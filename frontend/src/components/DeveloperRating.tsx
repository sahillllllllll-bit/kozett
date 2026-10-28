import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { DeveloperRating as DeveloperRatingData } from '../types'

const rankStyles = {
  Silver: 'border-slate-300/80 bg-gradient-to-br from-white via-slate-200 to-slate-400 text-slate-800 shadow-[0_0_18px_rgba(203,213,225,0.28)]',
  Gold: 'border-amber-300/80 bg-gradient-to-br from-yellow-100 via-amber-300 to-yellow-600 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.32)]',
  Platinum: 'border-cyan-200 bg-gradient-to-br from-white via-cyan-100 to-slate-300 text-cyan-950 shadow-[0_0_24px_rgba(103,232,249,0.42)]',
}

export function formatKdrScore(score: number) {
  return `${Number.isInteger(score) ? score : score.toFixed(1)}/100`
}

export function KdrInlineScore({
  rating,
  onClick,
  dark = false,
}: {
  rating: DeveloperRatingData | null
  onClick: () => void
  dark?: boolean
}) {
  const textClass = dark ? 'text-cyan-100 hover:text-white' : 'text-cyan-800 hover:text-cyan-600'
  const label = !rating || rating.score === null || rating.isProvisional
    ? 'KDR Pending'
    : `KDR ${formatKdrScore(rating.score)}`
  return (
    <button
      type='button'
      onClick={onClick}
      title='View KDR rating details'
      className={`inline-flex min-h-8 flex-wrap items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-sm transition hover:border-cyan-300/40 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${textClass}`}
    >
      <span className='font-bold tabular-nums'>{label}</span>
      {/* {rating?.rank && !rating.isProvisional ? (
        <>
          <KdrRankBadge rank={rating.rank} size='sm' />
          <span className='font-semibold'>{rating.rank} Developer</span>
        </>
      ) : null}
      {rating?.dataStatus === 'demo' ? <span className='rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-100'>Demo data</span> : null} */}
    </button>
  )
}

export function KdrRankBadge({
  rank,
  onClick,
  size = 'md',
}: {
  rank: DeveloperRatingData['rank']
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!rank) return null
  const sizeClasses = size === 'lg'
    ? 'h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20'
    : size === 'sm' ? 'h-10 w-10' : 'h-14 w-14'
  const emblem = (
    <span
      title={`${rank} Kozett Developer Rating badge`}
      aria-label={`${rank} Kozett Developer Rating badge`}
      className={`inline-flex ${sizeClasses} shrink-0 items-center justify-center rounded-2xl border ${rankStyles[rank]} transition-transform hover:scale-[1.04]`}
    >
      <svg aria-hidden='true' viewBox='0 0 40 44' className='h-[72%] w-[72%]' fill='none'>
        <path d='M20 2 35 8v12c0 10-6 17-15 22C11 37 5 30 5 20V8l15-6Z' fill='currentColor' fillOpacity='.12' stroke='currentColor' strokeWidth='2' />
        <path d='m20 9 2.7 6.1 6.6.6-5 4.4 1.5 6.4-5.8-3.3-5.8 3.3 1.5-6.4-5-4.4 6.6-.6L20 9Z' fill='currentColor' />
        <path d='M12 32h16' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
      </svg>
    </span>
  )

  return onClick ? (
    <button type='button' onClick={onClick} title={`View ${rank} KDR details`} className='rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'>
      {emblem}
    </button>
  ) : emblem
}

