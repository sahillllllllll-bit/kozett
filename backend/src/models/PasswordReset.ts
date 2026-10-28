import { Schema, model, Types } from 'mongoose'

export type PasswordResetScope = 'user' | 'admin'

export interface IPasswordReset {
  user: Types.ObjectId
  scope: PasswordResetScope
  otpHash: string
  otpExpiresAt: Date
  failedAttempts: number
  resendCount: number
  verifiedAt: Date | null
  resetTokenHash: string | null
  resetExpiresAt: Date | null
  consumedAt: Date | null
  cleanupAt: Date
  createdAt?: Date
  updatedAt?: Date
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scope: { type: String, enum: ['user', 'admin'], required: true },
    otpHash: { type: String, required: true, select: false },
    otpExpiresAt: { type: Date, required: true },
    failedAttempts: { type: Number, min: 0, required: true, default: 0 },
    resendCount: { type: Number, min: 0, required: true, default: 0 },
    verifiedAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null, select: false },
    resetExpiresAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    cleanupAt: { type: Date, required: true },
  },
  { timestamps: true },
)

passwordResetSchema.index({ user: 1, scope: 1 }, { unique: true })
passwordResetSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 })

export const PasswordReset = model<IPasswordReset>('PasswordReset', passwordResetSchema)
