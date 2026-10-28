import assert from 'node:assert/strict'
import test from 'node:test'
import { assessmentCatalog } from './assessment-catalog.js'
import { AssessmentQuestion } from '../models/AssessmentQuestion.js'

test('every catalog bank has at least five unique questions and valid answer keys', () => {
  assert.equal(assessmentCatalog.length, 8)
  for (const assessment of assessmentCatalog) {
    assert.ok(assessment.technology)
    assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(assessment.difficulty))
    assert.ok(assessment.topics.length > 0)
    assert.equal(typeof assessment.certificateAvailable, 'boolean')
    assert.equal(assessment.durationSeconds % 60, 0)
    assert.ok(assessment.questions.length >= 5, `${assessment.slug} should have at least five questions`)
    assert.equal(new Set(assessment.questions.map((question) => question.prompt)).size, assessment.questions.length)
    for (const question of assessment.questions) {
      assert.ok(question.topic)
      assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(question.difficulty))
      assert.equal(question.options.length, 4)
      assert.equal(new Set(question.options.map((option) => option.id)).size, 4)
      assert.ok(question.options.some((option) => option.id === question.correctOptionId))
    }
  }
  const allPrompts = assessmentCatalog.flatMap((assessment) => assessment.questions.map((question) => question.prompt))
  assert.equal(new Set(allPrompts).size, allPrompts.length)
  assert.ok(new Set(assessmentCatalog.flatMap((assessment) => assessment.questions.map((question) => question.correctOptionId))).size > 1)
})

test('answer keys and explanations are excluded from normal question queries', () => {
  assert.equal(AssessmentQuestion.schema.path('correctOptionId')?.options.select, false)
  assert.equal(AssessmentQuestion.schema.path('explanation')?.options.select, false)
})
