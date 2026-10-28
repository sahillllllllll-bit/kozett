import { z } from 'zod'

export function extractFeedHashtags(text: string) {
  return [...new Set((text.match(/(?:^|\s)#([\p{L}\p{N}_]{1,50})/gu) ?? [])
    .map((match) => match.trim().slice(1).toLowerCase()))].slice(0, 30)
}

export function escapeSearchRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildFeedPostSearchConditions(regex: RegExp) {
  return [
    { text: regex },
    { title: regex },
    { category: regex },
    { hashtags: regex },
    { link: regex },
    { 'projectLink.title': regex },
  ]
}

export function withPublishedFeedPostFilter<T extends Record<string, unknown>>(filter: T) {
  const existingAnd = Array.isArray(filter.$and) ? filter.$and : []
  return {
    ...filter,
    $and: [
      ...existingAnd,
      {
        $or: [
          { publicationStatus: 'published' },
          { publicationStatus: { $exists: false } },
        ],
      },
    ],
  }
}

export const feedProjectLinkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().trim().max(2048).url().refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }, 'Project links must use HTTP or HTTPS.'),
}).strict()

export const feedCodeSnippetSchema = z.object({
  language: z.string().trim().min(1).max(50),
  code: z.string().max(10000).refine((value) => value.trim().length > 0, 'Code snippet cannot be empty.'),
}).strict()

export const feedReportInputSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'misinformation', 'other']),
  details: z.string().trim().max(1000).nullable().optional(),
}).strict()
