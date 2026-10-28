import type { NextFunction, Request, Response } from 'express'
import { AppError } from './error.middleware.js'
import type { AdminRole } from '../models/User.js'

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.adminAccess?.active !== true || !req.user.adminAccess.role) {
    return next(new AppError('Administrator access required.', 403))
  }
  if (req.user.accountStatus === 'suspended') {
    return next(new AppError('This administrator account is suspended.', 403))
  }
  return next()
}

export function requireAdminRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.adminAccess?.role
    if (!role || !roles.includes(role)) {
      return next(new AppError('Your administrator role cannot perform this action.', 403))
    }
    return next()
  }
}

export function requireAdminPasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.adminAccess?.mustChangePassword) {
    return next(new AppError('Change the initial administrator password before continuing.', 403))
  }
  return next()
}
