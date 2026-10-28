import type { NextFunction, Request, Response } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { deleteCloudinaryImage, uploadImage } from '../services/cloudinary.service.js'
import { FeedBookmark } from '../models/FeedBookmark.js'
import { FeedComment } from '../models/FeedComment.js'
import { FeedCommentReport } from '../models/FeedCommentReport.js'
import { FeedFollow } from '../models/FeedFollow.js'
import { FeedLike } from '../models/FeedLike.js'
import { FeedNotification } from '../models/FeedNotification.js'
import { FeedPost } from '../models/FeedPost.js'
import { FeedReport } from '../models/FeedReport.js'
import { User } from '../models/User.js'
import { AppError } from '../middleware/error.middleware.js'
import {
  escapeSearchRegex,
  extractFeedHashtags,
  buildFeedPostSearchConditions,
  feedCodeSnippetSchema,
  feedProjectLinkSchema,
  feedReportInputSchema,
  withPublishedFeedPostFilter,
} from '../utils/feed.js'

const postFields = z.object({
  text: z.string().trim().max(5000),
  link: z.string().trim().max(2048).url().nullable().optional(),
  projectLink: feedProjectLinkSchema.nullable().optional(),
  codeSnippet: feedCodeSnippetSchema.nullable().optional(),
}).strict()
const postInput = postFields.extend({ text: z.string().trim().max(5000).default('') })
  .refine((value) => Boolean(value.text || value.link || value.projectLink || value.codeSnippet), {
    message: 'A post needs text, a link, a project link, or a code snippet.',
  })
const commentInput = z.object({ text: z.string().trim().min(1).max(2000) }).strict()
type PublicUser = { _id: unknown; name: string; username?: string; avatar?: string | null; visibility?: { publicProfile?: boolean; avatar?: boolean } }
type PostRecord = {
  _id: unknown
  author: PublicUser | Types.ObjectId
  title?: string | null
  text: string
  category?: string | null
  isOfficial?: boolean
  link: string | null
  projectLink: { title: string; url: string } | null
  codeSnippet: { language: string; code: string } | null
  hashtags: string[]
  images: Array<{ _id?: unknown; url: string; publicId?: string; altText?: string | null }>
  likesCount: number
  commentsCount: number
  createdAt?: Date
  updatedAt?: Date
}

function userId(req: Request) {
  if (!req.user?._id || !Types.ObjectId.isValid(String(req.user._id))) throw new AppError('Authentication required.', 401)
  return new Types.ObjectId(String(req.user._id))
}

function objectId(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new AppError(`${label} not found.`, 404)
  return new Types.ObjectId(value)
}

function stringQuery(value: unknown, label: string) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new AppError(`${label} must be a single string value.`, 400)
  return value
}

function pageSize(req: Request) {
  const raw = stringQuery(req.query.limit, 'limit') ?? '20'
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) {
    throw new AppError('limit must be a positive integer.', 400)
  }
  return Math.min(Number(raw), 50)
}

function parseCursor(value: unknown): { createdAt: Date; id: Types.ObjectId; commentsCount?: number; likesCount?: number } | undefined {
  const cursor = stringQuery(value, 'cursor')
  if (!cursor) return undefined
  if (cursor.length > 512) throw new AppError('cursor is invalid.', 400)
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      date?: string
      id?: string
      commentsCount?: number
      likesCount?: number
    }
    const createdAt = new Date(parsed.date ?? '')
    if (!Types.ObjectId.isValid(parsed.id ?? '') || Number.isNaN(createdAt.getTime())) throw new Error('invalid')
    if (parsed.commentsCount !== undefined && (!Number.isSafeInteger(parsed.commentsCount) || parsed.commentsCount < 0)) throw new Error('invalid')
    if (parsed.likesCount !== undefined && (!Number.isSafeInteger(parsed.likesCount) || parsed.likesCount < 0)) throw new Error('invalid')
    return { createdAt, id: new Types.ObjectId(parsed.id), commentsCount: parsed.commentsCount, likesCount: parsed.likesCount }
  } catch {
    throw new AppError('cursor is invalid.', 400)
  }
}

