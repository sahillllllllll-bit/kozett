import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { closeDatabase, connectDatabase } from '../config/database.js'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { isStrongPassword, normalizeEmail } from '../utils/security.js'

async function run() {
  if (!env.INITIAL_ADMIN_EMAIL || !env.INITIAL_ADMIN_PASSWORD) {
    throw new Error('Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD before running admin:bootstrap.')
  }
  if (!isStrongPassword(env.INITIAL_ADMIN_PASSWORD)) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain letters and numbers.')
  }

  await connectDatabase()
  const email = normalizeEmail(env.INITIAL_ADMIN_EMAIL)
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.adminAccess?.active) {
      console.log('The configured administrator already exists; its password and role were not changed.')
      return
    }
    throw new Error('An account already uses INITIAL_ADMIN_EMAIL but is not an administrator. No account was changed.')
  }

  const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 12)
  await User.create({
    name: 'Kozett Administrator',
    email,
    passwordHash,
    adminAccess: { role: 'superadmin', active: true, mustChangePassword: true },
  })
  console.log('Initial superadmin created. Sign in through /ad/login and change the initial password.')
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Administrator bootstrap failed.')
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabase()
    await mongoose.disconnect()
  })
