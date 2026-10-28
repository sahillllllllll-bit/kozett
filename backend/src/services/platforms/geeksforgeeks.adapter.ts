import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const geeksforgeeksAdapter: PlatformAdapter = {
  platform: 'GeeksforGeeks',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'GeeksforGeeks',
      /^\/(?:user\/)?([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://www.geeksforgeeks.org/user/${username}/`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const url = `https://www.geeksforgeeks.org/user/${encodeURIComponent(username)}/`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        if (res.status === 404) {
          return { success: false, username, stats: {}, error: 'GeeksforGeeks account was not found.' }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'GeeksforGeeks temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const html = await res.text()

      if (html.includes('User does not exist') || html.includes('Page Not Found')) {
        return { success: false, username, stats: {}, error: 'GeeksforGeeks user not found.' }
      }

      // Check embedded JSON or markup values
      const solvedMatch =
        html.match(/"total_problems_solved":\s*(\d+)/i) ||
        html.match(/Problems Solved:?.*?(\d+)/is) ||
        html.match(/class="problem_solved_value">\s*(\d+)/i)

      const scoreMatch =
        html.match(/"score":\s*(\d+)/i) ||
        html.match(/Coding Score:?.*?(\d+)/is) ||
        html.match(/class="score_card_value">\s*(\d+)/i)

      const streakMatch = html.match(/"pod_solved_longest_streak":\s*(\d+)/i)
      const rankMatch = html.match(/"institute_rank":\s*"([^"]+)"/i)

      const solved = solvedMatch ? parseInt(solvedMatch[1], 10) : null
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null
      const streak = streakMatch ? parseInt(streakMatch[1], 10) : null
      const rank = rankMatch && rankMatch[1].trim() ? rankMatch[1].trim() : null

      return {
        success: true,
        username,
        stats: {
          solved,
          rating: score,
          rank,
          streak,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach GeeksforGeeks.',
        isTemporaryError: true,
      }
    }
  },
}
