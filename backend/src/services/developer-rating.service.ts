import { createHash } from 'node:crypto'
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { AssessmentAttempt } from '../models/AssessmentAttempt.js'
import { Assessment } from '../models/Assessment.js'
import { DeveloperRating } from '../models/DeveloperRating.js'
import { DeveloperRatingSnapshot } from '../models/DeveloperRatingSnapshot.js'
import {
  calculateKdr,
  bestVerifiedAssessmentScores,
  KDR_ALGORITHM_VERSION,
  scoreVerifiedProblems,
  scoreVerifiedAssessments,
  type VerifiedAssessmentResult,
} from '../utils/developer-rating.js'

const RATING_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export type RatingPayload = {
  dataStatus: 'calculated' | 'demo'
  score: number | null
  rank: string | null
  components: Array<{
    key: string
    label: string
    weight: number
    score: number | null
    available: boolean
  }>
  dataCoverage: number
  isProvisional: boolean
  algorithmVersion: string
  calculatedAt: string
}

function toRatingPayload(rating: {
  dataStatus?: 'calculated' | 'demo'
  score: number | null
  rank: string | null
  components: RatingPayload['components']
  dataCoverage: number
  isProvisional: boolean
  algorithmVersion: string
  calculatedAt: Date
}): RatingPayload {
  return {
    dataStatus: rating.dataStatus ?? 'calculated',
    score: rating.score,
    rank: rating.rank,
    components: rating.components,
    dataCoverage: rating.dataCoverage,
    isProvisional: rating.isProvisional,
    algorithmVersion: rating.algorithmVersion,
    calculatedAt: rating.calculatedAt.toISOString(),
  }
}

export function serializeDeveloperRating(rating: Parameters<typeof toRatingPayload>[0] | null) {
  return rating ? toRatingPayload(rating) : null
}

export async function recalculateDeveloperRating(userId: Types.ObjectId | string) {
  const cachedRating = await DeveloperRating.findOne({ userId }).lean()
  if (cachedRating?.dataStatus === 'demo' && env.NODE_ENV !== 'production') {
    return serializeDeveloperRating(cachedRating)
  }

  const attempts = await AssessmentAttempt.find({
    user: userId,
    status: 'submitted',
    assessment: { $ne: null },
    score: { $gte: 0, $lte: 100 },
    submittedAt: { $ne: null },
  })
    .select('assessment score submittedAt')
    .lean()

  const assessmentIds = [...new Set(attempts.flatMap((attempt) => (
    attempt.assessment ? [String(attempt.assessment)] : []
  )))]
  const existingAssessments = await Assessment.find({ _id: { $in: assessmentIds } }).select('_id').lean()
  const validAssessmentIds = new Set(existingAssessments.map(({ _id }) => String(_id)))
  const verifiedResults: VerifiedAssessmentResult[] = attempts.flatMap((attempt) => (
    typeof attempt.score === 'number' &&
    Number.isFinite(attempt.score) &&
    validAssessmentIds.has(String(attempt.assessment)) &&
    attempt.submittedAt instanceof Date &&
    Number.isFinite(attempt.submittedAt.getTime())
      ? [{ assessmentId: String(attempt.assessment), score: attempt.score, submittedAt: attempt.submittedAt }]
      : []
  ))
  const verifiedSkillsScore = scoreVerifiedAssessments(verifiedResults)
  const problemSolvingScore = scoreVerifiedProblems([], env.KDR_PROBLEM_VOLUME_NORMALIZER)
  const calculatedAt = new Date()
  const result = calculateKdr(
    { problemSolving: problemSolvingScore, verifiedSkills: verifiedSkillsScore },
    env.KDR_MIN_DATA_COVERAGE,
  )
  const sourceVersion = createHash('sha256')
    .update(JSON.stringify(
      bestVerifiedAssessmentScores(verifiedResults),
    ))
    .digest('hex')
  const snapshotData = {
    userId,
    dataStatus: 'calculated' as const,
    ...result,
    algorithmVersion: KDR_ALGORITHM_VERSION,
    calculatedAt,
    sourceVersion,
  }
  const snapshotHash = createHash('sha256')
    .update(JSON.stringify({
      score: result.score,
      rank: result.rank,
      components: result.components,
      dataCoverage: result.dataCoverage,
      isProvisional: result.isProvisional,
      algorithmVersion: KDR_ALGORITHM_VERSION,
      sourceVersion,
    }))
    .digest('hex')

  const rating = await DeveloperRating.findOneAndUpdate(
    { userId },
    { $set: { ...snapshotData, snapshotHash } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )

  await DeveloperRatingSnapshot.updateOne(
    { userId, snapshotHash },
    { $setOnInsert: { ...snapshotData, snapshotHash } },
    { upsert: true, runValidators: true },
  )

  return serializeDeveloperRating(rating)
}

export async function getDeveloperRating(userId: Types.ObjectId | string) {
  const rating = await DeveloperRating.findOne({ userId }).lean()
  if (rating?.dataStatus === 'demo' && env.NODE_ENV !== 'production') {
    return serializeDeveloperRating(rating)
  }
  if (rating?.dataStatus === 'demo') {
    return recalculateDeveloperRating(userId)
  }
  if (!rating || Date.now() - rating.calculatedAt.getTime() >= RATING_CACHE_TTL_MS) {
    return recalculateDeveloperRating(userId)
  }
  return serializeDeveloperRating(rating)
}

export async function getDeveloperRatingHistory(userId: Types.ObjectId | string, limit = 50) {
  const snapshots = await DeveloperRatingSnapshot.find({ userId })
    .sort({ calculatedAt: -1 })
    .limit(limit)
    .lean()
  return snapshots.map((snapshot) => serializeDeveloperRating(snapshot))
}
