import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/error.middleware.js'
import { User, type IDemoProfile, type IUserImage } from '../models/User.js'
import { cleanupCloudinaryImages, uploadImage } from '../services/cloudinary.service.js'
import { sanitizeUser } from '../utils/security.js'
import { serializePublicProfile } from '../utils/public-profile.js'
import { serializeDemoProfile } from '../utils/demo-profile.js'
import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { DeveloperRating } from '../models/DeveloperRating.js'
import {
  getDeveloperRating,
  getDeveloperRatingHistory,
  recalculateDeveloperRating,
  serializeDeveloperRating,
} from '../services/developer-rating.service.js'

const publicUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/i)

const httpsUrl = z.string().trim().url().max(2048).refine((value) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}, 'URL must use HTTPS.')

const profileLinkSchema = z.object({
  title: z.string().trim().min(1).max(60),
  url: httpsUrl,
}).strict()

const projectSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  url: httpsUrl,
  repositoryUrl: httpsUrl.optional().or(z.literal('')),
  isPublic: z.boolean(),
}).strict()

const platformNames = ['LeetCode', 'Codeforces', 'CodeChef', 'GeeksforGeeks', 'HackerRank', 'HackerEarth', 'GitHub'] as const
const platformSchema = z.object({
  platform: z.enum(platformNames),
  url: httpsUrl,
}).strict().superRefine((value, context) => {
  const hostname = new URL(value.url).hostname.toLowerCase()
  const acceptedDomains: Record<(typeof platformNames)[number], string[]> = {
    LeetCode: ['leetcode.com'],
    Codeforces: ['codeforces.com'],
    CodeChef: ['codechef.com'],
    GeeksforGeeks: ['geeksforgeeks.org'],
    HackerRank: ['hackerrank.com'],
    HackerEarth: ['hackerearth.com'],
    GitHub: ['github.com'],
  }
  const validDomain = acceptedDomains[value.platform].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  )

  if (!validDomain) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: `URL must belong to ${value.platform}.`,
    })
  }
})

const dashboardProfileSchema = z.object({
  avatar: httpsUrl.nullable(),
  profileLinks: z.array(profileLinkSchema).max(20),
  projects: z.array(projectSchema).max(30),
  platforms: z.array(platformSchema).max(platformNames.length),
  visibility: z.object({
    publicProfile: z.boolean(),
    avatar: z.boolean(),
    bio: z.boolean(),
    platforms: z.boolean(),
    github: z.boolean(),
    links: z.boolean(),
    projects: z.boolean(),
    skills: z.boolean(),
    certifications: z.boolean(),
    kdr: z.boolean(),
  }).strict(),
}).strict().superRefine((value, context) => {
  const platforms = value.platforms.map(({ platform }) => platform)
  if (new Set(platforms).size !== platforms.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['platforms'],
      message: 'Each coding platform can only be connected once.',
    })
  }
})

const dashboardProfileSelect = [
  'avatar',
  'profileLinks',
  'platforms',
  'projects._id',
  'projects.title',
  'projects.description',
  'projects.url',
  'projects.repositoryUrl',
  'projects.isPublic',
  'projects.coverImage._id',
  'projects.coverImage.url',
  'projects.screenshots._id',
  'projects.screenshots.url',
  '+projects.coverImage.publicId',
  '+projects.screenshots.publicId',
  'visibility',
  'demoProfile',
].join(' ')

