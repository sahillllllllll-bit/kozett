import { Schema, model, Types } from 'mongoose'

export interface IFeedBookmark {
  user: Types.ObjectId
  post: Types.ObjectId
  createdAt?: Date
}

const feedBookmarkSchema = new Schema<IFeedBookmark>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

feedBookmarkSchema.index({ user: 1, post: 1 }, { unique: true })
feedBookmarkSchema.index({ user: 1, createdAt: -1 })

export const FeedBookmark = model<IFeedBookmark>('FeedBookmark', feedBookmarkSchema)
