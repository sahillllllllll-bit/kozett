import { Schema, model, Types } from 'mongoose'

export interface IAssessmentQuestion {
  assessment: Types.ObjectId
  prompt: string
  topic: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  options: Array<{ id: string; text: string }>
  correctOptionId: string
  explanation: string
  order: number
}

const assessmentQuestionSchema = new Schema<IAssessmentQuestion>(
  {
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    prompt: { type: String, required: true },
    topic: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    options: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            text: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      required: true,
    },
    correctOptionId: { type: String, required: true, select: false },
    explanation: { type: String, required: true, select: false },
    order: { type: Number, required: true },
  },
  { timestamps: true },
)

assessmentQuestionSchema.index({ assessment: 1, order: 1 }, { unique: true })
assessmentQuestionSchema.index({ assessment: 1, prompt: 1 }, { unique: true })

export const AssessmentQuestion = model<IAssessmentQuestion>('AssessmentQuestion', assessmentQuestionSchema)
