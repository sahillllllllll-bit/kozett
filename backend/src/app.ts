import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { authRoutes } from './routes/auth.routes.js'
import { userRoutes } from './routes/user.routes.js'
import { assessmentRouter, certificateRouter } from './routes/assessment.routes.js'
import { earnRouter } from './routes/earn.routes.js'
import { contestRouter } from './routes/contest.routes.js'
import { feedRouter } from './routes/feed.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { notFoundHandler, errorMiddleware } from './middleware/error.middleware.js'

const app = express()

app.disable('x-powered-by')
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  }),
)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true)
      }

      if (origin === env.FRONTEND_ORIGIN || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true)
      }

      return callback(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'OK', environment: env.NODE_ENV })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/assessments', assessmentRouter)
app.use('/api/certificates', certificateRouter)
app.use('/api/earn', earnRouter)
app.use('/api/contests', contestRouter)
app.use('/api/feed', feedRouter)
app.use('/api/admin', adminRouter)

app.use(notFoundHandler)
app.use(errorMiddleware)

export { app }
