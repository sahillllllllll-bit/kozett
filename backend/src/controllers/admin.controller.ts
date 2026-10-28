import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { NextFunction, Request, Response } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error.middleware.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'
import { Assessment } from '../models/Assessment.js'
import { AssessmentAttempt } from '../models/AssessmentAttempt.js'
import { Certificate } from '../models/Certificate.js'
import { Contest } from '../models/Contest.js'
import { FeedCommentReport } from '../models/FeedCommentReport.js'
import { FeedComment } from '../models/FeedComment.js'
import { FeedReport } from '../models/FeedReport.js'
import { DeveloperRating } from '../models/DeveloperRating.js'
import { DeveloperRatingSnapshot } from '../models/DeveloperRatingSnapshot.js'
import { EarnLedger } from '../models/EarnLedger.js'
import { EarnOpportunity } from '../models/EarnOpportunity.js'
import { EarnWallet } from '../models/EarnWallet.js'
import { EarnWithdrawal } from '../models/EarnWithdrawal.js'
import { FeedPost } from '../models/FeedPost.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { setCsrfCookie } from '../middleware/csrf.middleware.js'
import { recalculateDeveloperRating, serializeDeveloperRating } from '../services/developer-rating.service.js'
import { writeAdminAudit } from '../services/admin-audit.service.js'
import { createSessionToken, hashToken, isStrongPassword, normalizeEmail } from '../utils/security.js'

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
}).strict()

const passwordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(12).max(128),
}).strict()

const userListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'active', 'suspended']).default('all'),
  sort: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
}).strict()

const auditListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().max(100).optional(),
}).strict()

const statusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().min(5).max(500),
}).strict()

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict()

const reportListSchema = pageSchema.extend({
  page: z.coerce.number().int().min(1).max(100).default(1),
  status: z.enum(['all', 'open', 'resolved', 'dismissed']).default('open'),
}).strict()

const reportResolutionSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  reason: z.string().trim().min(5).max(500),
}).strict()

const certificateListSchema = pageSchema.extend({
  search: z.string().trim().max(100).default(''),
}).strict()

