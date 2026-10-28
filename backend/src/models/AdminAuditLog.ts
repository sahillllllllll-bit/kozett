import { Schema, model, Types } from 'mongoose'
import type { AdminRole } from './User.js'

export interface IAdminAuditLog {
  adminId: Types.ObjectId
  adminRole: AdminRole
  action: string
  targetType: string
  targetId: string
  reason: string | null
  outcome: 'success' | 'failure'
  metadata: Record<string, string | number | boolean | null>
  createdAt?: Date
}

const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminRole: { type: String, enum: ['superadmin', 'admin', 'finance_admin', 'moderator'], required: true },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    targetType: { type: String, required: true, trim: true, maxlength: 80 },
    targetId: { type: String, required: true, trim: true, maxlength: 128 },
    reason: { type: String, trim: true, maxlength: 500, default: null },
    outcome: { type: String, enum: ['success', 'failure'], required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

adminAuditLogSchema.index({ createdAt: -1 })
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

export const AdminAuditLog = model<IAdminAuditLog>('AdminAuditLog', adminAuditLogSchema)
