export type AssessmentThresholds = {
  excellent: number
  intermediate: number
  beginner: number
}

export function assessmentRating(score: number | null, thresholds: AssessmentThresholds) {
  if (
    !Number.isFinite(score) ||
    score === null ||
    score < thresholds.beginner ||
    score < 0 ||
    score > 100
  ) {
    return { level: null, stars: null, isVerified: false } as const
  }
  if (score >= thresholds.excellent) {
    return { level: 'Excellent', stars: 3, isVerified: true } as const
  }
  if (score >= thresholds.intermediate) {
    return { level: 'Intermediate', stars: 2, isVerified: true } as const
  }
  return { level: 'Beginner', stars: 1, isVerified: true } as const
}
