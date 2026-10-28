import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProfileEditorDialog, { type ProfileEditorValue } from '../components/ProfileEditorDialog'
import DemoProfileSections from '../components/DemoProfileSections'
import { KdrBreakdownDialog, KdrInlineScore, KdrRankBadge } from '../components/DeveloperRating'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { CodingPlatform, DashboardProfile, DeveloperRating, ProfileLink, Project } from '../types'

type EditorKind = 'link' | 'project' | 'platform' | 'avatar'
type GithubStats = { publicRepos: number; followers: number; url: string }

const platforms: CodingPlatform['platform'][] = [
  'LeetCode',
  'Codeforces',
  'CodeChef',
  'GeeksforGeeks',
  'GitHub',
  'HackerRank',
  'HackerEarth',
]

function ActionIcon({ name }: { name: 'preview' | 'share' | 'plus' | 'external' | 'edit' | 'trash' | 'settings' }) {
  const paths: Record<typeof name, React.ReactNode> = {
    preview: <><path d='M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z' /><circle cx='12' cy='12' r='2.5' /></>,
    share: <><circle cx='18' cy='5' r='2.5' /><circle cx='6' cy='12' r='2.5' /><circle cx='18' cy='19' r='2.5' /><path d='m8.3 10.8 7.4-4.5m-7.4 7 7.4 4.5' /></>,
    plus: <path d='M12 5v14m-7-7h14' />,
    external: <><path d='M14 4h6v6m-11 3L20 4' /><path d='M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6' /></>,
    edit: <><path d='m15 5 4 4' /><path d='M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z' /></>,
    trash: <><path d='M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3' /></>,
    settings: <><circle cx='12' cy='12' r='3' /><path d='m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z' /></>,
  }

  return (
    <svg aria-hidden='true' viewBox='0 0 24 24' fill='none' className='h-4 w-4' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      {paths[name]}
    </svg>
  )
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className='mb-4 flex items-center justify-between gap-3'>
      <h2 className='text-lg font-semibold tracking-tight text-slate-900'>{title}</h2>
      {action}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className='rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm leading-6 text-slate-500'>{children}</p>
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingError, setSavingError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [editor, setEditor] = useState<{ kind: EditorKind; index?: number } | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [githubStats, setGithubStats] = useState<GithubStats | null>(null)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [developerRating, setDeveloperRating] = useState<DeveloperRating | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [ratingDetailsOpen, setRatingDetailsOpen] = useState(false)
  const [ratingRecalculating, setRatingRecalculating] = useState(false)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingFeedbackIsError, setRatingFeedbackIsError] = useState(false)

  useEffect(() => {
    let active = true
    api.dashboardProfile()
      .then(({ profile: loaded }) => {
        if (active) setProfile(loaded)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    api.myDeveloperRating()
      .then(({ rating }) => {
        if (active) setDeveloperRating(rating)
      })
      .catch((error: unknown) => {
        if (active) setRatingError(error instanceof Error ? error.message : 'Unable to load your KDR.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const github = profile?.platforms.find((item) => item.platform === 'GitHub')
    if (!github) {
      setGithubStats(null)
      setGithubError('')
      setGithubLoading(false)
      return
    }

    let active = true
    let githubUrl: URL
    try {
      githubUrl = new URL(github.url)
    } catch {
      setGithubError('The saved GitHub profile URL is invalid.')
      return
    }
    const username = githubUrl.pathname.split('/').filter(Boolean)[0]
    if (!username) {
      setGithubError('The saved GitHub profile URL is invalid.')
      return
    }

    setGithubLoading(true)
    setGithubError('')
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'GitHub account was not found.' : 'GitHub public stats are temporarily unavailable.')
        }
        return response.json() as Promise<{ public_repos?: unknown; followers?: unknown; html_url?: unknown }>
      })
      .then((data) => {
        if (!active) return
        if (typeof data.public_repos !== 'number' || typeof data.followers !== 'number') {
          throw new Error('GitHub returned an unexpected statistics response.')
        }
        setGithubStats({
          publicRepos: data.public_repos,
          followers: data.followers,
          url: typeof data.html_url === 'string' ? data.html_url : github.url,
        })
      })
      .catch((error: unknown) => {
        if (active) setGithubError(error instanceof Error ? error.message : 'Unable to load GitHub statistics.')
      })
      .finally(() => {
        if (active) setGithubLoading(false)
      })

    return () => {
      active = false
    }
  }, [profile?.platforms])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const persistProfile = useCallback(async (next: DashboardProfile) => {
    setSavingError('')
    try {
      const response = await api.updateDashboardProfile(next)
      setProfile(response.profile)
      setAvatarLoadFailed(false)
      setNotice('Changes saved.')
      setNoticeIsError(false)
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : 'Unable to save profile changes.')
      throw error
    }
  }, [])

  if (!user) return null

  const profileUrl = user.username ? `${window.location.origin}/${encodeURIComponent(user.username)}` : null
  const openPreview = () => {
    if (!profileUrl) {
      setNotice('Add a username to create your public profile link.')
      setNoticeIsError(true)
      return
    }
    if (profile && !profile.visibility.publicProfile) {
      setNotice('Your profile is private. Enable public visibility in Profile settings before previewing it.')
      setNoticeIsError(true)
      return
    }
    window.open(profileUrl, '_blank', 'noopener,noreferrer')
  }

  const shareProfile = async () => {
    if (!profileUrl) {
      setNotice('Add a username to create your public profile link.')
      setNoticeIsError(true)
      return
    }
    if (profile && !profile.visibility.publicProfile) {
      setNotice('Your profile is private. Enable public visibility in Profile settings before sharing it.')
      setNoticeIsError(true)
      return
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: `${user.name} on Kozett`, url: profileUrl })
        setNotice('Profile link shared.')
        setNoticeIsError(false)
      } else {
        await navigator.clipboard.writeText(profileUrl)
        setNotice('Profile link copied!')
        setNoticeIsError(false)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setNotice('Unable to share or copy the profile link. Please check browser permissions.')
      setNoticeIsError(true)
    }
  }

  const saveEditor = async (value: ProfileEditorValue) => {
    if (!profile) throw new Error('Your profile is still loading.')

    if (value.kind === 'avatar') {
      if (value.remove) {
        await api.deleteAvatar()
        setProfile({ ...profile, avatar: null })
      } else if (value.file) {
        const response = await api.uploadAvatar(value.file)
        setProfile({ ...profile, avatar: response.avatar })
      }
      setAvatarLoadFailed(false)
      setNotice('Profile photo updated.')
      setNoticeIsError(false)
      return
    }

    const next: DashboardProfile = {
      ...profile,
      profileLinks: [...profile.profileLinks],
      projects: [...profile.projects],
      platforms: [...profile.platforms],
    }

    if (value.kind === 'platform') {
      const { kind: _kind, ...platform } = value
      if (editor?.index !== undefined) next.platforms[editor.index] = platform
      else next.platforms.push(platform)
      await persistProfile(next)
      return
    }

    if (value.kind === 'link') {
      const link: ProfileLink = { title: value.title, url: value.url }
      if (editor?.index !== undefined) next.profileLinks[editor.index] = link
      else next.profileLinks.push(link)
      await persistProfile(next)
      return
    }

    const { kind: _kind, coverImageFile, screenshotFiles, removeImageIds, ...projectData } = value
    const project: Project = {
      id: projectData.id ?? null,
      title: projectData.title,
      description: projectData.description,
      url: projectData.url,
      repositoryUrl: projectData.repositoryUrl,
      isPublic: projectData.isPublic,
      coverImage: editor?.index !== undefined ? next.projects[editor.index]?.coverImage ?? null : null,
      screenshots: editor?.index !== undefined ? next.projects[editor.index]?.screenshots ?? [] : [],
    }
    if (editor?.index !== undefined) next.projects[editor.index] = project
    else next.projects.push(project)

    const saved = await api.updateDashboardProfile(next)
    setProfile(saved.profile)

    const savedProject = saved.profile.projects.find((item) => projectData.id && item.id === projectData.id)
      ?? saved.profile.projects[saved.profile.projects.length - 1]
    if (!savedProject?.id) {
      throw new Error('Project saved but its image upload could not be started. Reload and try again.')
    }
    const savedProjectIndex = saved.profile.projects.findIndex((item) => item.id === savedProject.id)
    if (editor?.index === undefined) setEditor({ kind: 'project', index: savedProjectIndex })

    for (const imageId of removeImageIds) {
      await api.deleteProjectImage(savedProject.id, imageId)
    }
    if (coverImageFile || screenshotFiles.length) {
      await api.uploadProjectImages(savedProject.id, coverImageFile, screenshotFiles)
    }

    const refreshed = await api.dashboardProfile()
    setProfile(refreshed.profile)
    setNotice('Project saved.')
    setNoticeIsError(false)
  }

  const removeLink = async (index: number) => {
    if (!profile) return
    try {
      await persistProfile({ ...profile, profileLinks: profile.profileLinks.filter((_, itemIndex) => itemIndex !== index) })
    } catch {
      return
    }
  }

  const removeProject = async (index: number) => {
    if (!profile) return
    try {
      await persistProfile({ ...profile, projects: profile.projects.filter((_, itemIndex) => itemIndex !== index) })
    } catch {
      return
    }
  }

  const removePlatform = async (index: number) => {
    if (!profile) return
    try {
      await persistProfile({ ...profile, platforms: profile.platforms.filter((_, itemIndex) => itemIndex !== index) })
    } catch {
      return
    }
  }

  const removeProjectImage = async (projectId: string | null, imageId: string) => {
    if (!projectId) return
    try {
      await api.deleteProjectImage(projectId, imageId)
      const refreshed = await api.dashboardProfile()
      setProfile(refreshed.profile)
      setNotice('Project image removed.')
      setNoticeIsError(false)
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : 'Unable to remove project image.')
    }
  }

  const logoutUser = async () => {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : 'Unable to log out.')
    }
  }

  const recalculateRating = async () => {
    setRatingRecalculating(true)
    setRatingFeedback('')
    try {
      const response = await api.recalculateDeveloperRating()
      setDeveloperRating(response.rating)
      setRatingFeedback('KDR recalculated successfully.')
      setRatingFeedbackIsError(false)
    } catch (error) {
      setRatingFeedback(error instanceof Error ? error.message : 'Unable to recalculate your KDR.')
      setRatingFeedbackIsError(true)
    } finally {
      setRatingRecalculating(false)
    }
  }

  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  const connectedGithub = profile?.platforms.some((item) => item.platform === 'GitHub') ?? false

  return (
    <div className='private-cockpit min-h-screen px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
      <header className='cockpit-panel mb-7 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6'>
        <div className='flex min-w-0 items-center gap-4'>
          <div className='flex shrink-0 items-center gap-2 sm:gap-3'>
            {developerRating?.rank ? <KdrRankBadge rank={developerRating.rank} size='lg' onClick={() => setRatingDetailsOpen(true)} /> : null}
            {profile?.avatar && !avatarLoadFailed ? (
              <img src={profile.avatar} alt='' onError={() => setAvatarLoadFailed(true)} className='h-16 w-16 shrink-0 rounded-2xl border border-cyan-200/20 object-cover sm:h-20 sm:w-20' />
            ) : (
              <div aria-hidden='true' className='flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-xl font-bold text-cyan-100 sm:h-20 sm:w-20'>{initials}</div>
            )}
          </div>
          <div className='min-w-0'>
            <p className='cockpit-label'>Driver profile · Owner cockpit</p>
            <div className='mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
              <h1 className='break-words text-3xl font-bold tracking-tight text-white sm:text-4xl'>{user.name}</h1>
              <KdrInlineScore rating={developerRating} onClick={() => { setRatingDetailsOpen(true); setRatingFeedback('') }} dark />
            </div>
            <p className='mt-1 text-sm text-slate-400'>{user.username ? `@${user.username}` : 'Username not set'}</p>
            {user.bio ? <p className='mt-2 line-clamp-2 max-w-2xl text-sm text-slate-300'>{user.bio}</p> : null}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link to='/profile/settings' aria-label='Profile settings' title='Profile settings' className='inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200/20 bg-slate-950/60 text-cyan-100 transition hover:border-cyan-200/50 hover:text-white hover:shadow-[0_0_18px_rgba(34,211,238,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'>
            <ActionIcon name='settings' />
          </Link>
          <button type='button' onClick={openPreview} className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-200/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'><ActionIcon name='preview' />Preview</button>
          <button type='button' onClick={() => void shareProfile()} className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'><ActionIcon name='share' />Share Profile</button>
        </div>
      </header>

      <KdrBreakdownDialog
        rating={developerRating}
        open={ratingDetailsOpen}
        onClose={() => setRatingDetailsOpen(false)}
        dark
        showHistory
        onRecalculate={() => void recalculateRating()}
        recalculating={ratingRecalculating}
        recalculateMessage={ratingFeedback || ratingError}
        recalculateError={ratingFeedbackIsError || Boolean(ratingError)}
      />

      {notice ? <p className={`mb-4 text-sm ${noticeIsError ? 'text-red-700' : 'text-emerald-700'}`} role={noticeIsError ? 'alert' : 'status'}>{notice}</p> : null}
      {savingError ? <p className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700' role='alert'>{savingError}</p> : null}
      {loadError ? <p className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700' role='alert'>{loadError}</p> : null}

      <button type='button' aria-expanded={mobileSidebarOpen} onClick={() => setMobileSidebarOpen((open) => !open)} className='mb-4 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 lg:hidden'>
        {mobileSidebarOpen ? 'Hide profile details' : 'Show profile details'}
      </button>

      <div className='grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)]'>
        <aside className={`${mobileSidebarOpen ? 'block' : 'hidden'} cockpit-panel p-5 lg:sticky lg:top-24 lg:block`}>
          {loading || !profile ? (
            <p className='py-6 text-sm text-slate-500' role='status'>Loading profile details...</p>
          ) : (
            <>
              <div className='flex flex-col items-center border-b border-slate-100 pb-5'>
                {profile.avatar && !avatarLoadFailed ? (
                  <img src={profile.avatar} alt={`${user.name}'s profile`} onError={() => setAvatarLoadFailed(true)} className='h-24 w-24 rounded-full border border-slate-200 object-cover' />
                ) : (
                  <div aria-label={`${user.name} initials`} className='flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-2xl font-bold text-violet-800'>{initials}</div>
                )}
                <button type='button' onClick={() => setEditor({ kind: 'avatar' })} className='mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900'><ActionIcon name='edit' />Edit photo</button>
                <p className='mt-3 w-full break-all text-center text-xs text-slate-500'>{user.email}</p>
              </div>

              <div className='border-b border-slate-100 py-5'>
                <SectionTitle title='Coding profiles' action={<button type='button' onClick={() => setEditor({ kind: 'platform' })} disabled={profile.platforms.length >= platforms.length} className='text-sm font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-40'>Connect Apps</button>} />
                {profile.platforms.length ? (
                  <ul className='space-y-2'>
                    {profile.platforms.map((item, index) => (
                      <li key={item.platform} className='group flex items-center justify-between gap-2 text-sm'>
                        <a href={item.url} target='_blank' rel='noreferrer' className='truncate text-slate-700 hover:text-violet-700'>{item.platform}</a>
                        <div className='flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'>
                          <button type='button' aria-label={`Edit ${item.platform}`} onClick={() => setEditor({ kind: 'platform', index })} className='rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-violet-700'><ActionIcon name='edit' /></button>
                          <button type='button' aria-label={`Disconnect ${item.platform}`} onClick={() => void removePlatform(index)} className='rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700'><ActionIcon name='trash' /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className='text-sm leading-5 text-slate-500'>No coding profiles connected yet.</p>}
              </div>

              <div className='border-b border-slate-100 py-5'>
                <SectionTitle title='Links' action={<button type='button' onClick={() => setEditor({ kind: 'link' })} className='inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900'><ActionIcon name='plus' />Add Link</button>} />
                {profile.profileLinks.length ? (
                  <ul className='space-y-2'>
                    {profile.profileLinks.map((link, index) => (
                      <li key={`${link.url}-${index}`} className='group flex min-w-0 items-center justify-between gap-2 text-sm'>
                        <a href={link.url} target='_blank' rel='noreferrer' className='flex min-w-0 items-center gap-1.5 truncate text-slate-700 hover:text-violet-700'><span className='truncate'>{link.title}</span><ActionIcon name='external' /></a>
                        <div className='flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'>
                          <button type='button' aria-label={`Edit ${link.title}`} onClick={() => setEditor({ kind: 'link', index })} className='rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-violet-700'><ActionIcon name='edit' /></button>
                          <button type='button' aria-label={`Remove ${link.title}`} onClick={() => void removeLink(index)} className='rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700'><ActionIcon name='trash' /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className='text-sm leading-5 text-slate-500'>Add links to your work or online presence.</p>}
              </div>

              <div className='space-y-2 pt-5'>
                <button type='button' onClick={() => setEditor({ kind: 'project' })} className='inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'><ActionIcon name='plus' />Add Project</button>
                <button type='button' onClick={() => setEditor({ kind: 'platform' })} disabled={profile.platforms.length >= platforms.length} className='inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40'><ActionIcon name='plus' />Connect Apps</button>
                <button type='button' onClick={() => void logoutUser()} className='w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50'>Logout</button>
              </div>
            </>
          )}
        </aside>

        <div className='min-w-0 space-y-6'>
          {profile?.demoData ? <DemoProfileSections data={profile.demoData} /> : null}

          {!profile?.demoData ? <div className='grid gap-6 xl:grid-cols-2'>
            <section className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'>
              <SectionTitle title='Coding progress' action={<span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500'>{profile?.platforms.length ?? 0} linked</span>} />
              {profile?.platforms.length ? (
                <div className='flex min-h-44 flex-col justify-center'>
                  <p className='text-sm leading-6 text-slate-600'>Your coding profiles are linked. Kozett does not yet synchronize coding activity or comparable ratings.</p>
                  <button type='button' onClick={() => setEditor({ kind: 'platform' })} className='mt-4 w-fit text-sm font-semibold text-violet-700 hover:text-violet-900'>Manage connected profiles</button>
                </div>
              ) : (
                <div className='flex min-h-44 flex-col justify-center'>
                  <div aria-hidden='true' className='mb-5 flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-slate-100 text-2xl text-slate-300'>⌁</div>
                  <p className='text-sm leading-6 text-slate-600'>Connect your coding profiles to see your progress.</p>
                  <button type='button' onClick={() => setEditor({ kind: 'platform' })} className='mt-4 w-fit rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600'>Connect Platforms</button>
                </div>
              )}
            </section>

            <section className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'>
              <SectionTitle title='GitHub' action={connectedGithub ? <span className='rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'>Connected</span> : null} />
              {!connectedGithub ? (
                <div className='flex min-h-44 flex-col justify-center'>
                  <p className='text-sm leading-6 text-slate-600'>Connect a GitHub profile to see public repository and follower counts.</p>
                  <button type='button' onClick={() => setEditor({ kind: 'platform' })} className='mt-4 w-fit rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'>Connect GitHub</button>
                </div>
              ) : githubLoading ? (
                <p className='py-10 text-sm text-slate-500' role='status'>Loading public GitHub statistics...</p>
              ) : githubError ? (
                <div className='py-6'>
                  <p className='text-sm text-slate-600'>{githubError}</p>
                  {profile?.platforms.find((item) => item.platform === 'GitHub') ? <a href={profile.platforms.find((item) => item.platform === 'GitHub')?.url} target='_blank' rel='noreferrer' className='mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700'>View GitHub profile <ActionIcon name='external' /></a> : null}
                </div>
              ) : githubStats ? (
                <>
                  <div className='mb-5 grid grid-cols-2 gap-3'>
                    <div className='rounded-xl bg-slate-50 p-4'><p className='text-xs text-slate-500'>Public repositories</p><p className='mt-1 text-2xl font-bold text-slate-900'>{githubStats.publicRepos}</p></div>
                    <div className='rounded-xl bg-slate-50 p-4'><p className='text-xs text-slate-500'>Followers</p><p className='mt-1 text-2xl font-bold text-slate-900'>{githubStats.followers}</p></div>
                  </div>
                  <a href={githubStats.url} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900'>View GitHub profile <ActionIcon name='external' /></a>
                  <p className='mt-3 text-xs leading-5 text-slate-500'>Public profile data from GitHub. Contribution activity is not shown.</p>
                </>
              ) : <EmptyState>GitHub statistics are not available yet.</EmptyState>}
            </section>
          </div> : null}

          {!profile?.demoData ? <>
          <section className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'>
            <SectionTitle title='Projects' action={<button type='button' onClick={() => setEditor({ kind: 'project' })} className='inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900'><ActionIcon name='plus' />Add Project</button>} />
            {!profile?.projects.length ? (
              <EmptyState>Your projects will appear here when you add them.</EmptyState>
            ) : (
              <div className='grid gap-3 md:grid-cols-2'>
                {profile.projects.map((project, index) => (
                  <article key={`${project.title}-${index}`} className='rounded-xl border border-slate-200 p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <h3 className='break-words font-semibold text-slate-900'>{project.title}</h3>
                        <p className='mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600'>{project.description}</p>
                      </div>
                      <div className='flex shrink-0 gap-1'>
                        <button type='button' aria-label={`Edit ${project.title}`} onClick={() => setEditor({ kind: 'project', index })} className='rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-violet-700'><ActionIcon name='edit' /></button>
                        <button type='button' aria-label={`Remove ${project.title}`} onClick={() => void removeProject(index)} className='rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700'><ActionIcon name='trash' /></button>
                      </div>
                    </div>
                    {project.coverImage ? (
                      <div className='relative mt-4'>
                        <img src={project.coverImage.url} alt={`${project.title} cover`} className='h-40 w-full rounded-lg border border-slate-200 object-cover' />
                        {project.id ? <button type='button' onClick={() => void removeProjectImage(project.id, project.coverImage!.id)} className='absolute right-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50'>Remove cover</button> : null}
                      </div>
                    ) : null}
                    {project.screenshots.length ? (
                      <div className='mt-3 grid grid-cols-3 gap-2'>
                        {project.screenshots.map((image) => (
                          <div key={image.id} className='group relative'>
                            <img src={image.url} alt={`${project.title} screenshot`} className='h-20 w-full rounded-lg border border-slate-200 object-cover' />
                            {project.id ? <button type='button' onClick={() => void removeProjectImage(project.id, image.id)} className='absolute right-1 top-1 rounded bg-white/95 px-1.5 py-1 text-[11px] font-semibold text-red-700 opacity-100 shadow-sm sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'>Remove</button> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className='mt-4 flex flex-wrap gap-4'>
                      <a href={project.url} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 text-sm font-medium text-violet-700'>View project <ActionIcon name='external' /></a>
                      {project.repositoryUrl ? <a href={project.repositoryUrl} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 text-sm font-medium text-violet-700'>Repository <ActionIcon name='external' /></a> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'>
            <SectionTitle title='Skills Verified' />
            <EmptyState>Verified skills and achievements will appear here when they are available. No verifications have been recorded yet.</EmptyState>
          </section>
          </> : null}
        </div>
      </div>

      {editor && profile ? (
        <ProfileEditorDialog
          kind={editor.kind}
          initialValue={
            editor.kind === 'avatar'
              ? { avatar: profile.avatar }
              : editor.index === undefined
                ? undefined
                : editor.kind === 'link'
                  ? profile.profileLinks[editor.index]
                  : editor.kind === 'project'
                    ? profile.projects[editor.index]
                    : profile.platforms[editor.index]
          }
          existingPlatforms={profile.platforms}
          currentAvatar={profile.avatar}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      ) : null}

      </div>
    </div>
  )
}
