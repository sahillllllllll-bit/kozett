import mongoose, { Types, type ClientSession } from 'mongoose'
import { env } from '../config/env.js'
import { EarnCheckIn } from '../models/EarnCheckIn.js'
import { EarnCheckInState } from '../models/EarnCheckInState.js'
import { EarnLedger, type EarnLedgerType } from '../models/EarnLedger.js'
import { EarnOpportunity } from '../models/EarnOpportunity.js'
import { EarnWallet } from '../models/EarnWallet.js'
import { EarnWithdrawal } from '../models/EarnWithdrawal.js'
import { assertDailyCheckInEnabled, consecutiveStreakDay, indiaDateKey, rewardForStreakDay } from '../utils/earn-logic.js'

const sessionOptions = (session?: ClientSession) => session ? { session } : {}

function isTransactionUnsupported(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: number; message?: string }
  return candidate.code === 20 ||
    candidate.code === 263 ||
    candidate.message?.includes('Transaction numbers are only allowed') === true ||
    candidate.message?.includes('does not support transactions') === true
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000)
}

async function withOptionalTransaction<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession()
  try {
    try {
      session.startTransaction()
      const result = await operation(session)
      await session.commitTransaction()
      return result
    } catch (error) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction()
        } catch {
          // Keep the original write error so standalone deployments can use the atomic fallback.
        }
      }
      if (isTransactionUnsupported(error)) return operation()
      throw error
    }
  } finally {
    await session.endSession()
  }
}

async function getOrCreateWallet(user: Types.ObjectId, session?: ClientSession) {
  try {
    return await EarnWallet.findOneAndUpdate(
      { user },
      { $setOnInsert: { user, balancePaise: 0, reservedPaise: 0, appliedOperationKeys: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOptions(session) },
    )
  } catch (error) {
    if (session || !isDuplicateKey(error)) throw error
    const wallet = await EarnWallet.findOne({ user })
    if (!wallet) throw error
    return wallet
  }
}

async function ensureLedger(input: {
  user: Types.ObjectId
  operationKey: string
  type: EarnLedgerType
  amountPaise: number
  referenceId: Types.ObjectId
  dateKey?: string
}, session?: ClientSession) {
  return EarnLedger.findOneAndUpdate(
    { user: input.user, operationKey: input.operationKey },
    { $setOnInsert: { ...input, status: 'pending' } },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOptions(session) },
  )
}

async function syncCheckInState(user: Types.ObjectId, session?: ClientSession) {
  const latest = await EarnCheckIn.findOne({ user }).sort({ dateKey: -1 }).session(session ?? null)
  const totalCheckIns = await EarnCheckIn.countDocuments({ user }, sessionOptions(session))
  if (!latest) return
  await EarnCheckInState.findOneAndUpdate(
    { user },
    {
      $set: {
        lastCheckInDate: latest.dateKey,
        currentStreak: latest.streakDay,
        totalCheckIns,
      },
      $setOnInsert: { user },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOptions(session) },
  )
}

async function runCheckIn(user: Types.ObjectId, dateKey: string, session?: ClientSession) {
  const wallet = await getOrCreateWallet(user, session)
  let checkIn = await EarnCheckIn.findOne({ user, dateKey }).session(session ?? null)
  let alreadyCheckedIn = Boolean(checkIn)

  if (!checkIn) {
    const previous = await EarnCheckIn.findOne({ user, dateKey: { $lt: dateKey } })
      .sort({ dateKey: -1 })
      .session(session ?? null)
    const streakDay = consecutiveStreakDay(previous?.dateKey ?? null, previous?.streakDay ?? 0, dateKey)
    const operationKey = `checkin:${dateKey}`
    checkIn = new EarnCheckIn({ user, dateKey, streakDay, rewardPaise: rewardForStreakDay(streakDay), operationKey })
    await checkIn.save(sessionOptions(session))
    alreadyCheckedIn = false
  }

  const operationKey = `checkin:${dateKey}`
  const ledger = await ensureLedger({
    user,
    operationKey,
    type: 'check_in_reward',
    amountPaise: checkIn.rewardPaise,
    referenceId: checkIn._id,
    dateKey,
  }, session)

  const applied = await EarnWallet.updateOne(
    { user, appliedOperationKeys: { $ne: operationKey } },
    { $inc: { balancePaise: checkIn.rewardPaise }, $addToSet: { appliedOperationKeys: operationKey } },
    sessionOptions(session),
  )
  if (applied.modifiedCount > 0 || wallet.appliedOperationKeys.includes(operationKey)) {
    await EarnLedger.updateOne({ _id: ledger._id, user }, { $set: { status: 'applied' } }, sessionOptions(session))
  }

  await syncCheckInState(user, session)
  const currentWallet = await EarnWallet.findOne({ user }).session(session ?? null)
  return {
    checkIn,
    wallet: currentWallet ?? wallet,
    alreadyCheckedIn,
  }
}

