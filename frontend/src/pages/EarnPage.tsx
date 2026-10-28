import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'

type EarnSummary = {
  totalEarningsPaise: number
  availableBalancePaise: number
  pendingWithdrawalsPaise: number
  totalWithdrawnPaise: number
  pendingRewardsPaise: number
  currentStreak: number
  minimumWithdrawalPaise: number
  timezone: string
  currency: 'INR'
}

type CheckInStatus = {
  enabled: boolean
  claimStatus: 'disabled' | 'already_claimed' | 'available'
  checkedInToday: boolean
  currentStreak: number
  todayRewardPaise: number
  nextRewardPaise: number
  nextStreakDay: number
  checkInDate: string
  timezone: string
  schedule: Array<{ dayFrom: number; dayTo: number | null; rewardPaise: number }>
}

type EarnOpportunity = {
  id: string
  title: string
  description: string
  category: 'Daily Check-in' | string
  tags: string[]
  rewardPaise: number
  status: 'available' | 'completed'
  estimatedEffort?: string
  availabilityMessage?: string
}

type EarnTransaction = {
  id: string
  type: 'check_in_reward' | 'withdrawal_reservation'
  status: 'confirmed' | 'review_pending'
  amountPaise: number
  date: string
  dateKey: string | null
  referenceId: string
}

type WithdrawalRequest = {
  id: string
  amountPaise: number
  status: 'processing' | 'review_pending' | 'rejected'
  payoutMethod: string
  createdAt: string
}

type TransactionPage = {
  transactions: EarnTransaction[]
  page: number
  pages: number
  total: number
}

const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80'
const primaryButton = 'inline-flex items-center justify-center rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50'
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const categories = [
  'Daily Check-in',
  'Coding Challenges',
  'Contests',
  'Open-Source Contributions',
  'Paid Pull Requests',
  'Freelance Projects',
  'Referrals',
  'Special Campaigns',
]

function formatRupees(amountPaise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amountPaise / 100)
}

function getStatusClass(status: EarnTransaction['status'] | WithdrawalRequest['status']) {
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
  if (status === 'review_pending' || status === 'processing') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

function transactionLabel(type: EarnTransaction['type']) {
  return type === 'check_in_reward' ? 'Daily check-in reward' : 'Withdrawal reserved for manual review'
}

function statusLabel(status: EarnTransaction['status'] | WithdrawalRequest['status']) {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'review_pending') return 'Pending review'
  if (status === 'processing') return 'Processing'
  return 'Rejected'
}

