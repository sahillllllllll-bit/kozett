import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const hackerearthAdapter: PlatformAdapter = {
  platform: 'HackerEarth',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'HackerEarth',
      /^\/@?([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://www.hackerearth.com/@${username}`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const url = `https://www.hackerearth.com/@${encodeURIComponent(username)}/`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        if (res.status === 404) {
          return { success: false, username, stats: {}, error: 'HackerEarth account was not found.' }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'HackerEarth temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const html = await res.text()

      if (html.includes('Page Not Found') || html.includes('User not found')) {
        return { success: false, username, stats: {}, error: 'HackerEarth user not found.' }
      }

      const solvedMatch =
        html.match(/"problems_solved":\s*(\d+)/i) ||
        html.match(/Problems Solved:?.*?(\d+)/is) ||
        html.match(/(\d+)\s*Problems Solved/i)

      const ratingMatch =
        html.match(/"rating":\s*(\d+)/i) ||
        html.match(/Rating:?.*?(\d+)/is)

      const pointsMatch = html.match(/"points":\s*(\d+)/i)

      const solved = solvedMatch ? parseInt(solvedMatch[1], 10) : null
      const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : pointsMatch ? parseInt(pointsMatch[1], 10) : null

      return {
        success: true,
        username,
        stats: {
          solved,
          rating,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach HackerEarth.',
        isTemporaryError: true,
      }
    }
  },
}
