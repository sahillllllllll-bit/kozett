import type { NextFunction, Request, Response } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { AppError } from '../middleware/error.middleware.js'
import { FeedBookmark } from '../models/FeedBookmark.js'
import { FeedComment } from '../models/FeedComment.js'
import { FeedCommentReport } from '../models/FeedCommentReport.js'
import { FeedLike } from '../models/FeedLike.js'
import { FeedPost } from '../models/FeedPost.js'
import { FeedReport } from '../models/FeedReport.js'
import { deleteCloudinaryImage, uploadImage } from '../services/cloudinary.service.js'
import { writeAdminAudit } from '../services/admin-audit.service.js'
import {
  adminFeedPostFieldsSchema,
  adminFeedPostStatuses,
  adminFeedPostUpdateSchema,
  canTransitionFeedPostStatus,
  collectFeedPostHashtags,
  hasFeedPostContent,
  type AdminFeedPostStatus,
} from '../utils/feed-content.js'
import { escapeSearchRegex } from '../utils/feed.js'

const listPostsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.union([z.literal('all'), z.enum(adminFeedPostStatuses)]).default('all'),
  search: z.string().trim().max(100).default(''),
}).strict()

const postStatusSchema = z.object({
  status: z.enum(adminFeedPostStatuses),
}).strict()

type AdminFeedPostRecord = {
  _id: Types.ObjectId
  title?: string | null
  text: string
  category?: string | null
  hashtags: string[]
  publicationStatus?: AdminFeedPostStatus
  publishedAt?: Date | null
  link: string | null
  projectLink: { title: string; url: string } | null
  codeSnippet: { language: string; code: string } | null
  images: Array<{ _id?: Types.ObjectId; url: string; publicId: string; altText?: string | null }>
  likesCount: number
  commentsCount: number
  createdAt?: Date
  updatedAt?: Date
}

function actor(req: Request) {
  const id = req.user?._id
  const role = req.user?.adminAccess?.role
  if (!id || !role) throw new AppError('Administrator access required.', 403)
  return { id: new Types.ObjectId(String(id)), role }
}

function routePostId(req: Request) {
  const postId = req.params.postId
  if (typeof postId !== 'string' || !Types.ObjectId.isValid(postId)) {
    throw new AppError('Feed post was not found.', 404)
  }
  return new Types.ObjectId(postId)
}

function serializeAdminPost(post: AdminFeedPostRecord) {
  return {
    id: String(post._id),
    title: post.title ?? '',
    text: post.text,
    category: post.category ?? '',
    hashtags: post.hashtags ?? [],
    status: post.publicationStatus ?? 'published',
    publishedAt: post.publishedAt ?? null,
    link: post.link,
    projectLink: post.projectLink,
    codeSnippet: post.codeSnippet,
    images: post.images.map(({ _id, url, altText }) => ({
      id: _id ? String(_id) : null,
      url,
      altText: altText ?? '',
    })),
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }
}

function searchFilter(search: string) {
  if (!search) return {}
  const regex = new RegExp(escapeSearchRegex(search), 'i')
  return {
    $or: [
      { title: regex },
      { text: regex },
      { category: regex },
      { hashtags: regex },
    ],
  }
}

async function removeImageIfUnreferenced(publicId: string) {
  if (await FeedPost.exists({ 'images.publicId': publicId })) return true
  return deleteCloudinaryImage(publicId)
}

