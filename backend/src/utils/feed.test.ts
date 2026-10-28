import assert from 'node:assert/strict'
import test from 'node:test'
import {
  escapeSearchRegex,
  extractFeedHashtags,
  buildFeedPostSearchConditions,
  withPublishedFeedPostFilter,
  feedCodeSnippetSchema,
  feedProjectLinkSchema,
  feedReportInputSchema,
} from './feed.js'

test('extractFeedHashtags normalizes and deduplicates tags from text', () => {
  assert.deepEqual(extractFeedHashtags('Hello #Kozett #kozett #Développeur #tag-with-dash'), ['kozett', 'développeur', 'tag'])
})

test('extractFeedHashtags bounds the number of extracted tags', () => {
  const text = Array.from({ length: 35 }, (_, index) => `#tag${index}`).join(' ')
  assert.equal(extractFeedHashtags(text).length, 30)
})

test('escapeSearchRegex treats user input as a literal search string', () => {
  const escaped = escapeSearchRegex('a+b (test).*')
  assert.equal(new RegExp(escaped).test('a+b (test).*'), true)
  assert.equal(new RegExp(escaped).test('aaab testZZ'), false)
})

test('post search includes text, title, category, hashtags, links, and project titles', () => {
  const conditions = buildFeedPostSearchConditions(new RegExp(escapeSearchRegex('kozett'), 'i'))
  assert.deepEqual(conditions.map((condition) => Object.keys(condition)[0]), [
    'text',
    'title',
    'category',
    'hashtags',
    'link',
    'projectLink.title',
  ])
  for (const condition of conditions) {
    const field = Object.values(condition)[0] as RegExp
    assert.equal(field.test('KOZETT project'), true)
    assert.equal(field.test('kozetx'), false)
  }
})

test('public feed filter excludes drafts without replacing existing search conditions', () => {
  const filter = withPublishedFeedPostFilter({
    $or: [{ text: /release/i }, { hashtags: /release/i }],
    author: { $in: ['public-author'] },
  })

  assert.equal((filter.$or as unknown[]).length, 2)
  assert.deepEqual(filter.$and, [{
    $or: [
      { publicationStatus: 'published' },
      { publicationStatus: { $exists: false } },
    ],
  }])
})

test('project links require a title and an HTTP(S) URL', () => {
  assert.equal(feedProjectLinkSchema.safeParse({ title: 'Project', url: 'https://example.com/demo' }).success, true)
  assert.equal(feedProjectLinkSchema.safeParse({ title: 'Unsafe', url: 'javascript:alert(1)' }).success, false)
  assert.equal(feedProjectLinkSchema.safeParse({ title: '', url: 'https://example.com' }).success, false)
})

test('code snippets enforce bounded language and source lengths', () => {
  assert.equal(feedCodeSnippetSchema.safeParse({ language: 'TypeScript', code: 'const ready = true' }).success, true)
  assert.equal(feedCodeSnippetSchema.safeParse({ language: 'x'.repeat(51), code: 'code' }).success, false)
  assert.equal(feedCodeSnippetSchema.safeParse({ language: 'JS', code: 'x'.repeat(10001) }).success, false)
})

test('post and comment report reasons share validation and bounded details', () => {
  assert.equal(feedReportInputSchema.safeParse({ reason: 'spam', details: 'Repeated promotional content' }).success, true)
  assert.equal(feedReportInputSchema.safeParse({ reason: 'other' }).success, true)
  assert.equal(feedReportInputSchema.safeParse({ reason: 'threats' }).success, false)
  assert.equal(feedReportInputSchema.safeParse({ reason: 'spam', details: 'x'.repeat(1001) }).success, false)
  assert.equal(feedReportInputSchema.safeParse({ reason: 'spam', unexpected: true }).success, false)
})
