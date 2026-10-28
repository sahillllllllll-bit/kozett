import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

type FeedTab = 'for-you' | 'following' | 'latest' | 'trending'
type FeedUser = { id: string; name: string; username: string | null; avatar: string | null }
type FeedSearchUser = FeedUser & { following: boolean }
type FeedSuggestion = FeedUser & { followersCount: number }
type FeedAttachment = { url: string; width?: number; height?: number; alt?: string }
type FeedPost = {
  id: string
  author: FeedUser
  title?: string | null
  text: string
  category?: string | null
  isOfficial?: boolean
  link: string | null
  projectLink: { title: string; url: string } | null
  codeSnippet: { language: string; code: string } | null
  hashtags: string[]
  images: FeedAttachment[]
  likesCount: number
  commentsCount: number
  likedByMe: boolean
  savedByMe: boolean
  following: boolean
  isAuthor: boolean
  createdAt: string
  updatedAt: string
}
type FeedComment = { id: string; author: FeedUser | null; text: string; createdAt: string; postId: string }
type FeedPageResponse = { success: boolean; items: FeedPost[]; nextCursor: string | null }
type UpcomingContest = { id: string; title: string; platform: string; startTime: string; contestUrl: string }

const panel = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80'
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const button = 'inline-flex items-center justify-center rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50'
const tabs: Array<{ id: FeedTab; label: string }> = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'latest', label: 'Latest' },
  { id: 'trending', label: 'Trending' },
]
const postTokenPattern = /(#[\p{L}\p{N}_]{1,40}|https?:\/\/[^\s<]+)/gu

function userUrl(user: FeedUser) {
  return user.username ? `/${encodeURIComponent(user.username)}` : '/profile'
}

function formatTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Author({ user, size = 'md' }: { user: FeedUser; size?: 'sm' | 'md' }) {
  return (
    <Link to={userUrl(user)} className='flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'>
      {user.avatar ? (
        <img src={user.avatar} alt='' className={`${size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'} shrink-0 rounded-full object-cover`} />
      ) : (
        <span aria-hidden='true' className={`${size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'} flex shrink-0 items-center justify-center rounded-full bg-cyan-900 text-sm font-bold text-white dark:bg-cyan-700`}>{user.name.slice(0, 1).toUpperCase()}</span>
      )}
      <span className='min-w-0'>
        <span className='block truncate text-sm font-semibold text-slate-950 dark:text-white'>{user.name}</span>
        <span className='block truncate text-xs text-slate-500 dark:text-slate-400'>{user.username ? `@${user.username}` : 'Kozett developer'}</span>
      </span>
    </Link>
  )
}

function PostText({ post, onHashtag }: { post: FeedPost; onHashtag: (tag: string) => void }) {
  const parts = post.text.split(postTokenPattern)
  return (
    <p className='whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-200'>
      {parts.map((part, index) => part.startsWith('#')
        ? <button key={`${part}-${index}`} type='button' onClick={() => onHashtag(part.slice(1))} className='font-semibold text-cyan-800 hover:underline dark:text-cyan-300'>{part}</button>
        : part.startsWith('http://') || part.startsWith('https://')
          ? <ExternalLink key={`${part}-${index}`} url={part}>{part}</ExternalLink>
          : <span key={index}>{part}</span>)}
    </p>
  )
}

function ExternalLink({ url, children }: { url: string; children: React.ReactNode }) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return <a href={parsed.toString()} target='_blank' rel='noopener noreferrer' className='text-cyan-800 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-600 dark:text-cyan-300'>{children}</a>
  } catch {
    return null
  }
}

