import bcrypt from 'bcryptjs'
import type { NextFunction, Request, Response } from 'express'
import { Types } from 'mongoose'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error.middleware.js'
import { PasswordReset, type PasswordResetScope } from '../models/PasswordReset.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { passwordResetDeliveryService } from '../services/password-reset-delivery.service.js'
import {
  generatePasswordResetOtp,
  generatePasswordResetToken,
  hashPasswordResetSecret,
  maskRecoveryEmail,
  PASSWORD_RESET_AUTH_TTL_MS,
  PASSWORD_RESET_CLEANUP_TTL_MS,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_MAX_RESENDS,
  PASSWORD_RESET_OTP_TTL_MS,
  passwordResetAccountFilter,
  passwordResetSecretMatches,
  passwordResetEmailSchema,
  resetPasswordSchema,
  verifyPasswordResetOtpSchema,
} from '../utils/password-reset.js'
import { isStrongPassword, normalizeEmail } from '../utils/security.js'

const genericRequestMessage = 'If an eligible account matches, recovery can continue using the instructions provided by this environment.'
const invalidCodeMessage = 'The verification code is invalid or expired. Request a new code and try again.'
const invalidAuthorizationMessage = 'Password reset authorization is invalid or expired. Start the recovery process again.'

function sessionCookieOptions() {
  return { path: '/', sameSite: 'lax' as const, secure: env.NODE_ENV === 'production' }
}

async function findEligibleAccount(email: string, scope: PasswordResetScope) {
  return User.findOne({
    email,
    ...passwordResetAccountFilter(scope),
  }).select('_id email')
}

async function issueInitialOtp(email: string, scope: PasswordResetScope, userId: Types.ObjectId, otp: string, now: Date) {
  const values = {
    otpHash: hashPasswordResetSecret(otp),
    otpExpiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
    failedAttempts: 0,
    resendCount: 0,
    verifiedAt: null,
    resetTokenHash: null,
    resetExpiresAt: null,
    consumedAt: null,
    cleanupAt: new Date(now.getTime() + PASSWORD_RESET_CLEANUP_TTL_MS),
  }
  try {
    await PasswordReset.findOneAndUpdate(
      { user: userId, scope },
      { $set: values, $setOnInsert: { user: userId, scope } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    )
    return true
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
    const updated = await PasswordReset.findOneAndUpdate(
      { user: userId, scope },
      { $set: values },
      { new: true, runValidators: true },
    )
    return Boolean(updated)
  }
}

async function issueResendOtp(scope: PasswordResetScope, userId: Types.ObjectId, otp: string, now: Date) {
  const existing = await PasswordReset.findOne({
    user: userId,
    scope,
    consumedAt: null,
    cleanupAt: { $gt: now },
  }).select('_id resendCount')
  if (!existing) return false

  const updated = await PasswordReset.findOneAndUpdate(
    { _id: existing._id, resendCount: { $lt: PASSWORD_RESET_MAX_RESENDS }, consumedAt: null, cleanupAt: { $gt: now } },
    {
      $set: {
        otpHash: hashPasswordResetSecret(otp),
        otpExpiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
        failedAttempts: 0,
        verifiedAt: null,
        resetTokenHash: null,
        resetExpiresAt: null,
        consumedAt: null,
        cleanupAt: new Date(now.getTime() + PASSWORD_RESET_CLEANUP_TTL_MS),
      },
      $inc: { resendCount: 1 },
    },
    { new: true, runValidators: true },
  )
  return Boolean(updated)
}

async function requestOtp(emailInput: string, scope: PasswordResetScope, resend: boolean) {
  const email = normalizeEmail(emailInput)
  const user = await findEligibleAccount(email, scope)
  const now = new Date()
  let issued = false
  let otp: string | undefined

  if (user) {
    otp = generatePasswordResetOtp()
    issued = resend
      ? await issueResendOtp(scope, user._id, otp, now)
      : await issueInitialOtp(email, scope, user._id, otp, now)
  }

  let developmentOtp: string | undefined
  if (env.PASSWORD_RESET_DEV_OTP_ENABLED) {
    if (issued && user && otp) {
      const delivery = await passwordResetDeliveryService.deliver({
        email,
        otp,
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS),
        scope,
      })
      developmentOtp = delivery.developmentOtp ?? otp
    }
  }

  return {
    success: true,
    message: genericRequestMessage,
    ...(env.PASSWORD_RESET_DEV_OTP_ENABLED && developmentOtp ? { otp: developmentOtp, developmentOtp } : {}),
    ...(resend ? { maskedEmail: maskRecoveryEmail(email) } : {}),
  }
}

