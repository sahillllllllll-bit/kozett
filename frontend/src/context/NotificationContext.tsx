import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'

export type NotificationActor = {
  id: string
  name: string
  username: string | null
  avatar: string | null
}

export type AppNotification = {
  id: string
  type: 'like' | 'comment' | 'follow'
  actor: NotificationActor | null
  postId: string | null
  readAt: string | null
  createdAt: string
}

type NotificationContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  nextCursor: string | null
  loading: boolean
  error: string | null
  refreshNotifications: (limit?: number) => Promise<void>
  loadMoreNotifications: () => Promise<void>
  refreshUnreadCount: () => Promise<void>
  markRead: (notification: AppNotification) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(user?.id ?? null)
  userIdRef.current = user?.id ?? null

  const refreshUnreadCount = useCallback(async () => {
    const requestedUserId = userIdRef.current
    if (!requestedUserId) return
    try {
      const result = await api.get<{ unreadCount: number }>('/feed/notifications?limit=1')
      if (userIdRef.current === requestedUserId) setUnreadCount(result.unreadCount)
    } catch (loadError) {
      if (userIdRef.current === requestedUserId) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.')
      }
    }
  }, [])

  const refreshNotifications = useCallback(async (limit = 10) => {
    const requestedUserId = userIdRef.current
    if (!requestedUserId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<{ items: AppNotification[]; unreadCount: number; nextCursor: string | null }>(`/feed/notifications?limit=${limit}`)
      if (userIdRef.current !== requestedUserId) return
      setNotifications(result.items)
      setUnreadCount(result.unreadCount)
      setNextCursor(result.nextCursor)
      setOwnerId(requestedUserId)
    } catch (loadError) {
      if (userIdRef.current === requestedUserId) setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.')
    } finally {
      if (userIdRef.current === requestedUserId) setLoading(false)
    }
  }, [])

  const loadMoreNotifications = useCallback(async () => {
    const requestedUserId = userIdRef.current
    if (!requestedUserId || !nextCursor || loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<{ items: AppNotification[]; unreadCount: number; nextCursor: string | null }>(`/feed/notifications?limit=20&cursor=${encodeURIComponent(nextCursor)}`)
      if (userIdRef.current !== requestedUserId) return
      setNotifications((current) => [...current, ...result.items])
      setUnreadCount(result.unreadCount)
      setNextCursor(result.nextCursor)
    } catch (loadError) {
      if (userIdRef.current === requestedUserId) setError(loadError instanceof Error ? loadError.message : 'Unable to load more notifications.')
    } finally {
      if (userIdRef.current === requestedUserId) setLoading(false)
    }
  }, [loading, nextCursor])

  const markRead = useCallback(async (notification: AppNotification) => {
    const requestedUserId = userIdRef.current
    if (!requestedUserId || notification.readAt) return
    try {
      const result = await api.patch<{ readAt: string }>(`/feed/notifications/${encodeURIComponent(notification.id)}/read`, {})
      if (userIdRef.current !== requestedUserId) return
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: result.readAt } : item))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (readError) {
      if (userIdRef.current === requestedUserId) setError(readError instanceof Error ? readError.message : 'Unable to mark the notification as read.')
      throw readError
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const requestedUserId = userIdRef.current
    if (!requestedUserId) return
    try {
      await api.patch('/feed/notifications/read-all', {})
      if (userIdRef.current !== requestedUserId) return
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt })))
      setUnreadCount(0)
    } catch (readError) {
      if (userIdRef.current === requestedUserId) setError(readError instanceof Error ? readError.message : 'Unable to mark notifications as read.')
      throw readError
    }
  }, [])

  useEffect(() => {
    setOwnerId(user?.id ?? null)
    setNotifications([])
    setUnreadCount(0)
    setNextCursor(null)
    setLoading(false)
    setError(null)
    if (!user) return
    void refreshUnreadCount()
    const interval = window.setInterval(() => void refreshUnreadCount(), 60_000)
    return () => window.clearInterval(interval)
  }, [user?.id, refreshUnreadCount])

  const visibleOwner = ownerId === (user?.id ?? null)
  const value = useMemo<NotificationContextValue>(() => ({
    notifications: visibleOwner ? notifications : [],
    unreadCount: visibleOwner ? unreadCount : 0,
    nextCursor: visibleOwner ? nextCursor : null,
    loading,
    error,
    refreshNotifications,
    loadMoreNotifications,
    refreshUnreadCount,
    markRead,
    markAllRead,
  }), [visibleOwner, notifications, unreadCount, nextCursor, loading, error, refreshNotifications, loadMoreNotifications, refreshUnreadCount, markRead, markAllRead])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider')
  return context
}