function encodeCursor(record: { createdAt?: Date; _id: unknown; commentsCount?: number; likesCount?: number }) {
  return Buffer.from(JSON.stringify({
    date: record.createdAt?.toISOString(),
    id: String(record._id),
    ...(record.commentsCount === undefined ? {} : { commentsCount: record.commentsCount }),
    ...(record.likesCount === undefined ? {} : { likesCount: record.likesCount }),
  })).toString('base64url')
}

function serializeUser(user: PublicUser | null | undefined, viewerId?: Types.ObjectId) {
  if (!user || (user.visibility?.publicProfile === false && String(user._id) !== String(viewerId ?? ''))) return null
  return { id: String(user._id), name: user.name, username: user.username ?? null, avatar: user.visibility?.avatar ? user.avatar ?? null : null }
}

function serializePost(record: PostRecord, viewerId: Types.ObjectId, liked = false, saved = false, following = false) {
  const author = record.author && '_id' in record.author ? record.author as PublicUser : null
  return {
    id: String(record._id),
    author: serializeUser(author, viewerId),
    title: record.title ?? null,
    text: record.text,
    category: record.category ?? null,
    isOfficial: record.isOfficial === true,
    link: record.link,
    projectLink: record.projectLink,
    codeSnippet: record.codeSnippet,
    hashtags: record.hashtags,
    images: record.images.map(({ _id, url, altText }) => ({ id: _id ? String(_id) : null, url, alt: altText ?? null })),
    likesCount: record.likesCount,
    commentsCount: record.commentsCount,
    likedByMe: liked,
    savedByMe: saved,
    following,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isAuthor: Boolean(author && String(author._id) === String(viewerId)),
  }
}

async function publicAuthorIds(viewerId: Types.ObjectId) {
  const users = await User.find({ $or: [{ 'visibility.publicProfile': true }, { _id: viewerId }] }).select('_id').lean()
  return users.map((user) => user._id)
}

async function serializePosts(records: PostRecord[], viewerId: Types.ObjectId) {
  if (records.length === 0) return []
  const ids = records.map((record) => record._id)
  const authors = records.map((record) => {
    const author = record.author && '_id' in record.author ? record.author as PublicUser : null
    return author?._id
  }).filter((id): id is NonNullable<typeof id> => id !== undefined)
  const [likes, bookmarks, follows] = await Promise.all([
    FeedLike.find({ user: viewerId, post: { $in: ids } }).select('post').lean(),
    FeedBookmark.find({ user: viewerId, post: { $in: ids } }).select('post').lean(),
    FeedFollow.find({ follower: viewerId, following: { $in: authors } }).select('following').lean(),
  ])
  const liked = new Set(likes.map((record) => String(record.post)))
  const saved = new Set(bookmarks.map((record) => String(record.post)))
  const following = new Set(follows.map((record) => String(record.following)))
  return records.map((record) => {
    const author = record.author && '_id' in record.author ? record.author as PublicUser : null
    return serializePost(record, viewerId, liked.has(String(record._id)), saved.has(String(record._id)), Boolean(author && following.has(String(author._id))))
  })
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { void handler(req, res, next).catch(next) }
}

export const trendingHashtags = asyncHandler(async (req, res) => {
  const limitText = stringQuery(req.query.limit, 'limit') ?? '10'
  if (!/^\d+$/.test(limitText) || !Number.isSafeInteger(Number(limitText)) || Number(limitText) < 1) {
    throw new AppError('limit must be a positive integer.', 400)
  }
  const limit = Math.min(Number(limitText), 20)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const publicUsers = await User.find({
    'visibility.publicProfile': true,
    demoSeedKey: { $exists: false },
    demoProfile: { $exists: false },
  }).select('_id').lean()
  const items = publicUsers.length === 0
    ? []
    : await FeedPost.aggregate<{ hashtag: string; postCount: number }>([
      {
        $match: withPublishedFeedPostFilter({
          author: { $in: publicUsers.map((user) => user._id) },
          createdAt: { $gte: since },
          hashtags: { $exists: true, $ne: [] },
        }),
      },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', postCount: { $sum: 1 } } },
      { $sort: { postCount: -1, _id: 1 } },
      { $limit: limit },
      { $project: { _id: 0, hashtag: '$_id', postCount: 1 } },
    ])
  res.json({ success: true, items, periodDays: 7, since })
})

