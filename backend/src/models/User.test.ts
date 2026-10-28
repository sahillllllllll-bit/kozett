import assert from 'node:assert/strict'
import test from 'node:test'
import { User } from './User.js'

test('administrator account validates without an optional demo profile', () => {
  const administrator = new User({
    name: 'Kozett Administrator',
    email: 'admin@example.test',
    passwordHash: 'hashed-password',
    adminAccess: { role: 'superadmin', active: true, mustChangePassword: true },
  })

  assert.equal(administrator.demoProfile, undefined)
  assert.equal(administrator.validateSync(), undefined)
})

test('demo profile validations remain enabled when the profile is provided', () => {
  const user = new User({
    name: 'Demo Profile',
    email: 'demo@example.test',
    passwordHash: 'hashed-password',
    demoProfile: { marker: 'DEMO DATA' },
  })

  const error = user.validateSync()
  assert.ok(error)
  assert.match(error.message, /github\.username/)
  assert.match(error.message, /github\.syncedAt/)
})
