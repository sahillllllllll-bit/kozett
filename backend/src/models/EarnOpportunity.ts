import { Schema, model } from 'mongoose'

export interface IEarnOpportunity {
  code: string
  title: string
  description: string
  type: 'daily_check_in' | 'paid'
  active: boolean
  configured: boolean
}

const earnOpportunitySchema = new Schema<IEarnOpportunity>(
  {
    code: { type: String, required: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    type: { type: String, enum: ['daily_check_in', 'paid'], required: true },
    active: { type: Boolean, required: true, default: false },
    configured: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
)

earnOpportunitySchema.index({ code: 1 }, { unique: true })
earnOpportunitySchema.index({ active: 1, configured: 1 })

export const EarnOpportunity = model<IEarnOpportunity>('EarnOpportunity', earnOpportunitySchema)