export const getDeveloperSuggestions = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const limit = pageSize(req)
  const cursor = parseCursor(req.query.cursor)
  const follows = await FeedFollow.find({ follower: viewerId }).select('following').lean()
  const excludedIds = [...follows.map((follow) => follow.following), viewerId]
  const filter: Record<string, unknown> = {
    _id: { $nin: excludedIds },
    'visibility.publicProfile': true,
    username: { $type: 'string', $ne: '' },
    demoSeedKey: { $exists: false },
    demoProfile: { $exists: false },
  }
  if (cursor) {
    filter.$and = [
      { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }] },
    ]
  }
  const users = await User.find(filter).select('name username avatar visibility createdAt')
    .sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean()
  const hasMore = users.length > limit
  const page = users.slice(0, limit)
  const followerCounts = page.length === 0
    ? []
    : await FeedFollow.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { following: { $in: page.map((item) => item._id) } } },
      { $group: { _id: '$following', count: { $sum: 1 } } },
    ])
  const countByUser = new Map(followerCounts.map((item) => [String(item._id), item.count]))
  const items = page.map((item) => ({
    ...serializeUser(item as unknown as PublicUser, viewerId),
    followersCount: countByUser.get(String(item._id)) ?? 0,
    following: false,
  }))
  res.json({
    success: true,
    items,
    nextCursor: hasMore ? encodeCursor(users[limit - 1]!) : null,
  })
})

export const listPosts = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const mode = stringQuery(req.query.mode, 'mode') ?? 'latest'
  if (!['latest', 'following', 'trending'].includes(mode)) throw new AppError('mode must be latest, following, or trending.', 400)
  const limit = pageSize(req)
  const cursor = parseCursor(req.query.cursor)
  const authors = await publicAuthorIds(viewerId)
  let authorFilter: Types.ObjectId[] = authors
  if (mode === 'following') {
    const follows = await FeedFollow.find({ follower: viewerId }).select('following').lean()
    authorFilter = [...new Map([...follows.map((record) => record.following), viewerId].map((id) => [String(id), id])).values()]
    authorFilter = authorFilter.filter((id) => authors.some((allowed) => String(allowed) === String(id)))
  }
  const filter: Record<string, unknown> = { author: { $in: authorFilter } }
  if (cursor) {
    filter.$or = mode === 'trending' && cursor.commentsCount !== undefined && cursor.likesCount !== undefined
      ? [
        { commentsCount: { $lt: cursor.commentsCount } },
        { commentsCount: cursor.commentsCount, likesCount: { $lt: cursor.likesCount } },
        { commentsCount: cursor.commentsCount, likesCount: cursor.likesCount, createdAt: { $lt: cursor.createdAt } },
        { commentsCount: cursor.commentsCount, likesCount: cursor.likesCount, createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ]
      : [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }]
  }
  const sort: Record<string, 1 | -1> = mode === 'trending'
    ? { commentsCount: -1, likesCount: -1, createdAt: -1, _id: -1 }
    : { createdAt: -1, _id: -1 }
  const results = await FeedPost.find(withPublishedFeedPostFilter(filter)).sort(sort).limit(limit + 1)
    .populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  const hasMore = results.length > limit
  const records = results.slice(0, limit) as unknown as PostRecord[]
  res.json({ success: true, items: await serializePosts(records, viewerId), nextCursor: hasMore ? encodeCursor(records[records.length - 1]!) : null })
})

