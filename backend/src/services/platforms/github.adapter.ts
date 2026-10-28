import type { PlatformAdapter, PlatformAdapterResult, UrlValidationResult } from './types.js'
import { parseAndValidatePlatformUrl } from './url-helpers.js'

const TIMEOUT_MS = 6000

export const githubAdapter: PlatformAdapter = {
  platform: 'GitHub',

  validateUrl(input: string): UrlValidationResult {
    return parseAndValidatePlatformUrl(
      input,
      'GitHub',
      /^\/([a-zA-Z0-9_.-]+)\/?$/i,
      (username) => `https://github.com/${username}`,
    )
  },

  async fetchStats(username: string): Promise<PlatformAdapterResult> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Kozett-Platform',
        Accept: 'application/vnd.github+json',
      }
      if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
      }

      const userUrl = `https://api.github.com/users/${encodeURIComponent(username)}`
      const userRes = await fetch(userUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })

      if (!userRes.ok) {
        if (userRes.status === 404) {
          return { success: false, username, stats: {}, error: 'GitHub account was not found.' }
        }
        if (userRes.status === 403 || userRes.status === 429) {
          return {
            success: false,
            username,
            stats: {},
            error: 'GitHub rate limit exceeded. Please try again later.',
            isTemporaryError: true,
          }
        }
        return {
          success: false,
          username,
          stats: {},
          error: 'GitHub API temporarily unavailable.',
          isTemporaryError: true,
        }
      }

      const userData = (await userRes.json()) as {
        login: string
        public_repos?: number
        followers?: number
        following?: number
        avatar_url?: string
      }

      let totalStars = 0
      const languages = new Set<string>()

      try {
        const reposUrl = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=updated`
        const reposRes = await fetch(reposUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
        if (reposRes.ok) {
          const reposData = (await reposRes.json()) as Array<{
            stargazers_count?: number
            language?: string | null
          }>
          if (Array.isArray(reposData)) {
            for (const repo of reposData) {
              totalStars += repo.stargazers_count ?? 0
              if (repo.language) languages.add(repo.language)
            }
          }
        }
      } catch {
        // Repo details optional if request times out
      }

      return {
        success: true,
        username: userData.login,
        stats: {
          publicRepos: userData.public_repos ?? 0,
          followers: userData.followers ?? 0,
          following: userData.following ?? 0,
          totalStars,
          topLanguages: [...languages].slice(0, 5),
          avatar: userData.avatar_url ?? null,
        },
      }
    } catch (err) {
      return {
        success: false,
        username,
        stats: {},
        error: err instanceof Error ? err.message : 'Failed to reach GitHub.',
        isTemporaryError: true,
      }
    }
  },
}
