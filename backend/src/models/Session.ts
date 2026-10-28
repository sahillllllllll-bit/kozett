import { Schema, model, type Types } from 'mongoose'

export interface ISession {
  user: Types.ObjectId
  tokenHash: string
  createdAt?: Date
  expiresAt: Date
  revokedAt?: Date | null
  lastUsedAt?: Date | null
}

const sessionSchema = new Schema<ISession>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
sessionSchema.index({ lastUsedAt: -1, user: 1 })

export const Session = model<ISession>('Session', sessionSchema)