export const createPost = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const parsed = postInput.safeParse(req.body)
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Post is invalid.', 400)
  if (parsed.data.link) {
    const link = new URL(parsed.data.link)
    if (!['http:', 'https:'].includes(link.protocol)) throw new AppError('Only HTTP and HTTPS links are supported.', 400)
  }
  const post = await FeedPost.create({
    author: authorId,
    text: parsed.data.text,
    link: parsed.data.link ?? null,
    projectLink: parsed.data.projectLink ?? null,
    codeSnippet: parsed.data.codeSnippet ?? null,
    hashtags: extractFeedHashtags(parsed.data.text),
  })
  const record = await FeedPost.findById(post._id).populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  res.status(201).json({ success: true, post: serializePost(record as unknown as PostRecord, authorId) })
})

export const getPost = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const post = await FeedPost.findOne(withPublishedFeedPostFilter({ _id: objectId(req.params.postId, 'Post'), author: { $in: await publicAuthorIds(viewerId) } }))
    .populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  if (!post) throw new AppError('Post not found.', 404)
  res.json({ success: true, post: (await serializePosts([post as unknown as PostRecord], viewerId))[0] })
})

export const updatePost = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const parsed = postFields.partial().safeParse(req.body)
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError('Provide valid post fields to update.', 400)
  const current = await FeedPost.findOne({ _id: postId, author: viewerId, isOfficial: { $ne: true } })
  if (!current) throw new AppError('Post not found.', 404)
  const text = parsed.data.text ?? current.text
  const link = parsed.data.link === undefined ? current.link : parsed.data.link
  const projectLink = parsed.data.projectLink === undefined ? current.projectLink : parsed.data.projectLink
  const codeSnippet = parsed.data.codeSnippet === undefined ? current.codeSnippet : parsed.data.codeSnippet
  if (!text && !link && !projectLink && !codeSnippet && current.images.length === 0) {
    throw new AppError('A post needs text, a link, a project link, a code snippet, or an image.', 400)
  }
  if (link) {
    try {
      if (!['http:', 'https:'].includes(new URL(link).protocol)) throw new Error('bad protocol')
    } catch { throw new AppError('Only valid HTTP and HTTPS links are supported.', 400) }
  }
  if (parsed.data.text !== undefined) {
    current.text = text
    current.hashtags = extractFeedHashtags(text)
  }
  if (parsed.data.link !== undefined) current.link = link
  if (parsed.data.projectLink !== undefined) current.projectLink = projectLink
  if (parsed.data.codeSnippet !== undefined) current.codeSnippet = codeSnippet
  await current.save()
  const record = await FeedPost.findById(postId).populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  res.json({ success: true, post: serializePost(record as unknown as PostRecord, viewerId) })
})

export const deletePost = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const post = await FeedPost.findOneAndDelete({ _id: objectId(req.params.postId, 'Post'), author: authorId, isOfficial: { $ne: true } }).lean()
  if (!post) throw new AppError('Post not found.', 404)
  const publicIds = post.images.map((image) => image.publicId)
  await Promise.all([
    FeedLike.deleteMany({ post: post._id }),
    FeedComment.deleteMany({ post: post._id }),
    FeedBookmark.deleteMany({ post: post._id }),
    FeedNotification.deleteMany({ post: post._id }),
  ])
  for (const publicId of publicIds) {
    try {
      if (!await deleteCloudinaryImage(publicId)) console.error('Feed image cleanup was not confirmed.')
    } catch (error) {
      console.error('Feed image cleanup failed:', error)
    }
  }
  res.json({ success: true })
})

export const uploadPostImage = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const post = await FeedPost.findOne({ _id: postId, author: authorId, isOfficial: { $ne: true } })
  if (!post) throw new AppError('Post not found.', 404)
  if (!req.file) throw new AppError('Select an image to upload.', 400)
  if (post.images.length >= 6) throw new AppError('A post can include at most six images.', 400)
  let image: { url: string; publicId: string }
  try {
    image = await uploadImage(req.file.buffer, 'kozett/feed', [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }])
  } catch (error) {
    console.error('Feed image upload failed:', error)
    throw error
  }
  try {
    post.images.push(image)
    await post.save()
  } catch (error) {
    try {
      if (!await deleteCloudinaryImage(image.publicId)) console.error('Feed image rollback was not confirmed.')
    } catch (cleanupError) {
      console.error('Feed image rollback failed:', cleanupError)
    }
    throw error
  }
  const record = await FeedPost.findById(postId).populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  res.status(201).json({ success: true, post: serializePost(record as unknown as PostRecord, authorId) })
})

