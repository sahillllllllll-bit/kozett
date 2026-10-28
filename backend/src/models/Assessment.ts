import { Schema, model } from 'mongoose'

export interface IAssessment {
  slug: string
  title: string
  technology: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  topics: string[]
  certificateAvailable: boolean
  category: string
  description: string
  introduction: string
  durationSeconds: number
  passingScore: number
  maxAttempts: number
  questionCount: number
  isActive: boolean
}

const assessmentSchema = new Schema<IAssessment>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    technology: { type: String, required: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    topics: { type: [String], required: true, default: [] },
    certificateAvailable: { type: Boolean, required: true, default: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    introduction: { type: String, required: true },
    durationSeconds: { type: Number, required: true, min: 60 },
    passingScore: { type: Number, required: true, min: 1, max: 100 },
    maxAttempts: { type: Number, required: true, min: 1 },
    questionCount: { type: Number, required: true, min: 1, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

export const Assessment = model<IAssessment>('Assessment', assessmentSchema)
