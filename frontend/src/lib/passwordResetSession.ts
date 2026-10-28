export type PasswordResetScope = 'user' | 'admin'

type PasswordResetFlow = {
  email: string
  scope: PasswordResetScope
  developmentOtp?: string
  authorization?: string
  authorizationExpiresAt?: number
}

let activeFlow: PasswordResetFlow | null = null

export function startPasswordResetFlow(email: string, scope: PasswordResetScope, developmentOtp?: string) {
  activeFlow = { email, scope, ...(developmentOtp ? { developmentOtp } : {}) }
}

export function getPasswordResetFlow(scope: PasswordResetScope) {
  return activeFlow?.scope === scope ? activeFlow : null
}

export function updatePasswordResetOtp(scope: PasswordResetScope, developmentOtp?: string) {
  if (!activeFlow || activeFlow.scope !== scope) return
  activeFlow.developmentOtp = developmentOtp
  activeFlow.authorization = undefined
  activeFlow.authorizationExpiresAt = undefined
}

export function setPasswordResetAuthorization(scope: PasswordResetScope, authorization: string, expiresInSeconds: number) {
  if (!activeFlow || activeFlow.scope !== scope) return false
  activeFlow.authorization = authorization
  activeFlow.authorizationExpiresAt = Date.now() + expiresInSeconds * 1000
  return true
}

export function getPasswordResetAuthorization(scope: PasswordResetScope) {
  if (!activeFlow || activeFlow.scope !== scope || !activeFlow.authorization) return null
  if (!activeFlow.authorizationExpiresAt || activeFlow.authorizationExpiresAt <= Date.now()) {
    clearPasswordResetFlow()
    return null
  }
  return activeFlow.authorization
}

export function clearPasswordResetFlow() {
  activeFlow = null
}
