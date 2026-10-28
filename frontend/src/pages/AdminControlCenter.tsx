import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../context/ThemeContext'
import type { DeveloperRating } from '../types'
import AdminFeedPostsPage from './AdminFeedPostsPage'

type Admin = { id: string; name: string; email: string; role: string; mustChangePassword: boolean }
type Overview = {
  periodDays: number
  calculatedAt: string
  metrics: {
    totalUsers: number
    newUsers: number
    activeUsers30Days: number
    activeUsers1Day: number
    publishedFeedPosts: number
    recentFeedPosts: number
    certificatesIssued: number
    recentCertificatesIssued: number
    assessmentAttempts: number
    assessmentPassRate: number
    upcomingContests: number
    activeEarningOpportunities: number
    rewardsCreditedPaise: number
    rewardTransactions: number
    walletAvailablePaise: number
    walletReservedPaise: number
    pendingWithdrawalRequests: number
    pendingWithdrawalAmountPaise: number
    completedWithdrawals: number | null
    completedWithdrawalAmountPaise: number | null
    completedWithdrawalTracking: string
  }
  series: {
    registrations: Array<{ _id: string; count: number }>
    posts: Array<{ _id: string; count: number }>
    assessments: Array<{ _id: string; attempts: number; passed: number }>
  }
  platformActivity: { available: boolean; reason: string }
}
type AdminUser = {
  id: string
  name: string
  username: string | null
  email: string
  createdAt: string
  status: 'active' | 'suspended'
  suspendedAt: string | null
  connectedPlatforms: string[]
  projectCount: number
  certificateCount: number
  rating: Pick<DeveloperRating, 'score' | 'rank' | 'dataCoverage' | 'isProvisional'> | null
  wallet: { availablePaise: number; reservedPaise: number }
  adminRole: string | null
}
type AdminUserDetails = {
  id: string
  name: string
  username: string | null
  email: string
  createdAt: string
  updatedAt: string
  emailVerifiedAt: string | null
  status: 'active' | 'suspended'
  suspendedAt: string | null
  suspensionReason: string | null
  connectedPlatforms: string[]
  projectCount: number
  adminRole: string | null
  rating: DeveloperRating | null
  ratingHistory: DeveloperRating[]
  certificates: Array<{ id: string; credentialId: string; assessmentId: string; score: number; issuedAt: string }>
  sessions: Array<{ createdAt: string; lastUsedAt: string | null; expiresAt: string; revoked: boolean }>
  wallet: { availablePaise: number; reservedPaise: number } | null
  ledger: Array<{ id: string; type: string; status: string; amountPaise: number; referenceId: string; dateKey: string | null; createdAt: string }>
}
type AuditItem = {
  id: string
  administrator: { name: string; email: string }
  role: string
  action: string
  targetType: string
  targetId: string
  reason: string | null
  outcome: string
  createdAt: string
}
type AdminCertificate = {
  id: string
  credentialId: string
  recipient: { name: string; username: string | null; email: string }
  assessment: { title: string; technology: string; category: string }
  score: number
  issuedAt: string
  revokedAt: string | null
  revocationReason: string | null
}
type AdminReport = {
  id: string
  kind: 'post' | 'comment'
  targetId: string
  targetText: string
  targetAuthor: string
  context?: string | null
  contextAuthor?: string | null
  reporter: string
  reason: string
  details: string | null
  status: 'open' | 'resolved' | 'dismissed' | undefined
  resolutionReason: string | null
  createdAt: string
}
type AdminWithdrawal = {
  id: string
  user: { id: string; name: string; username: string | null; email: string }
  amountPaise: number
  payoutMethod: string
  status: 'processing' | 'review_pending' | 'rejected'
  createdAt: string
  wallet: { availablePaise: number; reservedPaise: number } | null
  ledger: { id: string; status: string; amountPaise: number; createdAt: string } | null
}

function money(paise: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(paise / 100)
}

function MetricCard({ label, value, description }: { label: string; value: string | number; description?: string }) {
  return (
    <article className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900'>
      <p className='text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400'>{label}</p>
      <p className='mt-2 text-2xl font-bold tabular-nums'>{value}</p>
      {description ? <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{description}</p> : null}
    </article>
  )
}

function Series({ title, values }: { title: string; values: Array<{ day: string; value: number }> }) {
  const maximum = Math.max(1, ...values.map(({ value }) => value))
  return (
    <section className='rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      {values.length ? (
        <div className='mt-4 flex h-36 items-end gap-1.5 overflow-x-auto'>
          {values.map(({ day, value }) => (
            <div key={day} className='group flex h-full min-w-3 flex-1 flex-col justify-end' title={`${day}: ${value}`}>
              <div className='min-h-1 rounded-t bg-cyan-600 dark:bg-cyan-400' style={{ height: `${Math.max(3, value / maximum * 100)}%` }} />
              <span className='mt-1 hidden text-center text-[9px] text-slate-500 group-last:block'>{day.slice(5)}</span>
            </div>
          ))}
        </div>
      ) : <p className='mt-4 text-sm text-slate-500'>No records in this period.</p>}
    </section>
  )
}

