import { z } from 'zod'
import { feedCodeSnippetSchema, feedProjectLinkSchema } from './feed.js'

export const adminFeedPostStatuses = ['draft', 'published', 'archived'] as const
export type AdminFeedPostStatus = typeof adminFeedPostStatuses[number]

const httpUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}, 'Links must use HTTP or HTTPS.')

export const adminFeedPostFieldsSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  text: z.string().trim().max(5000).default(''),
  category: z.string().trim().max(80).nullable().optional(),
  link: httpUrlSchema.nullable().optional(),
  projectLink: feedProjectLinkSchema.nullable().optional(),
  codeSnippet: feedCodeSnippetSchema.nullable().optional(),
  hashtags: z.array(z.string().trim().regex(/^[\p{L}\p{N}_]{1,50}$/u)).max(30).default([]),
  status: z.enum(adminFeedPostStatuses).default('draft'),
}).strict()

export const adminFeedPostUpdateSchema = adminFeedPostFieldsSchema
  .omit({ status: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one post field to update.')

export function collectFeedPostHashtags(text: string, hashtags: string[]) {
  return [...new Set([...hashtags, ...extractHashtagsFromText(text)].map((tag) => tag.toLowerCase()))].slice(0, 30)
}

function extractHashtagsFromText(text: string) {
  return [...new Set((text.match(/(?:^|\s)#([\p{L}\p{N}_]{1,50})/gu) ?? [])
    .map((match) => match.trim().slice(1).toLowerCase()))]
}

export function hasFeedPostContent(post: {
  title?: string | null
  text?: string | null
  link?: string | null
  projectLink?: { title?: string; url?: string } | null
  codeSnippet?: { code?: string } | null
  images?: unknown[]
}) {
  return Boolean(
    post.title?.trim() ||
    post.text?.trim() ||
    post.link ||
    post.projectLink?.title ||
    post.codeSnippet?.code?.trim() ||
    post.images?.length,
  )
}

export function canTransitionFeedPostStatus(current: AdminFeedPostStatus, next: AdminFeedPostStatus) {
  if (current === next) return false
  if (current === 'archived') return next === 'draft'
  return true
}