export function KdrBreakdownDialog({
  rating,
  open,
  onClose,
  dark = false,
  showHistory = false,
  onRecalculate,
  recalculating = false,
  recalculateMessage = '',
  recalculateError = false,
}: {
  rating: DeveloperRatingData | null
  open: boolean
  onClose: () => void
  dark?: boolean
  showHistory?: boolean
  onRecalculate?: () => void
  recalculating?: boolean
  recalculateMessage?: string
  recalculateError?: boolean
}) {
  const [history, setHistory] = useState<DeveloperRatingData[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyLoadingInternal, setHistoryLoadingInternal] = useState(false)
  const [historyErrorInternal, setHistoryErrorInternal] = useState('')
  useEffect(() => {
    if (!open || !showHistory || historyLoaded || historyLoadingInternal) return
    setHistoryLoadingInternal(true)
    api.developerRatingHistory()
      .then(({ snapshots }) => {
        setHistory(snapshots)
        setHistoryLoaded(true)
      })
      .catch((error: unknown) => {
        setHistoryErrorInternal(error instanceof Error ? error.message : 'Unable to load rating history.')
        setHistoryLoaded(true)
      })
      .finally(() => setHistoryLoadingInternal(false))
  }, [historyLoaded, historyLoadingInternal, open, showHistory])
  if (!open) return null
  const panelClasses = dark
    ? 'border-white/10 bg-[#0b111b] text-white'
    : 'border-slate-200 bg-white text-slate-900'
  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4' onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role='dialog' aria-modal='true' aria-labelledby='kdr-breakdown-title' className={`max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl sm:p-6 ${panelClasses}`}>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-cyan-500'>Kozett reputation system</p>
            <h2 id='kdr-breakdown-title' className='mt-2 text-xl font-bold'>KDR rating breakdown</h2>
          </div>
          <button type='button' onClick={onClose} aria-label='Close rating breakdown' className='rounded-lg px-2 py-1 text-xl opacity-70 hover:bg-slate-500/10'>×</button>
        </div>
        {rating ? (
          <>
            <div className='mt-5 flex items-center gap-3'>
              {rating.rank ? <KdrRankBadge rank={rating.rank} size='sm' /> : null}
              <div>
                <p className='text-2xl font-bold tabular-nums'>{rating.score === null || rating.isProvisional ? 'KDR Pending' : formatKdrScore(rating.score)}</p>
                {rating.rank ? <p className='text-sm text-slate-500 dark:text-slate-400'>{rating.rank} rank</p> : null}
              </div>
            </div>
            {rating.score === null || rating.isProvisional ? (
              <p className='mt-4 rounded-lg bg-slate-500/5 p-3 text-sm leading-5 opacity-75'>Connect coding accounts or add verified assessment evidence to improve rating coverage.</p>
            ) : null}
            <div className='mt-5 space-y-4'>
              {rating.components.map((component) => (
                <div key={component.key}>
                  <div className='mb-1.5 flex justify-between gap-3 text-sm'>
                    <span className='font-medium'>{component.label} <span className='text-xs opacity-60'>· {(component.weight * 100).toFixed(0)}%</span></span>
                    <span className='tabular-nums opacity-75'>{component.available && component.score !== null ? `${component.score.toFixed(1)} / 100` : 'Not assessed'}</span>
                  </div>
                  <div className='h-2 overflow-hidden rounded-full bg-slate-500/15'>
                    <div className='h-full rounded-full bg-gradient-to-r from-cyan-600 to-sky-400' style={{ width: `${component.available ? component.score ?? 0 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className='mt-5 grid gap-2 rounded-xl border border-slate-500/15 p-4 text-xs leading-5 opacity-80 sm:grid-cols-2'>
              {rating.dataStatus === 'demo' ? <p className='font-semibold text-amber-600 dark:text-amber-300'>Demo data · illustrative component values, not verified real-world measurements.</p> : null}
              <p>Data coverage: {(rating.dataCoverage * 100).toFixed(0)}%</p>
              <p>Calculated: {new Date(rating.calculatedAt).toLocaleString()}</p>
              <p>Algorithm version: {rating.algorithmVersion}</p>
              <p className='sm:col-span-2'>KDR = 35% problem-solving + 15% consistency + 20% open-source + 20% projects + 10% verified skills. Available components are reweighted proportionally; ranked badges require sufficient evidence coverage.</p>
            </div>
            {historyLoadingInternal ? <p className='mt-4 text-sm opacity-65' role='status'>Loading rating history…</p> : null}
            {historyErrorInternal ? <p className='mt-4 text-sm text-rose-500' role='alert'>{historyErrorInternal}</p> : null}
            {showHistory && !historyLoadingInternal && !historyErrorInternal && history.length > 1 ? (
              <section className='mt-5'>
                <h3 className='text-sm font-semibold'>Rating history</h3>
                <ol className='mt-2 max-h-36 space-y-2 overflow-y-auto text-xs'>
                  {history.slice(1).map((snapshot) => (
                    <li key={`${snapshot.calculatedAt}-${snapshot.algorithmVersion}`} className='flex justify-between gap-3 rounded-lg bg-slate-500/5 px-3 py-2'>
                      <span>{new Date(snapshot.calculatedAt).toLocaleDateString()} · {snapshot.rank ?? (snapshot.isProvisional ? 'Provisional' : 'Unranked')}</span>
                      <span className='font-semibold tabular-nums'>{snapshot.score === null ? 'No score' : snapshot.score.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        ) : (
          <p className='mt-5 text-sm leading-6 opacity-75'>No verified rating evidence is available yet. No score or rank is assigned until reliable data is recorded.</p>
        )}
        {onRecalculate ? (
          <div className='mt-4 flex flex-wrap items-center gap-3'>
            <button type='button' onClick={onRecalculate} disabled={recalculating} className='rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-50'>
              {recalculating ? 'Recalculating…' : 'Recalculate rating'}
            </button>
            {recalculateMessage ? <p className={`text-xs ${recalculateError ? 'text-rose-500' : 'opacity-75'}`} role={recalculateError ? 'alert' : 'status'}>{recalculateMessage}</p> : null}
          </div>
        ) : null}
        <p className='mt-4 text-xs leading-5 opacity-60'>KDR is a Kozett-created score, not an official rating issued by LeetCode, Codeforces, GitHub, or another external platform.</p>
      </section>
    </div>
  )
}

export function DeveloperRatingCard({
  rating,
  onRecalculate,
  recalculating = false,
  dark = false,
}: {
  rating: DeveloperRatingData | null
  onRecalculate?: () => void
  recalculating?: boolean
  dark?: boolean
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const cardClasses = dark
    ? 'border-white/10 bg-slate-950/55 text-white'
    : 'border-slate-200 bg-white text-slate-900'
  const openBreakdown = () => {
    setBreakdownOpen(true)
  }
  return (
    <>
      <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${cardClasses}`}>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='flex items-center gap-3'>
            {rating?.rank ? <KdrRankBadge rank={rating.rank} size='md' onClick={openBreakdown} /> : null}
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300'>Kozett Developer Rating</p>
              <h2 className='mt-1 text-2xl font-bold tabular-nums'>
                {rating?.score === null || !rating ? 'Not enough data' : `${rating.isProvisional ? 'Provisional · ' : ''}${formatKdrScore(rating.score)}`}
              </h2>
              <p className='mt-1 text-sm opacity-70'>A transparent summary of verified coding, contribution, project, and skill evidence.</p>
            </div>
          </div>
          {rating?.rank ? <span className='rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200'>{rating.rank}</span> : null}
        </div>
        <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
          <p className='text-xs opacity-65'>
            {rating ? `Data coverage ${(rating.dataCoverage * 100).toFixed(0)}% · Calculated ${new Date(rating.calculatedAt).toLocaleString()}` : 'Verified data is not available yet.'}
          </p>
          <div className='flex flex-wrap gap-2'>
            <button type='button' onClick={openBreakdown} className='rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-200'>View Rating Breakdown</button>
            {onRecalculate ? <button type='button' onClick={onRecalculate} disabled={recalculating} className='rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50'>{recalculating ? 'Recalculating…' : 'Recalculate'}</button> : null}
          </div>
        </div>
      </section>
      <KdrBreakdownDialog
        rating={rating}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        dark={dark}
        showHistory
        onRecalculate={onRecalculate}
        recalculating={recalculating}
      />
    </>
  )
}
