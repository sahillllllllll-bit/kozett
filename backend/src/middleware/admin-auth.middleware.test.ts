import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { requireAdmin, requireAdminPasswordChanged, requireAdminRole } from './admin-auth.middleware.js'

function callMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  user: Record<string, unknown>,
) {
  let passed = false
  let error: unknown
  middleware(
    { user } as unknown as Request,
    {} as Response,
    ((nextError?: unknown) => {
      error = nextError
      passed = !nextError
    }) as NextFunction,
  )
  return { passed, error }
}

test('admin middleware admits only active, unsuspended administrators', () => {
  const admin = callMiddleware(requireAdmin, {
    adminAccess: { active: true, role: 'admin' },
    accountStatus: 'active',
  })
  assert.equal(admin.passed, true)
  assert.equal(admin.error, undefined)

  const regularUser = callMiddleware(requireAdmin, {})
  assert.equal(regularUser.passed, false)
  assert.equal((regularUser.error as { statusCode?: number }).statusCode, 403)

  const suspendedAdmin = callMiddleware(requireAdmin, {
    adminAccess: { active: true, role: 'admin' },
    accountStatus: 'suspended',
  })
  assert.equal(suspendedAdmin.passed, false)
  assert.equal((suspendedAdmin.error as { statusCode?: number }).statusCode, 403)
})

test('role middleware rejects administrators without the required role', () => {
  const result = callMiddleware(requireAdminRole('superadmin', 'admin'), {
    adminAccess: { active: true, role: 'moderator' },
  })
  assert.equal(result.passed, false)
  assert.equal((result.error as { statusCode?: number }).statusCode, 403)
})

test('first-password gate blocks admin tools until the password is changed', () => {
  const required = callMiddleware(requireAdminPasswordChanged, {
    adminAccess: { mustChangePassword: true },
  })
  assert.equal(required.passed, false)

  const changed = callMiddleware(requireAdminPasswordChanged, {
    adminAccess: { mustChangePassword: false },
  })
  assert.equal(changed.passed, true)
})
