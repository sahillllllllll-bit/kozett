import type { NextFunction, Request, Response } from 'express'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { env } from '../config/env.js'
import { hashToken } from '../utils/security.js'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME]

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required.' })
    }

    const session = await Session.findOne({
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).populate('user')

    if (!session || !session.user) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.' })
    }

    const user = await User.findById(session.user)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.' })
    }
    if (user.accountStatus === 'suspended') {
      await Session.deleteOne({ _id: session._id })
      return res.status(403).json({ success: false, message: 'This account is suspended.' })
    }

    req.user = user
    session.lastUsedAt = new Date()
    await session.save()
    return next()
  } catch (error) {
    return next(error)
  }
}
