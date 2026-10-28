import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignupPage() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to='/dashboard' replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in your name, email, and password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const normalizedUsername = username.trim().toLowerCase()
    if (normalizedUsername && !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      setError('Username must be 3-30 characters and use only letters, numbers, and underscores.')
      return
    }

    if (['certifications', 'certificates', 'my-certificates', 'contest', 'dashboard', 'earn', 'feed', 'login', 'profile', 'signup'].includes(normalizedUsername)) {
      setError('That username is reserved. Please choose another one.')
      return
    }

    try {
      setLoading(true)
      await signup({ name, email, password, username: normalizedUsername || undefined })
      navigate('/dashboard')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create your account right now.')
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
            <h2 className='max-w-xs text-3xl font-bold'>Build your developer profile in minutes.</h2>
          </div>
          <p className='max-w-xs text-sm text-slate-300'>Keep a professional, future-ready overview of your work and growth.</p>
        </div>

        <div className='p-8 sm:p-10'>
          <div className='mb-8'>
            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-red-600'>Create account</p>
            <h1 className='mt-3 text-3xl font-bold text-slate-900'>Join Kozett</h1>
          </div>

          <form className='space-y-5' onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor='name' className='mb-2 block text-sm font-medium text-slate-700'>Name</label>
              <input id='name' type='text' value={name} onChange={(event) => setName(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='Jane Developer' autoComplete='name' />
            </div>

            <div>
              <label htmlFor='email' className='mb-2 block text-sm font-medium text-slate-700'>Email</label>
              <input id='email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='you@example.com' autoComplete='email' />
            </div>

            <div>
              <label htmlFor='username' className='mb-2 block text-sm font-medium text-slate-700'>Username (optional)</label>
              <input id='username' type='text' value={username} onChange={(event) => setUsername(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='jane-dev' autoComplete='username' />
            </div>

            <div>
              <label htmlFor='password' className='mb-2 block text-sm font-medium text-slate-700'>Password</label>
              <div className='relative'>
                <input id='password' type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 pr-11 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='••••••••' autoComplete='new-password' />
                <button type='button' onClick={() => setShowPassword((current) => !current)} className='absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500'>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <div>
              <label htmlFor='confirm-password' className='mb-2 block text-sm font-medium text-slate-700'>Confirm password</label>
              <input id='confirm-password' type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className='w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200' placeholder='••••••••' autoComplete='new-password' />
            </div>

            {error ? <div className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{error}</div> : null}

            <button type='submit' disabled={loading} className='w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70'>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className='mt-5 text-sm text-slate-600'>Already have an account? <Link to='/login' className='font-semibold text-red-600'>Log in</Link></p>
        </div>
      </div>
    </div>
  )
}
