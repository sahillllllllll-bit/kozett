import { Schema, model, type Types } from 'mongoose'

export const PLATFORM_NAMES = [
  'LeetCode',
  'Codeforces',
  'CodeChef',
  'GeeksforGeeks',
  'HackerRank',
  'HackerEarth',
  'GitHub',
] as const

export type PlatformName = (typeof PLATFORM_NAMES)[number]

export interface IPlatformStats {
  solved?: number | null
  rating?: number | null
  highestRating?: number | null
  rank?: string | null
  ranking?: number | null
  stars?: number | null
  easySolved?: number | null
  mediumSolved?: number | null
  hardSolved?: number | null
  publicRepos?: number | null
  followers?: number | null
  following?: number | null
  totalStars?: number | null
  topLanguages?: string[]
  badges?: Array<{ name: string; stars?: number; solved?: number }>
  [key: string]: unknown
}

export interface IPlatformProfile {
  _id?: Types.ObjectId
  userId: Types.ObjectId
  platform: PlatformName
  username: string
  canonicalProfileUrl: string
  verificationStatus: 'unverified' | 'verified' | 'pending'
  stats: IPlatformStats
  syncStatus: 'never_synced' | 'syncing' | 'synced' | 'failed' | 'stale'
  lastSyncAttemptAt?: Date | null
  lastSuccessfulSyncAt?: Date | null
  syncError?: string | null
  createdAt?: Date
  updatedAt?: Date
}

const platformProfileSchema = new Schema<IPlatformProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, required: true, enum: PLATFORM_NAMES },
    username: { type: String, required: true, trim: true },
    canonicalProfileUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'verified', 'pending'],
      default: 'unverified',
    },
    stats: { type: Schema.Types.Mixed, default: {} },
    syncStatus: {
      type: String,
      enum: ['never_synced', 'syncing', 'synced', 'failed', 'stale'],
      default: 'never_synced',
    },
    lastSyncAttemptAt: { type: Date, default: null },
    lastSuccessfulSyncAt: { type: Date, default: null },
    syncError: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
)

// Ensure each platform can only be connected once per user
platformProfileSchema.index({ userId: 1, platform: 1 }, { unique: true })
platformProfileSchema.index({ platform: 1, username: 1 })

export const PlatformProfile = model<IPlatformProfile>('PlatformProfile', platformProfileSchema)
