import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { AppError } from '../middleware/error.middleware.js'
import { setCsrfCookie } from '../middleware/csrf.middleware.js'
import { hashToken, isStrongPassword, normalizeEmail, sanitizeUser, createSessionToken } from '../utils/security.js'

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/i, 'Username may contain only letters, numbers, and underscores.')
    .refine(
      (username) =>
        !['certifications', 'contest', 'dashboard', 'earn', 'feed', 'login', 'profile', 'signup'].includes(
          username.toLowerCase(),
        ),
      'This username is reserved.',
    )
    .optional()
    .or(z.literal('')),
})

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
})

function createSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  }
}

export async function getCsrfToken(req: Request, res: Response) {
  const token = randomBytes(32).toString('hex')
  setCsrfCookie(res, token)
  return res.json({ success: true, csrfToken: token })
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = signupSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Please provide a valid name, email, and password.', 400)
    }

    const { name, email, password, username } = parsed.data
    const normalizedEmail = normalizeEmail(email)

    if (!isStrongPassword(password)) {
      throw new AppError('Password must be at least 8 characters and contain letters and numbers.', 400)
    }

    const normalizedUsername = username?.trim() ? username.trim().toLowerCase() : undefined

    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, ...(normalizedUsername ? [{ username: normalizedUsername }] : [])] })
    if (existingUser) {
      throw new AppError('An account with this email or username already exists.', 409)
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({
      name,
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
    })

    const sessionToken = createSessionToken()
    const session = await Session.create({
      user: user._id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    })

    const csrfToken = randomBytes(32).toString('hex')
    res.cookie(env.SESSION_COOKIE_NAME, sessionToken, createSessionCookieOptions())
    setCsrfCookie(res, csrfToken)

    res.status(201).json({
      success: true,
      user: sanitizeUser(user.toObject()),
      sessionId: String(session._id),
      csrfToken,
    })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Please provide a valid email and password.', 400)
    }

    const { email, password } = parsed.data
    const normalizedEmail = normalizeEmail(email)
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      throw new AppError('Invalid email or password.', 401)
    }
    if (user.accountStatus === 'suspended') {
      throw new AppError('This account is suspended.', 403)
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      throw new AppError('Invalid email or password.', 401)
    }

    const sessionToken = createSessionToken()
    await Session.create({
      user: user._id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    })

    const csrfToken = randomBytes(32).toString('hex')
    res.cookie(env.SESSION_COOKIE_NAME, sessionToken, createSessionCookieOptions())
    setCsrfCookie(res, csrfToken)

    return res.json({ success: true, user: sanitizeUser(user.toObject()), csrfToken })
  } catch (error) {
    return next(error)
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' })
  }

  return res.json({ success: true, user: sanitizeUser(req.user) })
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = req.cookies?.[env.SESSION_COOKIE_NAME]

    if (sessionToken) {
      await Session.deleteOne({ tokenHash: hashToken(sessionToken) })
    }

    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/', sameSite: 'lax', secure: env.NODE_ENV === 'production' })
    res.clearCookie(env.CSRF_COOKIE_NAME, { path: '/', sameSite: 'lax', secure: env.NODE_ENV === 'production' })

    return res.json({ success: true, message: 'Logged out successfully.' })
  } catch (error) {
    return next(error)
  }
}
