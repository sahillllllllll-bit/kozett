import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSafeRedirect } from '../lib/redirect'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const passwordResetSuccess = (location.state as { passwordResetSuccess?: boolean } | null)?.passwordResetSuccess === true

  if (user) {
    const stateRedirect = (location.state as { from?: string } | null)?.from
    const redirectTarget = getSafeRedirect(searchParams.get('redirect')) ?? getSafeRedirect(stateRedirect) ?? '/dashboard'
    return <Navigate to={redirectTarget} replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.')
      return
    }

    try {
      setLoading(true)
      await login({ email, password })
      const stateRedirect = (location.state as { from?: string } | null)?.from
      const redirectTarget = getSafeRedirect(searchParams.get('redirect')) ?? getSafeRedirect(stateRedirect) ?? '/dashboard'
      navigate(redirectTarget, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-12 sm:px-6'>
      <div className='grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2'>
        <div className='hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between'>
          <div>
            <div className='mb-12 text-2xl font-black tracking-tight'>Kozett</div>
            <h2 className='max-w-xs text-3xl font-bold'>Welcome back to your developer profile.</h2>
          </div>
          <p className='max-w-xs text-sm text-slate-300'>Keep your work visible, your skills organized, and your growth story consistent.</p>
        </div>

        <div className='p-8 sm:p-10'>
          <div className='mb-8'>
            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-red-600'>Login</p>
            <h1 className='mt-3 text-3xl font-bold text-slate-900'>Sign in</h1>
          </div>

          <form className='space-y-5' onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor='email' className='mb-2 block text-sm font-medium text-slate-700'>Email</label>
              <input id='email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='you@example.com' autoComplete='email' />
            </div>

            <div>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <label htmlFor='password' className='block text-sm font-medium text-slate-700'>Password</label>
                <Link to='/forgot-password' className='text-xs font-semibold text-red-600 hover:underline'>Forgot password?</Link>
              </div>
              <div className='relative'>
                <input id='password' type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 pr-11 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='••••••••' autoComplete='current-password' />
                <button type='button' onClick={() => setShowPassword((current) => !current)} className='absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500'> {showPassword ? 'Hide' : 'Show'} </button>
              </div>
            </div>

            {passwordResetSuccess ? <p role='status' className='rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'>Password updated. Sign in with your new password.</p> : null}
            {error ? <div className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{error}</div> : null}

            <button type='submit' disabled={loading} className='w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70'>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className='mt-5 text-sm text-slate-600'>Need an account? <Link to='/signup' className='font-semibold text-red-600'>Create one</Link></p>
        </div>
      </div>
    </div>
  )
}