export async function requestPasswordReset(req: Request, res: Response, next: NextFunction, scope: PasswordResetScope, resend = false) {
  try {
    const parsed = passwordResetEmailSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('Enter a valid email address.', 400)
    return res.status(202).json(await requestOtp(parsed.data.email, scope, resend))
  } catch (error) {
    return next(error)
  }
}

export async function verifyPasswordResetOtp(req: Request, res: Response, next: NextFunction, scope: PasswordResetScope) {
  try {
    const parsed = verifyPasswordResetOtpSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? invalidCodeMessage, 400)

    const email = normalizeEmail(parsed.data.email)
    const user = await findEligibleAccount(email, scope)
    const now = new Date()
    const reset = user
      ? await PasswordReset.findOne({
        user: user._id,
        scope,
        consumedAt: null,
        verifiedAt: null,
        otpExpiresAt: { $gt: now },
        failedAttempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
      }).select('+otpHash')
      : null
    if (!user || !reset || !passwordResetSecretMatches(parsed.data.otp, reset.otpHash)) {
      if (user && reset) {
        await PasswordReset.updateOne(
          { _id: reset._id, verifiedAt: null, consumedAt: null, failedAttempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS } },
          { $inc: { failedAttempts: 1 } },
        )
      }
      throw new AppError(invalidCodeMessage, 400)
    }

    const resetToken = generatePasswordResetToken()
    const updated = await PasswordReset.findOneAndUpdate(
      {
        _id: reset._id,
        otpHash: reset.otpHash,
        otpExpiresAt: { $gt: now },
        failedAttempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
        verifiedAt: null,
        consumedAt: null,
      },
      {
        $set: {
          verifiedAt: now,
          resetTokenHash: hashPasswordResetSecret(resetToken),
          resetExpiresAt: new Date(now.getTime() + PASSWORD_RESET_AUTH_TTL_MS),
        },
      },
      { new: true },
    )
    if (!updated) throw new AppError(invalidCodeMessage, 400)
    return res.json({ success: true, resetToken, expiresInSeconds: PASSWORD_RESET_AUTH_TTL_MS / 1000 })
  } catch (error) {
    return next(error)
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction, scope: PasswordResetScope) {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('Provide a valid reset authorization and new password.', 400)
    const { resetToken, newPassword } = parsed.data
    const isValidPassword = scope === 'admin'
      ? newPassword.length >= 12 && isStrongPassword(newPassword)
      : isStrongPassword(newPassword)
    if (!isValidPassword) {
      throw new AppError(scope === 'admin'
        ? 'Password must be at least 12 characters and include letters and numbers.'
        : 'Password must be at least 8 characters and contain letters and numbers.', 400)
    }

    const resetTokenHash = hashPasswordResetSecret(resetToken)
    const now = new Date()
    const reset = await PasswordReset.findOne({
      scope,
      resetTokenHash,
      verifiedAt: { $ne: null },
      resetExpiresAt: { $gt: now },
      consumedAt: null,
    }).select('+resetTokenHash')
    if (!reset) throw new AppError(invalidAuthorizationMessage, 400)

    const passwordHash = await bcrypt.hash(newPassword, 12)
    const claimed = await PasswordReset.findOneAndUpdate(
      {
        _id: reset._id,
        scope,
        resetTokenHash,
        resetExpiresAt: { $gt: new Date() },
        consumedAt: null,
      },
      { $set: { consumedAt: new Date() } },
      { new: true },
    )
    if (!claimed) throw new AppError(invalidAuthorizationMessage, 400)

    const accountFilter = {
      _id: reset.user,
      ...passwordResetAccountFilter(scope),
    }
    const update = scope === 'admin'
      ? { $set: { passwordHash, 'adminAccess.mustChangePassword': false } }
      : { $set: { passwordHash } }
    const account = await User.findOneAndUpdate(accountFilter, update, { new: true }).select('_id')
    if (!account) throw new AppError(invalidAuthorizationMessage, 400)

    await Promise.all([
      Session.deleteMany({ user: account._id }),
      PasswordReset.deleteMany({ user: account._id }),
    ])
    res.clearCookie(env.SESSION_COOKIE_NAME, sessionCookieOptions())
    res.clearCookie(env.CSRF_COOKIE_NAME, sessionCookieOptions())
    return res.json({ success: true, message: 'Password updated. Sign in with your new password.' })
  } catch (error) {
    return next(error)
  }
}
