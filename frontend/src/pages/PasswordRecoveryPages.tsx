import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import {
  clearPasswordResetFlow,
  getPasswordResetAuthorization,
  getPasswordResetFlow,
  setPasswordResetAuthorization,
  startPasswordResetFlow,
  updatePasswordResetOtp,
  type PasswordResetScope,
} from '../lib/passwordResetSession'

const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const primaryButtonClass = 'w-full rounded-xl bg-cyan-700 px-4 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50'
const errorClass = 'rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
const recoveryDescription = 'Enter the email address associated with your account to reset your password.'

function routeFor(scope: PasswordResetScope, step: 'forgot' | 'verify' | 'new' | 'login') {
  if (step === 'login') return scope === 'admin' ? '/ad/login' : '/login'
  if (step === 'forgot') return scope === 'admin' ? '/ad/forgot-password' : '/forgot-password'
  if (step === 'verify') return scope === 'admin' ? '/ad/reset-password/verify' : '/reset-password/verify'
  return scope === 'admin' ? '/ad/reset-password/new' : '/reset-password/new'
}

function apiBase(scope: PasswordResetScope) {
  return scope === 'admin' ? '/admin/auth' : '/auth'
}

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function PageShell({
  scope,
  title,
  children,
}: {
  scope: PasswordResetScope
  title: string
  children: ReactNode
}) {
  return (
    <main className='min-h-[70vh] bg-slate-50 px-4 py-12 text-slate-900 dark:bg-[#080d16] dark:text-white sm:px-6'>
      <section className='mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:p-8'>
        <Link to={scope === 'admin' ? '/ad/login' : '/'} className='text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300'>Kozett{scope === 'admin' ? ' Admin' : ''}</Link>
        <h1 className='mt-4 text-2xl font-bold sm:text-3xl'>{title}</h1>
        {children}
      </section>
    </main>
  )
}

