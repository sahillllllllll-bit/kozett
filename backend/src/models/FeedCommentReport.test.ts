import assert from 'node:assert/strict'
import test from 'node:test'
import { FeedCommentReport } from './FeedCommentReport.js'

test('comment reports have a unique reporter/comment index', () => {
  const indexes = FeedCommentReport.schema.indexes()
  assert.equal(
    indexes.some(([keys, options]) =>
      keys.reporter === 1 && keys.comment === 1 && options.unique === true),
    true,
  )
})