export async function listAdminContentPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listPostsSchema.safeParse(req.query)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid post query.', 400)
    const { page, limit, status, search } = parsed.data
    const filter: Record<string, unknown> = { isOfficial: true, ...searchFilter(search) }
    if (status === 'all') {
      filter.publicationStatus = { $in: ['draft', 'published', 'archived'] }
    } else {
      filter.publicationStatus = status
    }
    const [posts, total] = await Promise.all([
      FeedPost.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      FeedPost.countDocuments(filter),
    ])
    return res.json({
      success: true,
      page,
      limit,
      total,
      posts: posts.map((post) => serializeAdminPost(post as unknown as AdminFeedPostRecord)),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminContentPost(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await FeedPost.findOne({ _id: routePostId(req), isOfficial: true }).lean()
    if (!post) throw new AppError('Feed post was not found.', 404)
    return res.json({ success: true, post: serializeAdminPost(post as unknown as AdminFeedPostRecord) })
  } catch (error) {
    return next(error)
  }
}

export async function createAdminContentPost(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = actor(req)
    const parsed = adminFeedPostFieldsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Feed post is invalid.', 400)
    if (parsed.data.status === 'published' && !hasFeedPostContent(parsed.data)) {
      throw new AppError('Add text, a title, a link, a project, or an image before publishing.', 400)
    }
    const publishedAt = parsed.data.status === 'published' ? new Date() : null
    const post = await FeedPost.create({
      author: admin.id,
      title: parsed.data.title || null,
      text: parsed.data.text,
      category: parsed.data.category || null,
      link: parsed.data.link ?? null,
      projectLink: parsed.data.projectLink ?? null,
      codeSnippet: parsed.data.codeSnippet ?? null,
      hashtags: collectFeedPostHashtags(parsed.data.text, parsed.data.hashtags),
      isOfficial: true,
      publicationStatus: parsed.data.status,
      publishedAt,
    })
    await writeAdminAudit({
      adminId: admin.id,
      adminRole: admin.role,
      action: parsed.data.status === 'published' ? 'content.feed_post.publish' : 'content.feed_post.create',
      targetType: 'feed_post',
      targetId: String(post._id),
      metadata: { status: parsed.data.status, category: parsed.data.category ?? '' },
    })
    return res.status(201).json({ success: true, post: serializeAdminPost(post as unknown as AdminFeedPostRecord) })
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminContentPost(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = actor(req)
    const parsed = adminFeedPostUpdateSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Provide valid feed post fields.', 400)
    const post = await FeedPost.findOne({ _id: routePostId(req), isOfficial: true })
    if (!post) throw new AppError('Feed post was not found.', 404)

    if (parsed.data.title !== undefined) post.title = parsed.data.title || null
    if (parsed.data.text !== undefined) post.text = parsed.data.text
    if (parsed.data.category !== undefined) post.category = parsed.data.category || null
    if (parsed.data.link !== undefined) post.link = parsed.data.link
    if (parsed.data.projectLink !== undefined) post.projectLink = parsed.data.projectLink
    if (parsed.data.codeSnippet !== undefined) post.codeSnippet = parsed.data.codeSnippet
    if (parsed.data.hashtags !== undefined || parsed.data.text !== undefined) {
      post.hashtags = collectFeedPostHashtags(post.text, parsed.data.hashtags ?? post.hashtags)
    }
    if (post.publicationStatus === 'published' && !hasFeedPostContent(post)) {
      throw new AppError('A published feed post must contain visible content.', 400)
    }
    await post.save()
    await writeAdminAudit({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'content.feed_post.update',
      targetType: 'feed_post',
      targetId: String(post._id),
      metadata: { status: post.publicationStatus ?? 'published' },
    })
    return res.json({ success: true, post: serializeAdminPost(post as unknown as AdminFeedPostRecord) })
  } catch (error) {
    return next(error)
  }
}

export async function setAdminContentPostStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = actor(req)
    const parsed = postStatusSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'A valid publication status is required.', 400)
    const post = await FeedPost.findOne({ _id: routePostId(req), isOfficial: true })
    if (!post) throw new AppError('Feed post was not found.', 404)
    const previousStatus = post.publicationStatus ?? 'published'
    if (!canTransitionFeedPostStatus(previousStatus, parsed.data.status)) {
      throw new AppError(`Cannot change a ${previousStatus} post to ${parsed.data.status}.`, 409)
    }
    if (parsed.data.status === 'published' && !hasFeedPostContent(post)) {
      throw new AppError('Add post content before publishing.', 400)
    }
    post.publicationStatus = parsed.data.status
    post.publishedAt = parsed.data.status === 'published' ? new Date() : null
    await post.save()
    await writeAdminAudit({
      adminId: admin.id,
      adminRole: admin.role,
      action: parsed.data.status === 'published' ? 'content.feed_post.publish' : `content.feed_post.${parsed.data.status}`,
      targetType: 'feed_post',
      targetId: String(post._id),
      metadata: { previousStatus, status: parsed.data.status },
    })
    return res.json({ success: true, post: serializeAdminPost(post as unknown as AdminFeedPostRecord) })
  } catch (error) {
    return next(error)
  }
}

