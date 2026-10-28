import type { ContestStatus } from '../models/Contest.js'
import type { ParticipationStatus } from '../models/UserContest.js'

export interface NormalizedContest {
  externalContestId: string
  title: string
  startTime: Date
  endTime: Date
  durationSeconds: number
  status: ContestStatus
  contestUrl: string
  registrationUrl: string
  source: 'codeforces-api'
}

export interface NormalizedRating {
  externalContestId: string
  contestName: string
  rank: number
  oldRating: number
  newRating: number
  ratingUpdateTime: Date
  source: 'codeforces-api'
}

export function contestStatusAt(startTime: Date, endTime: Date, now = new Date()): ContestStatus {
  if (endTime.getTime() <= now.getTime()) return 'finished'
  if (startTime.getTime() <= now.getTime()) return 'ongoing'
  return 'upcoming'
}

export function normalizeCodeforcesContests(
  payload: unknown,
  now = new Date(),
): NormalizedContest[] {
  if (!payload || typeof payload !== 'object') return []
  const envelope = payload as { status?: unknown; result?: unknown }
  if (envelope.status !== 'OK' || !Array.isArray(envelope.result)) return []

  const lowerBound = now.getTime() - 30 * 24 * 60 * 60 * 1000
  const upperBound = now.getTime() + 365 * 24 * 60 * 60 * 1000
  const contests: NormalizedContest[] = []

  for (const item of envelope.result) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    const id = candidate.id
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
    const durationSeconds = candidate.durationSeconds
    const startTimeSeconds = candidate.startTimeSeconds

    if (
      !Number.isSafeInteger(id) ||
      (id as number) < 1 ||
      !name ||
      name.length > 200 ||
      !Number.isSafeInteger(durationSeconds) ||
      (durationSeconds as number) < 1 ||
      (durationSeconds as number) > 14 * 24 * 60 * 60 ||
      !Number.isSafeInteger(startTimeSeconds)
    ) {
      continue
    }

    const startTime = new Date((startTimeSeconds as number) * 1000)
    const endTime = new Date(startTime.getTime() + (durationSeconds as number) * 1000)
    if (
      !Number.isFinite(startTime.getTime()) ||
      startTime.getTime() < lowerBound ||
      startTime.getTime() > upperBound
    ) {
      continue
    }

    const externalContestId = String(id)
    contests.push({
      externalContestId,
      title: name,
      startTime,
      endTime,
      durationSeconds: durationSeconds as number,
      status: contestStatusAt(startTime, endTime, now),
      contestUrl: `https://codeforces.com/contest/${externalContestId}`,
      registrationUrl: `https://codeforces.com/contestRegistration/${externalContestId}`,
      source: 'codeforces-api',
    })
  }

  return contests
}

export function normalizeCodeforcesRatings(payload: unknown): NormalizedRating[] {
  if (!payload || typeof payload !== 'object') return []
  const envelope = payload as { status?: unknown; result?: unknown }
  if (envelope.status !== 'OK' || !Array.isArray(envelope.result)) return []

  return envelope.result.flatMap((item): NormalizedRating[] => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (
      !Number.isSafeInteger(candidate.contestId) ||
      (candidate.contestId as number) < 1 ||
      typeof candidate.contestName !== 'string' ||
      !candidate.contestName.trim() ||
      candidate.contestName.length > 200 ||
      !Number.isSafeInteger(candidate.rank) ||
      (candidate.rank as number) < 1 ||
      !Number.isSafeInteger(candidate.oldRating) ||
      !Number.isSafeInteger(candidate.newRating) ||
      !Number.isSafeInteger(candidate.ratingUpdateTimeSeconds)
    ) {
      return []
    }
    const ratingUpdateTime = new Date((candidate.ratingUpdateTimeSeconds as number) * 1000)
    if (!Number.isFinite(ratingUpdateTime.getTime())) return []
    return [{
      externalContestId: String(candidate.contestId),
      contestName: candidate.contestName.trim(),
      rank: candidate.rank as number,
      oldRating: candidate.oldRating as number,
      newRating: candidate.newRating as number,
      ratingUpdateTime,
      source: 'codeforces-api',
    }]
  })
}

export interface ContestFilterInput {
  search?: string
  platform?: string
  status?: ContestStatus
  now?: Date
}

export function buildContestMongoFilter(input: ContestFilterInput) {
  const filter: Record<string, unknown> = {}
  if (input.platform) filter.platform = input.platform
  if (input.search) filter.title = { $regex: escapeRegex(input.search), $options: 'i' }

  const now = input.now ?? new Date()
  const lowerBound = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const upperBound = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  if (input.status) {
    if (input.status === 'upcoming') filter.startTime = { $gt: now, $lte: upperBound }
    if (input.status === 'ongoing') {
      filter.startTime = { $gte: lowerBound, $lte: now }
      filter.endTime = { $gt: now }
    }
    if (input.status === 'finished') {
      filter.startTime = { $gte: lowerBound, $lte: upperBound }
      filter.endTime = { $lte: now }
    }
  } else {
    filter.startTime = { $gte: lowerBound, $lte: upperBound }
  }
  return filter
}

export function isVisibleContestRecord(record: {
  bookmarked: boolean
  participationStatus: ParticipationStatus | null
}) {
  return record.bookmarked || record.participationStatus !== null
}

export function extractCodeforcesHandle(profileUrl: string | undefined): string | null {
  if (!profileUrl) return null
  try {
    const url = new URL(profileUrl)
    if (
      !['codeforces.com', 'www.codeforces.com'].includes(url.hostname.toLowerCase()) ||
      url.protocol !== 'https:'
    ) {
      return null
    }
    const match = /^\/profile\/([A-Za-z0-9_.-]{1,64})\/?$/.exec(url.pathname)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
