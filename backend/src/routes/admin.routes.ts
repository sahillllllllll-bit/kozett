import { Router } from 'express'
import {
  adminLogin,
  adminLogout,
  adminSession,
  changeInitialAdminPassword,
  getAdminOverview,
  getAdminUserDetails,
  listAdminAuditLogs,
  listAdminCertificates,
  listAdminReports,
  listAdminUsers,
  listAdminWithdrawals,
  recalculateUserRating,
  resolveAdminReport,
  revokeAdminCertificate,
  setAdminUserStatus,
} from '../controllers/admin.controller.js'
import {
  createAdminContentPost,
  deleteAdminContentPost,
  deleteAdminContentPostImage,
  getAdminContentPost,
  listAdminContentPosts,
  setAdminContentPostStatus,
  updateAdminContentPost,
  uploadAdminContentPostImage,
} from '../controllers/admin-content.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireAdmin, requireAdminPasswordChanged, requireAdminRole } from '../middleware/admin-auth.middleware.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'
import {
  adminLoginRateLimit,
  adminMutationRateLimit,
  adminPasswordResetRequestRateLimit,
  adminPasswordResetResendRateLimit,
  adminPasswordResetSubmitRateLimit,
  adminPasswordResetVerifyRateLimit,
  imageUploadRateLimit,
  kdrRecalculationRateLimit,
} from '../middleware/rate-limit.middleware.js'
import { uploadFeedImageFile, validateImageFiles } from '../middleware/upload.middleware.js'
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from '../controllers/password-reset.controller.js'

const router = Router()

router.post('/auth/login', adminLoginRateLimit, requireCsrf, adminLogin)
router.post('/auth/forgot-password', adminPasswordResetRequestRateLimit, requireCsrf, (req, res, next) => requestPasswordReset(req, res, next, 'admin'))
router.post('/auth/verify-reset-otp', adminPasswordResetVerifyRateLimit, requireCsrf, (req, res, next) => verifyPasswordResetOtp(req, res, next, 'admin'))
router.post('/auth/resend-reset-otp', adminPasswordResetResendRateLimit, requireCsrf, (req, res, next) => requestPasswordReset(req, res, next, 'admin', true))
router.post('/auth/reset-password', adminPasswordResetSubmitRateLimit, requireCsrf, (req, res, next) => resetPassword(req, res, next, 'admin'))
router.use(requireAuth, requireAdmin)
router.get('/auth/session', adminSession)
router.post('/auth/logout', requireCsrf, adminLogout)
router.post('/auth/password', adminMutationRateLimit, requireCsrf, changeInitialAdminPassword)

router.use(requireAdminPasswordChanged)
router.get('/overview', requireAdminRole('superadmin', 'admin', 'finance_admin'), getAdminOverview)
router.get('/users', requireAdminRole('superadmin', 'admin'), listAdminUsers)
router.get('/users/:userId', requireAdminRole('superadmin', 'admin'), getAdminUserDetails)
router.patch('/users/:userId/status', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, setAdminUserStatus)
router.post('/users/:userId/kdr/recalculate', requireAdminRole('superadmin', 'admin'), requireCsrf, kdrRecalculationRateLimit, recalculateUserRating)
router.get('/certificates', requireAdminRole('superadmin', 'admin'), listAdminCertificates)
router.post('/certificates/:certificateId/revoke', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, revokeAdminCertificate)
router.get('/reports', requireAdminRole('superadmin', 'admin', 'moderator'), listAdminReports)
router.patch('/reports/:kind/:reportId', requireAdminRole('superadmin', 'admin', 'moderator'), adminMutationRateLimit, requireCsrf, resolveAdminReport)
router.get('/withdrawals', requireAdminRole('superadmin', 'admin', 'finance_admin'), listAdminWithdrawals)
router.get('/audit-logs', listAdminAuditLogs)
router.get('/content/feed-posts', requireAdminRole('superadmin', 'admin'), listAdminContentPosts)
router.post('/content/feed-posts', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, createAdminContentPost)
router.get('/content/feed-posts/:postId', requireAdminRole('superadmin', 'admin'), getAdminContentPost)
router.patch('/content/feed-posts/:postId', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, updateAdminContentPost)
router.patch('/content/feed-posts/:postId/status', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, setAdminContentPostStatus)
router.delete('/content/feed-posts/:postId', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, deleteAdminContentPost)
router.post(
  '/content/feed-posts/:postId/images',
  requireAdminRole('superadmin', 'admin'),
  imageUploadRateLimit,
  requireCsrf,
  uploadFeedImageFile,
  validateImageFiles,
  uploadAdminContentPostImage,
)
router.delete('/content/feed-posts/:postId/images/:imageId', requireAdminRole('superadmin', 'admin'), adminMutationRateLimit, requireCsrf, deleteAdminContentPostImage)

export { router as adminRouter }
