import { Schema, model, Types } from 'mongoose'

export type EarnLedgerType = 'check_in_reward' | 'withdrawal_reservation'
export type EarnLedgerStatus = 'pending' | 'applied' | 'failed'

export interface IEarnLedger {
  user: Types.ObjectId
  operationKey: string
  type: EarnLedgerType
  status: EarnLedgerStatus
  amountPaise: number
  referenceId: Types.ObjectId
  dateKey?: string
  createdAt?: Date
  updatedAt?: Date
}

const earnLedgerSchema = new Schema<IEarnLedger>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    operationKey: { type: String, required: true, maxlength: 128 },
    type: { type: String, enum: ['check_in_reward', 'withdrawal_reservation'], required: true },
    status: { type: String, enum: ['pending', 'applied', 'failed'], required: true, default: 'pending' },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    dateKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true },
)

earnLedgerSchema.index({ user: 1, operationKey: 1 }, { unique: true })
earnLedgerSchema.index({ user: 1, createdAt: -1 })
earnLedgerSchema.index({ user: 1, type: 1, status: 1 })

export const EarnLedger = model<IEarnLedger>('EarnLedger', earnLedgerSchema)
