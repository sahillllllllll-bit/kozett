import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { NotificationEntry } from '../components/NotificationEntry'
import { useNotifications } from '../context/NotificationContext'

const panel = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80'

export default function NotificationsPage() {
  const { notifications, unreadCount, nextCursor, loading, error, refreshNotifications, loadMoreNotifications, markRead, markAllRead } = useNotifications()

  useEffect(() => { void refreshNotifications(20) }, [refreshNotifications])

  return (
    <section className='mx-auto min-h-[75vh] max-w-3xl px-4 py-7 sm:px-6 lg:px-8'>
      <header className={`${panel} flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7`}>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.17em] text-cyan-800 dark:text-cyan-300'>Your account</p>
          <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white'>Notifications</h1>
          <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>{unreadCount} unread</p>
        </div>
        {unreadCount > 0 ? <button type='button' onClick={() => void markAllRead()} className='rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>Mark all as read</button> : null}
      </header>

      <section className={`${panel} mt-5 p-3 sm:p-4`} aria-label='Recent notifications'>
        {error ? <div role='alert' className='m-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'>{error}<button type='button' onClick={() => void refreshNotifications(20)} className='font-semibold underline'>Retry</button></div> : null}
        {loading && !notifications.length ? <p role='status' className='px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400'>Loading notifications…</p>
          : notifications.length ? <div className='divide-y divide-slate-100 dark:divide-slate-800'>{notifications.map((notification) => <NotificationEntry key={notification.id} notification={notification} onOpen={(item) => { void markRead(item).catch(() => undefined) }} onMarkRead={(item) => { void markRead(item).catch(() => undefined) }} />)}</div>
            : !error ? <div className='px-4 py-12 text-center'><p className='font-semibold text-slate-950 dark:text-white'>You're all caught up!</p><p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>New activity will show up here.</p></div> : null}
        {nextCursor ? <button type='button' disabled={loading} onClick={() => void loadMoreNotifications()} className='mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-cyan-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-cyan-300 dark:hover:bg-slate-800'>{loading ? 'Loading…' : 'Load more notifications'}</button> : null}
        <Link to='/feed' className='mt-3 block rounded-lg px-3 py-2 text-center text-sm font-semibold text-cyan-800 hover:underline dark:text-cyan-300'>Back to Feed</Link>
      </section>
    </section>
  )
}
