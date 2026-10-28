import { Schema, model, Types } from 'mongoose'

export type FeedNotificationType = 'like' | 'comment' | 'follow'

export interface IFeedNotification {
  recipient: Types.ObjectId
  actor: Types.ObjectId
  type: FeedNotificationType
  post: Types.ObjectId | null
  eventKey: string
  readAt: Date | null
  createdAt?: Date
}

const feedNotificationSchema = new Schema<IFeedNotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'comment', 'follow'], required: true },
    post: { type: Schema.Types.ObjectId, ref: 'FeedPost', default: null },
    eventKey: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

feedNotificationSchema.index({ recipient:  1, eventKey: 1 }, { unique: true })
feedNotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 })

export const FeedNotification = model<IFeedNotification>('FeedNotification', feedNotificationSchema)
