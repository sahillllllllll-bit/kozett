import { URL } from 'node:url'
import type { PlatformName, UrlValidationResult } from './types.js'

export const PLATFORM_DOMAINS: Record<PlatformName, string[]> = {
  LeetCode: ['leetcode.com'],
  Codeforces: ['codeforces.com'],
  CodeChef: ['codechef.com'],
  GeeksforGeeks: ['geeksforgeeks.org'],
  GitHub: ['github.com'],
  HackerRank: ['hackerrank.com'],
  HackerEarth: ['hackerearth.com'],
}

// Block SSRF / private IP / internal host attempts
export function isSafeExternalUrl(parsed: URL, allowedDomains: string[]): boolean {
  if (parsed.protocol !== 'https:') return false
  const hostname = parsed.hostname.toLowerCase()

  // Reject IP literals (IPv4 and IPv6)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false
  if (hostname.includes(':') || hostname.startsWith('[') || hostname.endsWith(']')) return false
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false

  return allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))
}

export function parseAndValidatePlatformUrl(
  input: string,
  platform: PlatformName,
  pathExtractRegex: RegExp,
  canonicalUrlBuilder: (username: string) => string,
): UrlValidationResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: 'URL or username is required.' }
  }

  // If the user entered a raw username or @handle instead of a full URL
  if (!/^https?:\/\//i.test(trimmed)) {
    const rawUsername = trimmed.replace(/^@/, '').trim()
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(rawUsername)) {
      return { valid: false, error: `Invalid ${platform} username format.` }
    }
    return {
      valid: true,
      username: rawUsername,
      canonicalUrl: canonicalUrlBuilder(rawUsername),
    }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, error: 'Invalid URL format.' }
  }

  if (!isSafeExternalUrl(parsed, PLATFORM_DOMAINS[platform])) {
    return { valid: false, error: `URL must be a valid HTTPS link to ${PLATFORM_DOMAINS[platform].join(', ')}.` }
  }

  const match = parsed.pathname.match(pathExtractRegex)
  if (!match || !match[1]) {
    return { valid: false, error: `Could not extract a valid ${platform} username from the provided profile URL.` }
  }

  const username = decodeURIComponent(match[1]).trim()
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(username)) {
    return { valid: false, error: `Extracted ${platform} username contains invalid characters.` }
  }

  return {
    valid: true,
    username,
    canonicalUrl: canonicalUrlBuilder(username),
  }
}
