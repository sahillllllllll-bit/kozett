import { Router } from 'express'
import {
  getContest,
  getContestPerformance,
  getContestRatings,
  listContests,
  listMyContests,
  removeContestBookmark,
  saveContestBookmark,
  updateContestParticipation,
} from '../controllers/contest.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'

const contestRouter = Router()

contestRouter.get('/', listContests)
contestRouter.get('/performance', requireAuth, getContestPerformance)
contestRouter.get('/ratings', requireAuth, getContestRatings)
contestRouter.get('/my-contests', requireAuth, listMyContests)
contestRouter.get('/:id', getContest)
contestRouter.post('/:id/bookmark', requireAuth, requireCsrf, saveContestBookmark)
contestRouter.delete('/:id/bookmark', requireAuth, requireCsrf, removeContestBookmark)
contestRouter.patch('/:id/participation', requireAuth, requireCsrf, updateContestParticipation)

export { contestRouter }
