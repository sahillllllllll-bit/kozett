import assert from 'node:assert/strict'
import test from 'node:test'
import { activeStreakForDate, assertDailyCheckInEnabled, consecutiveStreakDay, indiaDateKey, rewardForStreakDay, withdrawalOperationKey } from './earn-logic.js'

test('India date keys follow Asia/Kolkata rather than the UTC date', () => {
  assert.equal(indiaDateKey(new Date('2026-10-25T18:45:00.000Z')), '2026-10-26')
  assert.equal(indiaDateKey(new Date('2026-10-25T18:29:59.000Z')), '2026-10-25')
})

test('check-in streak increments only for the consecutive India calendar day', () => {
  assert.equal(consecutiveStreakDay('2026-10-25', 7, '2026-10-26'), 8)
  assert.equal(consecutiveStreakDay('2026-10-24', 7, '2026-10-26'), 1)
  assert.equal(consecutiveStreakDay(null, 0, '2026-10-26'), 1)
  assert.equal(consecutiveStreakDay('2024-02-28', 3, '2024-02-29'), 4)
})

test('a missed calendar day makes the prior streak inactive until a new check-in', () => {
  assert.equal(activeStreakForDate('2026-10-25', 8, '2026-10-26'), 8)
  assert.equal(activeStreakForDate('2026-10-24', 8, '2026-10-26'), 0)
  assert.equal(activeStreakForDate(null, 0, '2026-10-26'), 0)
})

test('check-in reward tiers use integer paise and exact boundaries', () => {
  assert.equal(rewardForStreakDay(1), 100)
  assert.equal(rewardForStreakDay(10), 100)
  assert.equal(rewardForStreakDay(11), 200)
  assert.equal(rewardForStreakDay(20), 200)
  assert.equal(rewardForStreakDay(21), 500)
  assert.equal(rewardForStreakDay(500), 500)
  assert.throws(() => rewardForStreakDay(0))
  assert.throws(() => rewardForStreakDay(1.5))
})

test('disabled daily check-in is rejected before reward operations run', () => {
  assert.equal(assertDailyCheckInEnabled(true), undefined)
  assert.throws(
    () => assertDailyCheckInEnabled(false),
    (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404),
  )
})

test('withdrawal idempotency keys are scoped to the user and stable on retries', () => {
  const first = withdrawalOperationKey('user-a', 'req-123')
  assert.equal(withdrawalOperationKey('user-a', 'req-123'), first)
  assert.notEqual(withdrawalOperationKey('user-b', 'req-123'), first)
  assert.equal(withdrawalOperationKey('user-a', '   '), null)
  assert.equal(withdrawalOperationKey('user-a', 'not safe/for keys'), null)
})
