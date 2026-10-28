import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DemoProfileSections from '../components/DemoProfileSections'
import { ApiError, api } from '../lib/api'
import { KdrBreakdownDialog, KdrInlineScore, KdrRankBadge } from '../components/DeveloperRating'
import type { PublicProfile } from '../types'

const sectionLinks = [
  ['coding', 'Telemetry'],
  ['dsa-lab', 'DSA Lab'],
  ['github', 'GitHub'],
  ['activity', 'Activity'],
  ['history', 'History'],
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['certifications', 'Credentials'],
  ['pull-requests', 'Pull requests'],
  ['achievements', 'Milestones'],
] as const

export default function PublicProfilePage() {
  const { username = '' } = useParams()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [ratingDetailsOpen, setRatingDetailsOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setProfile(null)
    setNotFound(false)
    setLoadError(false)

    api.publicUser(username)
      .then(({ user }) => {
        if (active) setProfile(user)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 404) setNotFound(true)
        else setLoadError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [username])

  const initials = profile?.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
  const resolvedSectionLinks = profile
    ? sectionLinks.map(([id, label]) => [
        id === 'projects' && profile.projects.length > 0 ? 'profile-projects' : id,
        label,
      ] as const)
    : sectionLinks

  return (
    <div className='public-cockpit'>
      <div className='cockpit-content mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <header className='flex h-16 items-center justify-between border-b border-white/10' aria-label='Kozett attribution'>
          <Link to='/' className='flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'>
            <img
              src='https://res.cloudinary.com/dmhykhefr/image/upload/v1792835595/Glossy_Gradient_Ribbon_K_Logo_crd3ym.png'
              alt='Kozett'
              className='h-6 w-auto object-contain'
            />
            <span className='text-xs font-medium tracking-wide text-slate-400'>Powered by Kozett</span>
          </Link>
        </header>

        <main className='py-8 sm:py-12'>
          {loading ? (
            <div className='cockpit-panel p-6' role='status'>
              <p className='cockpit-label'>Initializing profile</p>
              <p className='mt-3 text-sm text-slate-300'>Loading public telemetry...</p>
            </div>
          ) : notFound ? (
            <div className='cockpit-panel mx-auto max-w-2xl p-8 text-center'>
              <p className='cockpit-label'>Profile unavailable</p>
              <h1 className='mt-3 text-3xl font-bold text-white'>Driver not found</h1>
              <p className='mt-3 text-sm text-slate-400'>This public profile does not exist or is not currently visible.</p>
            </div>
          ) : loadError ? (
            <div className='cockpit-panel mx-auto max-w-2xl p-8 text-center' role='alert'>
              <p className='cockpit-label'>Connection issue</p>
              <h1 className='mt-3 text-3xl font-bold text-white'>Unable to load profile</h1>
              <p className='mt-3 text-sm text-slate-400'>Please check your connection and try again.</p>
            </div>
          ) : profile ? (
            <>
              <section className='cockpit-panel cockpit-reveal relative overflow-hidden p-5 sm:p-8'>
                <div aria-hidden='true' className='absolute -right-16 -top-24 h-64 w-64 rounded-full border border-cyan-300/10' />
                <div aria-hidden='true' className='absolute -right-5 -top-12 h-44 w-44 rounded-full border border-cyan-300/10' />
                <div className='relative grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]'>
                  <div className='flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center'>
                    <div className='flex shrink-0 items-center gap-3 self-start sm:self-auto'>
                      {profile.rating?.rank ? <KdrRankBadge rank={profile.rating.rank} size='lg' onClick={() => setRatingDetailsOpen(true)} /> : null}
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={`${profile.name} profile`}
                          className='h-24 w-24 shrink-0 rounded-2xl border border-cyan-200/20 object-cover shadow-[0_0_28px_rgba(34,211,238,0.12)]'
                        />
                      ) : (
                        <div aria-hidden='true' className='flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-slate-950/70 text-2xl font-bold text-cyan-100'>
                          {initials || 'K'}
                        </div>
                      )}
                    </div>
                    <div className='min-w-0'>
                      <p className='cockpit-label'>Driver profile · System online</p>
                      <div className='mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
                        <h1 className='break-words text-3xl font-bold tracking-tight text-white sm:text-5xl'>{profile.name}</h1>
                        <KdrInlineScore rating={profile.rating} onClick={() => setRatingDetailsOpen(true)} dark />
                      </div>
                      <p className='mt-2 text-sm font-medium text-cyan-100'>@{profile.username}</p>
                      {profile.bio ? <p className='mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-300'>{profile.bio}</p> : null}
                      {profile.profileLinks.length ? (
                        <ul className='mt-4 flex flex-wrap gap-2'>
                          {profile.profileLinks.map((link, index) => (
                            <li key={`${link.url}-${index}`}>
                              <a href={link.url} target='_blank' rel='noreferrer' className='cockpit-link inline-flex min-h-10 items-center rounded-lg border border-cyan-200/15 bg-slate-950/50 px-3 text-xs font-semibold'>
                                {link.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='cockpit-panel-inner p-4'>
                      <p className='cockpit-label'>Coding solves</p>
                      <p className='mt-2 text-2xl font-bold tabular-nums text-white'>
                        {profile.demoData?.sectionsVisible.platforms ? profile.demoData.totalReportedSolves.toLocaleString() : '—'}
                      </p>
                      <p className='mt-1 text-[11px] text-slate-500'>
                        {profile.demoData?.sectionsVisible.platforms ? 'Total reported · demo' : 'Not available'}
                      </p>
                    </div>
                    <div className='cockpit-panel-inner p-4'>
                      <p className='cockpit-label'>Platforms</p>
                      <p className='mt-2 text-2xl font-bold tabular-nums text-white'>
                        {profile.demoData?.sectionsVisible.platforms ? profile.demoData.linkedPlatforms : '—'}
                      </p>
                      <p className='mt-1 text-[11px] text-slate-500'>
                        {profile.demoData?.sectionsVisible.platforms ? 'Sample records' : 'Not available'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <nav aria-label='Profile sections' className='sticky top-0 z-20 -mx-4 mt-6 border-y border-white/10 bg-[#070b12]/90 px-4 py-2 backdrop-blur-xl sm:mx-0 sm:rounded-xl sm:border sm:px-3'>
                <ul className='flex gap-1 overflow-x-auto'>
                  {resolvedSectionLinks.map(([id, label]) => (
                    <li key={id} className='shrink-0'>
                      <a href={`#${id}`} className='inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className='mt-6 space-y-6'>
                {profile.platforms.length ? (
                  <section className='cockpit-panel p-5 sm:p-6'>
                    <p className='cockpit-label'>Connected account links</p>
                    <h2 className='mt-2 text-lg font-semibold text-white'>Coding profiles</h2>
                    <ul className='mt-4 flex flex-wrap gap-2'>
                      {profile.platforms.map(({ platform, url }) => (
                        <li key={platform}>
                          <a href={url} target='_blank' rel='noreferrer' className='cockpit-link inline-flex min-h-10 items-center rounded-lg border border-white/10 bg-slate-950/50 px-3 text-xs font-semibold'>
                            {platform}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {profile.projects.length ? (
                  <section id='profile-projects' className='cockpit-panel scroll-mt-24 p-5 sm:p-6'>
                    <div className='mb-4'>
                      <p className='cockpit-label'>Racing pit lane</p>
                      <h2 className='mt-2 text-lg font-semibold text-white'>Projects</h2>
                    </div>
                    <div className='grid gap-4 sm:grid-cols-2'>
                      {profile.projects.map((project) => (
                        <article key={`${project.title}-${project.url}`} className='cockpit-panel-inner overflow-hidden transition-transform duration-200 hover:-translate-y-0.5'>
                          {project.coverImage ? <img src={project.coverImage} alt='' className='h-44 w-full object-cover' /> : null}
                          <div className='p-5'>
                            <h3 className='font-semibold text-white'>{project.title}</h3>
                            <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400'>{project.description}</p>
                            <div className='mt-4 flex flex-wrap gap-4 text-sm font-medium'>
                              <a href={project.url} target='_blank' rel='noreferrer' className='cockpit-link'>View project</a>
                              {project.repositoryUrl ? <a href={project.repositoryUrl} target='_blank' rel='noreferrer' className='cockpit-link'>Repository</a> : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <DemoProfileSections data={profile.demoData} />
              </div>
            </>
          ) : null}
        </main>

      </div>
      <KdrBreakdownDialog rating={profile?.rating ?? null} open={ratingDetailsOpen} onClose={() => setRatingDetailsOpen(false)} dark />
    </div>
  )
}