export const deletePostImage = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const imageId = objectId(req.params.imageId, 'Image')
  const post = await FeedPost.findOne({ _id: postId, author: authorId, isOfficial: { $ne: true } })
  if (!post) throw new AppError('Post not found.', 404)
  const image = post.images.find((entry) => String(entry._id) === String(imageId))
  if (!image) throw new AppError('Image not found.', 404)
  post.images = post.images.filter((entry) => String(entry._id) !== String(imageId))
  await post.save()
  try {
    if (!await deleteCloudinaryImage(image.publicId)) console.error('Feed image deletion was not confirmed.')
  } catch (error) {
    console.error('Feed image deletion failed:', error)
  }
  const record = await FeedPost.findById(postId).populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  res.json({ success: true, post: serializePost(record as unknown as PostRecord, authorId) })
})

export const likePost = asyncHandler(async (req, res) => {
  const actor = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const post = await FeedPost.findOne(withPublishedFeedPostFilter({ _id: postId, author: { $in: await publicAuthorIds(actor) } })).select('_id author')
  if (!post) throw new AppError('Post not found.', 404)
  try {
    const result = await FeedLike.updateOne({ user: actor, post: postId }, { $setOnInsert: { user: actor, post: postId } }, { upsert: true })
    if (result.upsertedCount) {
      const counter = await FeedPost.updateOne({ _id: postId }, { $inc: { likesCount: 1 } })
      if (!counter.matchedCount) {
        await FeedLike.deleteOne({ user: actor, post: postId })
        throw new AppError('Post not found.', 404)
      }
      await createNotification(post.author, actor, 'like', postId, `like:${postId}:${actor}`)
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
  }
  const likesCount = (await FeedPost.findById(postId).select('likesCount').lean())?.likesCount ?? 0
  res.json({ success: true, liked: true, likesCount })
})

export const unlikePost = asyncHandler(async (req, res) => {
  const actor = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const post = await FeedPost.findOne(withPublishedFeedPostFilter({ _id: postId, author: { $in: await publicAuthorIds(actor) } })).select('_id')
  if (!post) throw new AppError('Post not found.', 404)
  const removed = await FeedLike.findOneAndDelete({ user: actor, post: postId })
  if (removed) await FeedPost.updateOne({ _id: postId, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } })
  const likesCount = (await FeedPost.findById(postId).select('likesCount').lean())?.likesCount ?? 0
  res.json({ success: true, liked: false, likesCount })
})

export const listComments = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const post = await FeedPost.findOne(withPublishedFeedPostFilter({ _id: postId, author: { $in: await publicAuthorIds(viewerId) } })).select('_id')
  if (!post) throw new AppError('Post not found.', 404)
  const limit = pageSize(req)
  const cursor = parseCursor(req.query.cursor)
  const filter: Record<string, unknown> = { post: postId }
  if (cursor) filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }]
  const records = await FeedComment.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
    .populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  const hasMore = records.length > limit
  const items = records.slice(0, limit).map((comment) => ({
    id: String(comment._id),
    postId: String(comment.post),
    author: serializeUser(comment.author as unknown as PublicUser, viewerId),
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isAuthor: String((comment.author as unknown as PublicUser)?._id) === String(viewerId),
  }))
  res.json({ success: true, items, nextCursor: hasMore ? encodeCursor(records[limit - 1]!) : null })
})