export function ForgotPasswordPage({ scope }: { scope: PasswordResetScope }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await api.post<{ success: boolean; otp?: string; developmentOtp?: string; message?: string }>(
        `${apiBase(scope)}/forgot-password`,
        { email: email.trim() },
      )
      if (result && result.success === false) {
        throw new Error(result.message || 'Unable to process the password recovery request.')
      }
      const otp = result.otp || result.developmentOtp
      if (otp) {
        alert("Your password reset OTP is: " + otp);
      }
      startPasswordResetFlow(email.trim(), scope, otp)
      navigate(routeFor(scope, 'verify'), { replace: true })
    } catch (requestError) {
      setError(friendlyError(requestError, 'Unable to process the password recovery request.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell scope={scope} title='Forgot your password?'>
      <p className='mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300'>{recoveryDescription}</p>
      <form onSubmit={(event) => void submit(event)} className='mt-6 space-y-5'>
        <label htmlFor='recovery-email' className='block text-sm font-medium'>Email address
          <input id='recovery-email' name='email' type='email' autoComplete='email' required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} placeholder='you@example.com' />
        </label>
        {error ? <p role='alert' className={errorClass}>{error}</p> : null}
        <button type='submit' disabled={submitting} className={primaryButtonClass}>{submitting ? 'Requesting code…' : 'Continue'}</button>
      </form>
      <Link to={routeFor(scope, 'login')} className='mt-5 inline-block text-sm font-semibold text-cyan-800 hover:underline dark:text-cyan-300'>Back to Login</Link>
    </PageShell>
  )
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 8)))}@${domain}`
}

export function VerifyResetOtpPage({ scope }: { scope: PasswordResetScope }) {
  const flow = getPasswordResetFlow(scope)
  const navigate = useNavigate()
  const [otp, setOtp] = useState('')
  const [developmentOtp, setDevelopmentOtp] = useState(flow?.developmentOtp ?? '')
  const [showDevelopmentOtp, setShowDevelopmentOtp] = useState(Boolean(flow?.developmentOtp))
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendDelay, setResendDelay] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => {
    if (resendDelay <= 0) return
    const timer = window.setTimeout(() => setResendDelay((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendDelay])

  if (!flow) return <Navigate to={routeFor(scope, 'forgot')} replace />

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit verification code.')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.post<{ success: boolean; resetToken: string; expiresInSeconds: number }>(
        `${apiBase(scope)}/verify-reset-otp`,
        { email: flow.email, otp },
      )
      if (!setPasswordResetAuthorization(scope, result.resetToken, result.expiresInSeconds)) {
        throw new Error('Recovery session expired. Request a new code.')
      }
      navigate(routeFor(scope, 'new'), { replace: true })
    } catch (verifyError) {
      setError(friendlyError(verifyError, 'Unable to verify this code.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    setError('')
    setResending(true)
    try {
      const result = await api.post<{ success: boolean; otp?: string; developmentOtp?: string; message?: string }>(
        `${apiBase(scope)}/resend-reset-otp`,
        { email: flow.email },
      )
      if (result && result.success === false) {
        throw new Error(result.message || 'Unable to request another code.')
      }
      const resendOtp = result.otp || result.developmentOtp
      if (resendOtp) {
        alert("Your password reset OTP is: " + resendOtp);
      }
      updatePasswordResetOtp(scope, resendOtp)
      setDevelopmentOtp(resendOtp ?? '')
      setShowDevelopmentOtp(Boolean(resendOtp))
      setOtp('')
      setResendDelay(30)
    } catch (resendError) {
      setError(friendlyError(resendError, 'Unable to request another code.'))
    } finally {
      setResending(false)
    }
  }

  return (
    <PageShell scope={scope} title='Verify your email'>
      <p className='mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300'>Enter the six-digit code for <span className='font-semibold'>{maskEmail(flow.email)}</span>.</p>
      <form onSubmit={(event) => void verify(event)} className='mt-6 space-y-5'>
        <label htmlFor='recovery-otp' className='block text-sm font-medium'>Six-digit code
          <input id='recovery-otp' name='otp' type='text' inputMode='numeric' autoComplete='one-time-code' pattern='[0-9]{6}' minLength={6} maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className={`${fieldClass} text-center font-mono text-2xl tracking-[0.45em]`} aria-describedby='otp-help' />
        </label>
        <p id='otp-help' className='-mt-3 text-xs text-slate-500 dark:text-slate-400'>The code expires after five minutes. Pasting a code is supported.</p>
        {error ? <p role='alert' className={errorClass}>{error}</p> : null}
        <button type='submit' disabled={submitting || otp.length !== 6} className={primaryButtonClass}>{submitting ? 'Verifying…' : 'Verify code'}</button>
      </form>
      <button type='button' onClick={() => void resend()} disabled={resending || resendDelay > 0} className='mt-4 text-sm font-semibold text-cyan-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 dark:text-cyan-300 dark:disabled:text-slate-600'>
        {resending ? 'Requesting another code…' : resendDelay > 0 ? `Resend code in ${resendDelay}s` : 'Resend code'}
      </button>
      <Link to={routeFor(scope, 'forgot')} onClick={() => clearPasswordResetFlow()} className='mt-4 block text-sm text-slate-600 hover:underline dark:text-slate-300'>Back</Link>

      {showDevelopmentOtp ? <div className='fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4' role='presentation'>
        <section role='dialog' aria-modal='true' aria-labelledby='development-otp-title' className='w-full max-w-sm rounded-2xl border border-amber-300 bg-white p-6 shadow-2xl dark:border-amber-800 dark:bg-slate-900'>
          <p className='text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300'>Development only</p>
          <h2 id='development-otp-title' className='mt-2 text-xl font-bold'>Development OTP</h2>
          <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>This local test code is never returned when development OTP mode is disabled.</p>
          <p className='mt-4 rounded-lg bg-amber-50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'>{developmentOtp}</p>
          <button type='button' autoFocus onClick={() => setShowDevelopmentOtp(false)} className='mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900'>Continue</button>
        </section>
      </div> : null}
    </PageShell>
  )
}

export function NewPasswordPage({ scope }: { scope: PasswordResetScope }) {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const flow = getPasswordResetFlow(scope)
  const authorization = getPasswordResetAuthorization(scope)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const minLength = scope === 'admin' ? 12 : 8
  const checks = useMemo(() => [
    password.length >= minLength,
    /[A-Za-z]/.test(password),
    /\d/.test(password),
  ], [minLength, password])
  const strength = checks.filter(Boolean).length

  if (!flow || !authorization) return <Navigate to={routeFor(scope, 'forgot')} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!checks.every(Boolean)) {
      setError(`Password must be at least ${minLength} characters and include letters and numbers.`)
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`${apiBase(scope)}/reset-password`, { resetToken: authorization, newPassword: password })
      clearPasswordResetFlow()
      await refreshUser()
      navigate(routeFor(scope, 'login'), { replace: true, state: { passwordResetSuccess: true } })
    } catch (resetError) {
      setError(friendlyError(resetError, 'Unable to update the password. Request a new recovery code and try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell scope={scope} title='Create a new password'>
      <p className='mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300'>Choose a new password for {maskEmail(flow.email)}.</p>
      <form onSubmit={(event) => void submit(event)} className='mt-6 space-y-5'>
        <label htmlFor='new-password' className='block text-sm font-medium'>New password
          <span className='relative block'>
            <input id='new-password' type={showPassword ? 'text' : 'password'} autoComplete='new-password' required minLength={minLength} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className={`${fieldClass} pr-16`} />
            <button type='button' onClick={() => setShowPassword((value) => !value)} className='absolute inset-y-0 right-3 my-auto text-xs font-semibold text-slate-500'>{showPassword ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        <div aria-label={`Password strength: ${strength} of 3 requirements met`} className='h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'><div className={`h-full transition-all ${strength === 3 ? 'bg-emerald-500' : strength === 2 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${strength / 3 * 100}%` }} /></div>
        <ul className='-mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400'>
          <li>{checks[0] ? '✓' : '•'} At least {minLength} characters</li>
          <li>{checks[1] ? '✓' : '•'} Includes a letter</li>
          <li>{checks[2] ? '✓' : '•'} Includes a number</li>
        </ul>
        <label htmlFor='confirm-password' className='block text-sm font-medium'>Confirm new password
          <span className='relative block'>
            <input id='confirm-password' type={showConfirmation ? 'text' : 'password'} autoComplete='new-password' required minLength={minLength} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={`${fieldClass} pr-16`} />
            <button type='button' onClick={() => setShowConfirmation((value) => !value)} className='absolute inset-y-0 right-3 my-auto text-xs font-semibold text-slate-500'>{showConfirmation ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        {error ? <p role='alert' className={errorClass}>{error}</p> : null}
        <button type='submit' disabled={submitting} className={primaryButtonClass}>{submitting ? 'Updating password…' : 'Update Password'}</button>
      </form>
      <Link to={routeFor(scope, 'login')} onClick={() => clearPasswordResetFlow()} className='mt-5 inline-block text-sm font-semibold text-cyan-800 hover:underline dark:text-cyan-300'>Back to Login</Link>
    </PageShell>
  )
}
