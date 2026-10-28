import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateKdr,
  rankForKdr,
  scoreAssessedProject,
  scoreCodingConsistency,
  scoreVerifiedAssessments,
  scoreVerifiedProblems,
} from './developer-rating.js'

test('badge tiers use exact unrounded thresholds', () => {
  assert.equal(rankForKdr(69.99), null)
  assert.equal(rankForKdr(70), 'Silver')
  assert.equal(rankForKdr(79.99), 'Silver')
  assert.equal(rankForKdr(80), 'Gold')
  assert.equal(rankForKdr(89.99), 'Gold')
  assert.equal(rankForKdr(90), 'Platinum')
  assert.equal(rankForKdr(100), 'Platinum')
})

test('verified assessment scoring keeps only each assessment best result', () => {
  assert.equal(scoreVerifiedAssessments([
    { assessmentId: 'a', score: 70, submittedAt: '2026-01-01' },
    { assessmentId: 'a', score: 90, submittedAt: '2026-01-02' },
    { assessmentId: 'b', score: 80, submittedAt: '2026-01-03' },
  ]), 85)
})

test('invalid or undated assessment results are unavailable', () => {
  assert.equal(scoreVerifiedAssessments([
    { assessmentId: 'a', score: Number.NaN, submittedAt: '2026-01-01' },
    { assessmentId: 'b', score: 120, submittedAt: '2026-01-01' },
    { assessmentId: 'c', score: 90, submittedAt: 'invalid' },
  ]), null)
})

test('problem solving deduplicates verified problems and applies diminishing returns', () => {
  const score = scoreVerifiedProblems([
    { id: 'same', difficulty: 'Hard', verified: true },
    { id: 'same', difficulty: 'Easy', verified: true },
    { id: 'ignored', difficulty: 'Hard', verified: false },
    { id: 'medium', difficulty: 'Medium', verified: true },
  ], 300)
  assert.equal(score, 100 * (1 - Math.exp(-6 / 300)))
  assert.equal(scoreVerifiedProblems([], 300), null)
  assert.throws(() => scoreVerifiedProblems([], 0), RangeError)
})

test('coding consistency rejects out-of-range activity and normalizes 30/90 day periods', () => {
  assert.equal(scoreCodingConsistency(15, 45), 50)
  assert.equal(scoreCodingConsistency(31, 45), null)
})

test('project quality is only scored from valid assessed evidence', () => {
  assert.equal(scoreAssessedProject({
    functionality: 100,
    complexity: 80,
    codeQuality: 60,
    deployment: 40,
    documentation: 20,
  }), 70)
  assert.equal(scoreAssessedProject({
    functionality: 101,
    complexity: 80,
    codeQuality: 60,
    deployment: 40,
    documentation: 20,
  }), null)
})

test('missing components reduce coverage and never receive a perfect default', () => {
  const result = calculateKdr({ verifiedSkills: 80 }, 0.6)
  assert.equal(result.score, 80)
  assert.equal(result.dataCoverage, 0.1)
  assert.equal(result.isProvisional, true)
  assert.equal(result.rank, null)
  assert.equal(result.components.find(({ key }) => key === 'projects')?.score, null)
})

test('zero evidence is insufficient and invalid component values are treated as unavailable', () => {
  assert.equal(calculateKdr({}, 0.6).score, null)
  const result = calculateKdr({ verifiedSkills: 101 }, 0.6)
  assert.equal(result.score, null)
  assert.equal(result.dataCoverage, 0)
})

test('official rank comes from the raw weighted score', () => {
  const result = calculateKdr({ problemSolving: 70, consistency: 70, openSource: 70, projects: 70, verifiedSkills: 70 }, 0.6)
  assert.equal(result.score, 70)
  assert.equal(result.rank, 'Silver')
  assert.equal(result.isProvisional, false)
})
