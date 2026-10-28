import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { useTheme } from '../context/ThemeContext'
import { NotificationEntry } from './NotificationEntry'

const links = [
  { to: '/certificates', label: 'Certification' },
  { to: '/contest', label: 'Contest' },
  { to: '/feed', label: 'Feed' },
  { to: '/earn', label: 'Earn' },
  { to: '/leaderboard', label: 'LeaderBoard' },

]

function navLinkClass(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
    isActive ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`
}

export default function Navbar() {
  const { user, loading, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationContainerRef = useRef<HTMLDivElement>(null)
  const notificationButtonRef = useRef<HTMLButtonElement>(null)
  const { notifications, unreadCount, loading: notificationsLoading, error: notificationError, refreshNotifications, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    setProfileOpen(false)
    setNotificationsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!notificationsOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !notificationContainerRef.current?.contains(event.target)) setNotificationsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
        notificationButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  const handleLogout = async () => {
    await logout()
    setProfileOpen(false)
    setMobileOpen(false)
    navigate('/')
  }

  return (
    <header className='site-navbar sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm'>
      <nav aria-label='Main navigation' className='mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 px-4 py-3 sm:px-6 lg:px-8'>
        <Link to='/' className='flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900'>
          <img
            src='https://res.cloudinary.com/dmhykhefr/image/upload/v1792835595/Glossy_Gradient_Ribbon_K_Logo_crd3ym.png'
            alt=''
            className='h-9 w-9 object-contain'
          />
          Kozett
        </Link>

        <div className='hidden items-center gap-1 lg:flex'>
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => navLinkClass(isActive)}>
              {label}
            </NavLink>
          ))}
        </div>

        <div className='ml-auto flex items-center gap-2'>
          <button
            type='button'
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'dark'}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className='theme-toggle inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'
          >
            {theme === 'dark' ? (
              <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                <circle cx='12' cy='12' r='4' /><path d='M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42' />
              </svg>
            ) : (
              <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z' />
              </svg>
            )}
          </button>
          {!loading && user ? (
            <div ref={notificationContainerRef} className='relative'>
              <button
                ref={notificationButtonRef}
                type='button'
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={notificationsOpen}
                aria-haspopup='dialog'
                onClick={() => {
                  const open = !notificationsOpen
                  setNotificationsOpen(open)
                  if (open) void refreshNotifications(10)
                }}
                className='relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              >
                <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9' />
                  <path d='M10 21h4' />
                </svg>
                {unreadCount > 0 ? <span aria-hidden='true' className='absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white'>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
              </button>
              {notificationsOpen ? (
                <section role='dialog' aria-label='Notifications' className='absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900'>
                  <div className='flex items-center justify-between gap-3 px-2 py-1'>
                    <h2 className='font-semibold text-slate-950 dark:text-white'>Notifications</h2>
                    {unreadCount > 0 ? <button type='button' onClick={() => void markAllRead().catch(() => undefined)} className='rounded text-xs font-semibold text-cyan-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300'>Mark all as read</button> : null}
                  </div>
                  {notificationError ? <div role='alert' className='m-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'>{notificationError}<button type='button' onClick={() => void refreshNotifications(10)} className='ml-2 font-semibold underline'>Retry</button></div> : null}
                  <div className='mt-2 max-h-[min(24rem,60vh)] space-y-1 overflow-y-auto'>
                    {notificationsLoading && !notifications.length ? <p role='status' className='px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400'>Loading notifications…</p>
                      : notifications.length ? notifications.map((notification) => <NotificationEntry key={notification.id} notification={notification} onOpen={(item) => { void markRead(item).catch(() => undefined) }} onMarkRead={(item) => { void markRead(item).catch(() => undefined) }} />)
                        : !notificationError ? <p className='px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400'>You're all caught up!</p> : null}
                  </div>
                  <Link to='/notifications' onClick={() => setNotificationsOpen(false)} className='mt-2 block rounded-xl px-3 py-2 text-center text-sm font-semibold text-cyan-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300 dark:hover:bg-slate-800'>View all notifications</Link>
                </section>
              ) : null}
            </div>
          ) : null}
          {loading ? (
            <span className='hidden text-sm text-slate-500 sm:inline' role='status'>Checking session...</span>
          ) : user ? (
            <div className='relative'>
              <button
                type='button'
                aria-expanded={profileOpen}
                aria-haspopup='menu'
                onClick={() => setProfileOpen((current) => !current)}
                className='flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
              >
                <span className='flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white'>
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className='max-w-24 truncate'>{user.name.split(' ')[0]}</span>
              </button>

              {profileOpen ? (
                <div role='menu' className='absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg'>
                  <Link role='menuitem' to='/profile' className='block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100'>View Profile</Link>
                  <Link role='menuitem' to='/dashboard' className='block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100'>Dashboard</Link>
                  <button role='menuitem' type='button' onClick={() => void handleLogout()} className='mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50'>Logout</button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link to='/login' className='hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex'>Login</Link>
              <Link to='/signup' className='inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'>Sign up</Link>
            </>
          )}

          <button
            type='button'
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((current) => !current)}
            className='inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden'
          >
            {mobileOpen ? (
              <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' d='m6 6 12 12M18 6 6 18' /></svg>
            ) : (
              <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' d='M4 7h16M4 12h16M4 17h16' /></svg>
            )}
          </button>
        </div>

        {mobileOpen ? (
          <div className='order-last flex w-full flex-col gap-1 border-t border-slate-100 pt-3 lg:hidden'>
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => navLinkClass(isActive)}>
                {label}
              </NavLink>
            ))}
            {!loading && !user ? (
              <Link to='/login' className='rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:hidden'>Login</Link>
            ) : null}
          </div>
        ) : null}
      </nav>
    </header>
  )
}