const withdrawalListSchema = pageSchema.extend({
  status: z.enum(['all', 'processing', 'review_pending', 'rejected']).default('all'),
  search: z.string().trim().max(100).default(''),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  minPaise: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  maxPaise: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().refine((value) => value.minPaise === undefined || value.maxPaise === undefined || value.minPaise <= value.maxPaise, {
  message: 'Minimum amount cannot exceed maximum amount.',
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'Start date cannot be after end date.',
})

function sessionCookieOptions() {
  const maxAge = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(Date.now() + maxAge),
    maxAge,
  }
}

function adminActor(req: Request) {
  if (!req.user?._id || !req.user.adminAccess?.role) throw new AppError('Administrator access required.', 403)
  return { id: String(req.user._id), role: req.user.adminAccess.role }
}

function routeUserId(req: Request) {
  const userId = req.params.userId
  if (typeof userId !== 'string' || !Types.ObjectId.isValid(userId)) {
    throw new AppError('User was not found.', 404)
  }
  return userId
}

function parseQuery<T extends z.ZodType>(schema: T, query: Request['query']): z.infer<T> {
  const parsed = schema.safeParse(query)
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid query parameters.', 400)
  return parsed.data
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function adminLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('Provide a valid administrator email and password.', 400)
    const user = await User.findOne({ email: normalizeEmail(parsed.data.email) })
    if (!user || user.adminAccess?.active !== true || user.accountStatus === 'suspended') {
      throw new AppError('Invalid administrator email or password.', 401)
    }
    if (!await bcrypt.compare(parsed.data.password, user.passwordHash)) {
      throw new AppError('Invalid administrator email or password.', 401)
    }

    await Session.deleteMany({ user: user._id })
    const token = createSessionToken()
    await Session.create({
      user: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    const csrfToken = randomBytes(32).toString('hex')
    res.cookie(env.SESSION_COOKIE_NAME, token, sessionCookieOptions())
    setCsrfCookie(res, csrfToken)
    return res.json({
      success: true,
      csrfToken,
      admin: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.adminAccess.role,
        mustChangePassword: user.adminAccess.mustChangePassword,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function adminSession(req: Request, res: Response) {
  const actor = adminActor(req)
  return res.json({
    success: true,
    admin: {
      id: String(actor.id),
      name: req.user!.name,
      email: req.user!.email,
      role: actor.role,
      mustChangePassword: req.user!.adminAccess?.mustChangePassword === true,
    },
  })
}

export async function adminLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME]
    if (token) await Session.deleteOne({ user: adminActor(req).id, tokenHash: hashToken(token) })
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/', sameSite: 'lax', secure: env.NODE_ENV === 'production' })
    res.clearCookie(env.CSRF_COOKIE_NAME, { path: '/', sameSite: 'lax', secure: env.NODE_ENV === 'production' })
    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
}

export async function changeInitialAdminPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = adminActor(req)
    const parsed = passwordSchema.safeParse(req.body)
    if (!parsed.success || !isStrongPassword(parsed.data.newPassword)) {
      throw new AppError('New password must be at least 12 characters and include letters and numbers.', 400)
    }
    const user = await User.findById(actor.id)
    if (!user || !user.adminAccess?.active) throw new AppError('Administrator account was not found.', 404)
    if (!await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) {
      throw new AppError('Current password is incorrect.', 400)
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      throw new AppError('Choose a new password different from the current password.', 400)
    }

    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    user.adminAccess.mustChangePassword = false
    await user.save()

    const token = req.cookies?.[env.SESSION_COOKIE_NAME]
    if (token) {
      await Session.deleteMany({ user: user._id, tokenHash: { $ne: hashToken(token) } })
    }
    await writeAdminAudit({
      adminId: user._id,
      adminRole: actor.role,
      action: 'admin.initial_password_changed',
      targetType: 'user',
      targetId: String(user._id),
    })
    return res.json({ success: true, mustChangePassword: false })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const period = z.enum(['7', '30', '90']).safeParse(req.query.period)
    if (!period.success) throw new AppError('Period must be 7, 30, or 90 days.', 400)
    const days = Number(period.data)
    const now = new Date()
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const activeSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [
      totalUsers,
      newUsers,
      activeUsers,
      dailyActiveUsers,
      publishedPosts,
      recentPosts,
      totalCertificates,
      recentCertificates,
      attempts,
      upcomingContests,
      activeOpportunities,
      rewards,
      wallets,
      pendingWithdrawals,
      registrationSeries,
      postSeries,
      assessmentSeries,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: from } }),
      Session.distinct('user', { lastUsedAt: { $gte: activeSince }, revokedAt: null }).then((ids) => ids.length),
      Session.distinct('user', { lastUsedAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, revokedAt: null }).then((ids) => ids.length),
      FeedPost.countDocuments(),
      FeedPost.countDocuments({ createdAt: { $gte: from } }),
      Certificate.countDocuments(),
      Certificate.countDocuments({ issuedAt: { $gte: from } }),
      AssessmentAttempt.aggregate([
        { $match: { status: 'submitted', submittedAt: { $gte: from } } },
        { $group: { _id: null, total: { $sum: 1 }, passed: { $sum: { $cond: ['$passed', 1, 0] } } } },
      ]),
      Contest.countDocuments({ startTime: { $gte: now } }),
      EarnOpportunity.countDocuments({ active: true, configured: true }),
      EarnLedger.aggregate([
        { $match: { type: 'check_in_reward', status: 'applied' } },
        { $group: { _id: null, amountPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      ]),
      EarnWallet.aggregate([
        { $group: { _id: null, balancePaise: { $sum: '$balancePaise' }, reservedPaise: { $sum: '$reservedPaise' } } },
      ]),
      EarnWithdrawal.aggregate([
        { $match: { status: 'review_pending' } },
        { $group: { _id: null, count: { $sum: 1 }, amountPaise: { $sum: '$amountPaise' } } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      FeedPost.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AssessmentAttempt.aggregate([
        { $match: { status: 'submitted', submittedAt: { $gte: from } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt', timezone: 'Asia/Kolkata' } }, attempts: { $sum: 1 }, passed: { $sum: { $cond: ['$passed', 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
    ])
    const attemptStats = attempts[0] ?? { total: 0, passed: 0 }
    const rewardStats = rewards[0] ?? { amountPaise: 0, count: 0 }
    const walletStats = wallets[0] ?? { balancePaise: 0, reservedPaise: 0 }
    const pendingStats = pendingWithdrawals[0] ?? { count: 0, amountPaise: 0 }

    return res.json({
      success: true,
      periodDays: days,
      calculatedAt: now.toISOString(),
      metrics: {
        totalUsers,
        newUsers,
        activeUsers30Days: activeUsers,
        activeUsers1Day: dailyActiveUsers,
        publishedFeedPosts: publishedPosts,
        recentFeedPosts: recentPosts,
        certificatesIssued: totalCertificates,
        recentCertificatesIssued: recentCertificates,
        assessmentAttempts: attemptStats.total,
        assessmentPassRate: attemptStats.total ? attemptStats.passed / attemptStats.total : 0,
        upcomingContests,
        activeEarningOpportunities: activeOpportunities,
        rewardsCreditedPaise: rewardStats.amountPaise,
        rewardTransactions: rewardStats.count,
        walletAvailablePaise: walletStats.balancePaise,
        walletReservedPaise: walletStats.reservedPaise,
        pendingWithdrawalRequests: pendingStats.count,
        pendingWithdrawalAmountPaise: pendingStats.amountPaise,
        completedWithdrawals: null,
        completedWithdrawalAmountPaise: null,
        completedWithdrawalTracking: 'The current withdrawal model has no completed or paid state.',
      },
      series: { registrations: registrationSeries, posts: postSeries, assessments: assessmentSeries },
      platformActivity: { available: false, reason: 'Connected platform activity is not synchronized into Kozett records.' },
    })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseQuery(userListSchema, req.query)
    const filter: Record<string, unknown> = {}
    if (query.status !== 'all') filter.accountStatus = query.status
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i')
      filter.$or = [{ name: expression }, { username: expression }, { email: expression }]
    }
    const sortOrder = query.order === 'asc' ? 1 : -1
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id name username email createdAt accountStatus suspendedAt platforms projects adminAccess')
        .sort({ [query.sort]: sortOrder, _id: sortOrder })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      User.countDocuments(filter),
    ])
    const ids = users.map(({ _id }) => _id)
    const [ratings, certificates, wallets] = await Promise.all([
      DeveloperRating.find({ userId: { $in: ids } }).select('userId score rank dataCoverage isProvisional').lean(),
      Certificate.aggregate([
        { $match: { user: { $in: ids } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]),
      EarnWallet.find({ user: { $in: ids } }).select('user balancePaise reservedPaise').lean(),
    ])
    const ratingByUser = new Map(ratings.map((rating) => [String(rating.userId), rating]))
    const certificateCountByUser = new Map(certificates.map((item) => [String(item._id), item.count]))
    const walletByUser = new Map(wallets.map((wallet) => [String(wallet.user), wallet]))

    return res.json({
      success: true,
      page: query.page,
      limit: query.limit,
      total,
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        username: user.username ?? null,
        email: user.email,
        createdAt: user.createdAt,
        status: user.accountStatus ?? 'active',
        suspendedAt: user.suspendedAt ?? null,
        connectedPlatforms: (user.platforms ?? []).map(({ platform }) => platform),
        projectCount: user.projects?.length ?? 0,
        certificateCount: certificateCountByUser.get(String(user._id)) ?? 0,
        rating: serializeDeveloperRating(ratingByUser.get(String(user._id)) ?? null),
        wallet: walletByUser.get(String(user._id))
          ? {
              availablePaise: walletByUser.get(String(user._id))!.balancePaise,
              reservedPaise: walletByUser.get(String(user._id))!.reservedPaise,
            }
          : { availablePaise: 0, reservedPaise: 0 },
        adminRole: user.adminAccess?.active ? user.adminAccess.role : null,
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminUserDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = routeUserId(req)
    const user = await User.findById(userId)
      .select('_id name username email createdAt updatedAt emailVerifiedAt accountStatus suspendedAt suspensionReason platforms projects adminAccess')
      .lean()
    if (!user) throw new AppError('User was not found.', 404)
    const [rating, ratingHistory, certificates, recentSessions, wallet, ledger] = await Promise.all([
      DeveloperRating.findOne({ userId: user._id }).lean(),
      DeveloperRatingSnapshot.find({ userId: user._id }).sort({ calculatedAt: -1 }).limit(20).lean(),
      Certificate.find({ user: user._id }).sort({ issuedAt: -1 }).limit(25).select('certificateId assessment score issuedAt').lean(),
      Session.find({ user: user._id }).sort({ lastUsedAt: -1 }).limit(10).select('createdAt lastUsedAt expiresAt revokedAt').lean(),
      EarnWallet.findOne({ user: user._id }).select('balancePaise reservedPaise').lean(),
      EarnLedger.find({ user: user._id }).sort({ createdAt: -1 }).limit(25).select('type status amountPaise referenceId dateKey createdAt').lean(),
    ])
    return res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username ?? null,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
        status: user.accountStatus ?? 'active',
        suspendedAt: user.suspendedAt ?? null,
        suspensionReason: user.suspensionReason ?? null,
        connectedPlatforms: (user.platforms ?? []).map(({ platform }) => platform),
        projectCount: user.projects?.length ?? 0,
        adminRole: user.adminAccess?.active ? user.adminAccess.role : null,
        rating: serializeDeveloperRating(rating),
        ratingHistory: ratingHistory.map((snapshot) => serializeDeveloperRating(snapshot)),
        certificates: certificates.map((certificate) => ({
          id: String(certificate._id),
          credentialId: certificate.certificateId,
          assessmentId: String(certificate.assessment),
          score: certificate.score,
          issuedAt: certificate.issuedAt,
        })),
        sessions: recentSessions.map((session) => ({
          createdAt: session.createdAt,
          lastUsedAt: session.lastUsedAt,
          expiresAt: session.expiresAt,
          revoked: Boolean(session.revokedAt),
        })),
        wallet: wallet ? { availablePaise: wallet.balancePaise, reservedPaise: wallet.reservedPaise } : null,
        ledger: ledger.map((entry) => ({
          id: String(entry._id),
          type: entry.type,
          status: entry.status,
          amountPaise: entry.amountPaise,
          referenceId: String(entry.referenceId),
          dateKey: entry.dateKey ?? null,
          createdAt: entry.createdAt,
        })),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function setAdminUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = adminActor(req)
    const userId = routeUserId(req)
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'A status and reason are required.', 400)
    if (actor.id === userId) throw new AppError('You cannot change your own account status.', 400)
    if (parsed.data.status === 'suspended' && !['superadmin', 'admin'].includes(actor.role)) {
      throw new AppError('Your administrator role cannot suspend accounts.', 403)
    }

    const target = await User.findById(userId).select('_id adminAccess accountStatus')
    if (!target) throw new AppError('User was not found.', 404)
    if (target.adminAccess?.active && (actor.role !== 'superadmin' || target.adminAccess.role === 'superadmin')) {
      throw new AppError('Only a superadmin may suspend non-superadmin administrator accounts.', 403)
    }
    if (target.accountStatus === parsed.data.status) {
      throw new AppError(`Account is already ${parsed.data.status}.`, 409)
    }
    const previousStatus = target.accountStatus ?? 'active'
    const now = new Date()
    target.accountStatus = parsed.data.status
    target.suspendedAt = parsed.data.status === 'suspended' ? now : null
    target.suspensionReason = parsed.data.status === 'suspended' ? parsed.data.reason : null
    await target.save()
    if (parsed.data.status === 'suspended') await Session.deleteMany({ user: target._id })
    await writeAdminAudit({
      adminId: actor.id,
      adminRole: actor.role,
      action: parsed.data.status === 'suspended' ? 'user.suspend' : 'user.reactivate',
      targetType: 'user',
      targetId: String(target._id),
      reason: parsed.data.reason,
      metadata: { previousStatus, status: parsed.data.status },
    })
    return res.json({ success: true, status: parsed.data.status })
  } catch (error) {
    return next(error)
  }
}

export async function recalculateUserRating(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = routeUserId(req)
    const actor = adminActor(req)
    const targetExists = await User.exists({ _id: userId })
    if (!targetExists) throw new AppError('User was not found.', 404)
    const rating = await recalculateDeveloperRating(userId)
    await writeAdminAudit({
      adminId: actor.id,
      adminRole: actor.role,
      action: 'user.kdr_recalculate',
      targetType: 'user',
      targetId: userId,
    })
    return res.json({ success: true, rating })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminCertificates(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseQuery(certificateListSchema, req.query)
    const filter: Record<string, unknown> = {}
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i')
      const [matchingUsers, matchingAssessments] = await Promise.all([
        User.find({ $or: [{ name: expression }, { username: expression }, { email: expression }] }).select('_id').lean(),
        Assessment.find({ $or: [{ title: expression }, { technology: expression }] }).select('_id').lean(),
      ])
      filter.$or = [
        { certificateId: expression },
        { user: { $in: matchingUsers.map(({ _id }: { _id: Types.ObjectId }) => _id) } },
        { assessment: { $in: matchingAssessments.map(({ _id }: { _id: Types.ObjectId }) => _id) } },
      ]
    }
    const [certificates, total] = await Promise.all([
      Certificate.find(filter)
        .sort({ issuedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate({ path: 'user', select: 'name username email' })
        .populate({ path: 'assessment', select: 'title technology category' })
        .lean(),
      Certificate.countDocuments(filter),
    ])
    return res.json({
      success: true,
      page: query.page,
      limit: query.limit,
      total,
      certificates: certificates.map((certificate) => {
        const recipient = certificate.user as unknown as { name?: string; username?: string; email?: string } | null
        const assessment = certificate.assessment as unknown as { title?: string; technology?: string; category?: string } | null
        return {
          id: String(certificate._id),
          credentialId: certificate.certificateId,
          recipient: { name: recipient?.name ?? 'Unknown user', username: recipient?.username ?? null, email: recipient?.email ?? '' },
          assessment: { title: assessment?.title ?? 'Unknown assessment', technology: assessment?.technology ?? 'Unknown', category: assessment?.category ?? 'Unknown' },
          score: certificate.score,
          issuedAt: certificate.issuedAt,
          revokedAt: certificate.revokedAt ?? null,
          revocationReason: certificate.revocationReason ?? null,
        }
      }),
    })
  } catch (error) {
    return next(error)
  }
}

export async function revokeAdminCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = adminActor(req)
    const certificateId = req.params.certificateId
    if (typeof certificateId !== 'string' || certificateId.length < 8 || certificateId.length > 128) {
      throw new AppError('Certificate was not found.', 404)
    }
    const parsed = z.object({ reason: z.string().trim().min(5).max(500) }).strict().safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'A revocation reason is required.', 400)
    const certificate = await Certificate.findOneAndUpdate(
      { certificateId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedBy: actor.id, revocationReason: parsed.data.reason } },
      { new: true },
    ).select('_id certificateId revokedAt')
    if (!certificate) {
      if (!await Certificate.exists({ certificateId })) throw new AppError('Certificate was not found.', 404)
      throw new AppError('Certificate has already been revoked.', 409)
    }
    await writeAdminAudit({
      adminId: actor.id,
      adminRole: actor.role,
      action: 'certificate.revoke',
      targetType: 'certificate',
      targetId: certificate.certificateId,
      reason: parsed.data.reason,
    })
    return res.json({ success: true, revokedAt: certificate.revokedAt })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminReports(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseQuery(reportListSchema, req.query)
    const offset = (query.page - 1) * query.limit
    const filter = query.status === 'all'
      ? {}
      : query.status === 'open'
        ? { $or: [{ status: 'open' }, { status: { $exists: false } }] }
        : { status: query.status }
    const [postReports, commentReports, postTotal, commentTotal] = await Promise.all([
      FeedReport.find(filter).sort({ createdAt: -1, _id: -1 }).limit(offset + query.limit)
        .populate({ path: 'reporter', select: 'name username email' })
        .populate({ path: 'post', select: 'text hashtags createdAt author', populate: { path: 'author', select: 'name username' } }).lean(),
      FeedCommentReport.find(filter).sort({ createdAt: -1, _id: -1 }).limit(offset + query.limit)
        .populate({ path: 'reporter', select: 'name username email' })
        .populate({ path: 'comment', select: 'text createdAt author post', populate: [
          { path: 'author', select: 'name username' },
          { path: 'post', select: 'text createdAt author', populate: { path: 'author', select: 'name username' } },
        ] }).lean(),
      FeedReport.countDocuments(filter),
      FeedCommentReport.countDocuments(filter),
    ])
    const items = [
      ...postReports.map((report) => {
        const reporter = report.reporter as unknown as { name?: string; username?: string } | null
        const post = report.post as unknown as { text?: string; hashtags?: string[]; author?: { name?: string; username?: string } } | null
        return {
          id: String(report._id),
          kind: 'post' as const,
          targetId: report.post ? String((report.post as unknown as { _id?: unknown })._id ?? '') : '',
          targetText: post?.text ?? '[Post no longer exists]',
          targetAuthor: post?.author?.name ?? 'Unknown user',
          reporter: reporter?.name ?? 'Unknown user',
          reason: report.reason,
          details: report.details,
          status: report.status,
          resolutionReason: report.resolutionReason,
          createdAt: report.createdAt,
        }
      }),
      ...commentReports.map((report) => {
        const reporter = report.reporter as unknown as { name?: string; username?: string } | null
        const comment = report.comment as unknown as {
          _id?: unknown; text?: string; author?: { name?: string; username?: string }
          post?: { text?: string; author?: { name?: string } }
        } | null
        return {
          id: String(report._id),
          kind: 'comment' as const,
          targetId: comment?._id ? String(comment._id) : '',
          targetText: comment?.text ?? '[Comment no longer exists]',
          targetAuthor: comment?.author?.name ?? 'Unknown user',
          context: comment?.post?.text ?? null,
          contextAuthor: comment?.post?.author?.name ?? null,
          reporter: reporter?.name ?? 'Unknown user',
          reason: report.reason,
          details: report.details,
          status: report.status,
          resolutionReason: report.resolutionReason,
          createdAt: report.createdAt,
        }
      }),
    ].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()).slice(offset, offset + query.limit)
    return res.json({ success: true, page: query.page, limit: query.limit, total: postTotal + commentTotal, items })
  } catch (error) {
    return next(error)
  }
}

export async function resolveAdminReport(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = adminActor(req)
    const kind = req.params.kind
    const reportId = req.params.reportId
    if ((kind !== 'post' && kind !== 'comment') || typeof reportId !== 'string' || !Types.ObjectId.isValid(reportId)) {
      throw new AppError('Report was not found.', 404)
    }
    const parsed = reportResolutionSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'A resolution and reason are required.', 400)
    const update = {
      $set: { status: parsed.data.status, resolvedAt: new Date(), resolvedBy: actor.id, resolutionReason: parsed.data.reason },
    }
    const report = kind === 'post'
      ? await FeedReport.findOneAndUpdate({ _id: reportId, $or: [{ status: 'open' }, { status: { $exists: false } }] }, update, { new: true }).select('_id status')
      : await FeedCommentReport.findOneAndUpdate({ _id: reportId, $or: [{ status: 'open' }, { status: { $exists: false } }] }, update, { new: true }).select('_id status')
    if (!report) {
      const exists = kind === 'post' ? await FeedReport.exists({ _id: reportId }) : await FeedCommentReport.exists({ _id: reportId })
      if (!exists) throw new AppError('Report was not found.', 404)
      throw new AppError('Report has already been reviewed.', 409)
    }
    await writeAdminAudit({
      adminId: actor.id,
      adminRole: actor.role,
      action: parsed.data.status === 'resolved' ? 'report.resolve' : 'report.dismiss',
      targetType: `${kind}_report`,
      targetId: String(report._id),
      reason: parsed.data.reason,
    })
    return res.json({ success: true, status: report.status })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminWithdrawals(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseQuery(withdrawalListSchema, req.query)
    const filter: Record<string, unknown> = {}
    if (query.status !== 'all') filter.status = query.status
    if (query.minPaise !== undefined || query.maxPaise !== undefined) {
      filter.amountPaise = {
        ...(query.minPaise === undefined ? {} : { $gte: query.minPaise }),
        ...(query.maxPaise === undefined ? {} : { $lte: query.maxPaise }),
      }
    }
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { $lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000) } : {}),
      }
    }
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i')
      const users = await User.find({ $or: [{ name: expression }, { username: expression }, { email: expression }] }).select('_id').lean()
      filter.user = { $in: users.map(({ _id }) => _id) }
    }
    const [withdrawals, total] = await Promise.all([
      EarnWithdrawal.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit)
        .populate({ path: 'user', select: 'name username email' }).lean(),
      EarnWithdrawal.countDocuments(filter),
    ])
    const userIds = withdrawals.flatMap(({ user }) => {
      const populatedId = (user as unknown as { _id?: Types.ObjectId } | null)?._id
      return populatedId ? [populatedId] : []
    })
    const withdrawalIds = withdrawals.map(({ _id }) => _id)
    const [wallets, ledgerEntries] = await Promise.all([
      EarnWallet.find({ user: { $in: userIds } }).select('user balancePaise reservedPaise').lean(),
      EarnLedger.find({ referenceId: { $in: withdrawalIds } }).select('user status amountPaise referenceId createdAt').lean(),
    ])
    const walletByUser = new Map(wallets.map((wallet) => [String(wallet.user), wallet]))
    const ledgerByWithdrawal = new Map(ledgerEntries.map((entry) => [String(entry.referenceId), entry]))
    return res.json({
      success: true,
      page: query.page,
      limit: query.limit,
      total,
      payoutCompletionSupported: false,
      withdrawals: withdrawals.map((withdrawal) => {
        const user = withdrawal.user as unknown as { _id: Types.ObjectId; name?: string; username?: string; email?: string } | null
        const wallet = user ? walletByUser.get(String(user._id)) : null
        const ledger = ledgerByWithdrawal.get(String(withdrawal._id))
        return {
          id: String(withdrawal._id),
          user: { id: user ? String(user._id) : '', name: user?.name ?? 'Unknown user', username: user?.username ?? null, email: user?.email ?? '' },
          amountPaise: withdrawal.amountPaise,
          payoutMethod: withdrawal.payoutMethod,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
          wallet: wallet ? { availablePaise: wallet.balancePaise, reservedPaise: wallet.reservedPaise } : null,
          ledger: ledger ? { id: String(ledger._id), status: ledger.status, amountPaise: ledger.amountPaise, createdAt: ledger.createdAt } : null,
        }
      }),
    })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseQuery(auditListSchema, req.query)
    const filter = query.action ? { action: query.action } : {}
    const [items, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate({ path: 'adminId', select: 'name email' })
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ])
    return res.json({
      success: true,
      page: query.page,
      limit: query.limit,
      total,
      items: items.map((item) => ({
        id: String(item._id),
        administrator: item.adminId && typeof item.adminId === 'object'
          ? { name: (item.adminId as unknown as { name?: string }).name ?? 'Administrator', email: (item.adminId as unknown as { email?: string }).email ?? '' }
          : { name: 'Administrator', email: '' },
        role: item.adminRole,
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        reason: item.reason,
        outcome: item.outcome,
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
    })
  } catch (error) {
    return next(error)
  }
}
