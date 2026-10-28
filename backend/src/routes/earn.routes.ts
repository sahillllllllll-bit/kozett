import { Router } from 'express'
import {
  getCheckInStatus,
  getEarnOpportunities,
  getEarnSummary,
  getEarnTransactions,
  getEarnWithdrawal,
  getEarnWithdrawals,
  postCheckIn,
  postWithdrawal,
} from '../controllers/earn.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'
import { earnCheckInRateLimit, earnWithdrawalRateLimit } from '../middleware/rate-limit.middleware.js'

const earnRouter = Router()

earnRouter.use(requireAuth)
earnRouter.get('/summary', getEarnSummary)
earnRouter.get('/opportunities', getEarnOpportunities)
earnRouter.get('/check-in/status', getCheckInStatus)
earnRouter.post('/check-in', requireCsrf, earnCheckInRateLimit, postCheckIn)
earnRouter.get('/transactions', getEarnTransactions)
earnRouter.post('/withdrawals', requireCsrf, earnWithdrawalRateLimit, postWithdrawal)
earnRouter.get('/withdrawals', getEarnWithdrawals)
earnRouter.get('/withdrawals/:id', getEarnWithdrawal)

export { earnRouter }
