import { Schema, model, Types } from 'mongoose'

export interface IEarnCheckInState {
  user: Types.ObjectId
  lastCheckInDate: string
  currentStreak: number
  totalCheckIns: number
}

const earnCheckInStateSchema = new Schema<IEarnCheckInState>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastCheckInDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    currentStreak: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    totalCheckIns: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  },
  { timestamps: true },
)

earnCheckInStateSchema.index({ user: 1 }, { unique: true })

export const EarnCheckInState = model<IEarnCheckInState>('EarnCheckInState', earnCheckInStateSchema)
