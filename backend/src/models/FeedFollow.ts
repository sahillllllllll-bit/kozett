import { Schema, model, Types } from 'mongoose'

export interface IFeedFollow {
  follower: Types.ObjectId
  following: Types.ObjectId
  createdAt?: Date
}

const feedFollowSchema = new Schema<IFeedFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

feedFollowSchema.index({ follower: 1, following: 1 }, { unique: true })
feedFollowSchema.index({ follower: 1, createdAt: -1 })
feedFollowSchema.index({ following: 1, createdAt: -1 })

export const FeedFollow = model<IFeedFollow>('FeedFollow', feedFollowSchema)
