import { Schema, model, Types } from 'mongoose'

export interface IUserImage {
  _id?: Types.ObjectId
  url: string
  publicId: string
}

export interface IUserProject {
  _id?: Types.ObjectId
  title: string
  description: string
  url: string
  repositoryUrl?: string | null
  isPublic?: boolean
  coverImage?: IUserImage | null
  screenshots?: IUserImage[]
}

export interface IUserProfileVisibility {
  publicProfile: boolean
  avatar: boolean
  bio: boolean
  platforms: boolean
  github: boolean
  links: boolean
  projects: boolean
  skills: boolean
  certifications: boolean
  kdr: boolean
}

export type AdminRole = 'superadmin' | 'admin' | 'finance_admin' | 'moderator'
export type UserAccountStatus = 'active' | 'suspended'

export interface IUserAdminAccess {
  role: AdminRole
  active: boolean
  mustChangePassword: boolean
}

export interface IDemoPlatformStat {
  platform: string
  username: string
  url: string
  solved: number | null
  rating: number | null
  rank: string | null
  syncedAt: Date
  isDemo: true
}

export interface IDemoProfile {
  marker: string
  platforms: IDemoPlatformStat[]
  github: {
    username: string
    publicRepos: number
    followers: number
    following: number
    contributions: number
    repositories: Array<{ name: string; language: string; stars: number }>
    syncedAt: Date
    isDemo: true
  }
  projects: Array<{
    title: string
    category: string
    description: string
    technologies: string[]
    featured: boolean
    demoUrl: string | null
    repositoryUrl: string | null
    isDemo: true
  }>
  skills: Array<{
    name: string
    level: 'Excellent' | 'Intermediate' | 'Beginner' | null
    stars: 1 | 2 | 3 | null
    assessmentScore: number | null
    isVerified: boolean
    isDemo: true
  }>
  certifications: Array<{
    name: string
    issuer: string
    skill: string
    score: number | null
    credentialId: string
    isVerified: false
    isDemo: true
  }>
}

export interface IUser {
  name: string
  username?: string
  email: string
  passwordHash: string
  avatar?: string | null
  avatarPublicId?: string | null
  bio?: string | null
  emailVerifiedAt?: Date | null
  accountStatus?: UserAccountStatus
  suspendedAt?: Date | null
  suspensionReason?: string | null
  adminAccess?: IUserAdminAccess | null
  profileLinks?: Array<{ title: string; url: string }>
  projects?: IUserProject[]
  platforms?: Array<{ platform: string; url: string }>
  visibility?: IUserProfileVisibility
  demoSeedKey?: string
  demoProfile?: IDemoProfile
  createdAt?: Date
  updatedAt?: Date
}

const demoProfileSchema = new Schema<IDemoProfile>(
  {
    marker: { type: String, required: true },
    platforms: [{
      platform: { type: String, required: true },
      username: { type: String, required: true },
      url: { type: String, required: true },
      solved: { type: Number, default: null },
      rating: { type: Number, default: null },
      rank: { type: String, default: null },
      syncedAt: { type: Date, required: true },
      isDemo: { type: Boolean, required: true, default: true },
    }],
    github: {
      username: { type: String, required: true },
      publicRepos: { type: Number, required: true },
      followers: { type: Number, required: true },
      following: { type: Number, required: true },
      contributions: { type: Number, required: true },
      repositories: [{
        name: { type: String, required: true },
        language: { type: String, required: true },
        stars: { type: Number, required: true },
      }],
      syncedAt: { type: Date, required: true },
      isDemo: { type: Boolean, required: true, default: true },
    },
    projects: [{
      title: { type: String, required: true },
      category: { type: String, required: true },
      description: { type: String, required: true },
      technologies: [{ type: String }],
      featured: { type: Boolean, required: true },
      demoUrl: { type: String, default: null },
      repositoryUrl: { type: String, default: null },
      isDemo: { type: Boolean, required: true, default: true },
    }],
    skills: [{
      name: { type: String, required: true },
      level: { type: String, enum: ['Excellent', 'Intermediate', 'Beginner', null], default: null },
      stars: { type: Number, min: 1, max: 3, default: null },
      assessmentScore: { type: Number, min: 0, max: 100, default: null },
      isVerified: { type: Boolean, required: true },
      isDemo: { type: Boolean, required: true, default: true },
    }],
    certifications: [{
      name: { type: String, required: true },
      issuer: { type: String, required: true },
      skill: { type: String, required: true },
      score: { type: Number, default: null },
      credentialId: { type: String, required: true },
      isVerified: { type: Boolean, required: true, default: false },
      isDemo: { type: Boolean, required: true, default: true },
    }],
  },
  { _id: false },
)

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, required: false, trim: true, lowercase: true, unique: true, sparse: true, maxlength: 30 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: null },
    avatarPublicId: { type: String, default: null, select: false },
    bio: { type: String, default: null, maxlength: 500 },
    emailVerifiedAt: { type: Date, default: null },
    accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: null, maxlength: 500 },
    adminAccess: {
      type: new Schema<IUserAdminAccess>(
        {
          role: { type: String, enum: ['superadmin', 'admin', 'finance_admin', 'moderator'], required: true },
          active: { type: Boolean, required: true, default: true },
          mustChangePassword: { type: Boolean, required: true, default: false },
        },
        { _id: false },
      ),
      default: null,
    },
    profileLinks: {
      type: [
        new Schema(
          {
            title: { type: String, required: true, trim: true, maxlength: 60 },
            url: { type: String, required: true, trim: true, maxlength: 2048 },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    projects: {
      type: [
        new Schema(
          {
            title: { type: String, required: true, trim: true, maxlength: 100 },
            description: { type: String, required: true, trim: true, maxlength: 500 },
            url: { type: String, required: true, trim: true, maxlength: 2048 },
            repositoryUrl: { type: String, trim: true, maxlength: 2048, default: null },
            isPublic: { type: Boolean, default: false },
            coverImage: {
              type: new Schema(
                {
                  url: { type: String, required: true },
                  publicId: { type: String, required: true, select: false },
                },
                { _id: true },
              ),
              default: null,
            },
            screenshots: {
              type: [
                new Schema(
                  {
                    url: { type: String, required: true },
                    publicId: { type: String, required: true, select: false },
                  },
                  { _id: true },
                ),
              ],
              default: [],
            },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    platforms: {
      type: [
        new Schema(
          {
            platform: { type: String, required: true, enum: ['LeetCode', 'Codeforces', 'CodeChef', 'GeeksforGeeks', 'HackerRank', 'HackerEarth', 'GitHub'] },
            url: { type: String, required: true, trim: true, maxlength: 2048 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    visibility: {
      publicProfile: { type: Boolean, default: true },
      avatar: { type: Boolean, default: false },
      bio: { type: Boolean, default: false },
      platforms: { type: Boolean, default: false },
      github: { type: Boolean, default: false },
      links: { type: Boolean, default: false },
      projects: { type: Boolean, default: false },
      skills: { type: Boolean, default: false },
      certifications: { type: Boolean, default: false },
      kdr: { type: Boolean, default: false },
    },
    demoSeedKey: { type: String, select: false },
    demoProfile: { type: demoProfileSchema, default: undefined },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', userSchema)
