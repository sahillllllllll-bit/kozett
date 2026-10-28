import { Schema, model, Types } from 'mongoose'

export type EarnWithdrawalStatus = 'processing' | 'review_pending' | 'rejected'

export interface IEarnWithdrawal {
  user: Types.ObjectId
  idempotencyKey: string
  amountPaise: number
  payoutMethod: 'manual_review'
  status: EarnWithdrawalStatus
  createdAt?: Date
  updatedAt?: Date
}

const earnWithdrawalSchema = new Schema<IEarnWithdrawal>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true, maxlength: 128 },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    payoutMethod: { type: String, enum: ['manual_review'], required: true },
    status: { type: String, enum: ['processing', 'review_pending', 'rejected'], required: true, default: 'processing' },
  },
  { timestamps: true },
)

earnWithdrawalSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true })
earnWithdrawalSchema.index({ user: 1, createdAt: -1 })

export const EarnWithdrawal = model<IEarnWithdrawal>('EarnWithdrawal', earnWithdrawalSchema)
