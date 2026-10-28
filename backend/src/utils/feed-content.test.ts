import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adminFeedPostFieldsSchema,
  canTransitionFeedPostStatus,
  collectFeedPostHashtags,
  hasFeedPostContent,
} from './feed-content.js'

test('admin feed post validation defaults to a draft and only accepts safe web links', () => {
  const parsed = adminFeedPostFieldsSchema.safeParse({ title: 'Release notes', text: 'Hello' })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.equal(parsed.data.status, 'draft')
  assert.equal(adminFeedPostFieldsSchema.safeParse({ link: 'javascript:alert(1)' }).success, false)
  assert.equal(adminFeedPostFieldsSchema.safeParse({ hashtags: ['safe', 'bad-tag'] }).success, false)
})

test('admin feed post hashtags merge explicit and embedded tags without duplicates', () => {
  assert.deepEqual(collectFeedPostHashtags('Welcome #Kozett', ['product', 'kozett']), ['product', 'kozett'])
  assert.deepEqual(collectFeedPostHashtags('', ['Kozett', 'kozett']), ['kozett'])
})

test('only publishable posts need visible content', () => {
  assert.equal(hasFeedPostContent({}), false)
  assert.equal(hasFeedPostContent({ text: ' ' }), false)
  assert.equal(hasFeedPostContent({ title: 'Announcement' }), true)
  assert.equal(hasFeedPostContent({ images: [{}] }), true)
})

test('feed content status transitions reject no-ops and restore archived posts through drafts', () => {
  assert.equal(canTransitionFeedPostStatus('draft', 'published'), true)
  assert.equal(canTransitionFeedPostStatus('published', 'draft'), true)
  assert.equal(canTransitionFeedPostStatus('draft', 'draft'), false)
  assert.equal(canTransitionFeedPostStatus('archived', 'published'), false)
  assert.equal(canTransitionFeedPostStatus('archived', 'draft'), true)
})
