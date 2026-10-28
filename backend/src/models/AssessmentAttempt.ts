import { Schema, model, Types } from 'mongoose'

export interface IAssessmentAttempt {
  user: Types.ObjectId
  assessment: Types.ObjectId
  questionIds: Types.ObjectId[]
  startedAt: Date
  expiresAt: Date
  submittedAt?: Date | null
  status: 'in_progress' | 'submitted' | 'expired'
  score?: number | null
  correctCount?: number | null
  passed?: boolean | null
  answers?: Array<{ questionId: Types.ObjectId; selectedOptionId: string | null; isCorrect: boolean }>
  certificate?: Types.ObjectId | null
}

const attemptSchema = new Schema<IAssessmentAttempt>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'AssessmentQuestion', required: true }],
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    status: { type: String, enum: ['in_progress', 'submitted', 'expired'], required: true, default: 'in_progress' },
    score: { type: Number, min: 0, max: 100, default: null },
    correctCount: { type: Number, min: 0, default: null },
    passed: { type: Boolean, default: null },
    answers: [{
      questionId: { type: Schema.Types.ObjectId, ref: 'AssessmentQuestion', required: true },
      selectedOptionId: { type: String, default: null },
      isCorrect: { type: Boolean, required: true },
    }],
    certificate: { type: Schema.Types.ObjectId, ref: 'Certificate', default: null },
  },
  { timestamps: true },
)

attemptSchema.index({ user: 1, assessment: 1, status: 1 })
attemptSchema.index({ submittedAt: -1, passed: 1 })
attemptSchema.index(
  { user: 1, assessment: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' } },
)

export const AssessmentAttempt = model<IAssessmentAttempt>('AssessmentAttempt', attemptSchema)
