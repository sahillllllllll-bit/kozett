import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, type ContestApiRecord, type UserContestApiRecord } from '../lib/api'

type ContestPlatform = 'Codeforces' | 'CodeChef' | 'LeetCode' | 'GeeksforGeeks' | 'HackerRank' | 'HackerEarth' | 'GitHub' | 'Other'
type ContestStatus = 'upcoming' | 'live' | 'past'
type ParticipationStatus = 'planned' | 'registered' | 'participated' | 'missed'

type Contest = {
  id: string
  externalContestId: string
  title: string
  platform: ContestPlatform
  startTime: string
  endTime: string
  durationSeconds: number
  status: ContestStatus
  contestUrl: string
  registrationUrl: string | null
  source: string
  lastSyncedAt: string | null
  bookmarked?: boolean
  participationStatus?: ParticipationStatus | null
  personalNote?: string
}

type UserContest = Contest & {
  bookmarked: boolean
  participationStatus: ParticipationStatus | null
  personalNote: string | null
}

type RatingEntry = {
  contestTitle: string
  contestDate: string
  ratingBefore: number | null
  ratingAfter: number
  rank: number | null
}

type PerformanceData = {
  combined: { participatedCount: number }
  platformRatings: Array<{ platform: string; currentRating: number; highestRating: number }>
}

const platforms: ContestPlatform[] = ['Codeforces', 'CodeChef', 'LeetCode', 'GeeksforGeeks', 'HackerRank', 'HackerEarth', 'GitHub', 'Other']
const pageSize = 30
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80'
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const primaryButton = 'inline-flex items-center justify-center rounded-xl bg-cyan-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50'