function opportunityCategoryLabel(category: string) {
  if (category === 'daily_check_in') return 'Daily Check-in'
  return category.replaceAll('_', ' ')
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

export default function EarnPage() {
  const [summary, setSummary] = useState<EarnSummary | null>(null)
  const [checkIn, setCheckIn] = useState<CheckInStatus | null>(null)
  const [opportunities, setOpportunities] = useState<EarnOpportunity[]>([])
  const [transactionPage, setTransactionPage] = useState<TransactionPage | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [transactionPageNumber, setTransactionPageNumber] = useState(1)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [checkInBusy, setCheckInBusy] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [opportunityStatus, setOpportunityStatus] = useState('available')
  const [sort, setSort] = useState('title')
  const [reloadKey, setReloadKey] = useState(0)
  const withdrawalRequest = useRef<{ amountPaise: number; idempotencyKey: string } | null>(null)

  const loadPage = useCallback(async () => {
    setLoading(true)
    setPageError(null)
    try {
      const [summaryResponse, checkInResponse, opportunityResponse, historyResponse, withdrawalResponse] = await Promise.all([
        api.get<{ success: boolean; summary: EarnSummary }>('/earn/summary'),
        api.get<{ success: boolean; checkIn: CheckInStatus }>('/earn/check-in/status'),
        api.get<{ success: boolean; opportunities: EarnOpportunity[] }>('/earn/opportunities'),
        api.get<{ success: boolean; transactions: EarnTransaction[]; page: number; pages: number; total: number }>(`/earn/transactions?page=${transactionPageNumber}&limit=10${historyFilter === 'all' ? '' : `&type=${encodeURIComponent(historyFilter)}`}`),
        api.get<{ success: boolean; withdrawals: WithdrawalRequest[] }>('/earn/withdrawals'),
      ])
      setSummary(summaryResponse.summary)
      setCheckIn(checkInResponse.checkIn)
      setOpportunities(opportunityResponse.opportunities.map((opportunity) => ({
        ...opportunity,
        category: opportunityCategoryLabel(opportunity.category),
      })))
      setTransactionPage({
        transactions: historyResponse.transactions,
        page: historyResponse.page,
        pages: historyResponse.pages,
        total: historyResponse.total,
      })
      setWithdrawals(withdrawalResponse.withdrawals)
    } catch (loadError) {
      setPageError(messageFromError(loadError, 'Unable to load earnings right now.'))
    } finally {
      setLoading(false)
    }
  }, [historyFilter, transactionPageNumber])

  useEffect(() => {
    void loadPage()
  }, [loadPage, reloadKey])

  const visibleOpportunities = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return opportunities
      .filter((opportunity) => {
        const available = opportunity.status === 'available'
        const matchesStatus = opportunityStatus === 'all' ||
          (opportunityStatus === 'available' ? available : !available)
        const matchesCategory = category === 'all' || opportunity.category === category
        const matchesQuery = !normalizedQuery || [
          opportunity.title,
          opportunity.description,
          ...opportunity.tags,
        ].some((field) => field.toLocaleLowerCase().includes(normalizedQuery))
        return matchesStatus && matchesCategory && matchesQuery
      })
      .sort((left, right) => sort === 'reward'
        ? right.rewardPaise - left.rewardPaise || left.title.localeCompare(right.title)
        : left.title.localeCompare(right.title))
  }, [category, opportunityStatus, opportunities, query, sort])

  async function claimCheckIn() {
    if (checkInBusy || checkIn?.checkedInToday) return
    setCheckInBusy(true)
    setPageError(null)
    setActionMessage(null)
    try {
      const response = await api.post<{
        success: boolean
        checkIn?: CheckInStatus & { rewardPaise: number; streakDay: number }
        summary?: EarnSummary
        transaction?: EarnTransaction
        alreadyClaimed?: boolean
        alreadyCheckedIn?: boolean
      }>('/earn/check-in', {})
      if (response.summary) setSummary(response.summary)
      if (response.checkIn) setCheckIn((current) => current ? {
        ...current,
        checkedInToday: true,
        currentStreak: response.checkIn!.streakDay ?? current.currentStreak,
        todayRewardPaise: response.checkIn!.rewardPaise ?? current.todayRewardPaise,
      } : current)
      setActionMessage(response.alreadyClaimed || response.alreadyCheckedIn
        ? 'You already checked in today. Your confirmed balance is up to date.'
        : `Check-in confirmed. ${formatRupees(response.checkIn?.rewardPaise ?? checkIn?.todayRewardPaise ?? 0)} has been added.`)
      setTransactionPageNumber(1)
      setReloadKey((value) => value + 1)
    } catch (claimError) {
      setPageError(messageFromError(claimError, 'Unable to complete your check-in. Please try again.'))
    } finally {
      setCheckInBusy(false)
    }
  }

  async function submitWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWithdrawError(null)
    setWithdrawMessage(null)
    const amountMatch = /^(\d+)(?:\.(\d{1,2}))?$/.exec(withdrawAmount.trim())
    if (!amountMatch) {
      setWithdrawError('Enter a valid amount with up to two decimal places.')
      return
    }
    const amountPaise = Number(amountMatch[1]) * 100 + Number((amountMatch[2] ?? '').padEnd(2, '0'))
    if (!Number.isSafeInteger(amountPaise)) {
      setWithdrawError('Enter a valid amount with up to two decimal places.')
      return
    }
    const minimumWithdrawalPaise = summary?.minimumWithdrawalPaise ?? 0
    if (amountPaise < minimumWithdrawalPaise) {
      setWithdrawError(`The minimum request for review is ${formatRupees(minimumWithdrawalPaise)}.`)
      return
    }
    if (amountPaise > (summary?.availableBalancePaise ?? 0)) {
      setWithdrawError('The requested amount exceeds your available balance.')
      return
    }
    setWithdrawBusy(true)
    try {
      if (!withdrawalRequest.current || withdrawalRequest.current.amountPaise !== amountPaise) {
        withdrawalRequest.current = { amountPaise, idempotencyKey: crypto.randomUUID() }
      }
      const response = await api.post<{
        success: boolean
        request?: WithdrawalRequest
        withdrawal?: WithdrawalRequest
        summary?: EarnSummary
        message?: string
      }>('/earn/withdrawals', {
        amountPaise,
        payoutMethod: 'manual_review',
        idempotencyKey: withdrawalRequest.current.idempotencyKey,
      })
      if (response.summary) setSummary(response.summary)
      setWithdrawMessage(response.message ?? 'Your withdrawal request was submitted for review. No payment has been sent.')
      setWithdrawAmount('')
      withdrawalRequest.current = null
      setReloadKey((value) => value + 1)
    } catch (withdrawalError) {
      if (withdrawalError instanceof ApiError && withdrawalError.status < 500) {
        withdrawalRequest.current = null
      }
      setWithdrawError(messageFromError(withdrawalError, 'Unable to submit your request. Please try again.'))
    } finally {
      setWithdrawBusy(false)
    }
  }

  const canWithdraw = (summary?.availableBalancePaise ?? 0) >= (summary?.minimumWithdrawalPaise ?? Number.MAX_SAFE_INTEGER)
  const nextMilestoneProgress = checkIn
    ? Math.min(100, (Math.max(0, checkIn.currentStreak - 1) / Math.max(1, checkIn.nextStreakDay - 1)) * 100)
    : 0
  const schedule = checkIn?.schedule ?? []

  return (
    <section className='mx-auto min-h-[70vh] max-w-7xl px-4 py-9 sm:px-6 lg:px-8'>
      <header className='relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40 sm:p-8'>
        <div aria-hidden='true' className='pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl' />
        <div className='relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300'>Kozett rewards</p>
            <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl'>Earn</h1>
            <p className='mt-3 max-w-2xl text-slate-600 dark:text-slate-300'>Discover rewards, complete opportunities, and track your earnings on Kozett.</p>
          </div>
          <div className='grid gap-3 sm:grid-cols-2 xl:min-w-[420px]'>
            <BalanceCard label='Total Earnings' value={summary ? formatRupees(summary.totalEarningsPaise) : '—'} detail='Confirmed lifetime rewards' />
            <BalanceCard label='Available Balance' value={summary ? formatRupees(summary.availableBalancePaise) : '—'} detail='Eligible for withdrawal' />
          </div>
          <div className='xl:ml-2'>
            <button type='button' onClick={() => setWithdrawOpen(true)} disabled={!canWithdraw} title={!summary ? 'Loading withdrawal requirements.' : !canWithdraw ? `At least ${formatRupees(summary.minimumWithdrawalPaise)} in available balance is required.` : 'Request a withdrawal review'} className={primaryButton}>
              Withdraw
            </button>
            {!canWithdraw && summary ? <p className='mt-2 max-w-48 text-xs text-slate-500 dark:text-slate-400'>Available balance must reach {formatRupees(summary.minimumWithdrawalPaise)}.</p> : null}
          </div>
        </div>
        {summary && (summary.pendingWithdrawalsPaise > 0 || summary.pendingRewardsPaise > 0 || summary.totalWithdrawnPaise > 0) ? (
          <div className='relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400'>
            <span>Pending withdrawals: {formatRupees(summary.pendingWithdrawalsPaise)}</span>
            <span>Pending rewards: {formatRupees(summary.pendingRewardsPaise)}</span>
            <span>Total withdrawn: {formatRupees(summary.totalWithdrawnPaise)}</span>
          </div>
        ) : null}
      </header>

      {pageError ? (
        <div className='mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200' role='alert'>
          <span>{pageError}</span>
          <button type='button' onClick={() => setReloadKey((value) => value + 1)} className='ml-3 font-semibold underline'>Retry</button>
        </div>
      ) : null}
      {actionMessage ? <p className='mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200' role='status'>{actionMessage}</p> : null}

      <div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]'>
        <div className='min-w-0'>
          <section aria-labelledby='opportunities-heading'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300'>Verified opportunities</p>
                <h2 id='opportunities-heading' className='mt-1 text-2xl font-bold text-slate-950 dark:text-white'>Ways to earn</h2>
              </div>
              <p className='text-sm text-slate-500 dark:text-slate-400'>{visibleOpportunities.length} options</p>
            </div>
            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
              <label className='relative'>
                <span className='sr-only'>Search earning opportunities</span>
                <svg aria-hidden='true' viewBox='0 0 24 24' className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500' fill='none' stroke='currentColor' strokeWidth='1.8'><circle cx='11' cy='11' r='7' /><path d='m20 20-4-4' /></svg>
                <input type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search opportunities or tags...' className={`${inputClass} pl-10`} />
              </label>
              <div className='grid grid-cols-2 gap-3'>
                <select aria-label='Filter by category' value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                  <option value='all'>All categories</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select aria-label='Filter by availability' value={opportunityStatus} onChange={(event) => setOpportunityStatus(event.target.value)} className={inputClass}>
                  <option value='available'>Available</option>
                  <option value='all'>All statuses</option>
                  <option value='completed'>Unavailable</option>
                </select>
              </div>
            </div>
            <div className='mt-3 flex items-center justify-between'>
              <p className='text-xs text-slate-500 dark:text-slate-400'>Only configured opportunities are shown as available.</p>
              <select aria-label='Sort opportunities' value={sort} onChange={(event) => setSort(event.target.value)} className='rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'>
                <option value='title'>Title (A–Z)</option>
                <option value='reward'>Reward (high to low)</option>
              </select>
            </div>

            <div className='mt-4 space-y-3'>
              {loading && !opportunities.length ? <div className={`${panel} text-sm text-slate-500 dark:text-slate-400`} role='status'>Loading earning opportunities...</div>
                : visibleOpportunities.length ? visibleOpportunities.map((opportunity) => (
                  <article key={opportunity.id} className={`${panel} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`}>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='font-semibold text-slate-950 dark:text-white'>{opportunity.title}</h3>
                        <span className='rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200'>{opportunity.category}</span>
                      </div>
                      <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300'>{opportunity.description}</p>
                      {opportunity.tags.length ? <div className='mt-3 flex flex-wrap gap-1.5'>{opportunity.tags.map((tag) => <span key={tag} className='rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300'>{tag}</span>)}</div> : null}
                      {opportunity.availabilityMessage ? <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>{opportunity.availabilityMessage}</p> : null}
                    </div>
                    <div className='shrink-0 sm:text-right'>
                      <p className='text-xs text-slate-500 dark:text-slate-400'>Reward</p>
                      <p className='text-xl font-bold text-slate-950 dark:text-white'>{formatRupees(opportunity.rewardPaise)}</p>
                      {opportunity.estimatedEffort ? <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{opportunity.estimatedEffort}</p> : null}
                      {opportunity.category === 'Daily Check-in' ? <button type='button' onClick={() => document.getElementById('daily-check-in')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className='mt-3 text-sm font-semibold text-cyan-800 hover:text-cyan-600 dark:text-cyan-300'>Check in below →</button> : <span className='mt-3 inline-flex rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'>No verified task is currently open</span>}
                    </div>
                  </article>
                )) : <div className={`${panel} border-dashed py-10 text-center`}>
                  <h3 className='font-semibold text-slate-950 dark:text-white'>No opportunities found</h3>
                  <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>Try changing your search or filters.</p>
                </div>}
            </div>
          </section>

          <section aria-labelledby='history-heading' className='mt-9'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300'>Your ledger</p>
                <h2 id='history-heading' className='mt-1 text-2xl font-bold text-slate-950 dark:text-white'>Earnings history</h2>
              </div>
              <select aria-label='Filter transaction history' value={historyFilter} onChange={(event) => { setHistoryFilter(event.target.value); setTransactionPageNumber(1) }} className='rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'>
                <option value='all'>All transactions</option>
                <option value='check_in_reward'>Daily check-ins</option>
                <option value='withdrawal_reservation'>Withdrawals</option>
              </select>
            </div>
            <div className={`${panel} mt-4 overflow-hidden p-0`}>
              {transactionPage?.transactions.length ? (
                <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                  {transactionPage.transactions.map((transaction) => (
                    <article key={transaction.id} className='flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
                      <div className='min-w-0'>
                        <h3 className='truncate text-sm font-semibold text-slate-900 dark:text-slate-100'>{transactionLabel(transaction.type)}</h3>
                        <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{dateLabel(transaction.date)} · {transaction.dateKey ?? 'Wallet transaction'}</p>
                        <p className='mt-1 break-all font-mono text-[10px] text-slate-400 dark:text-slate-500'>Ref: {transaction.referenceId}</p>
                      </div>
                      <div className='flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1'>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(transaction.status)}`}>{statusLabel(transaction.status)}</span>
                        <span className={`text-sm font-bold ${transaction.type === 'withdrawal_reservation' ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-800 dark:text-emerald-300'}`}>{transaction.type === 'withdrawal_reservation' ? '−' : '+'}{formatRupees(transaction.amountPaise)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className='px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400'>{loading ? 'Loading transactions...' : 'No transactions to show yet. Complete a check-in to start your earnings history.'}</p>}
              {transactionPage && transactionPage.pages > 1 ? (
                <div className='flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800'>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>Page {transactionPage.page} of {transactionPage.pages} · {transactionPage.total} records</p>
                  <div className='flex gap-2'>
                    <button type='button' disabled={transactionPage.page <= 1} onClick={() => setTransactionPageNumber((page) => page - 1)} className='rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700'>Previous</button>
                    <button type='button' disabled={transactionPage.page >= transactionPage.pages} onClick={() => setTransactionPageNumber((page) => page + 1)} className='rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700'>Next</button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section aria-labelledby='withdrawal-history-heading' className='mt-9'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300'>Payout requests</p>
              <h2 id='withdrawal-history-heading' className='mt-1 text-2xl font-bold text-slate-950 dark:text-white'>Withdrawal history</h2>
            </div>
            <div className={`${panel} mt-4 overflow-hidden p-0`}>
              {withdrawals.length ? (
                <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                  {withdrawals.map((withdrawal) => (
                    <article key={withdrawal.id} className='flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5'>
                      <div>
                        <p className='text-sm font-semibold text-slate-900 dark:text-slate-100'>Manual payout review</p>
                        <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{dateLabel(withdrawal.createdAt)} · {withdrawal.payoutMethod.replaceAll('_', ' ')}</p>
                        <p className='mt-1 break-all font-mono text-[10px] text-slate-400 dark:text-slate-500'>Request: {withdrawal.id}</p>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(withdrawal.status)}`}>{statusLabel(withdrawal.status)}</span>
                        <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{formatRupees(withdrawal.amountPaise)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className='px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400'>You have not requested a withdrawal.</p>}
            </div>
          </section>
        </div>

        <aside className='space-y-5'>
          <section id='daily-check-in' className={`${panel} scroll-mt-24 overflow-hidden p-0`}>
            <div className='bg-gradient-to-r from-cyan-800 to-slate-900 px-5 py-5 text-white'>
              <p className='text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200'>Daily reward</p>
              <h2 className='mt-1 text-xl font-bold'>Check in & earn</h2>
              <p className='mt-1 text-sm text-slate-200'>One reward per India calendar day.</p>
            </div>
            <div className='p-5'>
              <div className='flex items-end justify-between gap-3'>
                <div>
                  <p className='text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'>Current streak</p>
                  <p className='mt-1 text-3xl font-black text-slate-950 dark:text-white'>{checkIn?.currentStreak ?? summary?.currentStreak ?? '—'}<span className='ml-2 text-sm font-semibold text-slate-500 dark:text-slate-400'>days</span></p>
                </div>
                <div className='text-right'>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>Today's reward</p>
                  <p className='text-xl font-bold text-cyan-800 dark:text-cyan-300'>{checkIn ? formatRupees(checkIn.todayRewardPaise) : '—'}</p>
                </div>
              </div>
              <div className='mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80'>
                <div className='flex justify-between gap-3 text-sm'>
                  <span className='text-slate-600 dark:text-slate-300'>Next reward</span>
                  <strong className='text-slate-950 dark:text-white'>{checkIn ? `${formatRupees(checkIn.nextRewardPaise)} · Day ${checkIn.nextStreakDay}` : '—'}</strong>
                </div>
                <div className='mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700' role='progressbar' aria-label='Progress to next check-in reward tier' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(nextMilestoneProgress)}>
                  <div className='h-full rounded-full bg-cyan-600 transition-all' style={{ width: `${nextMilestoneProgress}%` }} />
                </div>
                <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>Time zone: Asia/Kolkata · Progress to your next reward tier</p>
              </div>
              <button type='button' disabled={checkInBusy || checkIn?.checkedInToday || loading || !checkIn || !checkIn.enabled} onClick={() => void claimCheckIn()} className={`${primaryButton} mt-5 w-full`}>
                {checkInBusy ? 'Confirming check-in...' : !checkIn ? 'Loading reward...' : !checkIn.enabled ? 'Check-in unavailable' : checkIn.checkedInToday ? 'Checked in today' : `Check In & Earn ${formatRupees(checkIn.todayRewardPaise)}`}
              </button>
              <p className='mt-2 text-center text-xs text-slate-500 dark:text-slate-400'>
                {!checkIn?.enabled ? 'Daily check-in rewards are temporarily disabled.' : checkIn?.checkedInToday ? 'Your reward for today is already recorded.' : 'The server confirms your reward before your balance changes.'}
              </p>
            </div>
          </section>

          <section className={panel}>
            <div className='flex items-center justify-between gap-3'>
              <h2 className='font-semibold text-slate-950 dark:text-white'>Reward schedule</h2>
              <span className='text-xs text-slate-500 dark:text-slate-400'>Per consecutive day</span>
            </div>
            <ol className='mt-4 space-y-3'>
              {schedule.map((tier) => (
                <li key={`${tier.dayFrom}-${tier.dayTo}`} className='flex items-center justify-between gap-3 text-sm'>
                  <span className='text-slate-600 dark:text-slate-300'>Day {tier.dayFrom}{tier.dayTo ? `–${tier.dayTo}` : '+'}</span>
                  <span className='font-semibold text-slate-950 dark:text-white'>{formatRupees(tier.rewardPaise)} / day</span>
                </li>
              ))}
              {!schedule.length ? <li className='text-sm text-slate-500 dark:text-slate-400'>{loading ? 'Loading reward schedule...' : 'Reward schedule unavailable.'}</li> : null}
            </ol>
            <p className='mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400'>Missing a calendar day resets the consecutive streak. The schedule is supplied by the rewards service.</p>
          </section>

          {summary ? (
            <section className={panel}>
              <h2 className='font-semibold text-slate-950 dark:text-white'>Balance overview</h2>
              <dl className='mt-4 space-y-3'>
                <MoneyLine label='Lifetime earned' value={summary.totalEarningsPaise} />
                <MoneyLine label='Available' value={summary.availableBalancePaise} />
                <MoneyLine label='Pending withdrawals' value={summary.pendingWithdrawalsPaise} />
                <MoneyLine label='Total withdrawn' value={summary.totalWithdrawnPaise} />
              </dl>
            </section>
          ) : null}
        </aside>
      </div>

      {withdrawOpen ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) setWithdrawOpen(false) }}>
          <section role='dialog' aria-modal='true' aria-labelledby='withdraw-heading' className={`${panel} w-full max-w-lg p-6`}>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800 dark:text-cyan-300'>Request a payout review</p>
                <h2 id='withdraw-heading' className='mt-1 text-xl font-bold text-slate-950 dark:text-white'>Withdraw earnings</h2>
              </div>
              <button type='button' aria-label='Close withdrawal dialog' onClick={() => setWithdrawOpen(false)} className='rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'>×</button>
            </div>
            <div className='mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80'>
              <div className='flex justify-between text-sm'><span className='text-slate-600 dark:text-slate-300'>Available balance</span><strong className='text-slate-950 dark:text-white'>{formatRupees(summary?.availableBalancePaise ?? 0)}</strong></div>
              <p className='mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400'>Minimum request: {formatRupees(summary?.minimumWithdrawalPaise ?? 0)}. Requests are reviewed manually. Submitting does not initiate or guarantee an automatic payment.</p>
            </div>
            <form onSubmit={(event) => void submitWithdrawal(event)} className='mt-5 space-y-4'>
              <div>
                <label htmlFor='withdraw-amount' className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>Amount (INR)</label>
                <input id='withdraw-amount' type='number' min={((summary?.minimumWithdrawalPaise ?? 0) / 100).toFixed(2)} step='0.01' max={((summary?.availableBalancePaise ?? 0) / 100).toFixed(2)} value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder={((summary?.minimumWithdrawalPaise ?? 0) / 100).toFixed(2)} className={inputClass} required />
              </div>
              <div>
                <label className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200'>Payout method</label>
                <div className='rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200'>Manual review request</div>
              </div>
              <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>Do not enter bank passwords, PINs, OTPs, or card details. Payout instructions, if approved, will be handled separately.</p>
              {withdrawError ? <p className='text-sm text-red-700 dark:text-red-300' role='alert'>{withdrawError}</p> : null}
              {withdrawMessage ? <p className='text-sm text-emerald-800 dark:text-emerald-300' role='status'>{withdrawMessage}</p> : null}
              <div className='flex flex-wrap justify-end gap-3 pt-2'>
                <button type='button' onClick={() => setWithdrawOpen(false)} className='rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200'>Cancel</button>
                <button type='submit' disabled={withdrawBusy || !canWithdraw} className={primaryButton}>{withdrawBusy ? 'Submitting request...' : 'Confirm review request'}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function BalanceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70'>
      <p className='text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'>{label}</p>
      <p className='mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white'>{value}</p>
      <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{detail}</p>
    </div>
  )
}

function MoneyLine({ label, value }: { label: string; value: number }) {
  return <div className='flex justify-between gap-3 text-sm'><dt className='text-slate-600 dark:text-slate-300'>{label}</dt><dd className='font-semibold text-slate-950 dark:text-white'>{formatRupees(value)}</dd></div>
}
