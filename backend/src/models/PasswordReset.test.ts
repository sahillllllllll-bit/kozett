import assert from 'node:assert/strict'
import test from 'node:test'
import { Types } from 'mongoose'
import { PasswordReset } from './PasswordReset.js'

test('password reset records require account scope, expiries, and hashed OTP data', () => {
  const reset = new PasswordReset({
    user: new Types.ObjectId(),
    scope: 'user',
    otpHash: 'a'.repeat(64),
    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  assert.equal(reset.failedAttempts, 0)
  assert.equal(reset.resendCount, 0)
  assert.equal(reset.verifiedAt, null)
  assert.equal(reset.resetTokenHash, null)
  assert.equal(reset.validateSync(), undefined)
  assert.ok(PasswordReset.schema.path('otpHash').options.select === false)
  assert.ok(PasswordReset.schema.path('resetTokenHash').options.select === false)
})

test('password reset records have unique account scopes and TTL cleanup indexes', () => {
  const indexes = PasswordReset.schema.indexes()
  assert.equal(indexes.some(([keys, options]) =>
    keys.user === 1 && keys.scope === 1 && options.unique === true), true)
  assert.equal(indexes.some(([keys, options]) =>
    keys.cleanupAt === 1 && options.expireAfterSeconds === 0), true)
})
