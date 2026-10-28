import type { NextFunction, Request, Response } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { env } from '../config/env.js'
import { EarnCheckIn } from '../models/EarnCheckIn.js'
import { EarnCheckInState } from '../models/EarnCheckInState.js'
import { EarnLedger } from '../models/EarnLedger.js'
import { EarnWithdrawal } from '../models/EarnWithdrawal.js'
import { AppError } from '../middleware/error.middleware.js'
import {
  ensureConfiguredDailyCheckInOpportunity,
  getOrCreateWallet,
  recordDailyCheckIn,
  requestWithdrawal,
} from '../services/earn.service.js'
import { activeStreakForDate, consecutiveStreakDay, indiaDateKey, rewardForStreakDay, withdrawalOperationKey } from '../utils/earn-logic.js'

function authenticatedUserId(req: Request): Types.ObjectId {
  if (!req.user?._id) throw new AppError('Authentication required.', 401)
  try {
    return new Types.ObjectId(String(req.user._id))
  } catch {
    throw new AppError('Authentication required.', 401)
  }
}

function pageParameters(req: Request) {
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new AppError('Page and limit must be positive integers.', 400)
  }
  return { page, limit: Math.min(limit, 100) }
}

const withdrawalBodySchema = z.object({
  amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  payoutMethod: z.literal('manual_review'),
  idempotencyKey: z.string().trim().min(1).max(128).regex(/^[\w.:~-]+$/).optional(),
}).strict()

const rewardSchedule = [
  { dayFrom: 1, dayTo: 10, rewardPaise: 100 },
  { dayFrom: 11, dayTo: 20, rewardPaise: 200 },
  { dayFrom: 21, dayTo: null, rewardPaise: 500 },
] as const

