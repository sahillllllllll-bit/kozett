import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { FeedPost } from './FeedPost.js'

test('ordinary feed posts remain published and non-official by default', () => {
  const post = new FeedPost({ author: new Types.ObjectId(), text: 'Community post' })

  assert.equal(post.publicationStatus, 'published')
  assert.equal(post.isOfficial, false)
  assert.equal(post.title, null)
  assert.equal(post.validateSync(), undefined)
})

test('admin draft posts carry the content fields and optional image alt text', () => {
  const post = new FeedPost({
    author: new Types.ObjectId(),
    title: 'Release update',
    text: 'A new feature is available.',
    category: 'Product',
    isOfficial: true,
    publicationStatus: 'draft',
    images: [{ url: 'https://res.cloudinary.com/demo/image/upload/post.png', publicId: 'kozett/feed/post' }],
  })

  assert.equal(post.publicationStatus, 'draft')
  assert.equal(post.images[0]?.altText, null)
  assert.equal(post.validateSync(), undefined)

  ;(post as unknown as { publicationStatus: string }).publicationStatus = 'scheduled'
  assert.ok(post.validateSync()?.errors.publicationStatus)
})
