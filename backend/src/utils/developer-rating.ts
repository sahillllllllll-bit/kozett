export const KDR_ALGORITHM_VERSION = '1.0.0'

export const KDR_COMPONENTS = [
  { key: 'problemSolving', label: 'Problem-solving', weight: 0.35 },
  { key: 'consistency', label: 'Coding consistency', weight: 0.15 },
  { key: 'openSource', label: 'Open-source contributions', weight: 0.2 },
  { key: 'projects', label: 'Project quality', weight: 0.2 },
  { key: 'verifiedSkills', label: 'Verified skills', weight: 0.1 },
] as const

export type KdrComponentKey = (typeof KDR_COMPONENTS)[number]['key']
export type KdrRank = 'Silver' | 'Gold' | 'Platinum'
export type KdrComponent = {
  key: KdrComponentKey
  label: string
  weight: number
  score: number | null
  available: boolean
}

export type VerifiedAssessmentResult = {
  assessmentId: string
  score: number
  submittedAt: Date | string
}

export function bestVerifiedAssessmentScores(results: VerifiedAssessmentResult[]) {
  const bestByAssessment = new Map<string, number>()
  for (const result of results) {
    if (
      !result.assessmentId ||
      !Number.isFinite(result.score) ||
      result.score < 0 ||
      result.score > 100 ||
      !Number.isFinite(new Date(result.submittedAt).getTime())
    ) continue
    bestByAssessment.set(
      result.assessmentId,
      Math.max(bestByAssessment.get(result.assessmentId) ?? 0, result.score),
    )
  }

  return [...bestByAssessment.entries()]
    .map(([assessmentId, score]) => ({ assessmentId, score }))
    .sort((left, right) => left.assessmentId.localeCompare(right.assessmentId))
}

export function scoreVerifiedAssessments(results: VerifiedAssessmentResult[]) {
  const bestScores = bestVerifiedAssessmentScores(results)
  if (!bestScores.length) return null
  return bestScores.reduce((sum, result) => sum + result.score, 0) / bestScores.length
}

export function scoreVerifiedProblems(
  problems: Array<{ id: string; difficulty: 'Easy' | 'Medium' | 'Hard'; verified: boolean }>,
  volumeNormalizer = 300,
) {
  if (!Number.isFinite(volumeNormalizer) || volumeNormalizer <= 0) {
    throw new RangeError('Problem volume normalizer must be a positive number.')
  }
  const unique = new Map<string, 'Easy' | 'Medium' | 'Hard'>()
  for (const problem of problems) {
    const validDifficulty = problem.difficulty === 'Easy' || problem.difficulty === 'Medium' || problem.difficulty === 'Hard'
    if (problem.verified && problem.id && validDifficulty && !unique.has(problem.id)) {
      unique.set(problem.id, problem.difficulty)
    }
  }
  if (!unique.size) return null

  let weightedVolume = 0
  for (const difficulty of unique.values()) {
    weightedVolume += difficulty === 'Hard' ? 4 : difficulty === 'Medium' ? 2 : 1
  }
  return 100 * (1 - Math.exp(-weightedVolume / volumeNormalizer))
}

export function scoreCodingConsistency(activeDays30: number, activeDays90: number) {
  if (
    !Number.isInteger(activeDays30) ||
    !Number.isInteger(activeDays90) ||
    activeDays30 < 0 ||
    activeDays30 > 30 ||
    activeDays90 < 0 ||
    activeDays90 > 90
  ) return null

  return 0.6 * (activeDays30 / 30 * 100) + 0.4 * (activeDays90 / 90 * 100)
}

export function scoreAssessedProject(input: {
  functionality: number
  complexity: number
  codeQuality: number
  deployment: number
  documentation: number
}) {
  const values = Object.values(input)
  if (values.some((score) => !Number.isFinite(score) || score < 0 || score > 100)) return null
  return (
    input.functionality * 0.3 +
    input.complexity * 0.25 +
    input.codeQuality * 0.2 +
    input.deployment * 0.15 +
    input.documentation * 0.1
  )
}

export function rankForKdr(score: number): KdrRank | null {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null
  if (score >= 90) return 'Platinum'
  if (score >= 80) return 'Gold'
  if (score >= 70) return 'Silver'
  return null
}

export function calculateKdr(
  scores: Partial<Record<KdrComponentKey, number | null>>,
  minimumCoverage: number,
) {
  if (!Number.isFinite(minimumCoverage) || minimumCoverage <= 0 || minimumCoverage > 1) {
    throw new RangeError('Minimum KDR coverage must be greater than zero and no more than one.')
  }

  const components: KdrComponent[] = KDR_COMPONENTS.map(({ key, label, weight }) => {
    const value = scores[key]
    const available = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    return { key, label, weight, score: available ? value : null, available }
  })
  const availableWeight = components.reduce((total, component) => (
    total + (component.available ? Math.round(component.weight * 100) : 0)
  ), 0)
  const dataCoverage = availableWeight / 100
  const weightedTotal = components.reduce((total, component) => (
    total + (component.available ? (component.score ?? 0) * Math.round(component.weight * 100) : 0)
  ), 0)
  const score = availableWeight > 0 ? weightedTotal / availableWeight : null
  const official = score !== null && availableWeight >= minimumCoverage * 100

  return {
    score,
    rank: official ? rankForKdr(score) : null,
    components,
    dataCoverage,
    isProvisional: score !== null && !official,
  }
}