function serializeDashboardProfile(profile: {
  avatar?: string | null
  profileLinks?: Array<{ title: string; url: string }>
  projects?: Array<{
    _id?: unknown
    title: string
    description: string
    url: string
    repositoryUrl?: string | null
    isPublic?: boolean
    coverImage?: (IUserImage & { _id?: unknown }) | null
    screenshots?: Array<IUserImage & { _id?: unknown }>
  }>
  platforms?: Array<{ platform: string; url: string }>
  visibility?: {
    publicProfile?: boolean
    avatar?: boolean
    bio?: boolean
    platforms?: boolean
    github?: boolean
    links?: boolean
    projects?: boolean
    skills?: boolean
    certifications?: boolean
    kdr?: boolean
  }
  demoProfile?: IDemoProfile
}) {
  return {
    avatar: profile.avatar ?? null,
    profileLinks: (profile.profileLinks ?? []).map(({ title, url }) => ({ title, url })),
    projects: (profile.projects ?? []).map((project) => ({
      id: project._id ? String(project._id) : null,
      title: project.title,
      description: project.description,
      url: project.url,
      repositoryUrl: project.repositoryUrl ?? null,
      isPublic: project.isPublic ?? false,
      coverImage: project.coverImage
        ? { id: String(project.coverImage._id), url: project.coverImage.url }
        : null,
      screenshots: (project.screenshots ?? []).map((image) => ({
        id: String(image._id),
        url: image.url,
      })),
    })),
    platforms: (profile.platforms ?? []).map(({ platform, url }) => ({ platform, url })),
    visibility: {
      publicProfile: profile.visibility?.publicProfile ?? true,
      avatar: profile.visibility?.avatar ?? false,
      bio: profile.visibility?.bio ?? false,
      platforms: profile.visibility?.platforms ?? false,
      github: profile.visibility?.github ?? false,
      links: profile.visibility?.links ?? false,
      projects: profile.visibility?.projects ?? false,
      skills: profile.visibility?.skills ?? false,
      certifications: profile.visibility?.certifications ?? false,
      kdr: profile.visibility?.kdr ?? false,
    },
    demoData: serializeDemoProfile(profile.demoProfile),
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' })
  }

  return res.json({ success: true, user: sanitizeUser(req.user) })
}

export async function getDashboardProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401)
    }

    const user = await User.findById(req.user._id)
      .select(dashboardProfileSelect)
      .lean()

    if (!user) {
      throw new AppError('User profile was not found.', 404)
    }

    return res.json({
      success: true,
      profile: serializeDashboardProfile(user),
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateDashboardProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401)
    }

    const parsed = dashboardProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid profile information.', 400)
    }

    const user = await User.findById(req.user._id).select(dashboardProfileSelect)
    if (!user) {
      throw new AppError('User profile was not found.', 404)
    }

    if (parsed.data.avatar !== (user.avatar ?? null)) {
      throw new AppError('Profile photos must be changed through the secure upload flow.', 400)
    }

    const submittedIds = parsed.data.projects.flatMap((project) => project.id ? [project.id] : [])
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new AppError('A project was submitted more than once.', 400)
    }

    const currentProjects = user.projects ?? []
    const currentProjectIds = new Set(currentProjects.map((project) => String(project._id)))
    if (submittedIds.some((id) => !mongoose.isValidObjectId(id) || !currentProjectIds.has(id))) {
      throw new AppError('One or more projects are invalid.', 400)
    }

    const removedAssets = currentProjects
      .filter((project) => !submittedIds.includes(String(project._id)))
      .flatMap((project) => [
        ...(project.coverImage?.publicId ? [project.coverImage.publicId] : []),
        ...(project.screenshots ?? []).map((image) => image.publicId),
      ])

    const retainedProjects = parsed.data.projects.map((submitted) => {
      const existing = submitted.id
        ? currentProjects.find((project) => String(project._id) === submitted.id)
        : undefined

      if (existing) {
        existing.title = submitted.title
        existing.description = submitted.description
        existing.url = submitted.url
        existing.repositoryUrl = submitted.repositoryUrl || null
        existing.isPublic = submitted.isPublic
        return existing
      }

      return {
        title: submitted.title,
        description: submitted.description,
        url: submitted.url,
        repositoryUrl: submitted.repositoryUrl || null,
        coverImage: null,
        screenshots: [],
      }
    })

    user.profileLinks = parsed.data.profileLinks
    user.projects = retainedProjects
    user.platforms = parsed.data.platforms
    user.visibility = parsed.data.visibility
    await user.save()
    await cleanupCloudinaryImages(removedAssets)

    return res.json({
      success: true,
      profile: serializeDashboardProfile(user),
    })
  } catch (error) {
    return next(error)
  }
}

