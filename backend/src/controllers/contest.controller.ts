import type { Request, Response } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { Contest } from '../models/Contest.js'
import { ContestRatingHistory } from '../models/ContestRatingHistory.js'
import { UserContest } from '../models/UserContest.js'
import { AppError } from '../middleware/error.middleware.js'
import { contestSourceMetadata, latestRatingSyncForUser, synchronizeContests, synchronizeUserRatings } from '../services/contest.service.js'
import { buildContestMongoFilter, contestStatusAt } from '../utils/contests.js'

const knownPlatforms = ['Codeforces', 'CodeChef', 'LeetCode', 'GeeksforGeeks', 'HackerRank', 'HackerEarth', 'GitHub']
const participationSchema = z.object({
  status: z.enum(['planned', 'registered', 'participated', 'missed']),
  personalNote: z.string().trim().max(1000).nullable().optional(),
}).strict()

function authenticatedUserId(req: Request): Types.ObjectId {
  if (!req.user?._id) throw new AppError('Authentication required.', 401)
  try {
    return new Types.ObjectId(String(req.user._id))
  } catch {
    throw new AppError('Authentication required.', 401)
  }
}

function contestObjectId(req: Request): Types.ObjectId {
  const id = req.params.id
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError('Contest not found.', 404)
  }
  return new Types.ObjectId(id)
}

function queryString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new AppError(`${name} must be a single string value.`, 400)
  return value
}

function pageParameters(req: Request) {
  const pageText = queryString(req.query.page, 'page') ?? '1'
  const limitText = queryString(req.query.limit, 'limit') ?? '20'
  if (!/^\d+$/.test(pageText) || !/^\d+$/.test(limitText)) {
    throw new AppError('Page and limit must be positive integers.', 400)
  }
  const page = Number(pageText)
  const limit = Number(limitText)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new AppError('Page and limit must be positive integers.', 400)
  }
  return { page, limit: Math.min(limit, 100) }
}

function serializeContest(contest: {
  _id: unknown
  externalContestId: string
  title: string
  platform: string
  startTime: Date
  endTime: Date
  durationSeconds: number
  contestUrl: string
  registrationUrl: string | null
  source: string
  lastSyncedAt: Date
}) {
  return {
    id: String(contest._id),
    externalContestId: contest.externalContestId,
    title: contest.title,
    platform: contest.platform,
    startTime: contest.startTime,
    endTime: contest.endTime,
    durationSeconds: contest.durationSeconds,
    status: contestStatusAt(contest.startTime, contest.endTime),
    contestUrl: contest.contestUrl,
    registrationUrl: contest.registrationUrl,
    source: contest.source,
    lastSyncedAt: contest.lastSyncedAt,
  }
}

function serializeUserContest(record: {
  _id: unknown
  bookmarked: boolean
  participationStatus: string | null
  personalNote: string | null
}) {
  return {
    bookmarkId: String(record._id),
    participationStatus: record.participationStatus,
    personalNote: record.personalNote,
    bookmarked: record.bookmarked,
  }
}

export async function listContests(req: Request, res: Response) {
  const search = queryString(req.query.search, 'search')?.trim()
  const platform = queryString(req.query.platform, 'platform')
  const statusValue = queryString(req.query.status, 'status')
  const sort = queryString(req.query.sort, 'sort') ?? 'soonest'
  const { page, limit } = pageParameters(req)

  if (search && search.length > 100) throw new AppError('Search must be 100 characters or fewer.', 400)
  if (platform && platform !== 'all' && !knownPlatforms.includes(platform)) {
    throw new AppError('Unsupported platform filter.', 400)
  }
  if (statusValue && statusValue !== 'all' && !['upcoming', 'ongoing', 'finished'].includes(statusValue)) {
    throw new AppError('Status must be upcoming, ongoing, or finished.', 400)
  }
  if (!['soonest', 'latest', 'title'].includes(sort)) {
    throw new AppError('Sort must be soonest, latest, or title.', 400)
  }

  await synchronizeContests()
  const filter = buildContestMongoFilter({
    search: search || undefined,
    platform: platform && platform !== 'all' ? platform : undefined,
    status: statusValue && statusValue !== 'all' ? statusValue as 'upcoming' | 'ongoing' | 'finished' : undefined,
  })
  const sortOrder = sort === 'latest' ? '-startTime' : sort === 'title' ? 'title' : 'startTime'
  const [records, total, metadata] = await Promise.all([
    Contest.find(filter).sort(sortOrder).skip((page - 1) * limit).limit(limit).lean(),
    Contest.countDocuments(filter),
    contestSourceMetadata(),
  ])

  return res.json({
    success: true,
    contests: records.map(serializeContest),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    lastSyncedAt: metadata.lastSyncedAt,
    sources: metadata.sources,
  })
}

