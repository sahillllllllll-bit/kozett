import assert from 'node:assert/strict'
import test from 'node:test'
import { serializePublicProfile } from './public-profile.js'

test('public profile serialization hides sections unless their visibility is enabled', () => {
  const user = {
    name: 'A Developer',
    username: 'adeveloper',
    email: 'private@example.com',
    passwordHash: 'private-hash',
    visibility: { avatar: false, bio: false, links: false, platforms: false, projects: false, kdr: false },
    profileLinks: [{ title: 'Portfolio', url: 'https://example.com' }],
    platforms: [{ platform: 'GitHub', url: 'https://github.com/adeveloper' }],
    projects: [{
      title: 'Private project',
      description: 'Not public',
      url: 'https://example.com/private',
      isPublic: true,
    }],
  }

  const result = serializePublicProfile(user)

  assert.deepEqual(result.profileLinks, [])
  assert.deepEqual(result.platforms, [])
  assert.deepEqual(result.projects, [])
  assert.equal(result.avatar, null)
  assert.equal(result.bio, null)
  assert.equal(result.rating, null)
  assert.equal('email' in result, false)
  assert.equal('passwordHash' in result, false)
})

test('public profile serialization returns only explicitly public projects and safe image fields', () => {
  const user = {
    name: 'A Developer',
    username: 'adeveloper',
    avatar: 'https://images.example.com/avatar.webp',
    bio: 'Developer bio',
    visibility: { avatar: true, bio: true, links: true, platforms: true, projects: true, kdr: false },
    profileLinks: [{ title: 'Portfolio', url: 'https://example.com' }],
    platforms: [{ platform: 'GitHub', url: 'https://github.com/adeveloper' }],
    projects: [
      {
        title: 'Public project',
        description: 'Public',
        url: 'https://example.com/public',
        isPublic: true,
        coverImage: { url: 'https://images.example.com/cover.webp', publicId: 'private-id' },
        screenshots: [{ url: 'https://images.example.com/screen.webp', publicId: 'private-screen-id' }],
      },
      {
        title: 'Private project',
        description: 'Private',
        url: 'https://example.com/private',
        isPublic: false,
      },
    ],
  }

  const result = serializePublicProfile(user)

  assert.equal(result.projects.length, 1)
  assert.equal(result.avatar, 'https://images.example.com/avatar.webp')
  assert.equal(result.bio, 'Developer bio')
  assert.equal(result.projects[0].title, 'Public project')
  assert.deepEqual(result.projects[0].screenshots, ['https://images.example.com/screen.webp'])
  assert.equal(JSON.stringify(result).includes('private-id'), false)
  assert.equal(JSON.stringify(result).includes('private-screen-id'), false)
})

test('public profile only exposes KDR when the user explicitly enables its visibility', () => {
  const rating = {
    dataStatus: 'calculated' as const,
    score: 81,
    rank: 'Gold',
    components: [],
    dataCoverage: 0.6,
    isProvisional: false,
    algorithmVersion: '1.0.0',
    calculatedAt: '2026-01-01T00:00:00.000Z',
  }
  const base = {
    name: 'A Developer',
    username: 'adeveloper',
    visibility: { kdr: false },
    rating,
  }

  assert.equal(serializePublicProfile(base).rating, null)
  assert.deepEqual(serializePublicProfile({
    ...base,
    visibility: { kdr: true },
  }).rating, rating)
})
