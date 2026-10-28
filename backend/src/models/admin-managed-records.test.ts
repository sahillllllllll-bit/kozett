import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { Certificate } from './Certificate.js'
import { FeedCommentReport } from './FeedCommentReport.js'
import { FeedReport } from './FeedReport.js'

test('new feed reports enter the open moderation queue', () => {
  const postReport = new FeedReport({
    reporter: new Types.ObjectId(),
    post: new Types.ObjectId(),
    reason: 'other',
    details: null,
  })
  const commentReport = new FeedCommentReport({
    reporter: new Types.ObjectId(),
    comment: new Types.ObjectId(),
    reason: 'other',
    details: null,
  })
  assert.equal(postReport.status, 'open')
  assert.equal(commentReport.status, 'open')
  assert.equal(postReport.resolvedAt, null)
  assert.equal(commentReport.resolvedBy, null)
})

test('certificate revocation metadata is optional and defaults to active', () => {
  const certificate = new Certificate({
    certificateId: 'test-credential-id',
    user: new Types.ObjectId(),
    assessment: new Types.ObjectId(),
    attempt: new Types.ObjectId(),
    score: 85,
    issuedAt: new Date(),
  })
  assert.equal(certificate.revokedAt, null)
  assert.equal(certificate.revokedBy, null)
  assert.equal(certificate.revocationReason, null)
})
