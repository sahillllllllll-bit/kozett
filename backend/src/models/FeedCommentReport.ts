import { Schema, model, Types } from 'mongoose'

export interface IFeedCommentReport {
  reporter: Types.ObjectId
  comment: Types.ObjectId
  reason: 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other'
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  resolutionReason: string | null
  resolvedAt: Date | null
  resolvedBy: Types.ObjectId | null
  createdAt?: Date
}

const feedCommentReportSchema = new Schema<IFeedCommentReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: Schema.Types.ObjectId, ref: 'FeedComment', required: true },
    reason: { type: String, required: true, enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'] },
    details: { type: String, trim: true, maxlength: 1000, default: null },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], required: true, default: 'open', index: true },
    resolutionReason: { type: String, trim: true, maxlength: 500, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

feedCommentReportSchema.index({ reporter: 1, comment: 1 }, { unique: true })
feedCommentReportSchema.index({ createdAt: -1 })

export const FeedCommentReport = model<IFeedCommentReport>('FeedCommentReport', feedCommentReportSchema)
