import { Router } from 'express'
import { getCsrfToken, signup, login, me, logout } from '../controllers/auth.controller.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  loginRateLimit,
  passwordResetRequestRateLimit,
  passwordResetResendRateLimit,
  passwordResetSubmitRateLimit,
  passwordResetVerifyRateLimit,
  signupRateLimit,
} from '../middleware/rate-limit.middleware.js'
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from '../controllers/password-reset.controller.js'

const router = Router()

router.get('/csrf', getCsrfToken)
router.post('/signup', signupRateLimit, requireCsrf, signup)
router.post('/login', loginRateLimit, requireCsrf, login)
router.post('/forgot-password', passwordResetRequestRateLimit, requireCsrf, (req, res, next) => requestPasswordReset(req, res, next, 'user'))
router.post('/verify-reset-otp', passwordResetVerifyRateLimit, requireCsrf, (req, res, next) => verifyPasswordResetOtp(req, res, next, 'user'))
router.post('/resend-reset-otp', passwordResetResendRateLimit, requireCsrf, (req, res, next) => requestPasswordReset(req, res, next, 'user', true))
router.post('/reset-password', passwordResetSubmitRateLimit, requireCsrf, (req, res, next) => resetPassword(req, res, next, 'user'))
router.get('/me', requireAuth, me)
router.post('/logout', requireCsrf, requireAuth, logout)

export { router as authRoutes }
