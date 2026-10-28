import { Schema, model, Types } from 'mongoose'

export interface IEarnCheckIn {
  user: Types.ObjectId
  dateKey: string
  streakDay: number
  rewardPaise: number
  operationKey: string
}

const earnCheckInSchema = new Schema<IEarnCheckIn>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    streakDay: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    rewardPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    operationKey: { type: String, required: true, maxlength: 128 },
  },
  { timestamps: true },
)

earnCheckInSchema.index({ user:  1, dateKey: 1 }, { unique: true })
earnCheckInSchema.index({ user: 1, operationKey: 1 }, { unique: true })

export const EarnCheckIn = model<IEarnCheckIn>('EarnCheckIn', earnCheckInSchema)
