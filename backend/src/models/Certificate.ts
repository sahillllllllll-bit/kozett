import { Schema, model, Types } from 'mongoose'

export interface ICertificate {
  certificateId: string
  user: Types.ObjectId
  assessment: Types.ObjectId
  attempt: Types.ObjectId
  score: number
  issuedAt: Date
  revokedAt?: Date | null
  revokedBy?: Types.ObjectId | null
  revocationReason?: string | null
}

const certificateSchema = new Schema<ICertificate>(
  {
    certificateId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    attempt: { type: Schema.Types.ObjectId, ref: 'AssessmentAttempt', required: true, unique: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    issuedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revocationReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true },
)

certificateSchema.index({ user: 1, issuedAt: -1 })

export const Certificate = model<ICertificate>('Certificate', certificateSchema)
