import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { User } from '../types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (payload: { email: string; password: string }) => Promise<User>
  signup: (payload: { name: string; email: string; password: string; username?: string }) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.me()
      setUser(response.user)
      return response.user
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const response = await api.post<{ success: boolean; user: User; csrfToken: string }>('/auth/login', { email, password })
    api.setCsrfToken(response.csrfToken)
    setUser(response.user)
    return response.user
  }, [])

  const signup = useCallback(async ({ name, email, password, username }: { name: string; email: string; password: string; username?: string }) => {
    const response = await api.post<{ success: boolean; user: User; csrfToken: string }>('/auth/signup', { name, email, password, username })
    api.setCsrfToken(response.csrfToken)
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {})
    } finally {
      setUser(null)
      await api.getCsrfToken().catch(() => undefined)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, signup, logout, refreshUser }), [user, loading, login, signup, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