export const createComment = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const parsed = commentInput.safeParse(req.body)
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Comment is invalid.', 400)
  const post = await FeedPost.findOne(withPublishedFeedPostFilter({ _id: postId, author: { $in: await publicAuthorIds(authorId) } })).select('_id author')
  if (!post) throw new AppError('Post not found.', 404)
  const comment = await FeedComment.create({ post: postId, author: authorId, text: parsed.data.text })
  const counter = await FeedPost.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } })
  if (!counter.matchedCount) {
    await FeedComment.deleteOne({ _id: comment._id })
    throw new AppError('Post not found.', 404)
  }
  await createNotification(post.author, authorId, 'comment', postId, `comment:${comment._id}`)
  const record = await FeedComment.findById(comment._id).populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  const author = serializeUser(record?.author as unknown as PublicUser, authorId)
  res.status(201).json({ success: true, comment: { id: String(comment._id), postId: String(postId), author, text: comment.text, createdAt: comment.createdAt, updatedAt: comment.updatedAt, isAuthor: true } })
})

export const updateComment = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const parsed = commentInput.safeParse(req.body)
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Comment is invalid.', 400)
  const comment = await FeedComment.findOneAndUpdate(
    { _id: objectId(req.params.commentId, 'Comment'), author: authorId },
    { $set: { text: parsed.data.text } },
    { new: true },
  ).populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  if (!comment) throw new AppError('Comment not found.', 404)
  res.json({ success: true, comment: { id: String(comment._id), postId: String(comment.post), author: serializeUser(comment.author as unknown as PublicUser, authorId), text: comment.text, createdAt: comment.createdAt, updatedAt: comment.updatedAt, isAuthor: true } })
})

export const deleteComment = asyncHandler(async (req, res) => {
  const authorId = userId(req)
  const comment = await FeedComment.findOneAndDelete({ _id: objectId(req.params.commentId, 'Comment'), author: authorId })
  if (!comment) throw new AppError('Comment not found.', 404)
  await FeedPost.updateOne({ _id: comment.post, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } })
  await FeedNotification.deleteOne({ eventKey: `comment:${comment._id}` })
  res.json({ success: true })
})

async function createNotification(recipient: Types.ObjectId, actor: Types.ObjectId, type: 'like' | 'comment' | 'follow', post: Types.ObjectId | null, eventKey: string) {
  if (String(recipient) === String(actor)) return
  await FeedNotification.updateOne(
    { recipient, eventKey },
    { $setOnInsert: { recipient, actor, type, post, eventKey, readAt: null } },
    { upsert: true },
  )
}

export const followUser = asyncHandler(async (req, res) => {
  const follower = userId(req)
  const following = objectId(req.params.userId, 'User')
  if (String(follower) === String(following)) throw new AppError('You cannot follow yourself.', 400)
  const target = await User.findOne({ _id: following, 'visibility.publicProfile': true }).select('_id')
  if (!target) throw new AppError('User not found.', 404)
  try {
    const result = await FeedFollow.updateOne({ follower, following }, { $setOnInsert: { follower, following } }, { upsert: true })
    if (result.upsertedCount) await createNotification(following, follower, 'follow', null, `follow:${follower}:${following}`)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
  }
  const [followersCount, followingCount] = await Promise.all([
    FeedFollow.countDocuments({ following }),
    FeedFollow.countDocuments({ follower: following }),
  ])
  res.json({ success: true, following: true, followersCount, followingCount })
})

export const unfollowUser = asyncHandler(async (req, res) => {
  const follower = userId(req)
  const following = objectId(req.params.userId, 'User')
  const target = await User.exists({ _id: following })
  if (!target) throw new AppError('User not found.', 404)
  await FeedFollow.deleteOne({ follower, following })
  const [followersCount, followingCount] = await Promise.all([
    FeedFollow.countDocuments({ following }),
    FeedFollow.countDocuments({ follower: following }),
  ])
  res.json({ success: true, following: false, followersCount, followingCount })
})

