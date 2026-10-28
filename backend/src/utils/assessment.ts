export interface AnswerForScoring {
  questionId: string
  selectedOptionId: string
}

export interface QuestionForScoring {
  id: string
  correctOptionId: string
  optionIds: string[]
}

export interface ScoredAnswer {
  questionId: string
  selectedOptionId: string | null
  isCorrect: boolean
}

export function scoreAssessment(
  questions: QuestionForScoring[],
  answers: AnswerForScoring[],
  passingScore: number,
  allowMissing = false,
) {
  if (questions.length === 0 || (!allowMissing && answers.length !== questions.length)) {
    throw new Error('Every assessment question must have exactly one answer.')
  }
  if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
    throw new Error('Passing score must be between 0 and 100.')
  }

  const byQuestion = new Map<string, AnswerForScoring>()
  const expectedIds = new Set(questions.map((question) => question.id))
  if (expectedIds.size !== questions.length) {
    throw new Error('Assessment question identifiers must be unique.')
  }
  for (const answer of answers) {
    if (!expectedIds.has(answer.questionId)) {
      throw new Error('An answer contains an invalid question.')
    }
    if (byQuestion.has(answer.questionId)) {
      throw new Error('An answer was provided more than once.')
    }
    byQuestion.set(answer.questionId, answer)
  }

  if (byQuestion.size > expectedIds.size) {
    throw new Error('Answers do not match the assessment questions.')
  }

  const scoredAnswers = questions.map((question): ScoredAnswer => {
    const answer = byQuestion.get(question.id)
    if (!answer && !allowMissing) {
      throw new Error('Every assessment question must have exactly one answer.')
    }
    if (answer && !question.optionIds.includes(answer.selectedOptionId)) {
      throw new Error('An answer contains an invalid question or option.')
    }
    return {
      questionId: question.id,
      selectedOptionId: answer?.selectedOptionId ?? null,
      isCorrect: answer?.selectedOptionId === question.correctOptionId,
    }
  })
  const correctCount = scoredAnswers.filter((answer) => answer.isCorrect).length
  const score = Math.round((correctCount / questions.length) * 100)

  return { score, correctCount, totalQuestions: questions.length, passed: score >= passingScore, answers: scoredAnswers }
}

export function isAttemptExpired(expiresAt: Date, now = new Date()) {
  return now.getTime() >= expiresAt.getTime()
}
