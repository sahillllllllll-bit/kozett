import { Schema, model, Types } from 'mongoose'
import type { KdrComponent, KdrRank } from '../utils/developer-rating.js'

export interface IDeveloperRating {
  userId: Types.ObjectId
  dataStatus: 'calculated' | 'demo'
  score: number | null
  rank: KdrRank | null
  components: KdrComponent[]
  dataCoverage: number
  isProvisional: boolean
  algorithmVersion: string
  calculatedAt: Date
  sourceVersion: string
  snapshotHash: string
}

const componentSchema = new Schema<KdrComponent>(
  {
    key: { type: String, required: true, enum: ['problemSolving', 'consistency', 'openSource', 'projects', 'verifiedSkills'] },
    label: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 1 },
    score: { type: Number, min: 0, max: 100, default: null },
    available: { type: Boolean, required: true },
  },
  { _id: false },
)

const developerRatingSchema = new Schema<IDeveloperRating>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    dataStatus: { type: String, enum: ['calculated', 'demo'], required: true, default: 'calculated' },
    score: { type: Number, min: 0, max: 100, default: null },
    rank: { type: String, enum: ['Silver', 'Gold', 'Platinum'], default: null },
    components: { type: [componentSchema], required: true },
    dataCoverage: { type: Number, required: true, min: 0, max: 1 },
    isProvisional: { type: Boolean, required: true },
    algorithmVersion: { type: String, required: true },
    calculatedAt: { type: Date, required: true },
    sourceVersion: { type: String, required: true },
    snapshotHash: { type: String, required: true },
  },
  { timestamps: true },
)

export const DeveloperRating = model<IDeveloperRating>('DeveloperRating', developerRatingSchema)
