import { Router } from 'express'
import {
  createComment,
  createPost,
  deletePostImage,
  deleteComment,
  deletePost,
  followUser,
  getFollowCounts,
  getDeveloperSuggestions,
  getPost,
  likePost,
  listComments,
  listNotifications,
  listPosts,
  listSavedPosts,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  reportPost,
  reportComment,
  savePost,
  searchFeed,
  trendingHashtags,
  unfollowUser,
  unlikePost,
  unsavePost,
  updateComment,
  updatePost,
  uploadPostImage,
} from '../controllers/feed.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireCsrf } from '../middleware/csrf.middleware.js'
import { feedWriteRateLimit, imageUploadRateLimit } from '../middleware/rate-limit.middleware.js'
import { uploadFeedImageFile, validateImageFiles } from '../middleware/upload.middleware.js'

const feedRouter = Router()

feedRouter.use(requireAuth)

feedRouter.get('/hashtags/trending', trendingHashtags)
feedRouter.get('/suggestions', getDeveloperSuggestions)
feedRouter.get('/posts', listPosts)
feedRouter.post('/posts', requireCsrf, feedWriteRateLimit, createPost)
feedRouter.get('/posts/:postId', getPost)
feedRouter.patch('/posts/:postId', requireCsrf, feedWriteRateLimit, updatePost)
feedRouter.delete('/posts/:postId', requireCsrf, feedWriteRateLimit, deletePost)
feedRouter.post('/posts/:postId/images', requireCsrf, imageUploadRateLimit, uploadFeedImageFile, validateImageFiles, uploadPostImage)
feedRouter.delete('/posts/:postId/images/:imageId', requireCsrf, feedWriteRateLimit, deletePostImage)
feedRouter.put('/posts/:postId/like', requireCsrf, feedWriteRateLimit, likePost)
feedRouter.delete('/posts/:postId/like', requireCsrf, feedWriteRateLimit, unlikePost)
feedRouter.get('/posts/:postId/comments', listComments)
feedRouter.post('/posts/:postId/comments', requireCsrf, feedWriteRateLimit, createComment)
feedRouter.post('/posts/:postId/report', requireCsrf, feedWriteRateLimit, reportPost)
feedRouter.post('/comments/:commentId/report', requireCsrf, feedWriteRateLimit, reportComment)
feedRouter.put('/posts/:postId/bookmark', requireCsrf, feedWriteRateLimit, savePost)
feedRouter.delete('/posts/:postId/bookmark', requireCsrf, feedWriteRateLimit, unsavePost)
feedRouter.get('/saved', listSavedPosts)
feedRouter.patch('/comments/:commentId', requireCsrf, feedWriteRateLimit, updateComment)
feedRouter.delete('/comments/:commentId', requireCsrf, feedWriteRateLimit, deleteComment)
feedRouter.put('/users/:userId/follow', requireCsrf, feedWriteRateLimit, followUser)
feedRouter.delete('/users/:userId/follow', requireCsrf, feedWriteRateLimit, unfollowUser)
feedRouter.get('/users/:userId/follow-counts', getFollowCounts)
feedRouter.get('/notifications', listNotifications)
feedRouter.patch('/notifications/read-all', requireCsrf, feedWriteRateLimit, markAllNotificationsRead)
feedRouter.patch('/notifications/:notificationId/unread', requireCsrf, feedWriteRateLimit, markNotificationUnread)
feedRouter.patch('/notifications/:notificationId/read', requireCsrf, feedWriteRateLimit, markNotificationRead)
feedRouter.get('/search', searchFeed)

export { feedRouter }
