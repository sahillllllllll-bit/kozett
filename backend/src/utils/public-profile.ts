import type { IDemoProfile } from '../models/User.js'
import { serializeDemoProfile } from './demo-profile.js'
import type { RatingPayload } from '../services/developer-rating.service.js'

type PublicProfileSource = {
  name: string
  username: string
  avatar?: string | null
  bio?: string | null
  visibility?: {
    avatar?: boolean
    bio?: boolean
    links?: boolean
    platforms?: boolean
    github?: boolean
    projects?: boolean
    skills?: boolean
    certifications?: boolean
    kdr?: boolean
  }
  profileLinks?: Array<{ title: string; url: string }>
  platforms?: Array<{ platform: string; url: string }>
  projects?: Array<{
    title: string
    description: string
    url: string
    repositoryUrl?: string | null
    isPublic?: boolean
    coverImage?: { url: string } | null
    screenshots?: Array<{ url: string }>
  }>
  demoProfile?: IDemoProfile
  rating?: RatingPayload | null
}

export function serializePublicProfile(user: PublicProfileSource) {
  return {
    name: user.name,
    username: user.username,
    avatar: user.visibility?.avatar ? user.avatar ?? null : null,
    bio: user.visibility?.bio ? user.bio ?? null : null,
    profileLinks: user.visibility?.links
      ? (user.profileLinks ?? []).map(({ title, url }) => ({ title, url }))
      : [],
    platforms: user.visibility?.platforms
      ? (user.platforms ?? []).map(({ platform, url }) => ({ platform, url }))
      : [],
    projects: user.visibility?.projects
      ? (user.projects ?? [])
          .filter((project) => project.isPublic === true)
          .map((project) => ({
            title: project.title,
            description: project.description,
            url: project.url,
            repositoryUrl: project.repositoryUrl ?? null,
            coverImage: project.coverImage?.url ?? null,
            screenshots: (project.screenshots ?? []).map(({ url }) => url),
          }))
      : [],
    demoData: user.demoProfile
      ? serializeDemoProfile(user.demoProfile, {
          platforms: user.visibility?.platforms === true,
          github: user.visibility?.github === true,
          projects: user.visibility?.projects === true,
          skills: user.visibility?.skills === true,
          certifications: user.visibility?.certifications === true,
        })
      : null,
    rating: user.visibility?.kdr === true ? user.rating ?? null : null,
  }
}