export async function getContest(req: Request, res: Response) {
  const contest = await Contest.findById(contestObjectId(req)).lean()
  if (!contest) throw new AppError('Contest not found.', 404)
  return res.json({ success: true, contest: serializeContest(contest) })
}

export async function listMyContests(req: Request, res: Response) {
  const user = authenticatedUserId(req)
  const records = await UserContest.find({
    user,
    $or: [{ bookmarked: true }, { participationStatus: { $ne: null } }],
  }).sort({ updatedAt: -1 }).lean()
  const contests = await Contest.find({ _id: { $in: records.map((record) => record.contest) } }).lean()
  const byId = new Map(contests.map((contest) => [String(contest._id), contest]))
  return res.json({
    success: true,
    contests: records.flatMap((record) => {
      const contest = byId.get(String(record.contest))
      return contest ? [{ ...serializeContest(contest), ...serializeUserContest(record) }] : []
    }),
  })
}

export async function saveContestBookmark(req: Request, res: Response) {
  const user = authenticatedUserId(req)
  const contest = await Contest.findById(contestObjectId(req)).select('_id').lean()
  if (!contest) throw new AppError('Contest not found.', 404)
  const record = await UserContest.findOneAndUpdate(
    { user, contest: contest._id },
    { $set: { bookmarked: true } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  )
  return res.json({ success: true, saved: true, userContest: serializeUserContest(record) })
}

export async function removeContestBookmark(req: Request, res: Response) {
  const user = authenticatedUserId(req)
  const contest = await Contest.findById(contestObjectId(req)).select('_id').lean()
  if (!contest) throw new AppError('Contest not found.', 404)
  const record = await UserContest.findOne({ user, contest: contest._id })
  if (!record) return res.json({ success: true, saved: false })
  if (record.participationStatus !== null) {
    record.bookmarked = false
    await record.save()
    return res.json({ success: true, saved: false, userContest: serializeUserContest(record) })
  }
  await record.deleteOne()
  return res.json({ success: true, saved: false })
}

export async function updateContestParticipation(req: Request, res: Response) {
  const user = authenticatedUserId(req)
  const parsed = participationSchema.safeParse(req.body)
  if (!parsed.success) throw new AppError('Provide a valid status and an optional note of at most 1000 characters.', 400)
  const contest = await Contest.findById(contestObjectId(req)).select('_id').lean()
  if (!contest) throw new AppError('Contest not found.', 404)
  const update: Record<string, unknown> = { participationStatus: parsed.data.status }
  if (parsed.data.personalNote !== undefined) update.personalNote = parsed.data.personalNote || null
  const record = await UserContest.findOneAndUpdate(
    { user, contest: contest._id },
    { $set: update },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  )
  return res.json({ success: true, userContest: serializeUserContest(record) })
}

export async function getContestRatings(req: Request, res: Response) {
  const user = authenticatedUserId(req)
  const requestedPlatform = queryString(req.query.platform, 'platform')
  if (requestedPlatform && !knownPlatforms.includes(requestedPlatform)) {
    throw new AppError('Unsupported platform filter.', 400)
  }
  if (!requestedPlatform || requestedPlatform === 'Codeforces') {
    await synchronizeUserRatings(String(user))
  }
  const platform = requestedPlatform ?? 'Codeforces'
  const records = platform === 'Codeforces'
    ? await ContestRatingHistory.find({ user, platform }).sort({ ratingUpdateTime: -1 }).lean()
    : []
  const storedAt = records.reduce<Date | null>((latest, record) => {
    return !latest || record.lastSyncedAt > latest ? record.lastSyncedAt : latest
  }, null)
  return res.json({
    success: true,
    ratings: records.map((record) => ({
      externalContestId: record.externalContestId,
      contestName: record.contestName,
      rank: record.rank,
      oldRating: record.oldRating,
      newRating: record.newRating,
      ratingChange: record.newRating - record.oldRating,
      ratingUpdateTime: record.ratingUpdateTime,
      source: record.source,
    })),
    platform,
    lastSyncedAt: latestRatingSyncForUser(String(user), storedAt),
  })
}

export async function getContestPerformance(req: Request, res: Response) {
  const user = authenticatedUserId(req)
  await synchronizeUserRatings(String(user))
  const records = await ContestRatingHistory.find({ user, platform: 'Codeforces' })
    .sort({ ratingUpdateTime: 1 }).lean()
  const platforms = records.length
    ? [{
      platform: 'Codeforces',
      contestCount: records.length,
      currentRating: records[records.length - 1].newRating,
      highestRating: Math.max(...records.map((record) => record.newRating)),
      totalRatingChange: records[records.length - 1].newRating - records[0].oldRating,
      bestRank: Math.min(...records.map((record) => record.rank)),
    }]
    : []
  return res.json({
    success: true,
    platforms,
    combined: {
      contestCount: records.length,
      platformCount: platforms.length,
    },
    source: records.length ? 'codeforces-api' : 'none',
  })
}
