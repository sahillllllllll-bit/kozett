import type { NextFunction, Request, Response } from 'express'

export class AppError extends Error {
  statusCode: number
  status: string
  isOperational: boolean

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
    this.isOperational = true
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Requested resource was not found.', 404))
}

export function errorMiddleware(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = error instanceof AppError ? error.statusCode : 500
  const message = error instanceof AppError ? error.message : 'Something went wrong. Please try again later.'

  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', error)
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && error instanceof Error ? { stack: error.stack } : {}),
  })
}
