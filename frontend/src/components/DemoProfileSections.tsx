import { useEffect, useMemo, useState } from 'react'
import type { DemoProfileData } from '../types'

function DemoBadge() {
  return <span className='inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-cyan-200'>DEMO DATA</span>
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
      <h2 className='text-lg font-semibold tracking-tight text-slate-900'>{title}</h2>
      <DemoBadge />
    </div>
  )
}

function Speedometer({ data }: { data: DemoProfileData }) {
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const progress = Math.min(data.totalReportedSolves / 2000, 1)
  const topStats = data.platforms.filter((item) => item.solved !== null)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setAnimatedProgress(progress)
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const duration = 1150
    const animate = (now: number) => {
      const fraction = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - fraction, 4)
      setAnimatedProgress(progress * eased)
      if (fraction < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [progress, reducedMotion])

  const displayedValue = Math.round(data.totalReportedSolves * animatedProgress)
  const arcLength = 251.3
  const needleAngle = -90 + animatedProgress * 180

  return (
    <section id='coding' className='cockpit-panel cockpit-reveal overflow-hidden p-5 text-white sm:p-7'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='cockpit-label'>Coding telemetry · System online</p>
          <h2 className='mt-1 text-xl font-semibold'>Coding speedometer</h2>
        </div>
        <DemoBadge />
      </div>
      <div className='mt-5 grid items-center gap-6 md:grid-cols-[minmax(230px,0.9fr)_1.1fr]'>
        <div className='relative mx-auto w-full max-w-[310px]' role='img' aria-label={`${data.totalReportedSolves} total reported solves in demo data`}>
          <svg viewBox='0 0 200 132' className='w-full overflow-visible' aria-hidden='true'>
            <path className='gauge-track' d='M20 105 A80 80 0 0 1 180 105' fill='none' stroke='#1e293b' strokeWidth='9' strokeLinecap='round' />
            <path
              d='M20 105 A80 80 0 0 1 180 105'
              fill='none'
              stroke='url(#speedometer-gradient)'
              strokeWidth='9'
              strokeLinecap='round'
              strokeDasharray={`${arcLength * animatedProgress} ${arcLength}`}
              filter='url(#speedometer-glow)'
            />
            <defs>
              <linearGradient id='speedometer-gradient' x1='20' y1='0' x2='180' y2='0' gradientUnits='userSpaceOnUse'>
                <stop stopColor='var(--gauge-start)' />
                <stop offset='1' stopColor='var(--gauge-end)' />
              </linearGradient>
              <filter id='speedometer-glow' x='-20%' y='-50%' width='140%' height='200%'>
                <feGaussianBlur stdDeviation='3' result='blur' />
                <feMerge><feMergeNode in='blur' /><feMergeNode in='SourceGraphic' /></feMerge>
              </filter>
            </defs>
            {Array.from({ length: 17 }, (_, tick) => {
              const angle = Math.PI - (tick / 16) * Math.PI
              const inner = tick % 4 === 0 ? 66 : 70
              const outer = 77
              const x1 = 100 + Math.cos(angle) * inner
              const y1 = 105 - Math.sin(angle) * inner
              const x2 = 100 + Math.cos(angle) * outer
              const y2 = 105 - Math.sin(angle) * outer
              return (
                <line className={tick / 16 <= animatedProgress ? 'gauge-tick-active' : 'gauge-tick'} key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tick / 16 <= animatedProgress ? '#67e8f9' : '#475569'} strokeWidth={tick % 4 === 0 ? 1.6 : 1} />
              )
            })}
            <g transform={`rotate(${needleAngle} 100 105)`}>
              <path className='gauge-needle' d='M100 105 L100 43' stroke='#f8fafc' strokeWidth='2.2' strokeLinecap='round' />
              <path className='gauge-pointer' d='M100 105 L100 48' stroke='#22d3ee' strokeWidth='1' strokeLinecap='round' />
            </g>
            <circle className='gauge-hub' cx='100' cy='105' r='5' fill='#e2e8f0' stroke='#22d3ee' strokeWidth='2' />
            <text className='gauge-label' x='28' y='93' fill='#64748b' fontSize='6'>0</text>
            <text className='gauge-label' x='88' y='21' fill='#64748b' fontSize='6'>1K</text>
            <text className='gauge-label' x='164' y='93' fill='#64748b' fontSize='6'>2K</text>
          </svg>
          <div className='-mt-7 text-center'>
            <p className='text-4xl font-bold tabular-nums'>{displayedValue.toLocaleString()}</p>
            <p className='mt-1 text-xs uppercase tracking-[0.16em] text-slate-400'>Total reported solves</p>
            <p className='mt-1 text-[10px] text-slate-500'>Visual scale: 0–2,000 reported solves</p>
          </div>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div className='cockpit-panel-inner p-4'>
            <p className='text-xs text-slate-400'>Connected platforms</p>
            <p className='mt-1 text-2xl font-semibold'>{data.linkedPlatforms}</p>
          </div>
          <div className='cockpit-panel-inner p-4'>
            <p className='text-xs text-slate-400'>Top platform</p>
            <p className='mt-1 text-lg font-semibold'>{data.topPlatform ?? 'No data'}</p>
          </div>
          <div className='cockpit-panel-inner col-span-2 p-4'>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-xs font-medium text-slate-300'>Platform-reported solves</p>
              <p className='text-[11px] text-slate-500'>Not de-duplicated</p>
            </div>
            <ul className='mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
              {topStats.map((platform) => (
                <li key={platform.platform} className='flex justify-between gap-2 text-slate-300'>
                  <span>{platform.platform}</span><span className='font-semibold tabular-nums text-white'>{platform.solved}</span>
                </li>
              ))}
            </ul>
            {data.lastSyncedAt ? <p className='mt-3 text-[11px] text-slate-500'>Demo sync timestamp: {new Date(data.lastSyncedAt).toLocaleString()}</p> : null}
          </div>
        </div>
      </div>
      <p className='mt-4 text-xs leading-5 text-slate-400'>Sample values for interface testing only. Platform totals may overlap and are not unique-problem counts.</p>
    </section>
  )
}

