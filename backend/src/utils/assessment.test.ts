import assert from 'node:assert/strict'
import test from 'node:test'
import { isAttemptExpired, scoreAssessment } from './assessment.js'

const questions = [
  { id: 'q1', correctOptionId: 'A', optionIds: ['A', 'B'] },
  { id: 'q2', correctOptionId: 'B', optionIds: ['A', 'B'] },
]

test('scores answers on the server and applies the passing threshold', () => {
  const result = scoreAssessment(questions, [
    { questionId: 'q2', selectedOptionId: 'B' },
    { questionId: 'q1', selectedOptionId: 'B' },
  ], 50)

  assert.equal(result.score, 50)
  assert.equal(result.correctCount, 1)
  assert.equal(result.passed, true)
  assert.equal(result.answers[0].isCorrect, false)
})

test('rejects missing, duplicate, unknown, and invalid-option answers', () => {
  assert.throws(() => scoreAssessment(questions, [{ questionId: 'q1', selectedOptionId: 'A' }], 60))
  assert.throws(() => scoreAssessment(questions, [
    { questionId: 'q1', selectedOptionId: 'A' },
    { questionId: 'q1', selectedOptionId: 'B' },
  ], 60))
  assert.throws(() => scoreAssessment(questions, [
    { questionId: 'q1', selectedOptionId: 'A' },
    { questionId: 'other', selectedOptionId: 'B' },
  ], 60))
  assert.throws(() => scoreAssessment(questions, [
    { questionId: 'q1', selectedOptionId: 'secret-answer' },
    { questionId: 'q2', selectedOptionId: 'B' },
  ], 60))
})

test('allows missing answers only for finalized timed-out attempts and scores them incorrect', () => {
  const partial = [{ questionId: 'q1', selectedOptionId: 'A' }]

  assert.throws(() => scoreAssessment(questions, partial, 60))
  const timedOut = scoreAssessment(questions, partial, 60, true)
  assert.equal(timedOut.score, 50)
  assert.equal(timedOut.correctCount, 1)
  assert.equal(timedOut.passed, false)
  assert.deepEqual(timedOut.answers, [
    { questionId: 'q1', selectedOptionId: 'A', isCorrect: true },
    { questionId: 'q2', selectedOptionId: null, isCorrect: false },
  ])
  assert.equal(scoreAssessment(questions, [], 60, true).score, 0)
  assert.throws(() => scoreAssessment(questions, [
    { questionId: 'q1', selectedOptionId: 'INVALID' },
  ], 60, true))
  assert.throws(() => scoreAssessment(questions, [
    { questionId: 'other', selectedOptionId: 'A' },
  ], 60, true))
})

test('an attempt expires only after its deadline', () => {
  const deadline = new Date('2026-10-26T10:00:00.000Z')
  assert.equal(isAttemptExpired(deadline, new Date('2026-10-26T09:59:59.000Z')), false)
  assert.equal(isAttemptExpired(deadline, deadline), true)
  assert.equal(isAttemptExpired(deadline, new Date('2026-10-26T10:00:01.000Z')), true)
})
