import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const leetcodeAdapter: PlatformAdapter = {
  platform: 'LeetCode',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'LeetCode',
      /^\/(?:u\/)?([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://leetcode.com/u/${username}/`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const query = `
        query userPlatformStats($username: String!) {
          matchedUser(username: $username) {
            username
            submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
              }
            }
            profile {
              ranking
              reputation
            }
          }
          userContestRanking(username: $username) {
            rating
            globalRanking
            badge {
              name
            }
          }
        }
      `

      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://leetcode.com',
        },
        body: JSON.stringify({ query, variables: { username } }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!res.ok) {
        if (res.status === 404) {
          return { success: false, username, stats: {}, error: 'LeetCode account was not found.' }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'LeetCode API temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const payload = (await res.json()) as {
        data?: {
          matchedUser?: {
            username: string
            submitStatsGlobal?: {
              acSubmissionNum?: Array<{ difficulty: string; count: number }>
            }
            profile?: {
              ranking?: number
            }
          } | null
          userContestRanking?: {
            rating?: number
            globalRanking?: number
            badge?: { name?: string } | null
          } | null
        }
        errors?: Array<{ message: string }>
      }

      const matchedUser = payload.data?.matchedUser
      if (!matchedUser) {
        return { success: false, username, stats: {}, error: 'LeetCode user not found.' }
      }

      const submissions = matchedUser.submitStatsGlobal?.acSubmissionNum ?? []
      const allSolved = submissions.find((s) => s.difficulty === 'All')?.count ?? 0
      const easySolved = submissions.find((s) => s.difficulty === 'Easy')?.count ?? 0
      const mediumSolved = submissions.find((s) => s.difficulty === 'Medium')?.count ?? 0
      const hardSolved = submissions.find((s) => s.difficulty === 'Hard')?.count ?? 0

      const contest = payload.data?.userContestRanking
      const rating = contest?.rating ? Math.round(contest.rating) : null
      const ranking = contest?.globalRanking ?? matchedUser.profile?.ranking ?? null
      const rank = contest?.badge?.name ?? (ranking ? `#${ranking.toLocaleString()}` : null)

      return {
        success: true,
        username: matchedUser.username,
        stats: {
          solved: allSolved,
          easySolved,
          mediumSolved,
          hardSolved,
          rating,
          ranking,
          rank,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach LeetCode.',
        isTemporaryError: true,
      }
    }
  },
}
