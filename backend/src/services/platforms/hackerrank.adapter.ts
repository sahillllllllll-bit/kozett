import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const hackerrankAdapter: PlatformAdapter = {
  platform: 'HackerRank',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'HackerRank',
      /^\/(?:profile\/)?([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://www.hackerrank.com/profile/${username}`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      }

      const badgesUrl = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`
      const badgesRes = await fetch(badgesUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })

      if (!badgesRes.ok) {
        if (badgesRes.status === 404) {
          return { success: false, username, stats: {}, error: 'HackerRank account was not found.' }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'HackerRank temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const badgesData = (await badgesRes.json()) as {
        models?: Array<{
          badge_name?: string
          stars?: number
          solved?: number
        }>
        error?: string
      }

      if (badgesData.error) {
        return { success: false, username, stats: {}, error: badgesData.error }
      }

      const badgeList = Array.isArray(badgesData.models) ? badgesData.models : []
      let totalSolved = 0
      let maxStars = 0

      const badges = badgeList.map((b) => {
        const solved = b.solved ?? 0
        const stars = b.stars ?? 0
        totalSolved += solved
        if (stars > maxStars) maxStars = stars
        return {
          name: b.badge_name ?? 'Badge',
          stars,
          solved,
        }
      })

      // Fetch track scores & ranks where accessible
      let bestRank: string | null = null
      let totalScore = 0

      try {
        const scoresUrl = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/scores_elo`
        const scoresRes = await fetch(scoresUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
        if (scoresRes.ok) {
          const scoresData = (await scoresRes.json()) as Array<{
            name?: string
            practice?: { score?: number; rank?: number | string }
          }>
          if (Array.isArray(scoresData)) {
            for (const track of scoresData) {
              const s = track.practice?.score ?? 0
              totalScore += s
              const r = track.practice?.rank
              if (r && r !== 'N/A' && (!bestRank || (typeof r === 'number' && typeof bestRank === 'string'))) {
                bestRank = `#${r}`
              }
            }
          }
        }
      } catch {
        // Optional
      }

      return {
        success: true,
        username,
        stats: {
          solved: totalSolved > 0 ? totalSolved : null,
          stars: maxStars > 0 ? maxStars : null,
          badges,
          rating: totalScore > 0 ? totalScore : null,
          rank: bestRank,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach HackerRank.',
        isTemporaryError: true,
      }
    }
  },
}
