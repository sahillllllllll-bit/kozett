import { Router } from 'express'
import {
  getAssessmentIntroduction,
  getAssessmentResult,
  getAttemptQuestions,
  getMyCertificate,
  listAssessments,
  listMyCertificates,
  startAssessment,
  submitAssessment,
  verifyCertificate,
} from '../controllers/assessment.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'
import {
  assessmentStartRateLimit,
  assessmentSubmitRateLimit,
  certificateVerifyRateLimit,
} from '../middleware/rate-limit.middleware.js'

const assessmentRouter = Router()
const certificateRouter = Router()

assessmentRouter.get('/', listAssessments)
assessmentRouter.get('/attempts/:attemptId/questions', requireAuth, getAttemptQuestions)
assessmentRouter.post('/attempts/:attemptId/submit', requireAuth, requireCsrf, assessmentSubmitRateLimit, submitAssessment)
assessmentRouter.get('/results/:attemptId', requireAuth, getAssessmentResult)
assessmentRouter.get('/:slug', getAssessmentIntroduction)
assessmentRouter.post('/:slug/start', requireAuth, requireCsrf, assessmentStartRateLimit, startAssessment)

certificateRouter.get('/verify/:certificateId', certificateVerifyRateLimit, verifyCertificate)
certificateRouter.get('/me', requireAuth, listMyCertificates)
certificateRouter.get('/me/:certificateId', requireAuth, getMyCertificate)

export { assessmentRouter, certificateRouter }
