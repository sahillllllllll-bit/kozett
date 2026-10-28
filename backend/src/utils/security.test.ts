import test from 'node:test'
import assert from 'node:assert/strict'
import { hashToken, isStrongPassword, normalizeEmail } from './security.js'

test('normalizeEmail lowercases and trims input', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com')
})

test('hashToken is deterministic and hashed', () => {
  const token = 'abc123'
  assert.equal(hashToken(token), hashToken(token))
  assert.notEqual(hashToken(token), token)
})

test('isStrongPassword accepts acceptable passwords and rejects weak ones', () => {
  assert.equal(isStrongPassword('Password1'), true)
  assert.equal(isStrongPassword('short'), false)
  assert.equal(isStrongPassword('onlyletters'), false)
})
