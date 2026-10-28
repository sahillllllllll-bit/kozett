import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { requestPasswordReset } from './password-reset.controller.js'
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

test('requestPasswordReset rejects invalid email format with 400', async () => {
  const error = await capturedError(
    (req, res, next) => requestPasswordReset(req, res, next, 'user'),
    { body: { email: 'not-an-email' } },
  )

  assert.ok(error instanceof AppError)
  assert.equal(error.statusCode, 400)
  assert.equal(error.message, 'Enter a valid email address.')
})

test('requestPasswordReset rejects missing email with 400', async () => {
  const error = await capturedError(
    (req, res, next) => requestPasswordReset(req, res, next, 'user'),
    { body: {} },
  )

  assert.ok(error instanceof AppError)
  assert.equal(error.statusCode, 400)
  assert.equal(error.message, 'Enter a valid email address.')
})