function UnavailablePanel({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <section id={id} className='cockpit-panel scroll-mt-24 p-5 sm:p-6'>
      <p className='cockpit-label'>Telemetry unavailable</p>
      <h2 className='mt-2 text-lg font-semibold text-white'>{title}</h2>
      <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-400'>{description}</p>
      <p className='mt-4 text-xs text-slate-500'>No sample values are substituted for missing user data.</p>
    </section>
  )
}

export default function DemoProfileSections({ data }: { data: DemoProfileData | null }) {
  const [platformFilter, setPlatformFilter] = useState('All')
  const shownPlatforms = useMemo(() => {
    if (!data) return []
    return platformFilter === 'All'
      ? data.platforms
      : data.platforms.filter((platform) => platform.platform === platformFilter)
  }, [data, platformFilter])

  return (
    <div className='cockpit-demo space-y-6'>
      {data?.sectionsVisible.platforms && data.platforms.length ? <Speedometer data={data} /> : (
        <UnavailablePanel id='coding' title='Coding telemetry' description='No reliable solved-count synchronization is available for this profile yet.' />
      )}

      {data?.sectionsVisible.platforms && data.platforms.length ? (
        <section className='cockpit-panel p-5 sm:p-6'>
          <SectionHeading title='Platform telemetry' />
          <label className='mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400'>
            Inspect platform
            <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} className='min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'>
              <option>All</option>
              {data.platforms.map((item) => <option key={item.platform}>{item.platform}</option>)}
            </select>
          </label>
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {shownPlatforms.map((item) => (
              <article key={item.platform} className='cockpit-panel-inner p-4 transition-colors hover:border-cyan-300/40'>
                <div className='flex items-start justify-between gap-2'>
                  <h3 className='font-semibold text-slate-900'>{item.platform}</h3>
                  <span className='rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800'>DEMO</span>
                </div>
                <p className='mt-1 text-xs text-slate-500'>Sample account: {item.username}</p>
                <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700'>
                  {item.solved !== null ? <span>{item.solved} solves</span> : null}
                  {item.rating !== null ? <span>Rating {item.rating}</span> : null}
                  {item.rank ? <span>{item.rank}</span> : null}
                </div>
                <p className='mt-3 text-[11px] text-slate-400'>Example data; not connected or synchronized.</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data?.sectionsVisible.github && data.github ? (
        <section id='github' className='cockpit-panel scroll-mt-24 p-5 sm:p-6'>
          <SectionHeading title='GitHub overview' />
          <p className='text-sm text-slate-500'>Sample account: {data.github.username}</p>
          <div className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {[
              ['Public repositories', data.github.publicRepos],
              ['Followers', data.github.followers],
              ['Following', data.github.following],
              ['Contributions', data.github.contributions],
            ].map(([label, value]) => (
              <div key={label} className='cockpit-panel-inner p-4'>
                <p className='text-xs text-slate-500'>{label}</p><p className='mt-1 text-xl font-bold text-slate-900'>{value}</p>
              </div>
            ))}
          </div>
          <ul className='mt-4 grid gap-2 sm:grid-cols-3'>
            {data.github.repositories.map((repo) => (
              <li key={repo.name} className='cockpit-panel-inner px-3 py-2 text-sm'>
                <span className='font-medium text-slate-800'>{repo.name}</span>
                <span className='mt-1 block text-xs text-slate-500'>{repo.language} · {repo.stars} sample stars</span>
              </li>
            ))}
          </ul>
          <p className='mt-3 text-xs text-slate-500'>Sample values only. These repositories are not linked to a real GitHub account.</p>
        </section>
      ) : null}

      {data?.sectionsVisible.github && !data.github ? (
        <UnavailablePanel id='github' title='GitHub performance garage' description='No GitHub statistics are stored for this profile. Live repositories and contribution data require a backend GitHub integration.' />
      ) : null}
      {!data?.sectionsVisible.github ? (
        <UnavailablePanel id='github' title='GitHub performance garage' description='GitHub details are not included because the profile owner has not enabled this section.' />
      ) : null}

      {data?.sectionsVisible.projects && data.projects.length ? (
        <section id='projects' className='cockpit-panel scroll-mt-24 p-5 sm:p-6'>
          <SectionHeading title='Featured projects' />
          <div className='grid gap-4 lg:grid-cols-3'>
            {data.projects.map((project) => (
              <article key={project.title} className='cockpit-panel-inner overflow-hidden transition-transform duration-200 hover:-translate-y-0.5'>
                <div className='flex h-28 items-end bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-4'>
                  <span className='text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200'>{project.category}</span>
                </div>
                <div className='p-4'>
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='font-semibold text-slate-900'>{project.title}</h3>
                    <span className='rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800'>DEMO</span>
                  </div>
                  <p className='mt-2 text-sm leading-6 text-slate-600'>{project.description}</p>
                  <ul className='mt-3 flex flex-wrap gap-1.5'>
                    {project.technologies.map((technology) => <li key={technology} className='rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600'>{technology}</li>)}
                  </ul>
                  <p className='mt-4 text-xs text-slate-500'>Sample project · no external links supplied</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data?.sectionsVisible.projects && !data.projects.length ? (
        <UnavailablePanel id='projects' title='Project pit lane' description='No public projects have been selected for this profile.' />
      ) : null}
      {!data?.sectionsVisible.projects ? (
        <UnavailablePanel id='projects' title='Project pit lane' description={data ? 'Projects are not included because the profile owner has not enabled this section.' : 'No demo project records are available. Any real public projects selected by the owner are shown separately above.'} />
      ) : null}

      {data?.sectionsVisible.skills && data.skills.length ? (
        <section id='skills' className='cockpit-panel scroll-mt-24 p-5 sm:p-6'>
          <SectionHeading title='Skills' />
          <ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {data.skills.map((skill) => (
              <li key={skill.name} className='cockpit-panel-inner p-4'>
                <p className='font-medium text-slate-900'>{skill.name}</p>
                <p className='mt-1 text-lg tracking-widest text-violet-700' aria-label={skill.stars ? `${skill.stars} stars, demo assessment` : 'No verified rating'}>
                  {skill.stars ? '★'.repeat(skill.stars) : <span className='text-sm tracking-normal text-slate-500'>Not verified</span>}
                </p>
                <p className='mt-1 text-xs text-slate-500'>{skill.isVerified && skill.level ? `${skill.level} · demo score ${skill.assessmentScore}%` : 'No qualifying assessment'}</p>
                <span className='mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800'>DEMO DATA</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data?.sectionsVisible.skills && !data.skills.length ? (
        <UnavailablePanel id='skills' title='Skills & credentials' description='No qualifying skill assessments are available for this profile.' />
      ) : null}
      {!data?.sectionsVisible.skills ? (
        <UnavailablePanel id='skills' title='Skills & credentials' description={data ? 'Skills are not included because the profile owner has not enabled this section.' : 'No verified skill-assessment records are available for this profile.'} />
      ) : null}

      {data?.sectionsVisible.certifications && data.certifications.length ? (
        <section id='certifications' className='cockpit-panel scroll-mt-24 p-5 sm:p-6'>
          <SectionHeading title='Certifications' />
          <div className='grid gap-3 md:grid-cols-3'>
            {data.certifications.map((certificate) => (
              <article key={certificate.credentialId} className='cockpit-panel-inner p-4'>
                <h3 className='font-semibold text-slate-900'>{certificate.name}</h3>
                <p className='mt-1 text-sm text-slate-600'>{certificate.issuer} · {certificate.skill}</p>
                {certificate.score !== null ? <p className='mt-2 text-sm text-slate-700'>Sample assessment score: {certificate.score}%</p> : null}
                <p className='mt-2 text-xs text-slate-500'>Credential {certificate.credentialId} · Not independently verified</p>
                <span className='mt-3 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800'>DEMO DATA</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data?.sectionsVisible.certifications && !data.certifications.length ? (
        <UnavailablePanel id='certifications' title='Certifications' description='No certification records are available for this profile.' />
      ) : null}
      {!data?.sectionsVisible.certifications ? (
        <UnavailablePanel id='certifications' title='Certifications' description={data ? 'Credentials are not included because the profile owner has not enabled this section.' : 'No certification records are available for this profile.'} />
      ) : null}

      <UnavailablePanel id='dsa-lab' title='DSA performance lab' description='Topic-level solved, attempted, and accuracy data is not provided by the current profile integrations. Topic mastery and practice recommendations will appear once problem-level records are available.' />
      <UnavailablePanel id='activity' title='Activity telemetry' description='A dated GitHub contribution series and coding submission history are not available. The profile does not currently provide heatmap, streak, or activity-period data.' />
      <UnavailablePanel id='history' title='Performance history' description='Historical snapshots are not yet collected for platform ratings, solve counts, contributions, or pull requests. Trends and comparisons are omitted until dated records exist.' />
      <UnavailablePanel id='achievements' title='Achievement garage' description='Achievements require verifiable milestone events and unlock dates. No achievement is inferred from demo numbers or unverified claims.' />
      <UnavailablePanel id='pull-requests' title='Pull request telemetry' description='The current API has no GitHub pull-request integration. PR counts, review activity, and recent PRs are intentionally not shown.' />
    </div>
  )
}
