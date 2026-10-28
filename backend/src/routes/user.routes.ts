import { Router } from 'express'
import {
  deleteProjectImage,
  deleteUserAvatar,
  getCurrentUser,
  getDashboardProfile,
  getMyDeveloperRating,
  getMyDeveloperRatingHistory,
  getPublicDeveloperRating,
  getPublicUser,
  recalculateMyDeveloperRating,
  updateDashboardProfile,
  uploadProjectImages,
  uploadUserAvatar,
} from '../controllers/user.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { imageUploadRateLimit, kdrRecalculationRateLimit, publicProfileRateLimit } from '../middleware/rate-limit.middleware.js'
import {
  uploadAvatarFile,
  uploadProjectImageFiles,
  validateImageFiles,
} from '../middleware/upload.middleware.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'

const router = Router()

router.get('/public/:username', publicProfileRateLimit, getPublicUser)
router.get('/public/:username/kdr', publicProfileRateLimit, getPublicDeveloperRating)
router.get('/me', requireAuth, getCurrentUser)
router.get('/me/profile', requireAuth, getDashboardProfile)
router.put('/me/profile', requireAuth, requireCsrf, updateDashboardProfile)
router.get('/me/kdr', requireAuth, getMyDeveloperRating)
router.get('/me/kdr/history', requireAuth, getMyDeveloperRatingHistory)
router.post('/me/kdr/recalculate', requireAuth, requireCsrf, kdrRecalculationRateLimit, recalculateMyDeveloperRating)
router.post(
  '/me/avatar',
  requireAuth,
  requireCsrf,
  imageUploadRateLimit,
  uploadAvatarFile,
  validateImageFiles,
  uploadUserAvatar,
)
router.delete('/me/avatar', requireAuth, requireCsrf, imageUploadRateLimit, deleteUserAvatar)
router.post(
  '/me/projects/:projectId/images',
  requireAuth,
  requireCsrf,
  imageUploadRateLimit,
  uploadProjectImageFiles,
  validateImageFiles,
  uploadProjectImages,
)
router.delete(
  '/me/projects/:projectId/images/:imageId',
  requireAuth,
  requireCsrf,
  imageUploadRateLimit,
  deleteProjectImage,
)

export { router as userRoutes }
