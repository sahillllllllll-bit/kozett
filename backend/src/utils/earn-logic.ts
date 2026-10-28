import { createHash } from 'node:crypto'

const INDIA_TIME_ZONE = 'Asia/Kolkata'

export function indiaDateKey(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function utcDateOrdinal(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new Error('Date key must use YYYY-MM-DD format.')
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000
}

export function consecutiveStreakDay(previousDate: string | null, previousStreak: number, today: string): number {
  if (!previousDate || utcDateOrdinal(today) - utcDateOrdinal(previousDate) !== 1) return 1
  return previousStreak + 1
}

export function activeStreakForDate(lastCheckInDate: string | null, streak: number, today: string): number {
  if (!lastCheckInDate) return 0
  const daysSinceLastCheckIn = utcDateOrdinal(today) - utcDateOrdinal(lastCheckInDate)
  return daysSinceLastCheckIn === 0 || daysSinceLastCheckIn === 1 ? streak : 0
}

export function rewardForStreakDay(streakDay: number): number {
  if (!Number.isSafeInteger(streakDay) || streakDay < 1) throw new Error('Streak day must be a positive integer.')
  if (streakDay <= 10) return 100
  if (streakDay <= 20) return 200
  return 500
}

export function assertDailyCheckInEnabled(enabled: boolean): void {
  if (!enabled) {
    throw Object.assign(new Error('Daily check-in is not available.'), { statusCode: 404 })
  }
}

export function withdrawalOperationKey(userId: string, idempotencyKey: string): string | null {
  const normalized = idempotencyKey.trim()
  if (!normalized || normalized.length > 128 || !/^[\w.:~-]+$/.test(normalized)) return null
  return createHash('sha256').update(`${userId}:${normalized}`).digest('hex')
}