export async function recordDailyCheckIn(user: Types.ObjectId, dateKey = indiaDateKey(new Date())) {
  assertDailyCheckInEnabled(env.EARN_DAILY_CHECK_IN_ENABLED)
  try {
    return await withOptionalTransaction((session) => runCheckIn(user, dateKey, session))
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
    return withOptionalTransaction((session) => runCheckIn(user, dateKey, session))
  }
}

async function runWithdrawal(input: {
  user: Types.ObjectId
  operationKey: string
  amountPaise: number
}, session?: ClientSession) {
  await getOrCreateWallet(input.user, session)
  let withdrawal = await EarnWithdrawal.findOne({
    user: input.user,
    idempotencyKey: input.operationKey,
  }).session(session ?? null)

  if (withdrawal && withdrawal.amountPaise !== input.amountPaise) {
    throw Object.assign(new Error('This idempotency key was already used for a different withdrawal.'), { statusCode: 409 })
  }
  if (!withdrawal) {
    withdrawal = new EarnWithdrawal({
      user: input.user,
      idempotencyKey: input.operationKey,
      amountPaise: input.amountPaise,
      payoutMethod: 'manual_review',
      status: 'processing',
    })
    await withdrawal.save(sessionOptions(session))
  }
  if (withdrawal.status === 'rejected') return { withdrawal, wallet: await EarnWallet.findOne({ user: input.user }).session(session ?? null) }

  const ledger = await ensureLedger({
    user: input.user,
    operationKey: `withdrawal:${input.operationKey}`,
    type: 'withdrawal_reservation',
    amountPaise: input.amountPaise,
    referenceId: withdrawal._id,
  }, session)

  const reservationKey = `withdrawal:${input.operationKey}`
  const reserved = await EarnWallet.updateOne(
    { user: input.user, balancePaise: { $gte: input.amountPaise }, appliedOperationKeys: { $ne: reservationKey } },
    {
      $inc: { balancePaise: -input.amountPaise, reservedPaise: input.amountPaise },
      $addToSet: { appliedOperationKeys: reservationKey },
    },
    sessionOptions(session),
  )
  const wallet = await EarnWallet.findOne({ user: input.user }).session(session ?? null)
  const alreadyReserved = wallet?.appliedOperationKeys.includes(reservationKey) === true

  if (reserved.modifiedCount > 0 || alreadyReserved) {
    await EarnLedger.updateOne({ _id: ledger._id, user: input.user }, { $set: { status: 'applied' } }, sessionOptions(session))
    if (withdrawal.status !== 'review_pending') {
      withdrawal.status = 'review_pending'
      await withdrawal.save(sessionOptions(session))
    }
  } else {
    await EarnLedger.updateOne({ _id: ledger._id, user: input.user }, { $set: { status: 'failed' } }, sessionOptions(session))
    if (withdrawal.status !== 'review_pending') {
      withdrawal.status = 'rejected'
      await withdrawal.save(sessionOptions(session))
    }
  }

  return { withdrawal, wallet }
}

export async function requestWithdrawal(input: {
  user: Types.ObjectId
  operationKey: string
  amountPaise: number
}) {
  if (input.amountPaise < env.EARN_MIN_WITHDRAWAL_PAISE) {
    throw Object.assign(new Error(`Minimum withdrawal is ${env.EARN_MIN_WITHDRAWAL_PAISE} paise.`), { statusCode: 400 })
  }
  try {
    return await withOptionalTransaction((session) => runWithdrawal(input, session))
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
    return withOptionalTransaction((session) => runWithdrawal(input, session))
  }
}

export async function ensureConfiguredDailyCheckInOpportunity() {
  if (!env.EARN_DAILY_CHECK_IN_ENABLED) return []
  try {
    await EarnOpportunity.findOneAndUpdate(
      { code: 'daily-check-in' },
      {
        $set: {
          title: 'Daily Check-in',
          description: 'Earn a daily check-in reward. Rewards increase with a consecutive daily streak.',
          type: 'daily_check_in',
          configured: true,
          active: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
  }
  return EarnOpportunity.find({
    code: 'daily-check-in',
    type: 'daily_check_in',
    active: true,
    configured: true,
  }).sort({ createdAt: 1 }).lean()
}

export { getOrCreateWallet }
