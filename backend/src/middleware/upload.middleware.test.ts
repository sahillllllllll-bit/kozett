import assert from 'node:assert/strict'
import test from 'node:test'
import { detectSupportedImageMime } from './upload.middleware.js'

test('detectSupportedImageMime accepts supported raster image signatures', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/v7sAAAAASUVORK5CYII=',
    'base64',
  )

  assert.equal(await detectSupportedImageMime(png), 'image/png')
})

test('detectSupportedImageMime rejects spoofed and unsupported image content', async () => {
  assert.equal(await detectSupportedImageMime(Buffer.from('not an image')), null)
  assert.equal(await detectSupportedImageMime(Buffer.from('<svg></svg>')), null)
})
