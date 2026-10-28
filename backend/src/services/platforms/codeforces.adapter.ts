import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const codeforcesAdapter: PlatformAdapter = {
  platform: 'Codeforces',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'Codeforces',
      /^\/(?:profile\/)?([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://codeforces.com/profile/${username}`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const infoUrl = `https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`
      const infoRes = await fetch(infoUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) })

      if (!infoRes.ok) {
        if (infoRes.status === 400 || infoRes.status === 404) {
          return { success: false, username, stats: {}, error: 'Codeforces user not found.' }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'Codeforces API temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const infoData = (await infoRes.json()) as {
        status?: string
        comment?: string
        result?: Array<{
          handle: string
          rating?: number
          maxRating?: number
          rank?: string
          maxRank?: string
          avatar?: string
          contribution?: number
        }>
      }

      if (infoData.status !== 'OK' || !infoData.result?.length) {
        return {
          success: false,
          username,
          stats: {},
          error: infoData.comment || 'Codeforces user not found.',
        }
      }

      const user = infoData.result[0]

      // Fetch submission status to calculate verified solved problems count
      let solvedCount: number | null = null
      try {
        const statusUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(username)}&from=1&count=500`
        const statusRes = await fetch(statusUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) })
        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as {
            status?: string
            result?: Array<{
              verdict?: string
              problem?: { contestId?: number; index?: string }
            }>
          }
          if (statusData.status === 'OK' && Array.isArray(statusData.result)) {
            const uniqueSolved = new Set<string>()
            for (const sub of statusData.result) {
              if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index) {
                uniqueSolved.add(`${sub.problem.contestId}_${sub.problem.index}`)
              }
            }
            solvedCount = uniqueSolved.size
          }
        }
      } catch {
        // Solved count optional if status query times out
      }

      return {
        success: true,
        username: user.handle,
        stats: {
          rating: typeof user.rating === 'number' ? user.rating : null,
          highestRating: typeof user.maxRating === 'number' ? user.maxRating : null,
          rank: user.rank ?? null,
          solved: solvedCount,
          avatar: user.avatar ?? null,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach Codeforces.',
        isTemporaryError: true,
      }
    }
  },
}
