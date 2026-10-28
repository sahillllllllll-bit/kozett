import { Schema, model, Types } from 'mongoose'

export interface IFeedReport {
  reporter: Types.ObjectId
  post: Types.ObjectId
  reason: string
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  resolutionReason: string | null
  resolvedAt: Date | null
  resolvedBy: Types.ObjectId | null
  createdAt?: Date
}

const feedReportSchema = new Schema<IFeedReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
    reason: { type: String, required: true, enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'] },
    details: { type: String, trim: true, maxlength: 1000, default: null },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], required: true, default: 'open', index: true },
    resolutionReason: { type: String, trim: true, maxlength: 500, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

feedReportSchema.index({ reporter: 1, post: 1 }, { unique: true })
feedReportSchema.index({ createdAt: -1 })

export const FeedReport = model<IFeedReport>('FeedReport', feedReportSchema)
