import { Schema, model, Types } from 'mongoose'
import type { ContestPlatform } from './Contest.js'

export interface IContestRatingHistory {
  user: Types.ObjectId
  platform: ContestPlatform
  externalContestId: string
  contestName: string
  rank: number
  oldRating: number
  newRating: number
  ratingUpdateTime: Date
  source: string
  lastSyncedAt: Date
  createdAt?: Date
  updatedAt?: Date
}

const contestRatingHistorySchema = new Schema<IContestRatingHistory>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, required: true, enum: ['Codeforces'] },
    externalContestId: { type: String, required: true, trim: true, maxlength: 32 },
    contestName: { type: String, required: true, trim: true, maxlength: 200 },
    rank: { type: Number, required: true, min: 1 },
    oldRating: { type: Number, required: true },
    newRating: { type: Number, required: true },
    ratingUpdateTime: { type: Date, required: true },
    source: { type: String, required: true, enum: ['codeforces-api'] },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true },
)

contestRatingHistorySchema.index({ user: 1, platform: 1, externalContestId: 1 }, { unique: true })
contestRatingHistorySchema.index({ user: 1, platform: 1, ratingUpdateTime: -1 })

export const ContestRatingHistory = model<IContestRatingHistory>(
  'ContestRatingHistory',
  contestRatingHistorySchema,
)
