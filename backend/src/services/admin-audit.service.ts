import type { Types } from 'mongoose'
import { AdminAuditLog } from '../models/AdminAuditLog.js'
import type { AdminRole } from '../models/User.js'

export async function writeAdminAudit(input: {
  adminId: Types.ObjectId | string
  adminRole: AdminRole
  action: string
  targetType: string
  targetId: string
  reason?: string | null
  metadata?: Record<string, string | number | boolean | null>
}) {
  await AdminAuditLog.create({
    ...input,
    reason: input.reason ?? null,
    outcome: 'success',
    metadata: input.metadata ?? {},
  })
}
