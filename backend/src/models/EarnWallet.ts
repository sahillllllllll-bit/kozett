import { Schema, model, Types } from 'mongoose'

export interface IEarnWallet {
  user: Types.ObjectId
  balancePaise: number
  reservedPaise: number
  appliedOperationKeys: string[]
}

const earnWalletSchema = new Schema<IEarnWallet>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    balancePaise: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
    reservedPaise: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
    appliedOperationKeys: { type: [String], default: [] },
  },
  { timestamps: true },
)

earnWalletSchema.index({ user: 1 }, { unique: true })

export const EarnWallet = model<IEarnWallet>('EarnWallet', earnWalletSchema)
