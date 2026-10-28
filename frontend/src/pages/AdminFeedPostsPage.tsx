import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'

type FeedContentImage = { id: string | null; url: string; altText: string }
type FeedContentPost = {
  id: string
  title: string
  text: string
  category: string
  hashtags: string[]
  status: 'draft' | 'published' | 'archived'
  publishedAt: string | null
  link: string | null
  projectLink: { title: string; url: string } | null
  codeSnippet: { language: string; code: string } | null
  images: FeedContentImage[]
  likesCount: number
  commentsCount: number
  createdAt?: string
  updatedAt?: string
}

const pageSize = 20
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'
const labelClass = 'block space-y-1.5 text-sm font-medium'

export default function AdminFeedPostsPage() {
  const [posts, setPosts] = useState<FeedContentPost[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<FeedContentPost | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [link, setLink] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [projectUrl, setProjectUrl] = useState('')
  const [snippetLanguage, setSnippetLanguage] = useState('')
  const [snippetCode, setSnippetCode] = useState('')
  const [imageAltText, setImageAltText] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const query = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      status: statusFilter,
      search,
    })
    api.get<{ success: boolean; posts: FeedContentPost[]; total: number }>(`/admin/content/feed-posts?${query}`)
      .then((result) => {
        if (active) {
          setPosts(result.posts)
          setTotal(result.total)
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load official feed posts.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, search, statusFilter])

  const startNew = () => {
    setSelected(null)
    setTitle('')
    setText('')
    setCategory('')
    setHashtags('')
    setLink('')
    setProjectTitle('')
    setProjectUrl('')
    setSnippetLanguage('')
    setSnippetCode('')
    setImageAltText('')
    setError('')
    setNotice('')
  }

  const edit = (post: FeedContentPost) => {
    setSelected(post)
    setTitle(post.title)
    setText(post.text)
    setCategory(post.category)
    setHashtags(post.hashtags.join(', '))
    setLink(post.link ?? '')
    setProjectTitle(post.projectLink?.title ?? '')
    setProjectUrl(post.projectLink?.url ?? '')
    setSnippetLanguage(post.codeSnippet?.language ?? '')
    setSnippetCode(post.codeSnippet?.code ?? '')
    setImageAltText('')
    setError('')
    setNotice('')
  }

  const fields = () => ({
    title: title.trim() || null,
    text: text.trim(),
    category: category.trim() || null,
    hashtags: hashtags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
    link: link.trim() || null,
    projectLink: projectTitle.trim() && projectUrl.trim()
      ? { title: projectTitle.trim(), url: projectUrl.trim() }
      : null,
    codeSnippet: snippetLanguage.trim() && snippetCode.trim()
      ? { language: snippetLanguage.trim(), code: snippetCode }
      : null,
  })

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const payload = fields()
      const response = selected
        ? await api.patch<{ success: boolean; post: FeedContentPost }>(`/admin/content/feed-posts/${encodeURIComponent(selected.id)}`, payload)
        : await api.post<{ success: boolean; post: FeedContentPost }>('/admin/content/feed-posts', { ...payload, status: 'draft' })
      edit(response.post)
      setRefresh((value) => value + 1)
      setNotice(selected ? 'Draft changes saved.' : 'Draft created. You can now add images or publish it.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this feed post.')
    } finally {
      setWorking(false)
    }
  }

  const updateStatus = async (post: FeedContentPost, nextStatus: FeedContentPost['status']) => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const result = await api.patch<{ success: boolean; post: FeedContentPost }>(
        `/admin/content/feed-posts/${encodeURIComponent(post.id)}/status`,
        { status: nextStatus },
      )
      if (selected?.id === post.id) edit(result.post)
      setRefresh((value) => value + 1)
      setNotice(`Post ${nextStatus}.`)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Unable to set post ${nextStatus}.`)
    } finally {
      setWorking(false)
    }
  }

  const removeDraft = async (post: FeedContentPost) => {
    if (!window.confirm('Permanently delete this draft? Drafts with activity or reports cannot be deleted.')) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const result = await api.del<{ success: boolean; message?: string }>(`/admin/content/feed-posts/${encodeURIComponent(post.id)}`)
      if (selected?.id === post.id) startNew()
      setRefresh((value) => value + 1)
      setNotice(result.message ?? 'Draft deleted.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this draft.')
    } finally {
      setWorking(false)
    }
  }

  const uploadImage = async (file: File) => {
    if (!selected) {
      setError('Save the post as a draft before uploading images.')
      return
    }
    setWorking(true)
    setError('')
    setNotice('')
    const formData = new FormData()
    formData.append('image', file)
    try {
      const result = await api.post<{ success: boolean; post: FeedContentPost }>(
        `/admin/content/feed-posts/${encodeURIComponent(selected.id)}/images`,
        formData,
        imageAltText.trim() ? { 'X-Image-Alt-Text': imageAltText.trim() } : undefined,
      )
      edit(result.post)
      setRefresh((value) => value + 1)
      setNotice('Image uploaded.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload this image.')
    } finally {
      setWorking(false)
    }
  }

  const removeImage = async (image: FeedContentImage) => {
    if (!selected || !image.id) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const result = await api.del<{ success: boolean; cleanupPending?: boolean; post: FeedContentPost }>(
        `/admin/content/feed-posts/${encodeURIComponent(selected.id)}/images/${encodeURIComponent(image.id)}`,
      )
      edit(result.post)
      setRefresh((value) => value + 1)
      setNotice(result.cleanupPending ? 'Image removed from the post; remote cleanup needs attention.' : 'Image removed.')
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove this image.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className='space-y-5'>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold'>Feed posts</h1>
          <p className='mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400'>Create official Kozett posts, keep work private as drafts, preview content, then publish or archive it. Existing user posts remain separate.</p>
        </div>
        <button type='button' onClick={startNew} className='rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white'>New post</button>
      </header>

      {error ? <p role='alert' className='rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200'>{error}</p> : null}
      {notice ? <p role='status' className='rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'>{notice}</p> : null}

      <div className='grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]'>
        <div className='space-y-3'>
          <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()) }} className='flex flex-wrap gap-2'>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder='Search title, text, category, or tag' className={`${inputClass} min-w-48 flex-1`} />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} aria-label='Filter publication status' className={`${inputClass} w-auto`}>
              <option value='all'>All statuses</option><option value='draft'>Drafts</option><option value='published'>Published</option><option value='archived'>Archived</option>
            </select>
            <button className='rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700'>Search</button>
          </form>

          <div className='space-y-3'>
            {loading ? <p role='status' className='rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10'>Loading official posts…</p>
              : posts.length ? posts.map((post) => <article key={post.id} className='rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <button type='button' onClick={() => edit(post)} className='min-w-0 flex-1 text-left'>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${post.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : post.status === 'archived' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{post.status}</span>
                    <h2 className='mt-2 truncate font-semibold'>{post.title || 'Untitled post'}</h2>
                    <p className='mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300'>{post.text || post.link || 'No text content'}</p>
                    <span className='mt-2 block text-xs text-slate-500'>{post.category || 'Uncategorized'} · {post.likesCount} likes · {post.commentsCount} comments</span>
                  </button>
                  <div className='flex flex-wrap gap-2'>
                    {post.status === 'draft' ? <button type='button' disabled={working} onClick={() => void updateStatus(post, 'published')} className='rounded-md bg-cyan-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50'>Publish</button> : null}
                    {post.status === 'published' ? <><button type='button' disabled={working} onClick={() => void updateStatus(post, 'draft')} className='rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 disabled:opacity-50'>Unpublish</button><button type='button' disabled={working} onClick={() => void updateStatus(post, 'archived')} className='rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 disabled:opacity-50'>Archive</button></> : null}
                    {post.status === 'archived' ? <button type='button' disabled={working} onClick={() => void updateStatus(post, 'draft')} className='rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 disabled:opacity-50'>Restore to draft</button> : null}
                    {post.status === 'draft' ? <button type='button' disabled={working} onClick={() => void removeDraft(post)} className='rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300 disabled:opacity-50'>Delete</button> : null}
                  </div>
                </div>
              </article>)
                : <p className='rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10'>No official feed posts found.</p>}
          </div>
          <div className='flex items-center justify-between text-sm text-slate-500'>
            <span>{total} posts</span>
            <div className='flex gap-2'>
              <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Previous</button>
              <button disabled={page * pageSize >= total || loading} onClick={() => setPage((value) => value + 1)} className='rounded border px-3 py-1.5 disabled:opacity-40 dark:border-slate-700'>Next</button>
            </div>
          </div>
        </div>

        <form onSubmit={(event) => void save(event)} className='space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900'>
          <div className='flex items-center justify-between gap-2'><h2 className='text-lg font-bold'>{selected ? 'Edit official post' : 'Create draft'}</h2>{selected ? <span className='text-xs font-semibold uppercase text-slate-500'>{selected.status}</span> : null}</div>
          <label className={labelClass}>Title<input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Post text<textarea maxLength={5000} rows={6} value={text} onChange={(event) => setText(event.target.value)} className={inputClass} /></label>
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className={labelClass}>Category<input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Hashtags, comma-separated<input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder='product, updates' className={inputClass} /></label>
          </div>
          <label className={labelClass}>External link<input type='url' value={link} onChange={(event) => setLink(event.target.value)} className={inputClass} /></label>
          <fieldset className='grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700'>
            <legend className='px-1 text-xs font-semibold text-slate-500'>Project link (optional)</legend>
            <label className={labelClass}>Link title<input maxLength={120} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Project URL<input type='url' value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} className={inputClass} /></label>
          </fieldset>
          <fieldset className='grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700'>
            <legend className='px-1 text-xs font-semibold text-slate-500'>Code snippet (optional)</legend>
            <label className={labelClass}>Language<input maxLength={50} value={snippetLanguage} onChange={(event) => setSnippetLanguage(event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Code<textarea maxLength={10000} rows={4} value={snippetCode} onChange={(event) => setSnippetCode(event.target.value)} className={inputClass} /></label>
          </fieldset>
          {selected ? <section className='space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700'>
            <h3 className='text-sm font-semibold'>Images</h3>
            <label className={labelClass}>Image alt text<input maxLength={250} value={imageAltText} onChange={(event) => setImageAltText(event.target.value)} className={inputClass} /></label>
            <input type='file' accept='image/jpeg,image/png,image/webp' disabled={working || selected.images.length >= 6} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.currentTarget.value = '' }} aria-label='Upload post image' className='block w-full text-sm' />
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>{selected.images.map((image) => <div key={image.id ?? image.url} className='relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700'>
              <img src={image.url} alt={image.altText} className='h-24 w-full object-cover' />
              <button type='button' disabled={working || !image.id} onClick={() => void removeImage(image)} className='w-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200 disabled:opacity-50'>Remove image</button>
            </div>)}</div>
          </section> : <p className='rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950'>Save the draft first to attach images.</p>}
          <button disabled={working} className='w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'>{working ? 'Saving…' : selected ? 'Save changes' : 'Save as draft'}</button>
          <aside className='rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900 dark:bg-cyan-950/30'>
            <p className='text-xs font-bold uppercase tracking-wide text-cyan-900 dark:text-cyan-100'>Preview</p>
            {title ? <p className='mt-2 font-semibold'>{title}</p> : null}
            <p className='mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200'>{text || 'Post text preview appears here.'}</p>
            {hashtags ? <p className='mt-2 text-xs text-cyan-800 dark:text-cyan-200'>{hashtags.split(',').map((tag) => `#${tag.trim().replace(/^#/, '')}`).join(' ')}</p> : null}
          </aside>
        </form>
      </div>
    </section>
  )
}
