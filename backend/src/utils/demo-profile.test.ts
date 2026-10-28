import assert from 'node:assert/strict'
import test from 'node:test'
import { serializeDemoProfile } from './demo-profile.js'

test('demo speedometer totals reported solves and excludes GitHub data', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const result = serializeDemoProfile({
    marker: 'DEMO DATA',
    platforms: [
      { platform: 'LeetCode', username: 'demo', url: 'https://leetcode.com/u/demo', solved: 200, rating: 1, rank: null, syncedAt: now, isDemo: true },
      { platform: 'Codeforces', username: 'demo', url: 'https://codeforces.com/profile/demo', solved: 150, rating: 2, rank: null, syncedAt: now, isDemo: true },
      { platform: 'GitHub', username: 'demo', url: 'https://github.com/demo', solved: null, rating: null, rank: null, syncedAt: now, isDemo: true },
    ],
    github: { username: 'demo', publicRepos: 99, followers: 9, following: 3, contributions: 80, repositories: [], syncedAt: now, isDemo: true },
    projects: [],
    skills: [],
    certifications: [],
  })

  assert.equal(result?.totalReportedSolves, 350)
  assert.equal(result?.topPlatform, 'LeetCode')
  assert.equal(result?.linkedPlatforms, 3)
})

test('public demo serialization respects section visibility', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const result = serializeDemoProfile({
    marker: 'DEMO DATA',
    platforms: [{ platform: 'LeetCode', username: 'demo', url: 'https://leetcode.com/u/demo', solved: 5, rating: null, rank: null, syncedAt: now, isDemo: true }],
    github: { username: 'demo', publicRepos: 1, followers: 2, following: 3, contributions: 4, repositories: [], syncedAt: now, isDemo: true },
    projects: [{ title: 'Hidden', category: 'Demo', description: 'Hidden', technologies: [], featured: true, demoUrl: null, repositoryUrl: null, isDemo: true }],
    skills: [],
    certifications: [],
  }, { platforms: false, github: false, projects: false })

  assert.equal(result?.sectionsVisible.platforms, false)
  assert.equal(result?.platforms.length, 0)
  assert.equal(result?.github, null)
  assert.equal(result?.projects.length, 0)
})
