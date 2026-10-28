import { Link } from 'react-router-dom'
import type { AppNotification } from '../context/NotificationContext'

export function notificationTarget(notification: AppNotification) {
  if (notification.type === 'follow' && notification.actor?.username) {
    return `/${encodeURIComponent(notification.actor.username)}`
  }
  if (notification.postId) return `/feed/post/${encodeURIComponent(notification.postId)}`
  if (notification.actor?.username) return `/${encodeURIComponent(notification.actor.username)}`
  return '/feed'
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(seconds, 'second')
}

const descriptions: Record<AppNotification['type'], string> = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
}

export function NotificationEntry({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: AppNotification
  onOpen: (notification: AppNotification) => void
  onMarkRead?: (notification: AppNotification) => void
}) {
  return (
    <article className={`flex items-start gap-3 rounded-xl px-3 py-3 ${notification.readAt ? '' : 'bg-cyan-50 dark:bg-cyan-950/50'}`}>
      <Link to={notificationTarget(notification)} onClick={() => onOpen(notification)} aria-label={`Open ${notification.actor?.name ?? 'developer'} notification`}>
        {notification.actor?.avatar
          ? <img src={notification.actor.avatar} alt='' className='h-10 w-10 rounded-full object-cover' />
          : <span aria-hidden='true' className='flex h-10 w-10 items-center justify-center rounded-full bg-cyan-900 text-sm font-bold text-white dark:bg-cyan-700'>{notification.actor?.name.slice(0, 1).toUpperCase() ?? 'K'}</span>}
      </Link>
      <div className='min-w-0 flex-1'>
        <Link to={notificationTarget(notification)} onClick={() => onOpen(notification)} className='block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'>
          <p className='text-sm leading-5 text-slate-700 dark:text-slate-200'><span className='font-semibold text-slate-950 dark:text-white'>{notification.actor?.name ?? 'A developer'}</span> {descriptions[notification.type]}.</p>
          <time dateTime={notification.createdAt} className='mt-1 block text-xs text-slate-500 dark:text-slate-400'>{relativeTime(notification.createdAt)}</time>
        </Link>
        {!notification.readAt && onMarkRead ? <button type='button' onClick={() => onMarkRead(notification)} className='mt-1 rounded text-xs font-semibold text-cyan-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300'>Mark as read</button> : null}
      </div>
      {!notification.readAt ? <span aria-label='Unread' className='mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-600' /> : null}
    </article>
  )
}
