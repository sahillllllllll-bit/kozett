import { createHmac, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function createSessionToken() {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string) {
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex')
}

export function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export function sanitizeUser(user: { _id: unknown; name: string; username?: string; email: string; avatar?: string | null; bio?: string | null; createdAt?: Date; updatedAt?: Date; emailVerifiedAt?: Date | null }) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username ?? null,
    email: user.email,
    avatar: user.avatar ?? null,
    bio: user.bio ?? null,
    createdAt: user.createdAt?.toISOString?.() ?? null,
    updatedAt: user.updatedAt?.toISOString?.() ?? null,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  }
}
