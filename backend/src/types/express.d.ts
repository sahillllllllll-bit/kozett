declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: unknown
        name: string
        email: string
        username?: string
        avatar?: string | null
        bio?: string | null
        emailVerifiedAt?: Date | null
        accountStatus?: 'active' | 'suspended'
        suspendedAt?: Date | null
        suspensionReason?: string | null
        adminAccess?: {
          role: 'superadmin' | 'admin' | 'finance_admin' | 'moderator'
          active: boolean
          mustChangePassword: boolean
        } | null
      }
    }
  }
}

export {}
