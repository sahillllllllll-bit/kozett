import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { DashboardProfile } from '../types'

type Visibility = DashboardProfile['visibility']

const visibilityOptions: Array<{
  field: keyof Visibility
  title: string
  description: string
}> = [
  { field: 'avatar', title: 'Profile photo', description: 'Allow your photo to appear on your public profile.' },
  { field: 'bio', title: 'Bio', description: 'Show the bio saved on your account.' },
  { field: 'platforms', title: 'Coding profile links', description: 'Share the coding platform links saved to your profile.' },
  { field: 'github', title: 'GitHub demo section', description: 'Show demo GitHub statistics when a demo profile is present.' },
  { field: 'links', title: 'Profile links', description: 'Show links you have added to your profile.' },
  { field: 'projects', title: 'Projects and demo projects', description: 'Include public projects and enabled demo project sections.' },
  { field: 'skills', title: 'Skills', description: 'Show skill records and any qualifying assessment ratings.' },
  { field: 'certifications', title: 'Certifications', description: 'Show certification records and their verification status.' },
  { field: 'kdr', title: 'Developer rating', description: 'Share your KDR score, rank, and component breakdown. Only verified rating aggregates are exposed.' },
]

function SettingsIcon({ name }: { name: 'back' | 'share' | 'preview' }) {
  const paths = {
    back: <path d='m15 18-6-6 6-6M9 12h11' />,
    share: <><circle cx='18' cy='5' r='2.5' /><circle cx='6' cy='12' r='2.5' /><circle cx='18' cy='19' r='2.5' /><path d='m8.3 10.8 7.4-4.5m-7.4 7 7.4 4.5' /></>,
    preview: <><path d='M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z' /><circle cx='12' cy='12' r='2.5' /></>,
  }
  return <svg aria-hidden='true' viewBox='0 0 24 24' fill='none' className='h-4 w-4' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>{paths[name]}</svg>
}