function FeedPostCard({
  post,
  onLike,
  onBookmark,
  onFollow,
  onComment,
  onReport,
  onHashtag,
  onShare,
  onEdit,
  onDelete,
  selectedTab,
  currentUserId,
}: {
  post: FeedPost
  onLike: () => void
  onBookmark: () => void
  onFollow: () => void
  onComment: () => void
  onReport: () => void
  onHashtag: (tag: string) => void
  onShare: () => void
  onEdit: () => void
  onDelete: () => void
  selectedTab: FeedTab
  currentUserId?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ownPost = currentUserId === post.author.id || post.isAuthor
  const postPath = `/feed/post/${encodeURIComponent(post.id)}?tab=${selectedTab}`
  return (
    <article className={`${panel} p-5 sm:p-6`}>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <Author user={post.author} />
          {!ownPost ? <button type='button' onClick={onFollow} className='shrink-0 rounded-full border border-cyan-700 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-200 dark:hover:bg-cyan-950'>{post.following ? 'Following' : 'Follow'}</button> : null}
        </div>
        <div className='relative flex shrink-0 items-center gap-2'>
          <time dateTime={post.createdAt} className='hidden text-xs text-slate-500 dark:text-slate-400 sm:inline'>{formatTime(post.createdAt)}</time>
          <button type='button' aria-label='Post actions' aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className='rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-slate-800'>•••</button>
          {menuOpen ? (
            <div className='absolute right-0 top-10 z-10 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900'>
              <Link to={postPath} className='block rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'>Open post</Link>
              <button type='button' onClick={() => { onBookmark(); setMenuOpen(false) }} className='block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'>{post.savedByMe ? 'Remove saved post' : 'Save post'}</button>
              <button type='button' onClick={() => { onShare(); setMenuOpen(false) }} className='block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'>Share post</button>
                  {ownPost && !post.isOfficial ? <><button type='button' onClick={() => { onEdit(); setMenuOpen(false) }} className='block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'>Edit post</button><button type='button' onClick={() => { onDelete(); setMenuOpen(false) }} className='block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'>Delete post</button></> : null}
              {!ownPost ? <button type='button' onClick={() => { onReport(); setMenuOpen(false) }} className='block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'>Report post</button> : null}
            </div>
          ) : null}
        </div>
      </div>
      <time dateTime={post.createdAt} className='mt-2 block text-xs text-slate-500 dark:text-slate-400 sm:hidden'>{formatTime(post.createdAt)}</time>
      {post.isOfficial ? <div className='mt-4 flex flex-wrap items-center gap-2'>
        <span className='rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200'>Official Kozett</span>
        {post.category ? <span className='text-xs font-medium text-slate-500 dark:text-slate-400'>{post.category}</span> : null}
      </div> : null}
      {post.title ? <h2 className='mt-3 text-lg font-bold text-slate-950 dark:text-white'>{post.title}</h2> : null}
      <div className={`${post.title ? 'mt-2' : 'mt-4'}`}><PostText post={post} onHashtag={onHashtag} /></div>
      {post.link ? <p className='mt-3 break-all text-sm'><ExternalLink url={post.link}>{post.link}</ExternalLink></p> : null}
      {post.projectLink ? <p className='mt-3 break-all text-sm'><ExternalLink url={post.projectLink.url}>{post.projectLink.title}</ExternalLink></p> : null}
      {post.codeSnippet ? <div className='mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950'><div className='border-b border-slate-800 px-4 py-2 text-xs text-cyan-300'>{post.codeSnippet.language}</div><pre className='max-h-80 overflow-auto p-4 text-xs leading-6 text-slate-100'><code>{post.codeSnippet.code}</code></pre></div> : null}
      {post.images.map((image) => (
        <a key={image.url} href={image.url} target='_blank' rel='noopener noreferrer' className='mt-4 block overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800'>
          <img src={image.url} alt={image.alt ?? 'Post attachment'} loading='lazy' className='max-h-[34rem] w-full object-contain' onError={(event) => { event.currentTarget.alt = 'Attachment could not be loaded'; event.currentTarget.classList.add('hidden') }} />
        </a>
      ))}
      <div className='mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400'>
        <span>{post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'}</span><span>{post.commentsCount} {post.commentsCount === 1 ? 'comment' : 'comments'}</span>
      </div>
      <div className='mt-2 grid grid-cols-3 gap-2'>
        <button type='button' aria-pressed={post.likedByMe} onClick={onLike} className={`rounded-lg px-2 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-slate-800 ${post.likedByMe ? 'text-cyan-800 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-300'}`}>{post.likedByMe ? 'Liked' : 'Like'}</button>
        <button type='button' onClick={onComment} className='rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800'>Comment</button>
        <button type='button' onClick={onShare} className='rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800'>Share</button>
      </div>
    </article>
  )
}

function useFeedActions(updatePost: (id: string, update: Partial<FeedPost>) => void, setMessage: (message: string) => void) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const requireUser = () => {
    if (user) return true
    navigate(`/login?redirect=${encodeURIComponent('/feed')}`)
    return false
  }
  const like = async (post: FeedPost) => {
    if (!requireUser()) return
    try {
      const result = post.likedByMe
        ? await api.del<{ likesCount: number }>(`/feed/posts/${encodeURIComponent(post.id)}/like`)
        : await api.put<{ likesCount: number }>(`/feed/posts/${encodeURIComponent(post.id)}/like`, {})
      updatePost(post.id, { likedByMe: !post.likedByMe, likesCount: result.likesCount })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update like.') }
  }
  const bookmark = async (post: FeedPost) => {
    if (!requireUser()) return
    try {
      if (post.savedByMe) await api.del(`/feed/posts/${encodeURIComponent(post.id)}/bookmark`)
      else await api.put(`/feed/posts/${encodeURIComponent(post.id)}/bookmark`, {})
      updatePost(post.id, { savedByMe: !post.savedByMe })
      setMessage(post.savedByMe ? 'Removed from saved posts.' : 'Post saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this post.') }
  }
  const follow = async (post: FeedPost) => {
    if (!requireUser()) return
    try {
      const path = `/feed/users/${encodeURIComponent(post.author.id)}/follow`
      if (post.following) await api.del(path)
      else await api.put(path, {})
      updatePost(post.id, { following: !post.following })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update follow status.') }
  }
  const report = async (post: FeedPost) => {
    if (!requireUser()) return
    const reason = window.prompt('Why are you reporting this post?')
    if (!reason?.trim()) return
    try {
      const normalizedReason = ['spam', 'harassment', 'inappropriate', 'misinformation'].includes(reason.trim().toLowerCase())
        ? reason.trim().toLowerCase()
        : 'other'
      await api.post(`/feed/posts/${encodeURIComponent(post.id)}/report`, { reason: normalizedReason })
      setMessage('Report submitted for review.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not submit report.') }
  }
  const share = async (post: FeedPost) => {
    const url = `${window.location.origin}/feed/post/${encodeURIComponent(post.id)}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `Post by ${post.author.name}`, text: post.text.slice(0, 200), url })
        setMessage('Post shared.')
        return
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Post link copied.')
    } catch {
      setMessage(`Post link: ${url}`)
    }
  }
  return { like, bookmark, follow, report, share }
}

export default function FeedPage({ mode = 'feed' }: { mode?: 'feed' | 'saved' | 'detail' }) {
  const { user } = useAuth()
  const { postId } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialTab = (tabs.some(({ id }) => id === searchParams.get('tab')) ? searchParams.get('tab') : 'for-you') as FeedTab
  const [tab, setTab] = useState<FeedTab>(initialTab)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [detailPost, setDetailPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentCursor, setCommentCursor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentOpen, setCommentOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [projectUrl, setProjectUrl] = useState('')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('text')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [hashtag, setHashtag] = useState(searchParams.get('tag') ?? '')
  const [searchType, setSearchType] = useState('posts')
  const [trendingTags, setTrendingTags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<FeedSuggestion[]>([])
  const [peopleResults, setPeopleResults] = useState<FeedSearchUser[]>([])
  const [upcomingContests, setUpcomingContests] = useState<UpcomingContest[]>([])
  const [profileCounts, setProfileCounts] = useState<{ followersCount: number; followingCount: number } | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const updatePost = useCallback((id: string, update: Partial<FeedPost>) => {
    setPosts((current) => current.map((post) => post.id === id ? { ...post, ...update } : post))
    setDetailPost((current) => current?.id === id ? { ...current, ...update } : current)
  }, [])
  const actions = useFeedActions(updatePost, setMessage)
  const maxCharacters = 5000

  const fetchPosts = useCallback(async (cursor?: string | null) => {
    if (cursor) setLoadingMore(true)
    else { setLoading(true); setError(null) }
    try {
      if (mode !== 'detail' && (query.trim() || hashtag.trim()) && (query.trim() || hashtag.trim()).replace(/^#/, '').length < 2) {
        setPosts([])
        setPeopleResults([])
        setNextCursor(null)
        setError('Search needs at least 2 characters.')
        return
      }
        const params = new URLSearchParams({ limit: '20' })
        if (cursor) params.set('cursor', cursor)
        let response: FeedPageResponse
        if (mode === 'detail') {
          const detail = await api.get<{ success: boolean; post: FeedPost }>(`/feed/posts/${encodeURIComponent(postId ?? '')}`)
          const post = detail.post
          setDetailPost(post)
          setPosts(post ? [post] : [])
          setNextCursor(null)
          return
        } else if (mode === 'saved') {
          response = await api.get<FeedPageResponse>(`/feed/saved?${params.toString()}`)
        } else if (query.trim() || hashtag.trim()) {
          params.set('q', (query.trim() || hashtag.trim()).replace(/^#/, ''))
          params.set('type', searchType === 'people' ? 'users' : 'posts')
          if (searchType === 'people') {
            const result = await api.get<{ items: FeedSearchUser[]; nextCursor: string | null }>(`/feed/search?${params.toString()}`)
            setPeopleResults(result.items)
            setPosts([])
            setNextCursor(result.nextCursor)
            return
          }
          setPeopleResults([])
          response = await api.get<FeedPageResponse>(`/feed/search?${params.toString()}`)
        } else {
          setPeopleResults([])
          params.set('mode', tab === 'following' || tab === 'trending' ? tab : 'latest')
          response = await api.get<FeedPageResponse>(`/feed/posts?${params.toString()}`)
        }
        setPosts((current) => cursor ? [...current, ...response.items] : response.items)
        setNextCursor(response.nextCursor)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the developer feed.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [hashtag, mode, postId, query, searchType, tab])

  useEffect(() => { void fetchPosts() }, [fetchPosts, reloadToken])
  useEffect(() => {
    if (mode !== 'feed') return
    setSearchParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('tab', tab)
      return updated
    }, { replace: true })
  }, [mode, setSearchParams, tab])
  useEffect(() => {
    let active = true
    void Promise.all([
      api.get<{ items: Array<{ hashtag: string }> }>('/feed/hashtags/trending?limit=10').then(({ items }) => { if (active) setTrendingTags(items.map(({ hashtag }) => hashtag)) }),
      user ? api.get<{ items: FeedSuggestion[] }>('/feed/suggestions?limit=5').then(({ items }) => { if (active) setSuggestions(items) }) : Promise.resolve(),
      api.contests(new URLSearchParams({ status: 'upcoming', limit: '3', sort: 'soonest' })).then(({ contests }) => {
        if (active) setUpcomingContests(contests.map(({ id, title, platform, startTime, contestUrl }) => ({ id, title, platform, startTime, contestUrl })))
      }),
    ]).catch((loadError: unknown) => {
      if (active) setMessage(loadError instanceof Error ? loadError.message : 'Some discovery data could not be loaded.')
    })
    return () => { active = false }
  }, [reloadToken, user])

  useEffect(() => {
    if (!user) {
      setProfileCounts(null)
      return
    }
    void api.get<{ followersCount: number; followingCount: number }>(`/feed/users/${encodeURIComponent(user.id)}/follow-counts`)
      .then(({ followersCount, followingCount }) => setProfileCounts({ followersCount, followingCount }))
      .catch((loadError: unknown) => setMessage(loadError instanceof Error ? loadError.message : 'Unable to load profile counts.'))
  }, [user])

  useEffect(() => {
    if (!image) {
      setImagePreview(null)
      return
    }
    const previewUrl = URL.createObjectURL(image)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [image])

  useEffect(() => {
    if (!commentOpen) return
    void api.get<{ items: FeedComment[]; nextCursor: string | null }>(`/feed/posts/${encodeURIComponent(commentOpen)}/comments?limit=20`)
      .then((result) => { setComments(result.items); setCommentCursor(result.nextCursor) })
      .catch((loadError: unknown) => setMessage(loadError instanceof Error ? loadError.message : 'Unable to load comments.'))
  }, [commentOpen, reloadToken])

  useEffect(() => {
    if (mode !== 'detail' || !postId) return
    setCommentOpen(postId)
  }, [mode, postId])

  const visiblePosts = posts

  async function publish() {
    if (!user) { navigate(`/login?redirect=${encodeURIComponent('/feed')}`); return }
    if (!draft.trim() || draft.length > maxCharacters) return
    setPublishing(true)
    setMessage('')
    if (image && image.size > 5 * 1024 * 1024) {
      setMessage('Images must be 5 MB or smaller.')
      setPublishing(false)
      return
    }

    if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      setMessage('Choose a JPEG, PNG, or WebP image.')
      setPublishing(false)
      return
    }
    try {
      const created = await api.post<{ post: FeedPost }>('/feed/posts', {
        text: draft.trim(),
        ...(projectUrl.trim() ? { projectLink: { title: projectTitle.trim() || projectUrl.trim(), url: projectUrl.trim() } } : {}),
        ...(code.trim() ? { codeSnippet: { language: language.trim() || 'text', code } } : {}),
      })
      if (image) {
        const form = new FormData()
        form.set('image', image)
        try {
          await api.post(`/feed/posts/${encodeURIComponent(created.post.id)}/images`, form)
        } catch (imageError) {
          setDraft('')
          setProjectTitle('')
          setProjectUrl('')
          setCode('')
          setImage(null)
          setMessage(`Your post was published, but the image upload failed: ${imageError instanceof Error ? imageError.message : 'Please retry the image upload.'}`)
          setReloadToken((value) => value + 1)
          return
        }
      }

      setDraft('')
      setProjectTitle('')
      setProjectUrl('')
      setCode('')
      setImage(null)
      setPreview(false)
      setMessage('Your post is published.')
      setReloadToken((value) => value + 1)
    } catch (publishError) {
      setMessage(publishError instanceof Error ? publishError.message : 'Unable to publish this post.')
    } finally {
      setPublishing(false)
    }
  }

  function cancelDraft() {
    if ((draft.trim() || projectUrl.trim() || code.trim() || image) && !window.confirm('Discard this post draft?')) return
    setDraft('')
    setProjectTitle('')
    setProjectUrl('')
    setCode('')
    setImage(null)
    setPreview(false)
    setMessage('')
  }

  async function submitComment(post: FeedPost) {
    if (!user) { navigate(`/login?redirect=${encodeURIComponent('/feed')}`); return }
    if (!commentText.trim()) return
    try {
      const response = await api.post<{ comment: FeedComment }>(`/feed/posts/${encodeURIComponent(post.id)}/comments`, { text: commentText.trim() })
      setComments((current) => [...current, response.comment])
      updatePost(post.id, { commentsCount: post.commentsCount + 1 })
      setCommentText('')
      setMessage('Comment added.')
    } catch (commentError) { setMessage(commentError instanceof Error ? commentError.message : 'Unable to post your comment.') }
  }

  async function editPost(post: FeedPost) {
    const text = window.prompt('Edit post text', post.text)
    if (text === null || !text.trim()) return
    try {
      const result = await api.patch<{ post: FeedPost }>(`/feed/posts/${encodeURIComponent(post.id)}`, { text: text.trim() })
      updatePost(post.id, result.post)
      setMessage('Post updated.')
    } catch (editError) { setMessage(editError instanceof Error ? editError.message : 'Unable to edit this post.') }
  }

  async function deletePost(post: FeedPost) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await api.del(`/feed/posts/${encodeURIComponent(post.id)}`)
      setPosts((current) => current.filter((item) => item.id !== post.id))
      if (mode === 'detail') navigate('/feed')
      setMessage('Post deleted.')
    } catch (deleteError) { setMessage(deleteError instanceof Error ? deleteError.message : 'Unable to delete this post.') }
  }

  async function reportComment(comment: FeedComment) {
    if (!user) { navigate(`/login?redirect=${encodeURIComponent(rootPath)}`); return }
    const reason = window.prompt('Why are you reporting this comment?')
    if (!reason?.trim()) return
    try {
      await api.post(`/feed/comments/${encodeURIComponent(comment.id)}/report`, { reason: 'other', details: reason.trim().slice(0, 1000) })
      setMessage('Report submitted for review.')
    } catch (reportError) { setMessage(reportError instanceof Error ? reportError.message : 'Unable to submit comment report.') }
  }

  async function updateComment(comment: FeedComment) {
    if (comment.author?.id !== user?.id) return
    const replacement = window.prompt('Edit your comment', comment.text)
    if (!replacement?.trim()) return
    try {
      await api.patch(`/feed/comments/${encodeURIComponent(comment.id)}`, { text: replacement.trim() })
      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, text: replacement.trim() } : item))
    } catch (editError) { setMessage(editError instanceof Error ? editError.message : 'Unable to edit the comment.') }
  }

  async function deleteComment(comment: FeedComment) {
    if (comment.author?.id !== user?.id || !window.confirm('Delete this comment?')) return
    try {
      await api.del(`/feed/comments/${encodeURIComponent(comment.id)}`)
      setComments((current) => current.filter((item) => item.id !== comment.id))
      const targetPost = posts.find((post) => post.id === commentOpen) ?? detailPost
      if (targetPost) updatePost(targetPost.id, { commentsCount: Math.max(0, targetPost.commentsCount - 1) })
    } catch (deleteError) { setMessage(deleteError instanceof Error ? deleteError.message : 'Unable to delete the comment.') }
  }

  async function loadMoreComments() {
    if (!commentOpen || !commentCursor) return
    try {
      const result = await api.get<{ items: FeedComment[]; nextCursor: string | null }>(`/feed/posts/${encodeURIComponent(commentOpen)}/comments?limit=20&cursor=${encodeURIComponent(commentCursor)}`)
      setComments((current) => [...current, ...result.items])
      setCommentCursor(result.nextCursor)
    } catch (loadError) { setMessage(loadError instanceof Error ? loadError.message : 'Unable to load more comments.') }
  }

  function openTag(tag: string) {
    setHashtag(tag.replace(/^#/, ''))
    setQuery('')
    setSearchParams({ tab, tag: tag.replace(/^#/, '') })
    if (mode !== 'feed') navigate('/feed')
  }

  function openComments(post: FeedPost) {
    setCommentOpen((current) => current === post.id ? null : post.id)
  }

  const rootPath = location.pathname
  const feedTitle = mode === 'saved' ? 'Saved posts' : mode === 'detail' ? 'Post' : 'Developer Feed'

  return (
    <section className='mx-auto min-h-[75vh] max-w-7xl px-4 py-7 sm:px-6 lg:px-8'>
      {/* <header className={`${panel} relative overflow-visible bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-5 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40 sm:p-7`}>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.17em] text-cyan-800 dark:text-cyan-300'>Kozett community</p>
            <h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white'>{feedTitle}</h1>
            <p className='mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300'>Share what you're building, learn from other developers, and grow together.</p>
          </div>
          <div className='relative flex items-center gap-2'>
            {mode === 'feed' ? <button type='button' onClick={() => document.getElementById('feed-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={button}>Create Post</button> : <Link to={`/feed?tab=${tab}`} className={button}>Back to feed</Link>}
          </div>
        </div>
      </header> */}

      {message ? <p role='status' aria-live='polite' className='mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100'>{message}</p> : null}
      {error ? <div role='alert' className='mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'>{error}<button type='button' onClick={() => setReloadToken((value) => value + 1)} className='font-semibold underline'>Retry</button></div> : null}

      <div className='mt-6 grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)_250px]'>
        <aside className='hidden space-y-4 lg:block'>
          <section className={`${panel} p-4`}>
            {user ? <><Author user={{ id: user.id, name: user.name, username: user.username, avatar: user.avatar }} />{profileCounts ? <div className='mt-4 flex gap-4 text-xs text-slate-600 dark:text-slate-300'><span><strong className='text-slate-950 dark:text-white'>{profileCounts.followersCount}</strong> followers</span><span><strong className='text-slate-950 dark:text-white'>{profileCounts.followingCount}</strong> following</span></div> : null}<Link to='/profile' className='mt-4 inline-flex text-sm font-semibold text-cyan-800 dark:text-cyan-300'>View my profile →</Link></> : <div><h2 className='font-semibold text-slate-950 dark:text-white'>Join the community</h2><Link to='/login' className='mt-3 inline-flex text-sm font-semibold text-cyan-800 dark:text-cyan-300'>Sign in to interact →</Link></div>}
          </section>
          <section className={`${panel} p-4`}>
            <h2 className='text-sm font-semibold text-slate-950 dark:text-white'>Quick links</h2>
            <nav className='mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300'>
              <Link to='/profile' className='hover:text-cyan-800 dark:hover:text-cyan-300'>My profile</Link>
              <Link to='/feed/saved' className='hover:text-cyan-800 dark:hover:text-cyan-300'>Saved posts</Link>
              <Link to='/contest' className='hover:text-cyan-800 dark:hover:text-cyan-300'>Coding contests</Link>
              <Link to='/certificates' className='hover:text-cyan-800 dark:hover:text-cyan-300'>Certification Academy</Link>
            </nav>
          </section>
        </aside>

        <main className='min-w-0 space-y-4'>
          {mode === 'feed' ? (
            <>
              <section id='feed-composer' className={`${panel} p-4 sm:p-5`}>
                <div className='flex items-center gap-3'>
                  {user?.avatar ? <img src={user.avatar} alt='' className='h-10 w-10 rounded-full object-cover' /> : <span aria-hidden='true' className='flex h-10 w-10 items-center justify-center rounded-full bg-cyan-900 font-bold text-white dark:bg-cyan-700'>{user?.name.slice(0, 1).toUpperCase() ?? 'K'}</span>}
                  <h2 className='font-semibold text-slate-950 dark:text-white'>Share with the community</h2>
                </div>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, maxCharacters))} maxLength={maxCharacters} rows={4} placeholder='What are you building or learning today?' className={`${field} mt-4 resize-y`} aria-label='Post text' />
                <div className='mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400'>
                  <span>{draft.length}/{maxCharacters}</span>
                  <button type='button' onClick={() => setPreview((value) => !value)} className='font-semibold text-cyan-800 dark:text-cyan-300'>{preview ? 'Hide preview' : 'Preview'}</button>
                </div>
                {preview ? <div className='mt-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700'><p className='mb-2 text-xs font-semibold uppercase text-slate-500'>Preview</p><p className='whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200'>{draft || 'Your post preview will appear here.'}</p>{projectUrl ? <p className='mt-2 text-sm'><ExternalLink url={projectUrl}>{projectTitle || projectUrl}</ExternalLink></p> : null}</div> : null}
                <details className='mt-3'>
                  <summary className='cursor-pointer text-sm font-semibold text-cyan-800 dark:text-cyan-300'>Add project link or code snippet</summary>
                  <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                    <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={100} placeholder='Project title (optional)' className={field} aria-label='Project title' />
                    <input value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} type='url' placeholder='https://project.example' className={field} aria-label='Project URL' />
                    <input value={language} onChange={(event) => setLanguage(event.target.value.slice(0, 30))} maxLength={30} placeholder='Language' className={field} aria-label='Code language' />
                    <textarea value={code} onChange={(event) => setCode(event.target.value.slice(0, 10000))} maxLength={10000} rows={3} placeholder='Code snippet (optional)' className={`${field} sm:col-span-2`} aria-label='Code snippet' />
                  </div>
                </details>
                {imagePreview ? <img src={imagePreview} alt='Selected post attachment preview' className='mt-3 max-h-64 w-full rounded-xl bg-slate-100 object-contain dark:bg-slate-800' /> : null}
                <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
                  <label className='cursor-pointer text-sm font-semibold text-slate-600 hover:text-cyan-800 dark:text-slate-300 dark:hover:text-cyan-300'>
                    Add image
                    <input type='file' accept='image/jpeg,image/png,image/webp' onChange={(event) => setImage(event.target.files?.[0] ?? null)} className='sr-only' />
                  </label>
                  <div className='flex items-center gap-3'>
                    {image ? <span className='max-w-40 truncate text-xs text-slate-500'>{image.name}<button type='button' aria-label='Remove image' onClick={() => setImage(null)} className='ml-2 font-bold text-red-600'>×</button></span> : null}
                    {(draft || projectUrl || code || image) ? <button type='button' disabled={publishing} onClick={cancelDraft} className='rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200'>Cancel</button> : null}
                    <button type='button' disabled={publishing || !draft.trim() || draft.length > maxCharacters} onClick={() => void publish()} className={button}>{publishing ? 'Publishing…' : 'Publish'}</button>
                  </div>
                </div>
              </section>
              <div className='grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900 sm:grid-cols-4' role='tablist' aria-label='Feed views'>
                {tabs.map(({ id, label }) => <button key={id} type='button' role='tab' aria-selected={tab === id} onClick={() => { setTab(id); setPosts([]); setNextCursor(null) }} className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${tab === id ? 'bg-white text-cyan-900 shadow-sm dark:bg-slate-800 dark:text-cyan-200' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}>{label}</button>)}
              </div>
              {tab === 'for-you' ? <p className='-mt-2 px-1 text-xs text-slate-500 dark:text-slate-400'>For You currently shows the latest public posts; personalized ranking is not enabled.</p> : null}
              {/* <section className={`${panel} p-3`}>
                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px]'>
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setQuery(searchInput); setSearchParams((current) => { const next = new URLSearchParams(current); searchInput ? next.set('q', searchInput) : next.delete('q'); return next }) } }} placeholder='Search posts, developers, or hashtags…' className={field} aria-label='Search feed' />
                  <select value={searchType} onChange={(event) => setSearchType(event.target.value)} className={field} aria-label='Search type'><option value='posts'>Posts</option><option value='people'>People</option><option value='hashtags'>Hashtags</option></select>
                  <button type='button' disabled={(searchInput.trim() || hashtag.trim()).replace(/^#/, '').length === 1} onClick={() => { setQuery(searchInput); setSearchParams((current) => { const next = new URLSearchParams(current); searchInput ? next.set('q', searchInput) : next.delete('q'); return next }) }} className='rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>Search</button>
                </div>
                {hashtag ? <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>Showing <span className='font-semibold text-cyan-800 dark:text-cyan-300'>#{hashtag}</span><button type='button' onClick={() => { setHashtag(''); setSearchParams({ tab }) }} className='ml-2 text-xs underline'>Clear</button></p> : null}
              </section> */}
            </>
          ) : null}

          {loading ? <div className='space-y-3' role='status' aria-label='Loading posts'>{[0, 1, 2].map((i) => <div key={i} className={`${panel} h-52 animate-pulse bg-slate-100 dark:bg-slate-800`} />)}</div>
            : visiblePosts.length ? visiblePosts.map((post) => (
              <div key={post.id}>
                <FeedPostCard
                  post={post}
                  currentUserId={user?.id}
                  onLike={() => void actions.like(post)}
                  onBookmark={() => void actions.bookmark(post)}
                  onFollow={() => void actions.follow(post)}
                  onReport={() => void actions.report(post)}
                  onShare={() => void actions.share(post)}
                  onEdit={() => void editPost(post)}
                  onDelete={() => void deletePost(post)}
                  selectedTab={tab}
                  onComment={() => { openComments(post); if (mode === 'feed') navigate(`/feed?tab=${tab}#comments-${post.id}`) }}
                  onHashtag={openTag}
                />
                {commentOpen === post.id ? <section id={`comments-${post.id}`} className={`${panel} mt-2 p-4`}>
                  <form onSubmit={(event) => { event.preventDefault(); void submitComment(post) }} className='flex gap-2'>
                    <input value={commentText} onChange={(event) => setCommentText(event.target.value.slice(0, 2000))} maxLength={2000} placeholder='Write a thoughtful comment…' className={field} aria-label='Write a comment' />
                    <button type='submit' disabled={!commentText.trim()} className={button}>Send</button>
                  </form>
                  <div className='mt-4 space-y-4'>
                    {comments.map((comment) => <article key={comment.id} className='flex items-start justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800'><div className='min-w-0'>{comment.author ? <Author user={comment.author} size='sm' /> : <p className='text-xs text-slate-500'>Private developer</p>}<p className='mt-2 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200'>{comment.text}</p><time className='mt-1 block text-xs text-slate-500'>{formatTime(comment.createdAt)}</time></div>{comment.author?.id === user?.id ? <div className='flex gap-2 text-xs'><button type='button' onClick={() => void updateComment(comment)} className='text-cyan-800 dark:text-cyan-300'>Edit</button><button type='button' onClick={() => void deleteComment(comment)} className='text-red-700 dark:text-red-300'>Delete</button></div> : <button type='button' onClick={() => void reportComment(comment)} className='text-xs text-red-700 dark:text-red-300'>Report</button>}</article>)}
                    {commentCursor ? <button type='button' onClick={() => void loadMoreComments()} className='w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200'>Load more comments</button> : null}
                    {!comments.length ? <p className='text-center text-sm text-slate-500'>Be the first to comment.</p> : null}
                  </div>
                </section> : null}
              </div>
            )) : !error && !peopleResults.length ? <div className={`${panel} border-dashed px-5 py-12 text-center`}><h2 className='font-semibold text-slate-950 dark:text-white'>{searchType === 'people' && query ? 'No developers found' : mode === 'saved' ? 'No saved posts' : mode === 'detail' ? 'Post not found' : 'No posts yet'}</h2><p className='mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300'>{searchType === 'people' && query ? 'Try another name or username.' : mode === 'saved' ? 'Save posts you want to revisit. They are private to your account.' : mode === 'detail' ? 'This post may have been removed or is not available.' : tab === 'following' ? 'Follow developers to see their posts here.' : 'When developers share real posts, they will appear here. Start the conversation with a post of your own.'}</p></div> : null}
          {nextCursor && mode !== 'detail' ? <button type='button' disabled={loadingMore} onClick={() => void fetchPosts(nextCursor)} className={`${panel} w-full px-4 py-3 text-sm font-semibold text-cyan-800 hover:bg-slate-50 disabled:opacity-60 dark:text-cyan-300 dark:hover:bg-slate-800`}>{loadingMore ? 'Loading…' : searchType === 'people' && query ? 'Load more developers' : 'Load more posts'}</button> : null}
        </main>

        <aside className='space-y-4'>
          <section className={`${panel} p-4`}>
            <h2 className='text-sm font-semibold text-slate-950 dark:text-white'>Trending topics · past 7 days</h2>
            <div className='mt-3 flex flex-wrap gap-2'>
              {trendingTags.map((tag) => <button key={tag} type='button' onClick={() => openTag(tag)} className='rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-900'>#{tag.replace(/^#/, '')}</button>)}
              {!trendingTags.length ? <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>Topics will appear as developers use hashtags in real posts.</p> : null}
            </div>
          </section>
          <section className={`${panel} p-4`}>
            <h2 className='text-sm font-semibold text-slate-950 dark:text-white'>Developers to discover</h2>
            <div className='mt-3 space-y-3'>
              {suggestions.map((suggestion) => <div key={suggestion.id} className='flex items-center justify-between gap-2'><div className='min-w-0'><Author user={suggestion} size='sm' /><p className='ml-12 mt-1 text-[11px] text-slate-500 dark:text-slate-400'>{suggestion.followersCount} followers</p></div><button type='button' onClick={async () => { try { await api.put(`/feed/users/${encodeURIComponent(suggestion.id)}/follow`, {}); setSuggestions((current) => current.filter((person) => person.id !== suggestion.id)) } catch (followError) { setMessage(followError instanceof Error ? followError.message : 'Unable to follow developer.') } }} className='text-xs font-semibold text-cyan-800 dark:text-cyan-300' aria-label={`Follow ${suggestion.name}`}>Follow</button></div>)}
              {!suggestions.length ? <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>Suggestions will show real public developers when available.</p> : null}
            </div>
          </section>
          <section className={`${panel} p-4`}>
            <h2 className='text-sm font-semibold text-slate-950 dark:text-white'>Upcoming contest</h2>
            {upcomingContests.length ? <ul className='mt-3 space-y-3'>{upcomingContests.map((contest) => <li key={contest.id} className='text-sm'><p className='font-medium text-slate-800 dark:text-slate-200'>{contest.title}</p><p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{contest.platform} · {formatTime(contest.startTime)}</p><ExternalLink url={contest.contestUrl}>Contest details</ExternalLink></li>)}</ul>
              : <p className='mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400'>No upcoming contests are currently available from supported feeds.</p>}
            <Link to='/contest' className='mt-3 inline-flex text-sm font-semibold text-cyan-800 dark:text-cyan-300'>Explore contests →</Link>
          </section>
        </aside>
      </div>
    </section>
  )
}
