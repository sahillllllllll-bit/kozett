import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { getCheckInStatus, getEarnTransactions, getEarnSummary } from './earn.controller.js'
import { AppError } from '../middleware/error.middleware.js'

async function capturedError(
  controller: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  request: Partial<Request>,
) {
  let error: unknown
  await controller(
    request as Request,
    {} as Response,
    ((value: unknown) => { error = value }) as NextFunction,
  )
  return error
}

test('Earn summary and check-in status reject missing authenticated users before database access', async () => {
  const summaryError = await capturedError(getEarnSummary, {})
  const checkInError = await capturedError(getCheckInStatus, {})

  assert.ok(summaryError instanceof AppError)
  assert.equal(summaryError.statusCode, 401)
  assert.ok(checkInError instanceof AppError)
  assert.equal(checkInError.statusCode, 401)
})

test('transaction pagination rejects invalid page numbers', async () => {
  const error = await capturedError(getEarnTransactions, {
    user: { _id: '507f1f77bcf86cd799439011', name: 'Tester', email: 'test@example.test' },
    query: { page: '0' },
  })

  assert.ok(error instanceof AppError)
  assert.equal(error.statusCode, 400)
})
