import { useEffect, useState } from 'react'
import type { CodingPlatform, Project, ProjectImage } from '../types'

export type ProfileEditorValue =
  | { kind: 'link'; title: string; url: string }
  | {
      kind: 'project'
      id?: string | null
      title: string
      description: string
      url: string
      repositoryUrl: string | null
      isPublic: boolean
      coverImageFile: File | null
      screenshotFiles: File[]
      removeImageIds: string[]
    }
  | { kind: 'platform'; platform: CodingPlatform['platform']; url: string }
  | { kind: 'avatar'; file: File | null; remove: boolean }

type EditorKind = 'link' | 'project' | 'platform' | 'avatar'

const platformNames: CodingPlatform['platform'][] = [
  'LeetCode',
  'Codeforces',
  'CodeChef',
  'GeeksforGeeks',
  'GitHub',
  'HackerRank',
  'HackerEarth',
]

const profilePatterns: Record<CodingPlatform['platform'], (username: string) => string> = {
  LeetCode: (username) => `https://leetcode.com/u/${encodeURIComponent(username)}/`,
  Codeforces: (username) => `https://codeforces.com/profile/${encodeURIComponent(username)}`,
  CodeChef: (username) => `https://www.codechef.com/users/${encodeURIComponent(username)}`,
  GeeksforGeeks: (username) => `https://www.geeksforgeeks.org/user/${encodeURIComponent(username)}/`,
  GitHub: (username) => `https://github.com/${encodeURIComponent(username)}`,
  HackerRank: (username) => `https://www.hackerrank.com/profile/${encodeURIComponent(username)}`,
  HackerEarth: (username) => `https://www.hackerearth.com/@${encodeURIComponent(username)}/`,
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function normalizePlatformUrl(value: string, platform: CodingPlatform['platform']) {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const username = trimmed.replace(/^@/, '')
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(username)) return ''
  return profilePatterns[platform](username)
}

function validateImageFile(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024
}