function parseContest(value: ContestApiRecord & Partial<Pick<UserContestApiRecord, 'bookmarked' | 'participationStatus' | 'personalNote'>>): Contest | null {
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.platform !== 'string' ||
    typeof value.startTime !== 'string' ||
    typeof value.endTime !== 'string' ||
    typeof value.contestUrl !== 'string'
  ) return null

  const start = Date.parse(value.startTime)
  const end = Date.parse(value.endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null

  const validPlatform = platforms.find((platform) => platform.toLocaleLowerCase() === value.platform.toLocaleLowerCase()) ?? 'Other'
  const now = Date.now()
  const status: ContestStatus = start > now ? 'upcoming' : end > now ? 'live' : 'past'

  return {
    id: value.id,
    externalContestId: typeof value.externalContestId === 'string' ? value.externalContestId : value.id,
    title: value.title,
    platform: validPlatform,
    startTime: value.startTime,
    endTime: value.endTime,
    durationSeconds: typeof value.durationSeconds === 'number' ? value.durationSeconds : Math.floor((end - start) / 1000),
    status,
    contestUrl: value.contestUrl,
    registrationUrl: typeof value.registrationUrl === 'string' ? value.registrationUrl : null,
    source: typeof value.source === 'string' ? value.source : 'unknown',
    lastSyncedAt: value.lastSyncedAt,
    bookmarked: value.bookmarked === true,
    participationStatus: ['planned', 'registered', 'participated', 'missed'].includes(String(value.participationStatus))
      ? value.participationStatus as ParticipationStatus
      : null,
    personalNote: typeof value.personalNote === 'string' ? value.personalNote : undefined,
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(value))
}

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`
}

function calendarUrl(contest: Contest) {
  const format = (date: string) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', contest.title)
  url.searchParams.set('dates', `${format(contest.startTime)}/${format(contest.endTime)}`)
  url.searchParams.set('details', `Contest on ${contest.platform}. Original contest: ${contest.contestUrl}`)
  url.searchParams.set('location', contest.platform)
  return url.toString()
}

function statusForNow(contest: Contest, now: number): ContestStatus {
  const start = Date.parse(contest.startTime)
  const end = Date.parse(contest.endTime)
  return start > now ? 'upcoming' : end > now ? 'live' : 'past'
}

function Countdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const remaining = Math.max(0, Date.parse(startsAt) - now)
  const days = Math.floor(remaining / 86_400_000)
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return <span className='font-mono tabular-nums'>{days ? `${days}d ` : ''}{hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role='alert' className='rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'>
      <p>{message}</p>
      <button type='button' onClick={onRetry} className='mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/50'>Retry</button>
    </div>
  )
}

export default function ContestHubPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contests, setContests] = useState<Contest[]>([])
  const [myContests, setMyContests] = useState<UserContest[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [ratings, setRatings] = useState<RatingEntry[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState('Combined Overview')
  const [dateRange, setDateRange] = useState('90')
  const [section, setSection] = useState<'upcoming' | 'live' | 'past' | 'my'>('upcoming')
  const [query, setQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('soonest')
  const [loading, setLoading] = useState(true)
  const [personalLoading, setPersonalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personalError, setPersonalError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set())
  const [now, setNow] = useState(Date.now())
  const [reloadKey, setReloadKey] = useState(0)

  const loadContests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const requestedStatus = statusFilter !== 'all'
        ? statusFilter
        : section === 'my'
          ? 'all'
          : section === 'live'
            ? 'ongoing'
            : section === 'past'
              ? 'finished'
              : 'upcoming'
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sort,
      })
      if (query.trim()) params.set('search', query.trim())
      if (platformFilter !== 'all') params.set('platform', platformFilter)
      if (requestedStatus !== 'all') params.set('status', requestedStatus)
      const response = await api.contests(params)
      setContests(response.contests.map(parseContest).filter((entry): entry is Contest => entry !== null))
      setPages(response.totalPages)
      setTotal(response.total)
      setLastSyncedAt(response.lastSyncedAt)
      setAvailablePlatforms(response.sources.codeforces.status === 'unavailable' ? [] : ['Codeforces'])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load contests.')
    } finally {
      setLoading(false)
    }
  }, [page, platformFilter, query, section, sort, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContests(), query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadContests, reloadKey])

  const loadPrivateData = useCallback(async () => {
    if (!user) {
      setPersonalLoading(false)
      setPerformance(null)
      setMyContests([])
      setRatings([])
      return
    }
    setPersonalLoading(true)
    setPersonalError(null)
    try {
      const [myResponse, performanceResponse, ratingResponse] = await Promise.all([
        api.myContests(),
        api.contestPerformance(),
        selectedPlatform === 'Combined Overview'
          ? Promise.resolve({ ratings: [] as const, lastSyncedAt: null, platform: 'Codeforces' })
          : api.contestRatings(selectedPlatform),
      ])
      setMyContests(myResponse.contests.map((entry) => parseContest(entry)).filter((entry): entry is UserContest => entry !== null))
      setPerformance({
        combined: { participatedCount: performanceResponse.combined.contestCount },
        platformRatings: performanceResponse.platforms.map(({ platform, currentRating, highestRating }) => ({
          platform,
          currentRating,
          highestRating,
        })),
      })
      setRatings(ratingResponse.ratings.map((rating) => ({
        contestTitle: rating.contestName,
        contestDate: rating.ratingUpdateTime,
        ratingBefore: rating.oldRating,
        ratingAfter: rating.newRating,
        rank: rating.rank,
      })))
    } catch (loadError) {
      setPersonalError(loadError instanceof Error ? loadError.message : 'Unable to load your contest data.')
    } finally {
      setPersonalLoading(false)
    }
  }, [selectedPlatform, user])

  useEffect(() => {
    void loadPrivateData()
  }, [loadPrivateData, reloadKey])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const displayContests = useMemo(() => {
    const source = section === 'my' ? myContests : contests
    const filtered = source.filter((contest) => {
      if (section === 'upcoming') return statusForNow(contest, now) === 'upcoming'
      if (section === 'live') return statusForNow(contest, now) === 'live'
      if (section === 'past') return statusForNow(contest, now) === 'past'
      return true
    })
    return filtered
  }, [contests, myContests, now, section])

  async function toggleBookmark(contest: Contest) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent('/contest')}`)
      return
    }
    setBusyIds((current) => new Set(current).add(contest.id))
    setPersonalError(null)
    try {
      if (contest.bookmarked) await api.removeContestBookmark(contest.id)
      else await api.bookmarkContest(contest.id)
      setContests((current) => current.map((item) => item.id === contest.id ? { ...item, bookmarked: !contest.bookmarked } : item))
      await loadPrivateData()
    } catch (actionError) {
      setPersonalError(actionError instanceof Error ? actionError.message : 'Unable to update bookmark.')
    } finally {
      setBusyIds((current) => {
        const updated = new Set(current)
        updated.delete(contest.id)
        return updated
      })
    }
  }

  async function updateParticipation(contestId: string, participationStatus: ParticipationStatus) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent('/contest')}`)
      return
    }
    setBusyIds((current) => new Set(current).add(contestId))
    setPersonalError(null)
    try {
      await api.updateContestParticipation(contestId, participationStatus)
      await loadPrivateData()
      setContests((current) => current.map((contest) => contest.id === contestId ? { ...contest, participationStatus } : contest))
    } catch (actionError) {
      setPersonalError(actionError instanceof Error ? actionError.message : 'Unable to update participation status.')
    } finally {
      setBusyIds((current) => {
        const updated = new Set(current)
        updated.delete(contestId)
        return updated
      })
    }
  }

  const selectionOptions = ['Combined Overview', ...(performance?.platformRatings.map((rating) => rating.platform) ?? [])]
  const currentRatingData = performance?.platformRatings ?? []
  const selectedRating = currentRatingData.find((entry) => entry.platform === selectedPlatform)
  const rangeDays = Number(dateRange)
  const visibleRatings = ratings.filter((rating) => Date.now() - Date.parse(rating.contestDate) <= rangeDays * 86_400_000)
  const listLoading = section === 'my' ? Boolean(user && personalLoading) : loading
  const listError = section === 'my' ? personalError : error

  return (
    <section className='mx-auto min-h-[70vh] max-w-7xl px-4 py-9 sm:px-6 lg:px-8'>
      <header className='relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40 sm:p-8'>
        <div aria-hidden='true' className='pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl' />
        <div className='relative'>
          <p className='text-sm font-semibold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300'>Kozett competitions</p>
          <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl'>Coding Contests</h1>
          <p className='mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300'>Discover upcoming coding contests, track your participation, and monitor your competitive programming progress.</p>
        </div>
      </header>

      <div className='mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]'>
        <div className='min-w-0'>
          <section aria-label='Contest search and filters' className='grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_150px_170px]'>
            <label className='relative'>
              <span className='sr-only'>Search contests</span>
              <svg aria-hidden='true' viewBox='0 0 24 24' className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500' fill='none' stroke='currentColor' strokeWidth='1.8'><circle cx='11' cy='11' r='7' /><path d='m20 20-4-4' /></svg>
              <input type='search' value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder='Search contests by name or platform...' className={`${fieldClass} pl-10`} />
            </label>
            <select aria-label='Filter contests by platform' value={platformFilter} onChange={(event) => { setPlatformFilter(event.target.value); setPage(1) }} className={fieldClass}>
              <option value='all'>All Platforms</option>
              {platforms.map((platform) => <option key={platform} value={platform} disabled={!availablePlatforms.some((item) => item.toLowerCase() === platform.toLowerCase())}>{platform}{availablePlatforms.some((item) => item.toLowerCase() === platform.toLowerCase()) ? '' : ' · No feed'}</option>)}
            </select>
            <select aria-label='Filter contests by status' value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className={fieldClass}>
              <option value='all'>All statuses</option>
              <option value='upcoming'>Upcoming</option>
              <option value='ongoing'>Live Now</option>
              <option value='finished'>Past</option>
            </select>
            <select aria-label='Sort contests' value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} className={fieldClass}>
              <option value='soonest'>Starting soon</option>
              <option value='latest'>Latest start</option>
              <option value='title'>Contest name A–Z</option>
            </select>
          </section>

          <div className='mt-5 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex flex-wrap gap-2' role='tablist' aria-label='Contest collections'>
              {([
                ['upcoming', 'Upcoming Contests'],
                ['live', 'Live Contests'],
                ['past', 'Past Contests'],
                ['my', 'My Contests'],
              ] as const).map(([id, label]) => (
                <button key={id} type='button' role='tab' aria-selected={section === id} onClick={() => { setSection(id); setPage(1) }} className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${section === id ? 'bg-cyan-800 text-white dark:bg-cyan-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className='text-sm text-slate-500 dark:text-slate-400' aria-live='polite'>{section === 'my' ? myContests.length : total} contests</p>
          </div>
          {lastSyncedAt ? <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>Contest feed last updated {formatDate(lastSyncedAt)}.</p> : null}

          {personalError ? <div className='mt-4'><ErrorPanel message={personalError} onRetry={() => setReloadKey((current) => current + 1)} /></div> : null}
          {error && section !== 'my' ? <div className='mt-4'><ErrorPanel message={error} onRetry={() => setReloadKey((current) => current + 1)} /></div> : null}
          {listLoading && !listError ? (
            <div className='mt-4 space-y-3' aria-label='Loading contests'>
              {[0, 1, 2].map((item) => <div key={item} className={`${panel} h-40 animate-pulse bg-slate-100 dark:bg-slate-800`} />)}
            </div>
          ) : !listError ? (
            <div className='mt-4 space-y-3'>
              {section === 'my' && !user ? (
                <div className={`${panel} text-center`}>
                  <h2 className='font-semibold text-slate-950 dark:text-white'>Sign in to view your contests</h2>
                  <Link to={`/login?redirect=${encodeURIComponent('/contest')}`} className={`${primaryButton} mt-4`}>Sign in</Link>
                </div>
              ) : displayContests.length ? displayContests.map((contest) => (
                <ContestCard
                  key={contest.id}
                  contest={contest}
                  now={now}
                  busy={busyIds.has(contest.id)}
                  isAuthenticated={Boolean(user)}
                  onBookmark={() => void toggleBookmark(contest)}
                  onParticipation={(status) => void updateParticipation(contest.id, status)}
                />
              )) : (
                <div className={`${panel} border-dashed py-10 text-center`}>
                  <h2 className='font-semibold text-slate-950 dark:text-white'>{section === 'my' ? 'No saved contests yet' : `No ${section} contests match your filters`}</h2>
                  <p className='mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300'>
                    {section === 'my' ? 'Bookmark a contest to save it here and track your own participation.' : 'Try another search or status filter. Contest listings are shown only when a supported source provides real feed data.'}
                  </p>
                </div>
              )}
              {section !== 'my' && pages > 1 ? (
                <div className='flex items-center justify-between pt-2'>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>Page {page} of {pages}</p>
                  <div className='flex gap-2'>
                    <button type='button' disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className='rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-700'>Previous</button>
                    <button type='button' disabled={page >= pages} onClick={() => setPage((current) => current + 1)} className='rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-700'>Next</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className='space-y-5'>
          <section className={panel}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300'>Competitive programming</p>
                <h2 className='mt-1 text-xl font-bold text-slate-950 dark:text-white'>Performance</h2>
              </div>
              <select aria-label='Select rating platform' value={selectedPlatform} onChange={(event) => setSelectedPlatform(event.target.value)} className='max-w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'>
                {selectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            {!user ? (
              <div className='mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
                Sign in to see your saved contests and private performance data.
                <Link to={`/login?redirect=${encodeURIComponent('/contest')}`} className='mt-3 inline-flex font-semibold text-cyan-800 dark:text-cyan-300'>Sign in to Kozett →</Link>
              </div>
            ) : personalError ? <p className='mt-5 text-sm text-red-700 dark:text-red-300' role='alert'>{personalError}</p>
              : !performance ? <p className='mt-5 text-sm text-slate-500 dark:text-slate-400' role='status'>Loading your performance...</p>
                : selectedPlatform === 'Combined Overview' ? (
                  <div className='mt-5'>
                    <div className='rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80'>
                      <p className='text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'>Contests with rating history</p>
                      <p className='mt-1 text-3xl font-bold text-slate-950 dark:text-white'>{performance.combined.participatedCount}</p>
                    </div>
                    {performance.platformRatings.length ? (
                      <div className='mt-4 space-y-2'>
                        <p className='text-sm font-semibold text-slate-900 dark:text-slate-100'>Platform ratings (separate scales)</p>
                        {performance.platformRatings.map((rating) => (
                          <div key={rating.platform} className='flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700'>
                            <span className='text-sm text-slate-700 dark:text-slate-200'>{rating.platform}</span>
                            <span className='text-right text-sm font-semibold text-slate-950 dark:text-white'>{rating.currentRating}<span className='block text-xs font-normal text-slate-500 dark:text-slate-400'>Best {rating.highestRating ?? '—'}</span></span>
                          </div>
                        ))}
                      </div>
                    ) : <p className='mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400'>No imported rating history is available yet. Ratings appear only when returned by a supported platform source.</p>}
                    <p className='mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400'>Ratings use platform-specific scales and are shown separately, not added together.</p>
                  </div>
                ) : selectedRating ? (
                  <div className='mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80'>
                    <p className='text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'>{selectedPlatform} rating</p>
                    <p className='mt-1 text-3xl font-bold text-slate-950 dark:text-white'>{selectedRating.currentRating}</p>
                    <p className='mt-1 text-sm text-slate-600 dark:text-slate-300'>Best rating: {selectedRating.highestRating ?? 'Not available'}</p>
                    <p className='mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400'>Ratings are imported from supported platform sources; self-reported participation does not create rating data.</p>
                  </div>
                ) : (
                  <div className='mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/80 dark:text-slate-300'>
                    {`No real contest rating history is available for ${selectedPlatform} yet.`}
                  </div>
                )}

            {user && selectedPlatform !== 'Combined Overview' ? (
              <section className='mt-5 border-t border-slate-200 pt-5 dark:border-slate-700'>
                <div className='flex items-center justify-between gap-3'>
                  <h3 className='text-sm font-semibold text-slate-900 dark:text-slate-100'>Rating history</h3>
                  <select aria-label='Rating history date range' value={dateRange} onChange={(event) => setDateRange(event.target.value)} className='rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950'>
                    <option value='30'>30 days</option>
                    <option value='90'>90 days</option>
                    <option value='365'>1 year</option>
                  </select>
                </div>
                {visibleRatings.length ? <RatingChart ratings={visibleRatings} platform={selectedPlatform} />
                  : <p className='mt-4 rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400'>No real rating history is available for this period.</p>}
              </section>
            ) : null}
          </section>

          <section className={panel}>
            <h2 className='font-semibold text-slate-950 dark:text-white'>Supported contest feed</h2>
            <div className='mt-3 flex flex-wrap gap-2'>
              {availablePlatforms.length ? availablePlatforms.map((platform) => <span key={platform} className='rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'>{platform}</span>)
                : <span className='text-sm text-slate-500 dark:text-slate-400'>No feed provider has returned contests yet.</span>}
            </div>
            <p className='mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400'>Only supported sources with validated contest data appear in this list. Ratings and participation are never inferred from a registration click.</p>
          </section>
        </aside>
      </div>
    </section>
  )
}

function ContestCard({
  contest,
  now,
  busy,
  isAuthenticated,
  onBookmark,
  onParticipation,
}: {
  contest: Contest
  now: number
  busy: boolean
  isAuthenticated: boolean
  onBookmark: () => void
  onParticipation: (status: ParticipationStatus) => void
}) {
  const liveStatus = statusForNow(contest, now)
  return (
    <article className={`${panel} transition hover:border-cyan-600/50`}>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200'>{contest.platform}</span>
            {liveStatus === 'live' ? <span className='inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 dark:bg-red-950 dark:text-red-200'><span className='h-1.5 w-1.5 animate-pulse rounded-full bg-red-600' />LIVE</span> : null}
            {contest.participationStatus ? <span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200'>{contest.participationStatus}</span> : null}
          </div>
          <h3 className='mt-2 text-lg font-semibold text-slate-950 dark:text-white'>{contest.title}</h3>
          <dl className='mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2'>
            <div><dt className='inline text-slate-500 dark:text-slate-400'>Starts: </dt><dd className='inline font-medium text-slate-800 dark:text-slate-200'>{formatDate(contest.startTime)}</dd></div>
            <div><dt className='inline text-slate-500 dark:text-slate-400'>Ends: </dt><dd className='inline font-medium text-slate-800 dark:text-slate-200'>{formatDate(contest.endTime)}</dd></div>
            <div><dt className='inline text-slate-500 dark:text-slate-400'>Duration: </dt><dd className='inline font-medium text-slate-800 dark:text-slate-200'>{durationLabel(contest.durationSeconds)}</dd></div>
            {liveStatus === 'upcoming' ? <div className='text-cyan-800 dark:text-cyan-300'><dt className='inline'>Starts in: </dt><dd className='inline font-semibold'><Countdown startsAt={contest.startTime} /></dd></div> : null}
          </dl>
          <p className='mt-3 text-xs text-slate-500 dark:text-slate-400'>Source: {contest.source}{contest.lastSyncedAt ? ` · Updated ${formatDate(contest.lastSyncedAt)}` : ''}</p>
        </div>
        <div className='flex shrink-0 flex-wrap gap-2 sm:justify-end'>
          <a href={liveStatus === 'upcoming' && contest.registrationUrl ? contest.registrationUrl : contest.contestUrl} target='_blank' rel='noreferrer' className={primaryButton}>{liveStatus === 'upcoming' && contest.registrationUrl ? 'Register' : 'View Contest'}</a>
          <a href={calendarUrl(contest)} target='_blank' rel='noreferrer' className='inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800'>Add to Calendar</a>
          <button type='button' disabled={busy} onClick={onBookmark} aria-pressed={contest.bookmarked === true} className='inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800'>
            {contest.bookmarked ? 'Saved' : 'Bookmark'}
          </button>
        </div>
      </div>
      {isAuthenticated ? (
        <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800'>
          <p className='text-xs text-slate-500 dark:text-slate-400'>Participation is self-reported; it is not verified by the contest platform.</p>
          <label className='flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400'>
            Track participation
            <select value={contest.participationStatus ?? ''} disabled={busy} onChange={(event) => {
              if (event.target.value) onParticipation(event.target.value as ParticipationStatus)
            }} className='rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'>
              <option value=''>Not tracked</option>
              <option value='planned'>Planned</option>
              <option value='registered'>Registered</option>
              <option value='participated'>Participated</option>
              <option value='missed'>Missed</option>
            </select>
          </label>
        </div>
      ) : null}
    </article>
  )
}

function RatingChart({ ratings, platform }: { ratings: RatingEntry[]; platform: string }) {
  const ordered = [...ratings].sort((left, right) => Date.parse(left.contestDate) - Date.parse(right.contestDate))
  if (ordered.length < 2) {
    const only = ordered[0]
    return (
      <div className='mt-4 rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400'>
        {only ? `${platform} rating after ${only.contestTitle}: ${only.ratingAfter}. More history is needed to draw a trend.` : 'No rating history to chart.'}
      </div>
    )
  }
  const width = 600
  const height = 220
  const padding = { left: 48, right: 18, top: 18, bottom: 34 }
  const values = ordered.map((entry) => entry.ratingAfter)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const x = (index: number) => padding.left + index * (width - padding.left - padding.right) / (ordered.length - 1)
  const y = (rating: number) => padding.top + (max - rating) * (height - padding.top - padding.bottom) / range
  const points = ordered.map((entry, index) => `${x(index)},${y(entry.ratingAfter)}`).join(' ')
  return (
    <div className='mt-4 overflow-x-auto'>
      <svg viewBox={`0 0 ${width} ${height}`} role='img' aria-label={`${platform} contest rating history line chart`} className='h-auto min-w-[480px] w-full'>
        {[0, 0.5, 1].map((fraction) => {
          const rating = Math.round(max - range * fraction)
          const lineY = y(rating)
          return <g key={fraction}><line x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} stroke='currentColor' opacity='0.15' /><text x={padding.left - 7} y={lineY + 4} textAnchor='end' className='fill-slate-500 text-[10px]'>{rating}</text></g>
        })}
        <polyline points={points} fill='none' stroke='#0891b2' strokeWidth='3' strokeLinejoin='round' strokeLinecap='round' />
        {ordered.map((entry, index) => <g key={`${entry.contestTitle}-${entry.contestDate}`}>
          <circle cx={x(index)} cy={y(entry.ratingAfter)} r='4.5' fill='#0891b2' stroke='white' strokeWidth='2'>
            <title>{`${entry.contestTitle} · ${formatDate(entry.contestDate)} · Rating ${entry.ratingAfter}${entry.rank ? ` · Rank ${entry.rank}` : ''}`}</title>
          </circle>
          <text x={x(index)} y={height - 10} textAnchor='middle' className='fill-slate-500 text-[9px]'>{new Date(entry.contestDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
        </g>)}
      </svg>
    </div>
  )
}