function readUploadedImages(req: Request) {
  const files = req.files as
    | { cover?: Express.Multer.File[]; screenshots?: Express.Multer.File[] }
    | undefined

  return {
    cover: files?.cover?.[0],
    screenshots: files?.screenshots ?? [],
  }
}

async function uploadAndTrack(
  file: Express.Multer.File,
  folder: string,
  transformation: { width: number; height: number; crop: 'limit'; quality: 'auto'; fetch_format: 'auto' },
  uploaded: string[],
) {
  const image = await uploadImage(file.buffer, folder, transformation)
  uploaded.push(image.publicId)
  return image
}

export async function uploadUserAvatar(req: Request, res: Response, next: NextFunction) {
  const file = req.file
  if (!file) {
    return next(new AppError('Select an avatar image to upload.', 400))
  }

  let uploadedPublicId: string | undefined
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    const image = await uploadImage(file.buffer, 'kozett/avatars', {
      width: 512,
      height: 512,
      crop: 'limit',
      quality: 'auto',
      fetch_format: 'auto',
    })
    uploadedPublicId = image.publicId

    const user = await User.findById(req.user._id).select('+avatarPublicId')
    if (!user) throw new AppError('User profile was not found.', 404)

    const oldPublicId = user.avatarPublicId
    user.avatar = image.url
    user.avatarPublicId = image.publicId
    await user.save()
    if (oldPublicId) await cleanupCloudinaryImages([oldPublicId])

    return res.json({ success: true, avatar: image.url })
  } catch (error) {
    if (uploadedPublicId) await cleanupCloudinaryImages([uploadedPublicId])
    if (error instanceof AppError) return next(error)
    console.error('Avatar upload failed.')
    return next(new AppError('Unable to upload the profile photo. Please try again.', 502))
  }
}

export async function deleteUserAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    const user = await User.findById(req.user._id).select('+avatarPublicId')
    if (!user) throw new AppError('User profile was not found.', 404)

    const oldPublicId = user.avatarPublicId
    user.avatar = null
    user.avatarPublicId = null
    await user.save()
    if (oldPublicId) await cleanupCloudinaryImages([oldPublicId])

    return res.json({ success: true, avatar: null })
  } catch (error) {
    return next(error)
  }
}

export async function uploadProjectImages(req: Request, res: Response, next: NextFunction) {
  const { cover, screenshots } = readUploadedImages(req)
  if (!cover && screenshots.length === 0) {
    return next(new AppError('Select a cover image or at least one screenshot.', 400))
  }

  const uploadedPublicIds: string[] = []
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      throw new AppError('Project not found.', 404)
    }

    const user = await User.findById(req.user._id).select(dashboardProfileSelect)
    if (!user) throw new AppError('User profile was not found.', 404)

    const project = (user.projects ?? []).find((item) => String(item._id) === req.params.projectId)
    if (!project) throw new AppError('Project not found.', 404)

    const currentScreenshots = project.screenshots ?? []
    if (currentScreenshots.length + screenshots.length > 5) {
      throw new AppError('A project can have no more than five screenshots.', 400)
    }

    const oldCoverPublicId = cover ? project.coverImage?.publicId : undefined
    const newCover = cover
      ? await uploadAndTrack(cover, 'kozett/projects', {
          width: 1600,
          height: 1200,
          crop: 'limit',
          quality: 'auto',
          fetch_format: 'auto',
        }, uploadedPublicIds)
      : undefined
    const newScreenshots = []
    for (const file of screenshots) {
      newScreenshots.push(await uploadAndTrack(file, 'kozett/projects', {
        width: 1600,
        height: 1200,
        crop: 'limit',
        quality: 'auto',
        fetch_format: 'auto',
      }, uploadedPublicIds))
    }

    try {
      if (newCover) project.coverImage = newCover
      project.screenshots = [...currentScreenshots, ...newScreenshots]
      await user.save()
    } catch (error) {
      throw error
    }

    if (oldCoverPublicId) await cleanupCloudinaryImages([oldCoverPublicId])

    return res.json({
      success: true,
      project: serializeDashboardProfile(user).projects.find((item) => item.id === req.params.projectId),
    })
  } catch (error) {
    if (uploadedPublicIds.length) await cleanupCloudinaryImages(uploadedPublicIds)
    if (error instanceof AppError) return next(error)
    console.error('Project image upload failed.')
    return next(new AppError('Unable to upload project images. Please try again.', 502))
  }
}

