import assert from 'node:assert/strict'
import test from 'node:test'
import { assessmentRating } from './assessment-rating.js'

const thresholds = { excellent: 85, intermediate: 60, beginner: 40 }

test('assessment thresholds map scores to the configured demo rating levels', () => {
  assert.deepEqual(assessmentRating(85, thresholds), { level: 'Excellent', stars: 3, isVerified: true })
  assert.deepEqual(assessmentRating(60, thresholds), { level: 'Intermediate', stars: 2, isVerified: true })
  assert.deepEqual(assessmentRating(40, thresholds), { level: 'Beginner', stars: 1, isVerified: true })
  assert.deepEqual(assessmentRating(39, thresholds), { level: null, stars: null, isVerified: false })
  assert.deepEqual(assessmentRating(null, thresholds), { level: null, stars: null, isVerified: false })
})

test('assessment rating rejects scores outside the valid range', () => {
  assert.equal(assessmentRating(-1, thresholds).isVerified, false)
  assert.equal(assessmentRating(101, thresholds).isVerified, false)
})
