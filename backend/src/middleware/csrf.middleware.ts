import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    return next()
  }

  const tokenFromCookie = req.cookies?.[env.CSRF_COOKIE_NAME]
  const tokenFromHeader = req.get('X-CSRF-Token')

  if (!tokenFromCookie || !tokenFromHeader || tokenFromCookie !== tokenFromHeader) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token.' })
  }

  return next()
}

export function setCsrfCookie(res: Response, token: string) {
  res.cookie(env.CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 60 * 1000,
  })
}
