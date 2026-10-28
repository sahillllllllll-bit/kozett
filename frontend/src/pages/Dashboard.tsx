import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DeveloperRatingCard } from '../components/DeveloperRating'
import { api } from '../lib/api'
import type { DeveloperRating } from '../types'

export default function Dashboard() {
  const [rating, setRating] = useState<DeveloperRating | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.myDeveloperRating()
      .then(({ rating: loadedRating }) => {
        if (active) setRating(loadedRating)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your KDR.')
      })
    return () => {
      active = false
    }
  }, [])

  const recalculateRating = async () => {
    setError('')
    try {
      const result = await api.recalculateDeveloperRating()
      setRating(result.rating)
    } catch (recalculationError) {
      setError(recalculationError instanceof Error ? recalculationError.message : 'Unable to recalculate your KDR.')
    }
  }

  return (
    <main className='private-cockpit min-h-screen px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl space-y-6'>
        <header className='cockpit-panel p-5 sm:p-7'>
          <p className='cockpit-label'>Developer dashboard</p>
          <h1 className='mt-2 text-3xl font-bold tracking-tight text-white'>Your reputation overview</h1>
          <p className='mt-2 max-w-2xl text-sm leading-6 text-slate-400'>Review your evidence-based Kozett Developer Rating and the data coverage behind it.</p>
        </header>
        <DeveloperRatingCard rating={rating} onRecalculate={() => void recalculateRating()} dark />
        {error ? <p className='text-sm text-rose-300' role='alert'>{error}</p> : null}
        <Link to='/profile' className='inline-flex min-h-10 items-center rounded-lg border border-cyan-200/20 px-4 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10'>Manage your profile</Link>
      </div>
    </main>
  )
}
