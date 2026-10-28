import { env } from '../config/env.js'

export type PasswordResetMessage = {
  email: string
  otp: string
  expiresAt: Date
  scope: 'user' | 'admin'
}

export interface PasswordResetDeliveryService {
  deliver(message: PasswordResetMessage): Promise<{ developmentOtp?: string }>
}

export class DevelopmentPasswordResetDeliveryService implements PasswordResetDeliveryService {
  async deliver({ otp }: PasswordResetMessage) {
    if (!env.PASSWORD_RESET_DEV_OTP_ENABLED) return {}
    return { developmentOtp: otp }
  }
}

export const passwordResetDeliveryService: PasswordResetDeliveryService =
  new DevelopmentPasswordResetDeliveryService()
