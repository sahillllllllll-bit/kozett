import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generatePasswordResetOtp,
  generatePasswordResetToken,
  hashPasswordResetSecret,
  maskRecoveryEmail,
  passwordResetAccountFilter,
  passwordResetSecretMatches,
  resetPasswordSchema,
  verifyPasswordResetOtpSchema,
} from './password-reset.js'

test('password reset OTPs and authorizations use secure fixed formats', () => {
  assert.match(generatePasswordResetOtp(), /^\d{6}$/)
  assert.match(generatePasswordResetToken(), /^[a-f\d]{64}$/)
})

test('hashed reset secrets are verified without storing their plaintext', () => {
  const otp = '042681'
  const tokenHash = generatePasswordResetToken()
  const otpHash = hashPasswordResetSecret(otp)
  assert.equal(passwordResetSecretMatches(otp, otpHash), true)
  assert.equal(passwordResetSecretMatches('123456', otpHash), false)
  assert.equal(passwordResetSecretMatches(tokenHash, otpHash), false)
})

test('reset API validation restricts OTPs, emails, and supplied fields', () => {
  assert.equal(verifyPasswordResetOtpSchema.safeParse({ email: 'person@example.com', otp: '012345' }).success, true)
  assert.equal(verifyPasswordResetOtpSchema.safeParse({ email: 'person@example.com', otp: '12345' }).success, false)
  assert.equal(verifyPasswordResetOtpSchema.safeParse({ email: 'person@example.com', otp: '123456', scope: 'admin' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ resetToken: 'a'.repeat(64), newPassword: 'Password123' }).success, true)
  assert.equal(resetPasswordSchema.safeParse({ resetToken: 'a'.repeat(64), newPassword: 'Password123', userId: 'target' }).success, false)
})

test('user and admin recovery account filters cannot cross account scope', () => {
  assert.deepEqual(passwordResetAccountFilter('user'), {
    adminAccess: null,
    accountStatus: { $ne: 'suspended' },
  })
  assert.deepEqual(passwordResetAccountFilter('admin'), {
    'adminAccess.active': true,
    accountStatus: { $ne: 'suspended' },
  })
})

test('recovery email masking preserves the domain and conceals the local part', () => {
  assert.equal(maskRecoveryEmail('sahil@example.com'), 's****@example.com')
})
