import assert from 'node:assert/strict'
import test from 'node:test'
import { KDR_ALGORITHM_VERSION } from './developer-rating.js'
import { createDemoDeveloperRating } from './demo-developer-rating.js'

test('sahilx1 demo rating is a fully covered, illustrative 75-point Silver fixture', () => {
  const calculatedAt = new Date('2026-10-26T00:00:00.000Z')
  const rating = createDemoDeveloperRating(calculatedAt)

  assert.equal(rating.dataStatus, 'demo')
  assert.equal(rating.score, 75)
  assert.equal(rating.rank, 'Silver')
  assert.equal(rating.isProvisional, false)
  assert.equal(rating.algorithmVersion, KDR_ALGORITHM_VERSION)
  assert.equal(rating.calculatedAt, calculatedAt)
  assert.equal(rating.dataCoverage, 1)
  assert.deepEqual(
    rating.components.map(({ key, score }) => [key, score]),
    [
      ['problemSolving', 80],
      ['consistency', 70],
      ['openSource', 75],
      ['projects', 70],
      ['verifiedSkills', 75],
    ],
  )
})
