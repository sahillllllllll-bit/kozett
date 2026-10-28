import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const codechefAdapter: PlatformAdapter = {
  platform: 'CodeChef',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'CodeChef',
      /^\/(?:users\/)?([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://www.codechef.com/users/${username}`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const url = `https://www.codechef.com/users/${encodeURIComponent(username)}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        if (res.status === 404) {
          return { success: false, username, stats: {}, error: 'CodeChef account was not found.' }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'CodeChef temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const html = await res.text()

      // Check if user exists on the page
      if (html.includes('Could not find user') || html.includes('Page Not Found')) {
        return { success: false, username, stats: {}, error: 'CodeChef user not found.' }
      }

      const ratingMatch = html.match(/class="rating-number">\s*(\d+)\s*<\/div>/i)
      const highestMatch = html.match(/Highest Rating\s*(\d+)/i)
      const starCount = (html.match(/&#9733;/g) || []).length
      const solvedMatch =
        html.match(/Fully Solved\s*\((\d+)\)/i) ||
        html.match(/Total Problems Solved:\s*(\d+)/i)
      const globalRankMatch = html.match(/<strong>\s*([^<]+)\s*<\/strong>\s*<\/a>\s*Global Rank/i)

      const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : null
      const highestRating = highestMatch ? parseInt(highestMatch[1], 10) : null
      const solved = solvedMatch ? parseInt(solvedMatch[1], 10) : null
      const rank = globalRankMatch ? globalRankMatch[1].trim() : null
      const stars = starCount > 0 ? starCount : null

      return {
        success: true,
        username,
        stats: {
          rating,
          highestRating,
          stars,
          solved,
          rank: rank && rank !== 'Inactive' ? `#${rank}` : rank,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach CodeChef.',
        isTemporaryError: true,
      }
    }
  },
}
