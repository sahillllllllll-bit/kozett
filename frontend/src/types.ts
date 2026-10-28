export type User = {
  id: string
  name: string
  username: string | null
  email: string
  avatar: string | null
  bio: string | null
  createdAt: string | null
  updatedAt: string | null
  emailVerifiedAt: string | null
}

export type AuthResponse = {
  success: boolean
  user: User
  message?: string
  csrfToken?: string
}

export type ProfileLink = {
  title: string
  url: string
}

export type Project = {
  id: string | null
  title: string
  description: string
  url: string
  repositoryUrl: string | null
  isPublic: boolean
  coverImage: ProjectImage | null
  screenshots: ProjectImage[]
}

export type ProjectImage = {
  id: string
  url: string
}

export type DemoProfileData = {
  marker: 'DEMO DATA'
  sectionsVisible: {
    platforms: boolean
    github: boolean
    projects: boolean
    skills: boolean
    certifications: boolean
  }
  totalReportedSolves: number
  linkedPlatforms: number
  topPlatform: string | null
  lastSyncedAt: string | null
  platforms: Array<{
    platform: string
    username: string
    url: string
    solved: number | null
    rating: number | null
    rank: string | null
    syncedAt: string
    isDemo: true
  }>
  github: {
    username: string
    publicRepos: number
    followers: number
    following: number
    contributions: number
    repositories: Array<{ name: string; language: string; stars: number }>
    syncedAt: string
    isDemo: true
  } | null
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
    level: string | null
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

export type AssessmentDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type AssessmentSummary = {
  id: string
  slug: string
  title: string
  technology: string
  category: string
  difficulty: AssessmentDifficulty
  description: string
  introduction: string
  topics: string[]
  questionCount: number
  timeLimitMinutes: number
  durationSeconds: number
  maxAttempts: number
  passingScore: number
  certificateAvailable: boolean
}

export type AssessmentQuestion = {
  id: string
  text: string
  options: Array<{ id: string; text: string }>
  topic: string
  difficulty?: AssessmentDifficulty
}

export type AssessmentAttempt = {
  id: string
  assessment: AssessmentSummary
  startedAt: string
  endsAt: string
  questions: AssessmentQuestion[]
}

export type AssessmentResult = {
  id: string
  assessment: AssessmentSummary
  score: number
  passed: boolean
  totalQuestions: number
  correctAnswers: number
  submittedAt: string
  certificateId: string | null
}

export type EarnedCertificate = {
  id: string
  certificateId: string
  title: string
  assessmentName: string
  technology: string
  category: string
  issuer: string
  recipientName: string
  score: number
  issuedAt: string
  verificationUrl: string
}

export type CodingPlatform = {
  platform: 'LeetCode' | 'Codeforces' | 'CodeChef' | 'GeeksforGeeks' | 'HackerRank' | 'HackerEarth' | 'GitHub'
  url: string
}

export type DashboardProfile = {
  avatar: string | null
  profileLinks: ProfileLink[]
  projects: Project[]
  platforms: CodingPlatform[]
  visibility: {
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
  demoData: DemoProfileData | null
}

export type DeveloperRating = {
  dataStatus: 'calculated' | 'demo'
  score: number | null
  rank: 'Silver' | 'Gold' | 'Platinum' | null
  components: Array<{
    key: 'problemSolving' | 'consistency' | 'openSource' | 'projects' | 'verifiedSkills'
    label: string
    weight: number
    score: number | null
    available: boolean
  }>
  dataCoverage: number
  isProvisional: boolean
  algorithmVersion: string
  calculatedAt: string
}

export type PublicProfile = {
  name: string
  username: string
  avatar: string | null
  bio: string | null
  profileLinks: ProfileLink[]
  platforms: CodingPlatform[]
  projects: Array<{
    title: string
    description: string
    url: string
    repositoryUrl: string | null
    coverImage: string | null
    screenshots: string[]
  }>
  demoData: DemoProfileData | null
  rating: DeveloperRating | null
}
