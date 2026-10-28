import { Schema, model, Types } from 'mongoose'

export interface IFeedLike {
  user: Types.ObjectId
  post: Types.ObjectId
  createdAt?: Date
}

const feedLikeSchema = new Schema<IFeedLike>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

feedLikeSchema.index({ user: 1, post: 1 }, { unique: true })
feedLikeSchema.index({ post: 1, createdAt: -1 })

export const FeedLike = model<IFeedLike>('FeedLike', feedLikeSchema)