export const getFollowCounts = asyncHandler(async (req, res) => {
  const target = objectId(req.params.userId, 'User')
  if (!await User.exists({ _id: target, 'visibility.publicProfile': true })) throw new AppError('User not found.', 404)
  const [followersCount, followingCount, isFollowing] = await Promise.all([
    FeedFollow.countDocuments({ following: target }),
    FeedFollow.countDocuments({ follower: target }),
    FeedFollow.exists({ follower: userId(req), following: target }),
  ])
  res.json({ success: true, followersCount, followingCount, isFollowing: Boolean(isFollowing) })
})

export const savePost = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  if (!await FeedPost.exists(withPublishedFeedPostFilter({ _id: postId, author: { $in: await publicAuthorIds(viewerId) } }))) throw new AppError('Post not found.', 404)
  try {
    await FeedBookmark.updateOne({ user: viewerId, post: postId }, { $setOnInsert: { user: viewerId, post: postId } }, { upsert: true })
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
  }
  res.json({ success: true, saved: true })
})

export const unsavePost = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  await FeedBookmark.deleteOne({ user: viewerId, post: objectId(req.params.postId, 'Post') })
  res.json({ success: true, saved: false })
})

export const listSavedPosts = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const limit = pageSize(req)
  const cursor = parseCursor(req.query.cursor)
  const bookmarks = await FeedBookmark.find({ user: viewerId, ...(cursor ? { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }] } : {}) })
    .sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean()
  const hasMore = bookmarks.length > limit
  const page = bookmarks.slice(0, limit)
  const posts = await FeedPost.find(withPublishedFeedPostFilter({ _id: { $in: page.map((record) => record.post) }, author: { $in: await publicAuthorIds(viewerId) } }))
    .populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  const byId = new Map(posts.map((post) => [String(post._id), post as unknown as PostRecord]))
  const records = page.map((bookmark) => byId.get(String(bookmark.post))).filter((post): post is PostRecord => Boolean(post))
  res.json({ success: true, items: await serializePosts(records, viewerId), nextCursor: hasMore ? encodeCursor(page[page.length - 1]!) : null })
})

export const listNotifications = asyncHandler(async (req, res) => {
  const recipient = userId(req)
  const limit = pageSize(req)
  const unreadOnly = stringQuery(req.query.unreadOnly, 'unreadOnly')
  if (unreadOnly !== undefined && !['true', 'false'].includes(unreadOnly)) throw new AppError('unreadOnly must be true or false.', 400)
  const cursor = parseCursor(req.query.cursor)
  const filter: Record<string, unknown> = { recipient }
  if (unreadOnly === 'true') filter.readAt = null
  if (cursor) filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }]
  const records = await FeedNotification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
    .populate({ path: 'actor', select: 'name username avatar visibility' }).lean()
  const hasMore = records.length > limit
  const items = records.slice(0, limit).map((record) => ({
    id: String(record._id),
    type: record.type,
    actor: serializeUser(record.actor as unknown as PublicUser),
    postId: record.post ? String(record.post) : null,
    readAt: record.readAt,
    createdAt: record.createdAt,
  }))
  res.json({ success: true, items, unreadCount: await FeedNotification.countDocuments({ recipient, readAt: null }), nextCursor: hasMore ? encodeCursor(records[limit - 1]!) : null })
})

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await FeedNotification.findOneAndUpdate(
    { _id: objectId(req.params.notificationId, 'Notification'), recipient: userId(req) },
    { $set: { readAt: new Date() } },
    { new: true },
  )
  if (!notification) throw new AppError('Notification not found.', 404)
  res.json({ success: true, readAt: notification.readAt })
})

export const markNotificationUnread = asyncHandler(async (req, res) => {
  const notification = await FeedNotification.findOneAndUpdate(
    { _id: objectId(req.params.notificationId, 'Notification'), recipient: userId(req) },
    { $set: { readAt: null } },
    { new: true },
  )
  if (!notification) throw new AppError('Notification not found.', 404)
  res.json({ success: true, readAt: null })
})

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await FeedNotification.updateMany({ recipient: userId(req), readAt: null }, { $set: { readAt: new Date() } })
  res.json({ success: true, updatedCount: result.modifiedCount })
})