export default function ProfileSettingsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [visibility, setVisibility] = useState<Visibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    api.dashboardProfile()
      .then(({ profile: loaded }) => {
        if (!active) return
        setProfile(loaded)
        setVisibility(loaded.visibility)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load profile settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const profileUrl = useMemo(() => {
    const username = user?.username ?? null
    return username ? `${window.location.origin}/${encodeURIComponent(username)}` : null
  }, [user?.username])
  const isDirty = Boolean(profile && visibility && JSON.stringify(profile.visibility) !== JSON.stringify(visibility))

  const updateVisibility = (field: keyof Visibility, value: boolean) => {
    setVisibility((current) => current ? { ...current, [field]: value } : current)
    setNotice('')
    setError('')
  }

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile || !visibility || !isDirty) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await api.updateDashboardProfile({ ...profile, visibility })
      setProfile(response.profile)
      setVisibility(response.profile.visibility)
      setNotice('Public profile settings saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save public profile settings.')
    } finally {
      setSaving(false)
    }
  }

  const previewProfile = () => {
    if (!profileUrl || !profile?.visibility.publicProfile || isDirty) return
    window.open(profileUrl, '_blank', 'noopener,noreferrer')
  }

  const shareProfile = async () => {
    if (!profileUrl || !profile?.visibility.publicProfile || isDirty) return
    try {
      if (navigator.share) {
        await navigator.share({ title: `${user?.name ?? 'Developer'} on Kozett`, url: profileUrl })
        setNotice('Profile link shared.')
      } else {
        await navigator.clipboard.writeText(profileUrl)
        setNotice('Profile link copied!')
      }
      setError('')
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return
      setError('Unable to share or copy the profile link. Check your browser permissions and try again.')
      setNotice('')
    }
  }

  return (
    <div className='private-cockpit min-h-screen px-4 py-8 sm:px-6 lg:px-8'>
      <main className='mx-auto max-w-4xl'>
        <header className='cockpit-panel mb-6 flex items-center gap-4 p-5 sm:p-6'>
          <Link to='/profile' aria-label='Back to profile' className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-cyan-100 hover:border-cyan-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'>
            <SettingsIcon name='back' />
          </Link>
          <div>
            <p className='cockpit-label'>Owner controls</p>
            <h1 className='mt-1 text-2xl font-bold text-white sm:text-3xl'>Profile settings</h1>
          </div>
        </header>

        {loading ? (
          <section className='cockpit-panel p-6' role='status'>
            <p className='cockpit-label'>Loading settings</p>
            <p className='mt-3 text-sm text-slate-400'>Retrieving your saved visibility preferences...</p>
          </section>
        ) : error && !profile ? (
          <section className='cockpit-panel p-6' role='alert'>
            <p className='cockpit-label'>Settings unavailable</p>
            <p className='mt-3 text-sm text-rose-200'>{error}</p>
            <Link to='/profile' className='mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-cyan-200 hover:text-white'>Return to profile</Link>
          </section>
        ) : profile && visibility ? (
          <form onSubmit={(event) => void saveSettings(event)} className='space-y-6'>
            <section className='cockpit-panel p-5 sm:p-7'>
              <div className='flex flex-wrap items-start justify-between gap-4'>
                <div>
                  <p className='cockpit-label'>Public access control</p>
                  <h2 className='mt-2 text-xl font-semibold text-white'>Public Profile Visibility</h2>
                  <p className='mt-2 max-w-2xl text-sm leading-6 text-slate-400'>
                    Control whether visitors can load your profile and which profile sections the public API returns.
                  </p>
                </div>
                <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold ${profile.visibility.publicProfile ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/25 bg-rose-300/10 text-rose-200'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${profile.visibility.publicProfile ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                  {profile.visibility.publicProfile ? 'Public' : 'Private'}
                </span>
              </div>

              <label className='cockpit-panel-inner mt-6 flex cursor-pointer items-start gap-3 p-4'>
                <input
                  type='checkbox'
                  checked={visibility.publicProfile}
                  onChange={(event) => updateVisibility('publicProfile', event.target.checked)}
                  className='mt-1 h-4 w-4 accent-cyan-400'
                />
                <span>
                  <span className='block text-sm font-semibold text-white'>Public profile</span>
                  <span className='mt-1 block text-xs leading-5 text-slate-400'>When off, the backend returns Profile not found to public visitors.</span>
                </span>
              </label>

              <div className='mt-6'>
                <label htmlFor='public-profile-url' className='cockpit-label'>Profile URL</label>
                <div className='mt-2 flex flex-col gap-2 sm:flex-row'>
                  <input
                    id='public-profile-url'
                    readOnly
                    value={profileUrl ?? 'Set a username to create your public URL'}
                    className='min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-200 outline-none'
                  />
                  <button
                    type='button'
                    onClick={previewProfile}
                    disabled={!profile.visibility.publicProfile || isDirty || !profileUrl}
                    className='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-slate-200 hover:border-cyan-200/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
                  >
                    <SettingsIcon name='preview' />Preview
                  </button>
                  <button
                    type='button'
                    onClick={() => void shareProfile()}
                    disabled={!profile.visibility.publicProfile || isDirty || !profileUrl}
                    className='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
                  >
                    <SettingsIcon name='share' />Share
                  </button>
                </div>
                {!profile.visibility.publicProfile ? <p className='mt-2 text-xs text-amber-200/80'>Preview and sharing are disabled while your saved profile is private.</p> : null}
                {isDirty ? <p className='mt-2 text-xs text-amber-200/80'>Save your changes before using profile preview or sharing.</p> : null}
              </div>
            </section>

            <section className='cockpit-panel p-5 sm:p-7'>
              <p className='cockpit-label'>Section permissions</p>
              <h2 className='mt-2 text-lg font-semibold text-white'>Choose what visitors can see</h2>
              <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                {visibilityOptions.map(({ field, title, description }) => (
                  <label key={field} className='cockpit-panel-inner flex cursor-pointer items-start gap-3 p-4'>
                    <input
                      type='checkbox'
                      checked={visibility[field]}
                      onChange={(event) => updateVisibility(field, event.target.checked)}
                      className='mt-1 h-4 w-4 accent-cyan-400'
                    />
                    <span>
                      <span className='block text-sm font-medium text-white'>{title}</span>
                      <span className='mt-1 block text-xs leading-5 text-slate-400'>{description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!visibility.publicProfile ? <p className='mt-3 text-xs text-slate-500'>Section preferences are retained while the profile is private.</p> : null}
            </section>

            {error ? <p className='rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200' role='alert'>{error}</p> : null}
            {notice ? <p className='rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-200' role='status'>{notice}</p> : null}

            <div className='flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center'>
              <Link to='/profile' className='inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:border-white/25 hover:text-white'>Back to profile</Link>
              <button
                type='submit'
                disabled={saving || !isDirty}
                className='inline-flex min-h-11 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
              >
                {saving ? 'Saving...' : isDirty ? 'Save changes' : 'All changes saved'}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  )
}
