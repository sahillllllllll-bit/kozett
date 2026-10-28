import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { PasswordResetScope } from '../models/PasswordReset.js'
import { hashToken } from './security.js'

export const passwordResetEmailSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict()

export const verifyPasswordResetOtpSchema = passwordResetEmailSchema.extend({
  otp: z.string().regex(/^\d{6}$/, 'Enter the six-digit verification code.'),
}).strict()

export const resetPasswordSchema = z.object({
  resetToken: z.string().regex(/^[a-f\d]{64}$/i),
  newPassword: z.string().min(8).max(128),
}).strict()

export const PASSWORD_RESET_OTP_TTL_MS = 5 * 60 * 1000
export const PASSWORD_RESET_AUTH_TTL_MS = 10 * 60 * 1000
export const PASSWORD_RESET_CLEANUP_TTL_MS = 24 * 60 * 60 * 1000
export const PASSWORD_RESET_MAX_ATTEMPTS = 5
export const PASSWORD_RESET_MAX_RESENDS = 3

export function generatePasswordResetOtp() {
  return String(randomInt(100_000, 1_000_000))
}

export function generatePasswordResetToken() {
  return randomBytes(32).toString('hex')
}

export function hashPasswordResetSecret(value: string) {
  return hashToken(value)
}

export function passwordResetSecretMatches(value: string, storedHash: string) {
  const candidate = Buffer.from(hashPasswordResetSecret(value), 'hex')
  const expected = Buffer.from(storedHash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function passwordResetAccountFilter(scope: PasswordResetScope) {
  return scope === 'admin'
    ? { 'adminAccess.active': true, accountStatus: { $ne: 'suspended' } }
    : { adminAccess: null, accountStatus: { $ne: 'suspended' } }
}

export function maskRecoveryEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  const visible = local.length > 1 ? local.slice(0, 1) : ''
  return `${visible}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 8)))}@${domain}`
}