function OverviewPage() {
  const [period, setPeriod] = useState('30')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.get<{ success: boolean } & Overview>(`/admin/overview?period=${period}`)
      .then((result) => { if (active) setOverview(result) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load platform overview.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  if (loading) return <p className='py-10 text-sm text-slate-500' role='status'>Loading live platform metrics…</p>
  if (error) return <p className='rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200' role='alert'>{error}</p>
  if (!overview) return <p className='py-10 text-sm text-slate-500'>No overview data is available.</p>
  const { metrics, series } = overview
  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div><h1 className='text-2xl font-bold'>Platform overview</h1><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Live aggregates from Kozett records · updated {new Date(overview.calculatedAt).toLocaleString()}</p></div>
        <label className='text-sm'>Range <select value={period} onChange={(event) => setPeriod(event.target.value)} className='ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900'><option value='7'>7 days</option><option value='30'>30 days</option><option value='90'>90 days</option></select></label>
      </div>
      <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <MetricCard label='Registered users' value={metrics.totalUsers} description={`+${metrics.newUsers} in selected period`} />
        <MetricCard label='Active users' value={metrics.activeUsers30Days} description={`Active in 30 days · ${metrics.activeUsers1Day} in last day`} />
        <MetricCard label='Feed posts' value={metrics.publishedFeedPosts} description={`${metrics.recentFeedPosts} created in selected period`} />
        <MetricCard label='Certificates issued' value={metrics.certificatesIssued} description={`${metrics.recentCertificatesIssued} in selected period`} />
        <MetricCard label='Assessment attempts' value={metrics.assessmentAttempts} description={`${(metrics.assessmentPassRate * 100).toFixed(1)}% pass rate`} />
        <MetricCard label='Upcoming contests' value={metrics.upcomingContests} />
        <MetricCard label='Active earning opportunities' value={metrics.activeEarningOpportunities} />
        <MetricCard label='Rewards credited' value={money(metrics.rewardsCreditedPaise)} description={`${metrics.rewardTransactions} applied ledger entries`} />
        <MetricCard label='Wallet available' value={money(metrics.walletAvailablePaise)} />
        <MetricCard label='Reserved withdrawals' value={money(metrics.walletReservedPaise)} />
        <MetricCard label='Pending withdrawal requests' value={metrics.pendingWithdrawalRequests} description={money(metrics.pendingWithdrawalAmountPaise)} />
        <MetricCard label='Completed withdrawals' value={metrics.completedWithdrawals ?? 'Not tracked'} description={metrics.completedWithdrawalTracking} />
      </section>
      <section className='grid gap-4 xl:grid-cols-3'>
        <Series title='New user registrations' values={series.registrations.map(({ _id, count }) => ({ day: _id, value: count }))} />
        <Series title='Feed posts created' values={series.posts.map(({ _id, count }) => ({ day: _id, value: count }))} />
        <Series title='Assessment attempts' values={series.assessments.map(({ _id, attempts }) => ({ day: _id, value: attempts }))} />
      </section>
      <p className='rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200'>{overview.platformActivity.reason} {metrics.completedWithdrawalTracking}</p>
    </div>
  )
}

function UsersPage() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('createdAt')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [working, setWorking] = useState(false)

  const loadUsers = useCallback(() => {
    let active = true
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), limit: '25', status, search, sort, order })
    api.get<{ success: boolean; users: AdminUser[]; total: number }>(`/admin/users?${query}`)
      .then((result) => {
        if (!active) return
        setUsers(result.users)
        setTotal(result.total)
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load users.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [order, page, refreshKey, search, sort, status])

  useEffect(() => loadUsers(), [loadUsers])

  const loadDetails = async (userId: string) => {
    setSelectedUserId(userId)
    setSelectedUser(null)
    setActionError('')
    try {
      const result = await api.get<{ success: boolean; user: AdminUserDetails }>(`/admin/users/${encodeURIComponent(userId)}`)
      setSelectedUser(result.user)
    } catch (loadError) {
      setActionError(loadError instanceof Error ? loadError.message : 'Unable to load user details.')
    }
  }

  const changeStatus = async (user: AdminUser) => {
    if (!reason.trim()) {
      setActionError('Enter a reason before changing account status.')
      return
    }
    setWorking(true)
    setActionError('')
    try {
      const nextStatus = user.status === 'active' ? 'suspended' : 'active'
      await api.patch(`/admin/users/${encodeURIComponent(user.id)}/status`, { status: nextStatus, reason: reason.trim() })
      setReason('')
      setSelectedUserId('')
      setSelectedUser(null)
      setRefreshKey((current) => current + 1)
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'Unable to update account status.')
    } finally {
      setWorking(false)
    }
  }

  const recalculateKdr = async (user: AdminUserDetails) => {
    setWorking(true)
    setActionError('')
    try {
      const result = await api.post<{ success: boolean; rating: DeveloperRating | null }>(`/admin/users/${encodeURIComponent(user.id)}/kdr/recalculate`, {})
      setSelectedUser({ ...user, rating: result.rating })
      setRefreshKey((current) => current + 1)
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'Unable to recalculate KDR.')
    } finally {
      setWorking(false)
    }
  }

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div className='space-y-5'>
      <div><h1 className='text-2xl font-bold'>Users</h1><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Search accounts and inspect connected data, KDR, certificates, and wallet summaries.</p></div>
      <form onSubmit={submitSearch} className='flex flex-wrap gap-2'>
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder='Search name, username, or email' className='min-w-60 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900' />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className='rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900'><option value='all'>All accounts</option><option value='active'>Active</option><option value='suspended'>Suspended</option></select>
        <select aria-label='Sort users by' value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} className='rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900'><option value='createdAt'>Newest</option><option value='name'>Name</option><option value='email'>Email</option></select>
        <select aria-label='Sort order' value={order} onChange={(event) => { setOrder(event.target.value); setPage(1) }} className='rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900'><option value='desc'>Descending</option><option value='asc'>Ascending</option></select>
        <button type='submit' className='rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600'>Search</button>
      </form>
      {error ? <p role='alert' className='rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200'>{error}</p> : null}
      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'>
        <table className='min-w-[900px] w-full text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400'><tr><th className='px-4 py-3'>User</th><th className='px-4 py-3'>Status</th><th className='px-4 py-3'>KDR</th><th className='px-4 py-3'>Platforms</th><th className='px-4 py-3'>Certificates / Projects</th><th className='px-4 py-3'>Wallet · available</th><th className='px-4 py-3'>Created</th><th className='px-4 py-3'>Detail</th></tr></thead>
          <tbody className='divide-y divide-slate-100 dark:divide-white/5'>
            {loading ? <tr><td colSpan={8} className='px-4 py-10 text-center text-slate-500'>Loading users…</td></tr>
              : users.length ? users.map((user) => (
                <tr key={user.id} className='align-top'>
                  <td className='px-4 py-3'><p className='font-semibold'>{user.name}</p><p className='text-xs text-slate-500'>{user.username ? `@${user.username} · ` : ''}{user.email}</p>{user.adminRole ? <span className='mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200'>{user.adminRole}</span> : null}</td>
                  <td className='px-4 py-3'><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>{user.status}</span></td>
                  <td className='px-4 py-3 tabular-nums'>{user.rating?.score !== null && user.rating ? user.rating.score.toFixed(1) : 'Not rated'}{user.rating?.rank ? <span className='ml-1 text-xs text-cyan-700 dark:text-cyan-300'>{user.rating.rank}</span> : null}</td>
                  <td className='px-4 py-3'>{user.connectedPlatforms.length ? user.connectedPlatforms.join(', ') : '—'}</td>
                  <td className='px-4 py-3 tabular-nums'>{user.certificateCount} / {user.projectCount}</td>
                  <td className='px-4 py-3 tabular-nums'>{money(user.wallet.availablePaise)}</td>
                  <td className='px-4 py-3 whitespace-nowrap text-xs'>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className='px-4 py-3'><button type='button' onClick={() => void loadDetails(user.id)} className='font-semibold text-cyan-700 hover:underline dark:text-cyan-300'>Inspect</button></td>
                </tr>
              )) : <tr><td colSpan={8} className='px-4 py-10 text-center text-slate-500'>No users matched this search.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className='flex items-center justify-between text-sm text-slate-500'><span>{total} users · page {page} of {Math.max(1, Math.ceil(total / 25))}</span><div className='flex gap-2'><button type='button' disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className='rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Previous</button><button type='button' disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((current) => current + 1)} className='rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Next</button></div></div>

      {selectedUserId ? (
        <section className='rounded-xl border border-cyan-300/40 bg-white p-5 dark:border-cyan-300/20 dark:bg-slate-900'>
          {!selectedUser ? <p className='text-sm text-slate-500' role='status'>Loading account details…</p> : (
            <>
              <div className='flex flex-wrap items-start justify-between gap-3'><div><h2 className='text-lg font-bold'>{selectedUser.name}</h2><p className='text-sm text-slate-500'>{selectedUser.email} · created {new Date(selectedUser.createdAt).toLocaleString()}</p></div><button type='button' onClick={() => { setSelectedUserId(''); setSelectedUser(null); setActionError('') }} className='rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800'>Close</button></div>
              <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                <MetricCard label='KDR' value={selectedUser.rating?.score === null || !selectedUser.rating ? 'Not rated' : selectedUser.rating.score.toFixed(1)} description={selectedUser.rating?.rank ?? 'No rank'} />
                <MetricCard label='Coverage' value={selectedUser.rating ? `${(selectedUser.rating.dataCoverage * 100).toFixed(0)}%` : '—'} description={selectedUser.rating?.algorithmVersion} />
                <MetricCard label='Wallet available' value={selectedUser.wallet ? money(selectedUser.wallet.availablePaise) : '—'} description={`Reserved ${money(selectedUser.wallet?.reservedPaise ?? 0)}`} />
                <MetricCard label='Certificates' value={selectedUser.certificates.length} description={`${selectedUser.projectCount} projects · ${selectedUser.connectedPlatforms.join(', ') || 'no linked platforms'}`} />
              </div>
              {selectedUser.rating ? <div className='mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>{selectedUser.rating.components.map((component) => <div key={component.key} className='rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950'><p className='font-semibold'>{component.label}</p><p className='mt-1 tabular-nums'>{component.score === null ? 'Not available' : `${component.score.toFixed(1)} · ${(component.weight * 100).toFixed(0)}%`}</p></div>)}</div> : null}
              <div className='mt-4 flex flex-wrap gap-4 text-xs text-slate-500'><span>Recent sessions: {selectedUser.sessions.length}</span><span>Ledger entries: {selectedUser.ledger.length}</span><span>Rating snapshots: {selectedUser.ratingHistory.length}</span>{selectedUser.username ? <Link to={`/${encodeURIComponent(selectedUser.username)}`} target='_blank' className='font-semibold text-cyan-700 dark:text-cyan-300'>Public profile</Link> : <span>Public profile unavailable (no username)</span>}</div>
              <div className='mt-4 flex flex-wrap items-end gap-3'>
                <label className='min-w-64 flex-1 text-xs font-semibold'>Reason for account status change<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder='Required for suspend or reactivate' className='mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950' /></label>
                <button type='button' disabled={working} onClick={() => { const row = users.find((item) => item.id === selectedUser.id); if (row) void changeStatus(row) }} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${selectedUser.status === 'active' ? 'bg-rose-700 hover:bg-rose-600' : 'bg-emerald-700 hover:bg-emerald-600'}`}>{selectedUser.status === 'active' ? 'Suspend account' : 'Reactivate account'}</button>
                <button type='button' disabled={working} onClick={() => void recalculateKdr(selectedUser)} className='rounded-lg border border-cyan-600 px-4 py-2.5 text-sm font-semibold text-cyan-800 disabled:opacity-50 dark:text-cyan-200'>Recalculate KDR</button>
              </div>
            </>
          )}
          {actionError ? <p role='alert' className='mt-3 text-sm text-rose-600 dark:text-rose-300'>{actionError}</p> : null}
        </section>
      ) : null}
    </div>
  )
}

function CertificatesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [items, setItems] = useState<AdminCertificate[]>([])
  const [total, setTotal] = useState(0)
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<AdminCertificate | null>(null)
  const [working, setWorking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), limit: '25', search })
    api.get<{ success: boolean; certificates: AdminCertificate[]; total: number }>(`/admin/certificates?${query}`)
      .then((result) => {
        if (!active) return
        setItems(result.certificates)
        setTotal(result.total)
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load certificates.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, search])

  const revoke = async () => {
    if (!selected || !reason.trim()) {
      setError('Select an active certificate and enter a revocation reason.')
      return
    }
    if (!window.confirm(`Revoke credential ${selected.credentialId}? This will make public verification fail.`)) return
    setWorking(true)
    setError('')
    try {
      await api.post(`/admin/certificates/${encodeURIComponent(selected.credentialId)}/revoke`, { reason: reason.trim() })
      setSelected(null)
      setReason('')
      setRefresh((value) => value + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to revoke certificate.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className='space-y-4'>
      <div><h1 className='text-2xl font-bold'>Issued certificates</h1><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Search real issued credentials and inspect their linked assessment results. Revocation is audited and cannot be reversed here.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()) }} className='flex gap-2'>
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder='Credential, user, or assessment' className='min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900' />
        <button className='rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white'>Search</button>
      </form>
      {error ? <p role='alert' className='text-sm text-rose-600 dark:text-rose-300'>{error}</p> : null}
      {selected ? <div className='rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/20'>
        <p className='font-semibold'>Revoke {selected.credentialId}</p>
        <p className='mt-1 text-xs text-slate-600 dark:text-slate-300'>This disables its public verification result. Historical assessment results remain unchanged.</p>
        <div className='mt-3 flex flex-wrap gap-2'>
          <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} placeholder='Required reason' className='min-w-60 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900' />
          <button type='button' disabled={working} onClick={() => void revoke()} className='rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'>{working ? 'Revoking…' : 'Confirm revocation'}</button>
          <button type='button' onClick={() => { setSelected(null); setReason('') }} className='rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700'>Cancel</button>
        </div>
      </div> : null}
      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'>
        <table className='min-w-[900px] w-full text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950'><tr><th className='px-4 py-3'>Credential</th><th className='px-4 py-3'>Recipient</th><th className='px-4 py-3'>Assessment</th><th className='px-4 py-3'>Score</th><th className='px-4 py-3'>Issued</th><th className='px-4 py-3'>Status / action</th></tr></thead>
          <tbody className='divide-y divide-slate-100 dark:divide-white/5'>
            {loading ? <tr><td colSpan={6} className='px-4 py-8 text-center text-slate-500'>Loading certificates…</td></tr>
              : items.length ? items.map((item) => <tr key={item.id}>
                <td className='px-4 py-3 font-mono text-xs'>{item.credentialId}</td>
                <td className='px-4 py-3'>{item.recipient.name}<span className='block text-xs text-slate-500'>{item.recipient.username ? `@${item.recipient.username} · ` : ''}{item.recipient.email}</span></td>
                <td className='px-4 py-3'>{item.assessment.title}<span className='block text-xs text-slate-500'>{item.assessment.technology} · {item.assessment.category}</span></td>
                <td className='px-4 py-3 tabular-nums'>{item.score}/100</td>
                <td className='px-4 py-3 whitespace-nowrap text-xs'>{new Date(item.issuedAt).toLocaleDateString()}</td>
                <td className='px-4 py-3'>{item.revokedAt ? <span className='text-xs font-semibold text-rose-600'>Revoked<span className='block max-w-48 font-normal'>{item.revocationReason}</span></span> : <button type='button' onClick={() => { setSelected(item); setError('') }} className='rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300'>Revoke</button>}</td>
              </tr>) : <tr><td colSpan={6} className='px-4 py-8 text-center text-slate-500'>No issued certificates found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className='flex items-center justify-between text-sm text-slate-500'><span>{total} total credentials</span><div className='flex gap-2'><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Previous</button><button disabled={page * 25 >= total || loading} onClick={() => setPage((value) => value + 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Next</button></div></div>
    </section>
  )
}

function ReportsPage() {
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [items, setItems] = useState<AdminReport[]>([])
  const [total, setTotal] = useState(0)
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<AdminReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), limit: '25', status })
    api.get<{ success: boolean; items: AdminReport[]; total: number }>(`/admin/reports?${query}`)
      .then((result) => { if (active) { setItems(result.items); setTotal(result.total) } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, status])

  const resolve = async (nextStatus: 'resolved' | 'dismissed') => {
    if (!selected || !reason.trim()) {
      setError('A review reason is required.')
      return
    }
    setWorking(true)
    setError('')
    try {
      await api.patch(`/admin/reports/${selected.kind}/${encodeURIComponent(selected.id)}`, { status: nextStatus, reason: reason.trim() })
      setSelected(null)
      setReason('')
      setRefresh((value) => value + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update report status.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className='space-y-4'>
      <div><h1 className='text-2xl font-bold'>Reports & moderation</h1><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Review user-submitted post and comment reports. Resolving or dismissing a report does not hide content or suspend an account.</p></div>
      <label className='text-sm'>Queue <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(null) }} className='ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900'><option value='open'>Open</option><option value='resolved'>Resolved</option><option value='dismissed'>Dismissed</option><option value='all'>All</option></select></label>
      {error ? <p role='alert' className='text-sm text-rose-600 dark:text-rose-300'>{error}</p> : null}
      {selected ? <div className='rounded-xl border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/20'>
        <p className='font-semibold'>Review {selected.kind} report</p><p className='mt-1 text-sm'>{selected.targetText}</p>
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder='Required review reason' className='mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900' />
        <div className='mt-3 flex gap-2'><button type='button' disabled={working} onClick={() => void resolve('resolved')} className='rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50'>Mark resolved</button><button type='button' disabled={working} onClick={() => void resolve('dismissed')} className='rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-700'>Dismiss report</button><button type='button' onClick={() => { setSelected(null); setReason('') }} className='px-3 py-2 text-xs text-slate-500'>Cancel</button></div>
      </div> : null}
      <div className='space-y-3'>
        {loading ? <p className='py-8 text-center text-sm text-slate-500'>Loading report queue…</p>
          : items.length ? items.map((item) => <article key={`${item.kind}:${item.id}`} className='rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900'>
            <div className='flex flex-wrap items-start justify-between gap-3'><div><p className='text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300'>{item.kind} · {item.reason} · {item.status ?? 'open'}</p><p className='mt-2 whitespace-pre-wrap text-sm font-medium'>{item.targetText}</p><p className='mt-1 text-xs text-slate-500'>By {item.targetAuthor} · Reported by {item.reporter} · {new Date(item.createdAt).toLocaleString()}</p>{item.context ? <p className='mt-2 border-l-2 border-slate-300 pl-3 text-xs text-slate-500'>On post by {item.contextAuthor}: {item.context}</p> : null}{item.details ? <p className='mt-2 text-xs text-slate-600 dark:text-slate-300'>Report details: {item.details}</p> : null}{item.resolutionReason ? <p className='mt-2 text-xs text-slate-500'>Review note: {item.resolutionReason}</p> : null}</div>{(item.status ?? 'open') === 'open' ? <button type='button' onClick={() => { setSelected(item); setReason(''); setError('') }} className='rounded-lg border border-cyan-600 px-3 py-2 text-xs font-semibold text-cyan-800 dark:text-cyan-200'>Review</button> : null}</div>
          </article>) : <p className='rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10'>No reports in this queue.</p>}
      </div>
      <div className='flex items-center justify-between text-sm text-slate-500'><span>{total} reports</span><div className='flex gap-2'><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Previous</button><button disabled={page * 25 >= total || loading} onClick={() => setPage((value) => value + 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Next</button></div></div>
    </section>
  )
}

function WithdrawalsPage() {
  const [status, setStatus] = useState('review_pending')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminWithdrawal[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), limit: '25', status, search })
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    if (minAmount) query.set('minPaise', String(Math.round(Number(minAmount) * 100)))
    if (maxAmount) query.set('maxPaise', String(Math.round(Number(maxAmount) * 100)))
    api.get<{ success: boolean; withdrawals: AdminWithdrawal[]; total: number; payoutCompletionSupported: boolean }>(`/admin/withdrawals?${query}`)
      .then((result) => { if (active) { setItems(result.withdrawals); setTotal(result.total) } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load withdrawals.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, maxAmount, minAmount, page, search, status, to])

  return (
    <section className='space-y-4'>
      <div><h1 className='text-2xl font-bold'>Withdrawal requests</h1><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Read-only financial review. This project has no supported approve, reject, or payout-completion state machine; no payout is marked complete here.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()) }} className='flex flex-wrap gap-2'>
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder='Search user name, username, or email' className='min-w-60 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900' />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900'><option value='all'>All statuses</option><option value='processing'>Processing</option><option value='review_pending'>Review pending</option><option value='rejected'>Rejected</option></select>
        <label className='text-xs text-slate-500'>From <input type='date' value={from} onChange={(event) => setFrom(event.target.value)} className='ml-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white' /></label>
        <label className='text-xs text-slate-500'>To <input type='date' value={to} onChange={(event) => setTo(event.target.value)} className='ml-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white' /></label>
        <input aria-label='Minimum amount in rupees' type='number' min='0' step='0.01' value={minAmount} onChange={(event) => setMinAmount(event.target.value)} placeholder='Min ₹' className='w-24 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900' />
        <input aria-label='Maximum amount in rupees' type='number' min='0' step='0.01' value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} placeholder='Max ₹' className='w-24 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900' />
        <button className='rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white'>Search</button>
      </form>
      {error ? <p role='alert' className='text-sm text-rose-600 dark:text-rose-300'>{error}</p> : null}
      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'>
        <table className='min-w-[900px] w-full text-left text-sm'><thead className='bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950'><tr><th className='px-4 py-3'>Request / user</th><th className='px-4 py-3'>Amount</th><th className='px-4 py-3'>Status</th><th className='px-4 py-3'>Wallet</th><th className='px-4 py-3'>Ledger</th><th className='px-4 py-3'>Requested</th></tr></thead>
          <tbody className='divide-y divide-slate-100 dark:divide-white/5'>{loading ? <tr><td colSpan={6} className='px-4 py-8 text-center text-slate-500'>Loading withdrawal requests…</td></tr> : items.length ? items.map((item) => <tr key={item.id}>
            <td className='px-4 py-3'><span className='font-mono text-xs'>{item.id}</span><span className='mt-1 block font-semibold'>{item.user.name}</span><span className='block text-xs text-slate-500'>{item.user.username ? `@${item.user.username} · ` : ''}{item.user.email}</span></td>
            <td className='px-4 py-3 tabular-nums'>{money(item.amountPaise)}<span className='block text-xs text-slate-500'>{item.payoutMethod.replace('_', ' ')}</span></td>
            <td className='px-4 py-3'>{item.status.replace('_', ' ')}</td>
            <td className='px-4 py-3 text-xs tabular-nums'>{item.wallet ? <>Available {money(item.wallet.availablePaise)}<span className='block'>Reserved {money(item.wallet.reservedPaise)}</span></> : 'Unavailable'}</td>
            <td className='px-4 py-3 text-xs'>{item.ledger ? <>{item.ledger.status}<span className='block font-mono'>{item.ledger.id}</span></> : 'No ledger entry'}</td>
            <td className='px-4 py-3 whitespace-nowrap text-xs'>{new Date(item.createdAt).toLocaleString()}</td>
          </tr>) : <tr><td colSpan={6} className='px-4 py-8 text-center text-slate-500'>No matching withdrawal requests.</td></tr>}</tbody>
        </table>
      </div>
      <div className='flex items-center justify-between text-sm text-slate-500'><span>{total} requests</span><div className='flex gap-2'><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Previous</button><button disabled={page * 25 >= total || loading} onClick={() => setPage((value) => value + 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Next</button></div></div>
    </section>
  )
}

function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.get<{ success: boolean; items: AuditItem[] }>('/admin/audit-logs?limit=50&page=1')
      .then((result) => { if (active) setItems(result.items) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load audit events.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return (
    <section className='space-y-4'>
      <div><h1 className='text-2xl font-bold'>Audit logs</h1><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Append-only records of administrator operations.</p></div>
      {error ? <p role='alert' className='text-sm text-rose-600'>{error}</p> : null}
      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'><table className='min-w-[800px] w-full text-left text-sm'><thead className='bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950'><tr><th className='px-4 py-3'>Action / outcome</th><th className='px-4 py-3'>Administrator</th><th className='px-4 py-3'>Target</th><th className='px-4 py-3'>Reason</th><th className='px-4 py-3'>Time</th></tr></thead><tbody className='divide-y divide-slate-100 dark:divide-white/5'>{loading ? <tr><td colSpan={5} className='px-4 py-8 text-center text-slate-500'>Loading audit events…</td></tr> : items.length ? items.map((item) => <tr key={item.id}><td className='px-4 py-3 font-semibold'>{item.action}<span className='block text-xs text-slate-500'>{item.role} · {item.outcome}</span></td><td className='px-4 py-3'>{item.administrator.name}<span className='block text-xs text-slate-500'>{item.administrator.email}</span></td><td className='px-4 py-3'>{item.targetType} · {item.targetId}</td><td className='max-w-xs px-4 py-3 text-xs'>{item.reason ?? '—'}</td><td className='px-4 py-3 whitespace-nowrap text-xs'>{new Date(item.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className='px-4 py-8 text-center text-slate-500'>No administrator actions recorded yet.</td></tr>}</tbody></table></div>
    </section>
  )
}

function PasswordChangePage({ onChanged }: { onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) {
      setError('The new password and confirmation do not match.')
      return
    }
    setSaving(true)
    try {
      await api.post('/admin/auth/password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      onChanged()
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Unable to change administrator password.')
    } finally {
      setSaving(false)
    }
  }
  return <section className='mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900'><h1 className='text-xl font-bold'>Change initial password</h1><p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>Set a unique password before accessing administrator tools.</p><form onSubmit={(event) => void submit(event)} className='mt-5 space-y-4'>{[['Current password', currentPassword, setCurrentPassword], ['New password', newPassword, setNewPassword], ['Confirm new password', confirmation, setConfirmation]].map(([label, value, setter]) => <label key={label as string} className='block text-sm font-medium'>{label as string}<input type='password' required minLength={8} maxLength={128} autoComplete={label === 'Current password' ? 'current-password' : 'new-password'} value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className='mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950' /></label>)}{error ? <p role='alert' className='text-sm text-rose-600'>{error}</p> : null}<button disabled={saving} className='rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Saving…' : 'Change password'}</button></form></section>
}

export default function AdminControlCenter() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const mustChangePassword = admin?.mustChangePassword === true

  const refreshSession = useCallback(async () => {
    try {
      const result = await api.get<{ success: boolean; admin: Admin }>('/admin/auth/session')
      setAdmin(result.admin)
      setError('')
    } catch (loadError) {
      setAdmin(null)
      setError(loadError instanceof Error ? loadError.message : 'Administrator session is unavailable.')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { void refreshSession() }, [refreshSession])

  useEffect(() => {
    if (!checking && !admin && location.pathname !== '/ad/login') navigate('/ad/login', { replace: true })
    if (admin?.mustChangePassword && location.pathname !== '/ad/password') navigate('/ad/password', { replace: true })
  }, [admin, checking, location.pathname, navigate])

  const logout = async () => {
    try {
      await api.post('/admin/auth/logout', {})
      setAdmin(null)
      navigate('/ad/login', { replace: true })
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to confirm administrator logout.')
    }
  }

  if (checking) return <main className='grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500 dark:bg-[#080d16]' role='status'>Verifying administrator session…</main>
  if (!admin) return <Navigate to='/ad/login' replace />
  if (mustChangePassword) return <main className='min-h-screen bg-slate-100 px-4 py-12 dark:bg-[#080d16]'><PasswordChangePage onChanged={() => void refreshSession()} /></main>

  const navigation = [
    { to: '/ad', label: 'Overview', end: true, roles: ['superadmin', 'admin', 'finance_admin'] },
    { to: '/ad/users', label: 'Users & KDR', roles: ['superadmin', 'admin'] },
    { to: '/ad/certificates', label: 'Issued certificates', roles: ['superadmin', 'admin'] },
    { to: '/ad/content/feed-posts', label: 'Feed posts', roles: ['superadmin', 'admin'] },
    { to: '/ad/reports', label: 'Reports & moderation', roles: ['superadmin', 'admin', 'moderator'] },
    { to: '/ad/withdrawals', label: 'Withdrawal requests', roles: ['superadmin', 'admin', 'finance_admin'] },
    { to: '/ad/audit', label: 'Audit logs' },
  ].filter((item) => !item.roles || item.roles.includes(admin.role))
  const sectionTitle = navigation.find((item) => item.to === location.pathname)?.label ?? 'Overview'

  return (
    <div className='min-h-screen bg-slate-100 text-slate-900 dark:bg-[#080d16] dark:text-white'>
      <div className='flex min-h-screen'>
        <aside className='hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950 md:flex'>
          <Link to='/ad' className='rounded-lg px-3 py-3 text-sm font-black tracking-[0.18em] text-cyan-700 dark:text-cyan-300'>KOZETT <span className='text-slate-400'>ADMIN</span></Link>
          <nav className='mt-6 space-y-1' aria-label='Administrator navigation'>{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}>{item.label}</NavLink>)}</nav>
          <div className='mt-auto rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10'><p className='font-semibold'>{admin.name}</p><p className='mt-1 break-all text-slate-500'>{admin.email}</p><p className='mt-2 inline-flex rounded-full bg-violet-100 px-2 py-1 font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200'>{admin.role}</p></div>
        </aside>
        <div className='min-w-0 flex-1'>
          <header className='sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 sm:px-6'>
            <div className='min-w-0'><p className='text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300'>Kozett admin control center</p><h1 className='truncate text-lg font-bold'>{sectionTitle}</h1></div>
            <div className='flex items-center gap-2'><span className='hidden max-w-48 truncate text-xs text-slate-500 sm:block'>{admin.name}</span><button type='button' onClick={toggleTheme} className='rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700'>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><button type='button' onClick={() => void logout()} className='rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900'>Log out</button></div>
          </header>
          <nav className='flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-slate-950 md:hidden' aria-label='Mobile administrator navigation'>{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100' : 'text-slate-600 dark:text-slate-300'}`}>{item.label}</NavLink>)}</nav>
          <main className='mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8'>
            {error ? <p role='alert' className='mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200'>{error}</p> : null}
            <Routes>
              <Route index element={admin.role === 'moderator' ? <Navigate to='/ad/reports' replace /> : <OverviewPage />} />
              <Route path='users' element={['superadmin', 'admin'].includes(admin.role) ? <UsersPage /> : <Navigate to='/ad' replace />} />
              <Route path='certificates' element={['superadmin', 'admin'].includes(admin.role) ? <CertificatesPage /> : <Navigate to='/ad' replace />} />
              <Route path='content/feed-posts' element={['superadmin', 'admin'].includes(admin.role) ? <AdminFeedPostsPage /> : <Navigate to='/ad' replace />} />
              <Route path='reports' element={['superadmin', 'admin', 'moderator'].includes(admin.role) ? <ReportsPage /> : <Navigate to='/ad' replace />} />
              <Route path='withdrawals' element={['superadmin', 'admin', 'finance_admin'].includes(admin.role) ? <WithdrawalsPage /> : <Navigate to='/ad' replace />} />
              <Route path='audit' element={<AuditPage />} />
              <Route path='password' element={<PasswordChangePage onChanged={() => void refreshSession()} />} />
              <Route path='*' element={<Navigate to='/ad' replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
