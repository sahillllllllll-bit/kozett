import EarnPage from './EarnPage'
import FeedPage from './FeedPage'

const pageContent = {
   leaderboard: {
    title: 'LeaderBoard',
    description: 'Discover future bounties, rewards, and eligible developer opportunities.',
    empty: 'Earning opportunities are not available yet.',
  },
} as const

type MemberPageKey = keyof typeof pageContent | 'earn' | 'feed'

export default function MemberPage({ page }: { page: MemberPageKey }) {
  if (page === 'earn') {
    return <EarnPage />
  }

  if (page === 'feed') {
    return <FeedPage />
  }

  const content = pageContent[page]

  return (
    <section className='mx-auto min-h-[70vh] max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
      <p className='text-sm font-semibold uppercase tracking-[0.16em] text-red-600'>Kozett</p>
      <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>{content.title}</h1>
      <p className='mt-3 max-w-2xl text-slate-600'>{content.description}</p>
      <div className='mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500 sm:px-6'>
        {content.empty}
      </div>
    </section>
  )
}
