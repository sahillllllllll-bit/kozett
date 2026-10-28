import { createHash } from 'node:crypto'
import {
  calculateKdr,
  KDR_ALGORITHM_VERSION,
  type KdrComponentKey,
} from './developer-rating.js'

const DEMO_COMPONENT_SCORES: Record<KdrComponentKey, number> = {
  problemSolving: 80,
  consistency: 70,
  openSource: 75,
  projects: 70,
  verifiedSkills: 75,
}

export function createDemoDeveloperRating(calculatedAt = new Date()) {
  // These values are illustrative UI fixtures, not verified developer measurements.
  const result = calculateKdr(DEMO_COMPONENT_SCORES, 0.6)
  const sourceVersion = createHash('sha256')
    .update(JSON.stringify({ fixture: 'sahilx1-demo-kdr-v1', scores: DEMO_COMPONENT_SCORES }))
    .digest('hex')
  const snapshotHash = createHash('sha256')
    .update(JSON.stringify({
      dataStatus: 'demo',
      score: result.score,
      rank: result.rank,
      components: result.components,
      dataCoverage: result.dataCoverage,
      isProvisional: false,
      algorithmVersion: KDR_ALGORITHM_VERSION,
      sourceVersion,
    }))
    .digest('hex')

  if (result.score !== 75 || result.rank !== 'Silver' || result.isProvisional) {
    throw new Error('The sahilx1 demo KDR fixture does not match its expected score and rank.')
  }

  return {
    dataStatus: 'demo' as const,
    ...result,
    isProvisional: false,
    algorithmVersion: KDR_ALGORITHM_VERSION,
    calculatedAt,
    sourceVersion,
    snapshotHash,
  }
}
