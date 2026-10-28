import { Link } from 'react-router-dom'

const features = [
  { title: 'Profile-first onboarding', description: 'Create a polished developer identity that keeps your goals, skills, and links in one place.' },
  { title: 'Skill tracking', description: 'Track progress across platforms and keep your development journey visible and organized.' },
  { title: 'Portfolio-ready profile', description: 'Share a professional overview that looks credible to recruiters, collaborators, and hiring teams.' },
]

export default function HomePage() {
  return (
    <div>
      <section className='mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8'>
        <div className='grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]'>
          <div>
            <div className='mb-4 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-red-700'>MVP for developer profiles</div>
            <h1 className='max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl'>Turn your coding journey into a clearer, stronger profile.</h1>
            <p className='mt-5 max-w-lg text-lg text-slate-600'>Kozett helps developers organize their experience, skills, and platform activity in one modern profile built for growth.</p>
            {/* <div className='mt-8 flex flex-wrap items-center gap-4'>
              <Link to='/signup' className='inline-flex rounded-full bg-red-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-red-500'>Create account</Link>
              <Link to='/login' className='inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50'>Login</Link>
            </div> */}
          </div>

          <div className='rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm'>
            <div className='rounded-2xl bg-white p-5 shadow-sm'>
              <div className='mb-5 flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-slate-500'>Developer snapshot</p>
                  <h2 className='mt-1 text-xl font-bold text-slate-900'>Aarav Singh</h2>
                </div>
                <span className='rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700'>Available</span>
              </div>
              <div className='grid gap-4'>
                <div className='rounded-2xl bg-slate-900 p-4 text-white'>
                  <div className='text-xs uppercase tracking-[0.18em] text-slate-300'>Focus</div>
                  <div className='mt-2 text-lg font-semibold'>Full-stack engineer</div>
                </div>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <div className='rounded-2xl bg-red-50 p-3'>
                    <div className='text-xs text-slate-500'>Problem solving</div>
                    <div className='mt-2 text-2xl font-bold text-red-700'>186</div>
                  </div>
                  <div className='rounded-2xl bg-slate-100 p-3'>
                    <div className='text-xs text-slate-500'>Projects</div>
                    <div className='mt-2 text-2xl font-bold text-slate-800'>12</div>
                  </div>
                  <div className='rounded-2xl bg-slate-100 p-3'>
                    <div className='text-xs text-slate-500'>Skills</div>
                    <div className='mt-2 text-2xl font-bold text-slate-800'>9</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id='features' className='border-y border-slate-200 bg-slate-50 py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
          <div className='mb-10 max-w-2xl'>
            <p className='text-sm font-semibold uppercase tracking-[0.15em] text-red-600'>Why Kozett</p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight text-slate-900'>A sharper developer brand without the noise.</h2>
          </div>
          <div className='grid gap-6 md:grid-cols-3'>
            {features.map((feature) => (
              <article key={feature.title} className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
                <div className='mb-4 h-11 w-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-black'>K</div>
                <h3 className='text-xl font-semibold text-slate-900'>{feature.title}</h3>
                <p className='mt-3 text-slate-600'>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id='how-it-works' className='mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8'>
        <div className='max-w-2xl'>
          <p className='text-sm font-semibold uppercase tracking-[0.15em] text-red-600'>How it works</p>
          <h2 className='mt-2 text-3xl font-bold tracking-tight text-slate-900'>Start with one clean profile, then grow it over time.</h2>
        </div>
        <div className='mt-8 grid gap-6 md:grid-cols-3'>
          {['Create an account', 'Add your skills and platforms', 'Showcase your work to the right people'].map((step, index) => (
            <div key={step} className='rounded-2xl border border-slate-200 bg-white p-6'>
              <div className='mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white'>{index + 1}</div>
              <p className='text-lg font-semibold text-slate-900'>{step}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
