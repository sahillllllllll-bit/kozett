import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

type AdminLoginResult = {
  success: boolean
  csrfToken: string
  admin: { id: string; name: string; email: string; role: string; mustChangePassword: boolean }
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const passwordResetSuccess = (location.state as { passwordResetSuccess?: boolean } | null)?.passwordResetSuccess === true

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await api.post<AdminLoginResult>('/admin/auth/login', { email, password })
      api.setCsrfToken(result.csrfToken)
      setPassword('')
      navigate(result.admin.mustChangePassword ? '/ad/password' : '/ad', { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in to the admin console.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className='min-h-screen bg-slate-100 px-4 py-12 text-slate-900 dark:bg-[#080d16] dark:text-white'>
      <section className='mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-950 sm:p-8'>
        <Link to='/' className='text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300'>Kozett Admin</Link>
        <h1 className='mt-3 text-2xl font-bold'>Administrator sign in</h1>
        <p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>Authorized administrators only.</p>
        <form onSubmit={(event) => void submit(event)} className='mt-6 space-y-4'>
          <label className='block text-sm font-medium'>
            Email
            <input type='email' autoComplete='username' required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className='mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900' />
          </label>
          <label className='block text-sm font-medium'>
            Password
            <input type='password' autoComplete='current-password' required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className='mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900' />
          </label>
          <div className='-mt-1 text-right'><Link to='/ad/forgot-password' className='text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300'>Forgot password?</Link></div>
          {passwordResetSuccess ? <p role='status' className='rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'>Password updated. Sign in with your new password.</p> : null}
          {error ? <p role='alert' className='rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'>{error}</p> : null}
          <button type='submit' disabled={submitting} className='w-full rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50'>{submitting ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
      </section>
    </main>
  )
}