export async function deleteAdminContentPost(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = actor(req)
    const postId = routePostId(req)
    const post = await FeedPost.findOne({ _id: postId, isOfficial: true })
    if (!post) throw new AppError('Feed post was not found.', 404)
    if (post.publicationStatus !== 'draft') throw new AppError('Only draft official posts can be permanently deleted. Archive published content instead.', 409)
    const [likes, comments, bookmarks, postReports, commentIds] = await Promise.all([
      FeedLike.countDocuments({ post: postId }),
      FeedComment.countDocuments({ post: postId }),
      FeedBookmark.countDocuments({ post: postId }),
      FeedReport.countDocuments({ post: postId }),
      FeedComment.find({ post: postId }).distinct('_id'),
    ])
    const commentReports = commentIds.length
      ? await FeedCommentReport.countDocuments({ comment: { $in: commentIds } })
      : 0
    if (likes || comments || bookmarks || postReports || commentReports) {
      throw new AppError('This draft has activity or reports and cannot be permanently deleted. Archive it instead.', 409)
    }
    const imagePublicIds = post.images.map(({ publicId }) => publicId)
    const deletion = await FeedPost.deleteOne({ _id: postId, isOfficial: true, publicationStatus: 'draft' })
    if (deletion.deletedCount !== 1) throw new AppError('This post changed while being deleted. Reload and try again.', 409)
    await writeAdminAudit({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'content.feed_post.delete',
      targetType: 'feed_post',
      targetId: String(postId),
      metadata: { removedImages: imagePublicIds.length },
    })
    const cleanupResults = await Promise.all(imagePublicIds.map(async (publicId) => {
      try {
        return await removeImageIfUnreferenced(publicId)
      } catch (error) {
        console.error('Official feed image cleanup failed:', error)
        return false
      }
    }))
    const cleanupPending = cleanupResults.some((result) => !result)
    return res.json({
      success: true,
      cleanupPending,
      message: cleanupPending ? 'Draft deleted. One or more unused images could not be confirmed as deleted.' : 'Draft deleted.',
    })
  } catch (error) {
    return next(error)
  }
}

export async function uploadAdminContentPostImage(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = actor(req)
    const post = await FeedPost.findOne({ _id: routePostId(req), isOfficial: true })
    if (!post) throw new AppError('Feed post was not found.', 404)
    if (!req.file) throw new AppError('Select an image to upload.', 400)
    if (post.images.length >= 6) throw new AppError('An official post can include at most six images.', 400)
    const altTextValue = req.get('X-Image-Alt-Text')
    const parsedAltText = z.string().trim().max(250).optional().safeParse(altTextValue || undefined)
    if (!parsedAltText.success) throw new AppError('Image alt text must be 250 characters or fewer.', 400)
    const image = await uploadImage(req.file.buffer, 'kozett/feed/official', [
      { width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
    ])
    try {
      post.images.push({ ...image, altText: parsedAltText.data ?? null })
      await post.save()
    } catch (error) {
      try {
        const cleaned = await deleteCloudinaryImage(image.publicId)
        if (!cleaned) console.error('Official feed image rollback was not confirmed.')
      } catch (cleanupError) {
        console.error('Official feed image rollback failed:', cleanupError)
      }
      throw error
    }
    await writeAdminAudit({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'content.feed_post.image_upload',
      targetType: 'feed_post',
      targetId: String(post._id),
      metadata: { imageCount: post.images.length },
    })
    return res.status(201).json({ success: true, post: serializeAdminPost(post as unknown as AdminFeedPostRecord) })
  } catch (error) {
    return next(error)
  }
}

export async function deleteAdminContentPostImage(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = actor(req)
    const imageId = req.params.imageId
    if (typeof imageId !== 'string' || !Types.ObjectId.isValid(imageId)) throw new AppError('Image was not found.', 404)
    const post = await FeedPost.findOne({ _id: routePostId(req), isOfficial: true })
    if (!post) throw new AppError('Feed post was not found.', 404)
    const image = post.images.find(({ _id }) => String(_id) === imageId)
    if (!image) throw new AppError('Image was not found.', 404)
    post.images = post.images.filter(({ _id }) => String(_id) !== imageId)
    await post.save()
    await writeAdminAudit({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'content.feed_post.image_remove',
      targetType: 'feed_post',
      targetId: String(post._id),
      metadata: { imageCount: post.images.length },
    })
    let cleanupPending = false
    try {
      const deleted = await removeImageIfUnreferenced(image.publicId)
      cleanupPending = !deleted
    } catch (error) {
      console.error('Official feed image cleanup failed:', error)
      cleanupPending = true
    }
    return res.json({
      success: true,
      cleanupPending,
      post: serializeAdminPost(post as unknown as AdminFeedPostRecord),
    })
  } catch (error) {
    return next(error)
  }
}
