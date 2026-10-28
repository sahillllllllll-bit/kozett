import type { IPlatformStats, PlatformName } from '../../models/PlatformProfile.js'

export type { PlatformName, IPlatformStats }

export type UrlValidationResult =
  | {
      valid: true
      username: string
      canonicalUrl: string
    }
  | {
      valid: false
      error: string
    }

export type PlatformAdapterResult = {
  success: boolean
  username: string
  stats: IPlatformStats
  error?: string
  isTemporaryError?: boolean
}

export interface PlatformAdapter {
  readonly platform: PlatformName
  validateUrl(input: string): UrlValidationResult
  fetchStats(username: string): Promise<PlatformAdapterResult>
}