export default function ProfileEditorDialog({
  kind,
  initialValue,
  existingPlatforms = [],
  currentAvatar,
  onClose,
  onSave,
}: {
  kind: EditorKind
  initialValue?: { title: string; url: string } | CodingPlatform | Project | { avatar: string | null }
  existingPlatforms?: CodingPlatform[]
  currentAvatar?: string | null
  onClose: () => void
  onSave: (value: ProfileEditorValue) => Promise<void>
}) {
  const initialPlatform =
    initialValue && 'platform' in initialValue
      ? initialValue.platform
      : platformNames.find((name) => !existingPlatforms.some((item) => item.platform === name)) ?? 'LeetCode'
  const [title, setTitle] = useState(initialValue && 'title' in initialValue ? initialValue.title : '')
  const [description, setDescription] = useState(initialValue && 'description' in initialValue ? initialValue.description : '')
  const [url, setUrl] = useState(initialValue && 'url' in initialValue ? initialValue.url : '')
  const [repositoryUrl, setRepositoryUrl] = useState(initialValue && 'repositoryUrl' in initialValue ? initialValue.repositoryUrl ?? '' : '')
  const [platform, setPlatform] = useState<CodingPlatform['platform']>(initialPlatform)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([])
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([])
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [projectIsPublic, setProjectIsPublic] = useState(
    initialValue && 'isPublic' in initialValue ? initialValue.isPublic : false,
  )
  const [coverPreview, setCoverPreview] = useState('')
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const existingProject = kind === 'project' && initialValue && 'description' in initialValue ? initialValue : undefined
  const existingCover: ProjectImage | null = existingProject?.coverImage ?? null
  const existingScreenshots: ProjectImage[] = existingProject?.screenshots ?? []
  const currentScreenshotCount =
    existingScreenshots.filter((image) => !removeImageIds.includes(image.id)).length + screenshotFiles.length

  useEffect(() => {
    const coverUrl = coverImageFile ? URL.createObjectURL(coverImageFile) : ''
    const screenshotUrls = screenshotFiles.map((file) => URL.createObjectURL(file))
    setCoverPreview(coverUrl)
    setScreenshotPreviews(screenshotUrls)

    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl)
      screenshotUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
    }
  }, [coverImageFile, screenshotFiles])

  const titleText = {
    link: initialValue ? 'Edit profile link' : 'Add profile link',
    project: initialValue ? 'Edit project' : 'Add project',
    platform: initialValue ? 'Edit platform' : 'Connect platform',
    avatar: 'Change profile photo',
  }[kind]

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const normalizedUrl = kind === 'platform' ? normalizePlatformUrl(url, platform) : url.trim()
    if (kind === 'link' && (!title.trim() || !isHttpsUrl(normalizedUrl))) {
      setError('Enter a link title and a valid HTTPS URL.')
      return
    }
    if (kind === 'project' && (!title.trim() || !description.trim() || !isHttpsUrl(normalizedUrl))) {
      setError('Enter a project title, description, and valid HTTPS URL.')
      return
    }
    if (kind === 'project' && repositoryUrl.trim() && !isHttpsUrl(repositoryUrl.trim())) {
      setError('Repository URL must be a valid HTTPS URL.')
      return
    }
    if (kind === 'platform' && !isHttpsUrl(normalizedUrl)) {
      setError('Enter a valid profile URL or username.')
      return
    }
    if (kind === 'avatar' && !coverImageFile && !removeAvatar) {
      setError('Select a photo to upload.')
      return
    }
    if (coverImageFile && !validateImageFile(coverImageFile)) {
      setError('Choose a JPEG, PNG, or WebP image no larger than 5 MB.')
      return
    }
    if (screenshotFiles.some((file) => !validateImageFile(file))) {
      setError('Each screenshot must be JPEG, PNG, or WebP and no larger than 5 MB.')
      return
    }
    if (currentScreenshotCount > 5) {
      setError('A project can have no more than five screenshots.')
      return
    }

    let value: ProfileEditorValue
    if (kind === 'link') {
      value = { kind, title: title.trim(), url: normalizedUrl }
    } else if (kind === 'project') {
      value = {
        kind,
        id: existingProject?.id,
        title: title.trim(),
        description: description.trim(),
        url: normalizedUrl,
        repositoryUrl: repositoryUrl.trim() || null,
        isPublic: projectIsPublic,
        coverImageFile,
        screenshotFiles,
        removeImageIds,
      }
    } else if (kind === 'platform') {
      value = { kind, platform, url: normalizedUrl }
    } else {
      value = { kind, file: coverImageFile, remove: removeAvatar }
    }

    try {
      setSaving(true)
      await onSave(value)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const availablePlatforms = platformNames.filter(
    (name) => name === platform || !existingPlatforms.some((item) => item.platform === name),
  )

  const toggleRemoveImage = (imageId: string) => {
    setRemoveImageIds((current) => current.includes(imageId)
      ? current.filter((id) => id !== imageId)
      : [...current, imageId])
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section role='dialog' aria-modal='true' aria-labelledby='profile-editor-title' className='max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl'>
        <div className='mb-6 flex items-start justify-between gap-4'>
          <h2 id='profile-editor-title' className='text-xl font-bold text-slate-900'>{titleText}</h2>
          <button type='button' onClick={onClose} aria-label='Close dialog' className='rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100'>✕</button>
        </div>

        <form className='space-y-4' onSubmit={(event) => void submit(event)}>
          {kind === 'link' || kind === 'project' ? (
            <label className='block text-sm font-medium text-slate-700'>
              {kind === 'link' ? 'Link title' : 'Project title'}
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={kind === 'link' ? 60 : 100} required className='mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100' />
            </label>
          ) : null}

          {kind === 'project' ? (
            <label className='block text-sm font-medium text-slate-700'>
              Short description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} required className='mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100' />
            </label>
          ) : null}

          {kind === 'platform' ? (
            <label className='block text-sm font-medium text-slate-700'>
              Platform
              <select value={platform} onChange={(event) => setPlatform(event.target.value as CodingPlatform['platform'])} className='mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100'>
                {availablePlatforms.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          ) : null}

          {kind === 'link' || kind === 'project' || kind === 'platform' ? (
            <label className='block text-sm font-medium text-slate-700'>
              {kind === 'platform' ? 'Profile URL or username' : 'URL'}
              <input type={kind === 'platform' ? 'text' : 'url'} value={url} onChange={(event) => setUrl(event.target.value)} placeholder={kind === 'platform' ? 'username or https://…' : 'https://…'} required maxLength={2048} className='mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100' />
            </label>
          ) : null}

          {kind === 'project' ? (
            <>
              <label className='flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700'>
                <input type='checkbox' checked={projectIsPublic} onChange={(event) => setProjectIsPublic(event.target.checked)} className='mt-0.5 accent-violet-700' />
                <span><span className='block font-medium'>Show this project publicly</span><span className='mt-0.5 block text-xs text-slate-500'>The project is included only when public projects are enabled in profile visibility.</span></span>
              </label>
              <label className='block text-sm font-medium text-slate-700'>
                Repository URL <span className='font-normal text-slate-400'>(optional)</span>
                <input type='url' value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder='https://github.com/…' maxLength={2048} className='mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100' />
              </label>
              <label className='block text-sm font-medium text-slate-700'>
                Cover image <span className='font-normal text-slate-400'>(optional, max 5 MB)</span>
                <input type='file' accept='image/jpeg,image/png,image/webp' onChange={(event) => setCoverImageFile(event.target.files?.[0] ?? null)} className='mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:font-semibold file:text-violet-700' />
              </label>
              {coverPreview || (existingCover && !removeImageIds.includes(existingCover.id)) ? (
                <div className='relative w-40'>
                  <img src={coverPreview || existingCover?.url} alt='Project cover preview' className='h-24 w-40 rounded-lg border border-slate-200 object-cover' />
                  {existingCover && !coverImageFile ? <button type='button' onClick={() => toggleRemoveImage(existingCover.id)} className='mt-1 text-xs font-medium text-red-700'>Remove current cover</button> : null}
                </div>
              ) : null}
              <div>
                <label className='block text-sm font-medium text-slate-700'>
                  Screenshots <span className='font-normal text-slate-400'>(up to five total, 5 MB each)</span>
                  <input type='file' multiple accept='image/jpeg,image/png,image/webp' disabled={currentScreenshotCount >= 5} onChange={(event) => {
                    const selected = Array.from(event.target.files ?? [])
                    setScreenshotFiles((current) => [...current, ...selected].slice(0, Math.max(0, 5 - existingScreenshots.filter((image) => !removeImageIds.includes(image.id)).length)))
                    event.target.value = ''
                  }} className='mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:font-semibold file:text-violet-700 disabled:opacity-50' />
                </label>
                {(existingScreenshots.length > 0 || screenshotFiles.length > 0) ? (
                  <div className='mt-3 grid grid-cols-3 gap-2'>
                    {existingScreenshots.map((image) => {
                      const removed = removeImageIds.includes(image.id)
                      return (
                        <div key={image.id} className='relative'>
                          <img src={image.url} alt='Saved project screenshot' className={`h-20 w-full rounded-lg border border-slate-200 object-cover ${removed ? 'opacity-30' : ''}`} />
                          <button type='button' onClick={() => toggleRemoveImage(image.id)} className='mt-1 text-xs font-medium text-red-700'>{removed ? 'Keep' : 'Remove'}</button>
                        </div>
                      )
                    })}
                    {screenshotPreviews.map((preview, index) => (
                      <div key={`${preview}-${index}`} className='relative'>
                        <img src={preview} alt={`New screenshot preview ${index + 1}`} className='h-20 w-full rounded-lg border border-slate-200 object-cover' />
                        <button type='button' onClick={() => setScreenshotFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className='mt-1 text-xs font-medium text-red-700'>Remove</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {kind === 'avatar' ? (
            <>
              <label className='block text-sm font-medium text-slate-700'>
                Choose a profile photo <span className='font-normal text-slate-400'>(JPEG, PNG, or WebP; max 5 MB)</span>
                <input type='file' accept='image/jpeg,image/png,image/webp' onChange={(event) => { setCoverImageFile(event.target.files?.[0] ?? null); setRemoveAvatar(false) }} className='mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:font-semibold file:text-violet-700' />
              </label>
              {(coverPreview || (currentAvatar && !removeAvatar)) ? <img src={coverPreview || currentAvatar || ''} alt='Profile photo preview' className='h-24 w-24 rounded-full border border-slate-200 object-cover' /> : null}
              {currentAvatar ? <button type='button' onClick={() => { setRemoveAvatar(true); setCoverImageFile(null) }} className='text-sm font-medium text-red-700'>Remove current photo</button> : null}
            </>
          ) : null}

          {error ? <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700' role='alert'>{error}</p> : null}

          <div className='flex justify-end gap-3 pt-2'>
            <button type='button' onClick={onClose} className='rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'>Cancel</button>
            <button type='submit' disabled={saving} className='rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-60'>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
