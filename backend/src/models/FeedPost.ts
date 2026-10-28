import { Schema, model, Types } from 'mongoose'

export interface IFeedPost {
  author: Types.ObjectId
  title?: string | null
  text: string
  category?: string | null
  isOfficial?: boolean
  publicationStatus?: 'draft' | 'published' | 'archived'
  publishedAt?: Date | null
  link: string | null
  projectLink: { title: string; url: string } | null
  codeSnippet: { language: string; code: string } | null
  hashtags: string[]
  images: Array<{ _id?: Types.ObjectId; url: string; publicId: string; altText?: string | null }>
  likesCount: number
  commentsCount: number
  createdAt?: Date
  updatedAt?: Date
}

const feedPostSchema = new Schema<IFeedPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, maxlength: 120, default: null },
    text: { type: String, trim: true, maxlength: 5000, default: '' },
    category: { type: String, trim: true, maxlength: 80, default: null },
    isOfficial: { type: Boolean, default: false, index: true },
    publicationStatus: { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },
    publishedAt: { type: Date, default: null, index: true },
    link: { type: String, trim: true, maxlength: 2048, default: null },
    projectLink: {
      type: new Schema(
        {
          title: { type: String, required: true, trim: true, maxlength: 120 },
          url: { type: String, required: true, trim: true, maxlength: 2048 },
        },
        { _id: false },
      ),
      default: null,
    },
    codeSnippet: {
      type: new Schema(
        {
          language: { type: String, required: true, trim: true, maxlength: 50 },
          code: { type: String, required: true, maxlength: 10000 },
        },
        { _id: false },
      ),
      default: null,
    },
    hashtags: { type: [String], default: [], index: true },
    images: {
      type: [new Schema({
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        altText: { type: String, trim: true, maxlength: 250, default: null },
      })],
      default: [],
    },
    likesCount: { type: Number, min: 0, default: 0 },
    commentsCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
)

feedPostSchema.index({ createdAt: -1, _id: -1 })
feedPostSchema.index({ commentsCount: -1, likesCount: -1, createdAt: -1, _id: -1 })
feedPostSchema.index({ hashtags: 1, createdAt: -1 })
feedPostSchema.index({ createdAt: -1, author: 1, hashtags: 1 })
feedPostSchema.index({ publicationStatus: 1, createdAt: -1, _id: -1 })

export const FeedPost = model<IFeedPost>('FeedPost', feedPostSchema)