export async function deleteProjectImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      throw new AppError('Project not found.', 404)
    }

    const user = await User.findById(req.user._id).select(dashboardProfileSelect)
    if (!user) throw new AppError('User profile was not found.', 404)

    const project = (user.projects ?? []).find((item) => String(item._id) === req.params.projectId)
    if (!project) throw new AppError('Project not found.', 404)

    const cover = project.coverImage
    if (cover && String(cover._id) === req.params.imageId) {
      const oldPublicId = cover.publicId
      project.coverImage = null
      await user.save()
      await cleanupCloudinaryImages([oldPublicId])
      return res.json({ success: true })
    }

    const screenshots = project.screenshots ?? []
    const screenshotIndex = screenshots.findIndex((image) => String(image._id) === req.params.imageId)
    if (screenshotIndex < 0) {
      return res.json({ success: true })
    }

    const [removed] = screenshots.splice(screenshotIndex, 1)
    project.screenshots = screenshots
    await user.save()
    await cleanupCloudinaryImages([removed.publicId])

    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
}

export async function getPublicUser(req: Request, res: Response, next: NextFunction) {
  try {
    const parsedUsername = publicUsernameSchema.safeParse(req.params.username)

    if (!parsedUsername.success) {
      throw new AppError('Profile not found.', 404)
    }

    const user = await User.findOne({
      username: parsedUsername.data.toLowerCase(),
      'visibility.publicProfile': { $ne: false },
    })
      .select({
        _id: 1,
        name: 1,
        username: 1,
        avatar: 1,
        bio: 1,
        visibility: 1,
        profileLinks: 1,
        platforms: 1,
        'projects._id': 1,
        'projects.title': 1,
        'projects.description': 1,
        'projects.url': 1,
        'projects.repositoryUrl': 1,
        'projects.isPublic': 1,
        'projects.coverImage.url': 1,
        'projects.screenshots.url': 1,
        demoProfile: 1,
      })
      .lean()

    const username = user?.username
    if (!user || !username) {
      throw new AppError('Profile not found.', 404)
    }

    const cachedRating = user.visibility?.kdr === true
      ? await DeveloperRating.findOne({ userId: user._id }).lean()
      : null
    const rating = cachedRating?.dataStatus === 'demo' && env.NODE_ENV === 'production'
      ? null
      : serializeDeveloperRating(cachedRating)

    return res.json({
      success: true,
      user: serializePublicProfile({ ...user, username, rating }),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getMyDeveloperRating(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    const rating = await getDeveloperRating(String(req.user._id))
    return res.json({ success: true, rating })
  } catch (error) {
    return next(error)
  }
}

export async function recalculateMyDeveloperRating(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    const rating = await recalculateDeveloperRating(String(req.user._id))
    return res.json({ success: true, rating })
  } catch (error) {
    return next(error)
  }
}

export async function getMyDeveloperRatingHistory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401)
    const snapshots = await getDeveloperRatingHistory(String(req.user._id))
    return res.json({ success: true, snapshots })
  } catch (error) {
    return next(error)
  }
}

export async function getPublicDeveloperRating(req: Request, res: Response, next: NextFunction) {
  try {
    const parsedUsername = publicUsernameSchema.safeParse(req.params.username)
    if (!parsedUsername.success) throw new AppError('Profile not found.', 404)
    const user = await User.findOne({
      username: parsedUsername.data.toLowerCase(),
      'visibility.publicProfile': { $ne: false },
    }).select('_id visibility.kdr').lean()
    if (!user) throw new AppError('Profile not found.', 404)
    const cachedRating = user.visibility?.kdr === true
      ? await DeveloperRating.findOne({ userId: user._id }).lean()
      : null
    const rating = cachedRating?.dataStatus === 'demo' && env.NODE_ENV === 'production'
      ? null
      : serializeDeveloperRating(cachedRating)
    return res.json({ success: true, rating })
  } catch (error) {
    return next(error)
  }
}