export const searchFeed = asyncHandler(async (req, res) => {
  const viewerId = userId(req)
  const query = stringQuery(req.query.q, 'q')?.trim() ?? ''
  if (query.length < 2 || query.length > 80) throw new AppError('q must contain between 2 and 80 characters.', 400)
  const type = stringQuery(req.query.type, 'type') ?? 'posts'
  if (!['posts', 'users'].includes(type)) throw new AppError('type must be posts or users.', 400)
  const limit = pageSize(req)
  const cursor = parseCursor(req.query.cursor)
  const regex = new RegExp(escapeSearchRegex(query), 'i')
  if (type === 'users') {
    const filter: Record<string, unknown> = {
      'visibility.publicProfile': true,
      $or: [{ name: regex }, { username: regex }],
      ...(cursor ? { _id: { $gt: cursor.id } } : {}),
    }
    const users = await User.find(filter).select('name username avatar visibility').sort({ _id: 1 }).limit(limit + 1).lean()
    const hasMore = users.length > limit
    const page = users.slice(0, limit)
    const followed = await FeedFollow.find({ follower: viewerId, following: { $in: page.map((user) => user._id) } }).select('following').lean()
    const following = new Set(followed.map((record) => String(record.following)))
    const items = page.map((item) => ({ ...serializeUser(item as unknown as PublicUser, viewerId), following: following.has(String(item._id)) }))
    return res.json({ success: true, items, nextCursor: hasMore ? Buffer.from(JSON.stringify({ date: new Date().toISOString(), id: String(users[limit - 1]!._id) })).toString('base64url') : null })
  }
  const filter: Record<string, unknown> = {
    author: { $in: await publicAuthorIds(viewerId) },
    $or: buildFeedPostSearchConditions(regex),
  }
  if (cursor) filter.$and = [
    { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }] },
    { $or: buildFeedPostSearchConditions(regex) },
  ]
  const records = await FeedPost.find(withPublishedFeedPostFilter(filter)).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
    .populate({ path: 'author', select: 'name username avatar visibility' }).lean()
  const hasMore = records.length > limit
  const page = records.slice(0, limit) as unknown as PostRecord[]
  res.json({ success: true, items: await serializePosts(page, viewerId), nextCursor: hasMore ? encodeCursor(page[page.length - 1]!) : null })
})

export const reportPost = asyncHandler(async (req, res) => {
  const reporter = userId(req)
  const postId = objectId(req.params.postId, 'Post')
  const parsed = feedReportInputSchema.safeParse(req.body)
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Report is invalid.', 400)
  if (!await FeedPost.exists(withPublishedFeedPostFilter({ _id: postId, author: { $in: await publicAuthorIds(reporter) } }))) throw new AppError('Post not found.', 404)
  try {
    await FeedReport.updateOne(
      { reporter, post: postId },
      { $setOnInsert: { reporter, post: postId, reason: parsed.data.reason, details: parsed.data.details ?? null } },
      { upsert: true },
    )
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
  }
  res.status(201).json({ success: true, reported: true })
})

export const reportComment = asyncHandler(async (req, res) => {
  const reporter = userId(req)
  const commentId = objectId(req.params.commentId, 'Comment')
  const parsed = feedReportInputSchema.safeParse(req.body)
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Report is invalid.', 400)
  const comment = await FeedComment.findById(commentId).select('post')
  if (!comment) throw new AppError('Comment not found.', 404)
  const visibleAuthors = await publicAuthorIds(reporter)
  if (!await FeedPost.exists(withPublishedFeedPostFilter({ _id: comment.post, author: { $in: visibleAuthors } }))) {
    throw new AppError('Comment not found.', 404)
  }
  try {
    await FeedCommentReport.updateOne(
      { reporter, comment: commentId },
      { $setOnInsert: { reporter, comment: commentId, reason: parsed.data.reason, details: parsed.data.details ?? null } },
      { upsert: true },
    )
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
  }
  res.status(201).json({ success: true, reported: true })
})
