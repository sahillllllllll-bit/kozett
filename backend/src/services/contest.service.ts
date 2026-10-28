import { Contest } from '../models/Contest.js'
import { ContestRatingHistory } from '../models/ContestRatingHistory.js'
import { User } from '../models/User.js'
import { extractCodeforcesHandle, normalizeCodeforcesContests, normalizeCodeforcesRatings } from '../utils/contests.js'
import { Types } from 'mongoose'

const CONTEST_CACHE_MS = 5 * 60 * 1000
const RATING_CACHE_MS = 10 * 60 * 1000
const PROVIDER_TIMEOUT_MS = 5000
const CODEFORCES_CONTESTS_URL = 'https://codeforces.com/api/contest.list?gym=false'

let contestsSyncAttemptAt = 0
let contestsSyncSuccessAt: Date | null = null
let contestsSyncInFlight: Promise<boolean> | null = null
const ratingSyncAttempts = new Map<string, number>()
const ratingSyncSuccesses = new Map<string, Date>()
const ratingSyncInFlight = new Map<string, Promise<boolean>>()

async function fetchProviderJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) })
  if (!response.ok) throw new Error('Contest provider request failed')
  return response.json() as Promise<unknown>
}

async function syncContests(): Promise<boolean> {
  try {
    const payload = await fetchProviderJson(CODEFORCES_CONTESTS_URL)
    if (!payload || typeof payload !== 'object' || (payload as { status?: unknown }).status !== 'OK') {
      console.error('Codeforces contest feed returned an unsuccessful response.')
      return false
    }
    const syncedAt = new Date()
    const normalized = normalizeCodeforcesContests(payload, syncedAt)
    if (normalized.length) {
      await Contest.bulkWrite(normalized.map((contest) => ({
        updateOne: {
          filter: { platform: 'Codeforces', externalContestId: contest.externalContestId },
          update: {
            $set: {
              ...contest,
              platform: 'Codeforces',
              lastSyncedAt: syncedAt,
            },
          },
          upsert: true,
        },
      })), { ordered: false })
    }
    contestsSyncSuccessAt = syncedAt
    return true
  } catch (error) {
    console.error('Codeforces contest feed synchronization failed:', error)
    return false
  }
}

export async function synchronizeContests(now = Date.now()): Promise<boolean> {
  if (contestsSyncInFlight) return contestsSyncInFlight
  if (now - contestsSyncAttemptAt < CONTEST_CACHE_MS) return false

  contestsSyncAttemptAt = now
  contestsSyncInFlight = syncContests()
  try {
    return await contestsSyncInFlight
  } finally {
    contestsSyncInFlight = null
  }
}

export async function contestSourceMetadata() {
  const latest = await Contest.findOne({ platform: 'Codeforces' }).sort({ lastSyncedAt: -1 }).select('lastSyncedAt').lean()
  const lastSyncedAt = contestsSyncSuccessAt ?? latest?.lastSyncedAt ?? null
  const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > CONTEST_CACHE_MS
  return {
    lastSyncedAt,
    sources: {
      codeforces: {
        status: !lastSyncedAt ? 'unavailable' : stale ? 'stale' : 'available',
        lastSyncedAt,
      },
    },
  }
}

async function syncRatingsForUser(userId: string, linkedUrl?: string): Promise<boolean> {
  const handle = extractCodeforcesHandle(linkedUrl)
  if (!handle) return false

  try {
    const payload = await fetchProviderJson(
      `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`,
    )
    if (!payload || typeof payload !== 'object' || (payload as { status?: unknown }).status !== 'OK') {
      console.error('Codeforces rating feed returned an unsuccessful response.')
      return false
    }
    const normalized = normalizeCodeforcesRatings(payload)
    const syncedAt = new Date()
    if (normalized.length) {
      await ContestRatingHistory.bulkWrite(normalized.map((rating) => ({
        updateOne: {
          filter: {
            user: new Types.ObjectId(userId),
            platform: 'Codeforces',
            externalContestId: rating.externalContestId,
          },
          update: {
            $set: {
              ...rating,
              user: new Types.ObjectId(userId),
              platform: 'Codeforces',
              lastSyncedAt: syncedAt,
            },
          },
          upsert: true,
        },
      })), { ordered: false })
    }
    ratingSyncSuccesses.set(userId, syncedAt)
    return true
  } catch (error) {
    console.error('Codeforces rating synchronization failed:', error)
    return false
  }
}

export async function synchronizeUserRatings(userId: string): Promise<boolean> {
  const existing = ratingSyncInFlight.get(userId)
  if (existing) return existing
  const now = Date.now()
  if (now - (ratingSyncAttempts.get(userId) ?? 0) < RATING_CACHE_MS) return false

  ratingSyncAttempts.set(userId, now)
  const user = await User.findById(userId).select('platforms').lean()
  const codeforces = user?.platforms?.find((platform) => platform.platform === 'Codeforces')
  const promise = syncRatingsForUser(userId, codeforces?.url)
  ratingSyncInFlight.set(userId, promise)
  try {
    return await promise
  } finally {
    ratingSyncInFlight.delete(userId)
  }
}

export function latestRatingSyncForUser(userId: string, storedAt: Date | null) {
  return ratingSyncSuccesses.get(userId) ?? storedAt
}

export function codeforcesContestProviderUrl() {
  return CODEFORCES_CONTESTS_URL
}
