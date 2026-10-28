import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import {
  buildContestMongoFilter,
  contestStatusAt,
  extractCodeforcesHandle,
  isVisibleContestRecord,
  normalizeCodeforcesContests,
  normalizeCodeforcesRatings,
} from './contests.js'
import { isOwnedBy } from '../models/UserContest.js'

const now = new Date('2026-10-26T00:00:00.000Z')

test('normalizes only valid Codeforces contests in the supported schedule window', () => {
  const result = normalizeCodeforcesContests({
    status: 'OK',
    result: [
      { id: 101, name: 'Round 101', durationSeconds: 7200, startTimeSeconds: now.getTime() / 1000 + 3600 },
      { id: 102, name: 'x'.repeat(201), durationSeconds: 3600, startTimeSeconds: now.getTime() / 1000 },
      { id: 103, name: 'Too old', durationSeconds: 3600, startTimeSeconds: now.getTime() / 1000 - 40 * 86400 },
      { id: '104', name: 'Bad id', durationSeconds: 3600, startTimeSeconds: now.getTime() / 1000 },
    ],
  }, now)

  assert.equal(result.length, 1)
  assert.equal(result[0].externalContestId, '101')
  assert.equal(result[0].contestUrl, 'https://codeforces.com/contest/101')
  assert.equal(result[0].registrationUrl, 'https://codeforces.com/contestRegistration/101')
})

test('does not normalize unsuccessful or malformed provider responses', () => {
  assert.deepEqual(normalizeCodeforcesContests({ status: 'FAILED', result: [] }, now), [])
  assert.deepEqual(normalizeCodeforcesContests(null, now), [])
})

test('normalizes genuine Codeforces rating-change entries only', () => {
  const result = normalizeCodeforcesRatings({
    status: 'OK',
    result: [
      { contestId: 12, contestName: 'Round 12', rank: 5, oldRating: 1200, newRating: 1240, ratingUpdateTimeSeconds: 1000 },
      { contestId: 13, contestName: 'Invalid rank', rank: 0, oldRating: 1200, newRating: 1240, ratingUpdateTimeSeconds: 1000 },
    ],
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].externalContestId, '12')
  assert.equal(result[0].newRating - result[0].oldRating, 40)
})

test('classifies time status at upcoming, active, and end boundaries', () => {
  const start = new Date(now.getTime() + 1000)
  const end = new Date(now.getTime() + 2000)
  assert.equal(contestStatusAt(start, end, now), 'upcoming')
  assert.equal(contestStatusAt(start, end, start), 'ongoing')
  assert.equal(contestStatusAt(start, end, end), 'finished')
})

test('builds escaped search and time-based status filters', () => {
  assert.deepEqual(buildContestMongoFilter({ status: 'ongoing', search: 'A.*', platform: 'Codeforces', now }), {
    platform: 'Codeforces',
    title: { $regex: 'A\\.\\*', $options: 'i' },
    startTime: { $gte: new Date(now.getTime() - 30 * 86400000), $lte: now },
    endTime: { $gt: now },
  })
  assert.deepEqual(buildContestMongoFilter({ status: 'finished', now }), {
    startTime: {
      $gte: new Date(now.getTime() - 30 * 86400000),
      $lte: new Date(now.getTime() + 365 * 86400000),
    },
    endTime: { $lte: now },
  })
})

test('only bookmarked or participating contest records appear in a user list', () => {
  assert.equal(isVisibleContestRecord({ bookmarked: false, participationStatus: null }), false)
  assert.equal(isVisibleContestRecord({ bookmarked: true, participationStatus: null }), true)
  assert.equal(isVisibleContestRecord({ bookmarked: false, participationStatus: 'missed' }), true)
})

test('user contest ownership is scoped to the record owner', () => {
  const owner = new Types.ObjectId('64b000000000000000000001')
  assert.equal(isOwnedBy({ user: owner }, owner), true)
  assert.equal(isOwnedBy({ user: owner }, '64b000000000000000000002'), false)
})

test('extracts handles only from official HTTPS Codeforces profile URLs', () => {
  assert.equal(extractCodeforcesHandle('https://codeforces.com/profile/example_1'), 'example_1')
  assert.equal(extractCodeforcesHandle('http://codeforces.com/profile/example'), null)
  assert.equal(extractCodeforcesHandle('https://codeforces.com.evil.invalid/profile/example'), null)
  assert.equal(extractCodeforcesHandle('https://codeforces.com/profile/example/extra'), null)
})
