import { Schema, model, Types } from 'mongoose'

export type ParticipationStatus = 'planned' | 'registered' | 'participated' | 'missed'

export interface IUserContest {
  user: Types.ObjectId
  contest: Types.ObjectId
  bookmarked: boolean
  participationStatus: ParticipationStatus | null
  personalNote: string | null
  createdAt?: Date
  updatedAt?: Date
}

const userContestSchema = new Schema<IUserContest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contest: { type: Schema.Types.ObjectId, ref: 'Contest', required: true },
    bookmarked: { type: Boolean, default: false },
    participationStatus: {
      type: String,
      enum: ['planned', 'registered', 'participated', 'missed', null],
      default: null,
    },
    personalNote: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { timestamps: true },
)

userContestSchema.index({ user: 1, contest: 1 }, { unique: true })
userContestSchema.index({ user: 1, bookmarked: 1, updatedAt: -1 })
userContestSchema.index({ user: 1, participationStatus: 1 })

export const UserContest = model<IUserContest>('UserContest', userContestSchema)

export function isOwnedBy(record: Pick<IUserContest, 'user'>, userId: Types.ObjectId | string) {
  return String(record.user) === String(userId)
}
