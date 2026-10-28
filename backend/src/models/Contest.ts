import { Schema, model } from 'mongoose'

export const contestPlatforms = ['Codeforces'] as const
export type ContestPlatform = (typeof contestPlatforms)[number]
export type ContestStatus = 'upcoming' | 'ongoing' | 'finished'

export interface IContest {
  externalContestId: string
  title: string
  platform: ContestPlatform
  startTime: Date
  endTime: Date
  durationSeconds: number
  status: ContestStatus
  contestUrl: string
  registrationUrl: string | null
  source: string
  lastSyncedAt: Date
  createdAt?: Date
  updatedAt?: Date
}

const contestSchema = new Schema<IContest>(
  {
    externalContestId: { type: String, required: true, trim: true, maxlength: 32 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    platform: { type: String, required: true, enum: contestPlatforms },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationSeconds: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: ['upcoming', 'ongoing', 'finished'] },
    contestUrl: { type: String, required: true, maxlength: 2048 },
    registrationUrl: { type: String, default: null, maxlength: 2048 },
    source: { type: String, required: true, enum: ['codeforces-api'] },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true },
)

contestSchema.index({ platform: 1, externalContestId: 1 }, { unique: true })
contestSchema.index({ startTime: 1 })
contestSchema.index({ platform: 1, status: 1, startTime: 1 })

export const Contest = model<IContest>('Contest', contestSchema)
