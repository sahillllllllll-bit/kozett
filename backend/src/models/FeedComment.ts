import { Schema, model, Types } from 'mongoose'

export interface IFeedComment {
  post: Types.ObjectId
  author: Types.ObjectId
  text: string
  createdAt?: Date
  updatedAt?: Date
}

const feedCommentSchema = new Schema<IFeedComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'FeedPost', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
)

feedCommentSchema.index({ post: 1, createdAt: -1, _id: -1 })

export const FeedComment = model<IFeedComment>('FeedComment', feedCommentSchema)