async function summaryFor(user: Types.ObjectId) {
  const [wallet, state, earned, pendingRewards] = await Promise.all([
    getOrCreateWallet(user),
    EarnCheckInState.findOne({ user }).lean(),
    EarnLedger.aggregate([
      { $match: { user, type: 'check_in_reward', status: 'applied' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    EarnLedger.aggregate([
      { $match: { user, type: 'check_in_reward', status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
  ])
  const today = indiaDateKey(new Date())
  return {
    totalEarningsPaise: earned[0]?.total ?? 0,
    availableBalancePaise: wallet.balancePaise,
    pendingWithdrawalsPaise: wallet.reservedPaise,
    totalWithdrawnPaise: 0,
    pendingRewardsPaise: pendingRewards[0]?.total ?? 0,
    currentStreak: activeStreakForDate(state?.lastCheckInDate ?? null, state?.currentStreak ?? 0, today),
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    minimumWithdrawalPaise: env.EARN_MIN_WITHDRAWAL_PAISE,
  }
}

async function checkInPayload(user: Types.ObjectId) {
  const checkInDate = indiaDateKey(new Date())
  const enabled = env.EARN_DAILY_CHECK_IN_ENABLED
  const [checkIn, state] = await Promise.all([
    EarnCheckIn.findOne({ user, dateKey: checkInDate }).lean(),
    EarnCheckInState.findOne({ user }).lean(),
  ])
  const checkedInToday = Boolean(checkIn)
  const currentStreak = activeStreakForDate(state?.lastCheckInDate ?? null, state?.currentStreak ?? 0, checkInDate)
  const nextStreakDay = checkedInToday
    ? (checkIn?.streakDay ?? 0) + 1
    : consecutiveStreakDay(state?.lastCheckInDate ?? null, currentStreak, checkInDate)
  const todayStreakDay = checkedInToday ? checkIn!.streakDay : nextStreakDay
  return {
    enabled,
    claimStatus: !enabled ? 'disabled' : checkedInToday ? 'already_claimed' : 'available',
    checkedInToday,
    currentStreak: checkedInToday ? checkIn!.streakDay : currentStreak,
    todayRewardPaise: checkIn?.rewardPaise ?? rewardForStreakDay(todayStreakDay),
    nextRewardPaise: rewardForStreakDay(todayStreakDay + 1),
    nextStreakDay,
    checkInDate,
    timezone: 'Asia/Kolkata',
    schedule: rewardSchedule,
  }
}

function serializeWithdrawal(withdrawal: {
  _id: unknown
  amountPaise: number
  payoutMethod: 'manual_review'
  status: string
  createdAt?: Date
  updatedAt?: Date
}) {
  return {
    id: String(withdrawal._id),
    amountPaise: withdrawal.amountPaise,
    currency: 'INR',
    payoutMethod: withdrawal.payoutMethod,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    updatedAt: withdrawal.updatedAt,
  }
}

export async function getEarnSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const user = authenticatedUserId(req)
    return res.json({
      success: true,
      summary: await summaryFor(user),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getEarnOpportunities(_req: Request, res: Response, next: NextFunction) {
  try {
    const user = authenticatedUserId(_req)
    const opportunities = await ensureConfiguredDailyCheckInOpportunity()
    const checkIn = await checkInPayload(user)
    return res.json({
      success: true,
      opportunities: opportunities.map((opportunity) => ({
        id: opportunity.code,
        title: opportunity.title,
        description: opportunity.description,
        category: 'daily_check_in',
        tags: ['daily', 'streak'],
        rewardPaise: checkIn.todayRewardPaise,
        status: checkIn.checkedInToday ? 'completed' : 'available',
        estimatedEffort: '1 minute',
        availabilityMessage: checkIn.checkedInToday
          ? 'You have already checked in today.'
          : 'Available once per India calendar day.',
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getCheckInStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = authenticatedUserId(req)
    return res.json({
      success: true,
      checkIn: await checkInPayload(user),
    })
  } catch (error) {
    return next(error)
  }
}

export async function postCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recordDailyCheckIn(authenticatedUserId(req))
    return res.json({
      success: true,
      checkIn: {
        checkedInToday: true,
        streakDay: result.checkIn.streakDay,
        currentStreak: result.checkIn.streakDay,
        checkInDate: result.checkIn.dateKey,
        todayRewardPaise: result.checkIn.rewardPaise,
        rewardPaise: result.checkIn.rewardPaise,
        timezone: 'Asia/Kolkata',
        alreadyCheckedIn: result.alreadyCheckedIn,
      },
      summary: await summaryFor(authenticatedUserId(req)),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getEarnTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = authenticatedUserId(req)
    const { page, limit } = pageParameters(req)
    const type = req.query.type
    if (type !== undefined && type !== 'check_in_reward' && type !== 'withdrawal_reservation') {
      throw new AppError('Unsupported transaction type.', 400)
    }
    const filter = { user, status: 'applied', ...(type ? { type } : {}) }
    const [transactions, total] = await Promise.all([
      EarnLedger.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EarnLedger.countDocuments(filter),
    ])
    return res.json({
      success: true,
      transactions: transactions.map((transaction) => ({
        id: String(transaction._id),
        type: transaction.type,
        amountPaise: transaction.amountPaise,
        currency: 'INR',
        status: transaction.type === 'withdrawal_reservation'
          ? 'review_pending'
          : transaction.status === 'applied' ? 'confirmed' : transaction.status,
        date: transaction.createdAt,
        dateKey: transaction.dateKey ?? null,
        referenceId: String(transaction.referenceId),
      })),
      page,
      pages: Math.ceil(total / limit),
      total,
    })
  } catch (error) {
    return next(error)
  }
}

export async function postWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = withdrawalBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid withdrawal request.', 400)
    }
    const user = authenticatedUserId(req)
    const rawIdempotencyKey = parsed.data.idempotencyKey || req.get('Idempotency-Key') || ''
    const operationKey = withdrawalOperationKey(String(user), rawIdempotencyKey)
    if (!operationKey) throw new AppError('A valid idempotencyKey or Idempotency-Key header is required.', 400)
    const result = await requestWithdrawal({
      user,
      operationKey,
      amountPaise: parsed.data.amountPaise,
    })
    if (result.withdrawal.status === 'rejected') {
      throw new AppError('Insufficient available balance for this withdrawal.', 409)
    }
    return res.status(202).json({
      success: true,
      request: serializeWithdrawal(result.withdrawal),
      summary: await summaryFor(user),
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && !(error instanceof AppError)) {
      const candidate = error as unknown as Error & { statusCode: number }
      return next(new AppError(candidate.message, Number(candidate.statusCode)))
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
      return next(new AppError('Invalid withdrawal request.', 400))
    }
    if (error instanceof Error && error.message.startsWith('Minimum withdrawal is ')) {
      return next(new AppError(error.message, 400))
    }
    return next(error)
  }
}

export async function getEarnWithdrawals(req: Request, res: Response, next: NextFunction) {
  try {
    const user = authenticatedUserId(req)
    const { page, limit } = pageParameters(req)
    const filter = { user }
    const [withdrawals, total] = await Promise.all([
      EarnWithdrawal.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      EarnWithdrawal.countDocuments(filter),
    ])
    return res.json({
      success: true,
      withdrawals: withdrawals.map(serializeWithdrawal),
      page,
      pages: Math.ceil(total / limit),
      total,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getEarnWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const user = authenticatedUserId(req)
    const withdrawalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!withdrawalId || !Types.ObjectId.isValid(withdrawalId)) throw new AppError('Withdrawal was not found.', 404)
    const withdrawal = await EarnWithdrawal.findOne({ _id: withdrawalId, user }).lean()
    if (!withdrawal) throw new AppError('Withdrawal was not found.', 404)
    return res.json({ success: true, request: serializeWithdrawal(withdrawal) })
  } catch (error) {
    return next(error)
  }
}
