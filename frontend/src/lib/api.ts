import type {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentSummary,
  AuthResponse,
  DashboardProfile,
  DeveloperRating,
  EarnedCertificate,
  Project,
  PublicProfile,
  User,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
let csrfToken: string | null = null

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function buildUrl(path: string) {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown, headers?: Record<string, string>) {
  const url = buildUrl(path)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
  }

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body)
  }

  if (method !== 'GET') {
    if (!csrfToken) {
      const csrfResponse = await fetch(buildUrl('/auth/csrf'), {
        method: 'GET',
        credentials: 'include',
      })
      const csrfPayload = (await csrfResponse.json().catch(() => ({}))) as {
        csrfToken?: string
      }

      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error('Unable to initialize secure request. Please try again.')
      }

      csrfToken = csrfPayload.csrfToken
    }

    options.headers = {
      ...(options.headers ?? {}),
      'X-CSRF-Token': csrfToken,
    }
  }

  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : 'Request failed.'
    throw new ApiError(message, response.status)
  }

  return payload as T
}

type AssessmentPayload = {
  slug: string
  title: string
  technology?: string
  category: string
  difficulty?: string
  description: string
  introduction?: string
  topics?: string[]
  questionCount: number
  timeLimitMinutes?: number
  durationSeconds?: number
  maxAttempts?: number
  passingScore: number
  certificateAvailable?: boolean
}

type QuestionPayload = {
  questionId: string
  prompt: string
  topic?: string
  difficulty?: string
  options: Array<{ id: string; text: string }>
}

type CertificatePayload = {
  certificateId: string
  title: string
  assessmentName: string
  technology: string
  category: string
  issuer: string
  recipientName: string
  score: number
  issuedAt: string
  verificationUrl?: string
  verificationPath?: string
}

export type ContestApiRecord = {
  id: string
  externalContestId: string
  title: string
  platform: string
  startTime: string
  endTime: string
  durationSeconds: number
  status: 'upcoming' | 'ongoing' | 'finished'
  contestUrl: string
  registrationUrl: string | null
  source: string
  lastSyncedAt: string
}

export type ContestListResponse = {
  success: boolean
  contests: ContestApiRecord[]
  page: number
  limit: number
  total: number
  totalPages: number
  lastSyncedAt: string | null
  sources: {
    codeforces: {
      status: 'available' | 'stale' | 'unavailable'
      lastSyncedAt: string | null
    }
  }
}

export type ContestPerformanceResponse = {
  success: boolean
  platforms: Array<{
    platform: string
    contestCount: number
    currentRating: number
    highestRating: number
    totalRatingChange: number
    bestRank: number
  }>
  combined: {
    contestCount: number
    platformCount: number
  }
  source: 'codeforces-api' | 'none'
}

export type ContestRatingsResponse = {
  success: boolean
  ratings: Array<{
    externalContestId: string
    contestName: string
    rank: number
    oldRating: number
    newRating: number
    ratingChange: number
    ratingUpdateTime: string
    source: string
  }>
  platform: string
  lastSyncedAt: string | null
}

export type UserContestApiRecord = ContestApiRecord & {
  bookmarkId: string
  participationStatus: 'planned' | 'registered' | 'participated' | 'missed' | null
  personalNote: string | null
  bookmarked: boolean
}

function toDifficulty(value: string | undefined) {
  switch (value?.toLocaleLowerCase()) {
    case 'beginner': return 'Beginner' as const
    case 'advanced': return 'Advanced' as const
    default: return 'Intermediate' as const
  }
}

function normalizeAssessment(assessment: AssessmentPayload) {
  const durationSeconds = assessment.durationSeconds ?? (assessment.timeLimitMinutes ?? 0) * 60
  return {
    id: assessment.slug,
    slug: assessment.slug,
    title: assessment.title,
    technology: assessment.technology ?? assessment.title,
    category: assessment.category,
    difficulty: toDifficulty(assessment.difficulty),
    description: assessment.description,
    introduction: assessment.introduction ?? assessment.description,
    topics: assessment.topics ?? [],
    questionCount: assessment.questionCount,
    timeLimitMinutes: assessment.timeLimitMinutes ?? Math.ceil(durationSeconds / 60),
    durationSeconds,
    maxAttempts: assessment.maxAttempts ?? 1,
    passingScore: assessment.passingScore,
    certificateAvailable: assessment.certificateAvailable ?? true,
  }
}

function normalizeCertificate(certificate: CertificatePayload) {
  return {
    id: certificate.certificateId,
    certificateId: certificate.certificateId,
    title: certificate.title,
    assessmentName: certificate.assessmentName,
    technology: certificate.technology,
    category: certificate.category,
    issuer: certificate.issuer,
    recipientName: certificate.recipientName,
    score: certificate.score,
    issuedAt: certificate.issuedAt,
    verificationUrl: certificate.verificationUrl ?? certificate.verificationPath ?? '',
  }
}

export const api = {
  get<T>(path: string) {
    return request<T>(path, 'GET')
  },
  post<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return request<T>(path, 'POST', body, headers)
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, 'PUT', body)
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, 'PATCH', body)
  },
  del<T>(path: string) {
    return request<T>(path, 'DELETE')
  },
  getCsrfToken() {
    return request<{ success: boolean; csrfToken: string }>('/auth/csrf', 'GET').then((response) => {
      csrfToken = response.csrfToken
      return response
    })
  },
  setCsrfToken(token: string) {
    csrfToken = token
  },
  me() {
    return request<{ success: boolean; user: User }>('/auth/me', 'GET')
  },
  publicUser(username: string) {
    return request<{ success: boolean; user: PublicProfile }>(
      `/users/public/${encodeURIComponent(username)}`,
      'GET',
    )
  },
  dashboardProfile() {
    return request<{ success: boolean; profile: DashboardProfile }>('/users/me/profile', 'GET')
  },
  assessments() {
    return request<{ success: boolean; assessments: AssessmentPayload[] }>('/assessments', 'GET')
      .then((response) => ({ ...response, assessments: response.assessments.map(normalizeAssessment) }))
  },
  assessment(slug: string) {
    return request<{ success: boolean; assessment: AssessmentPayload }>('/assessments/' + encodeURIComponent(slug), 'GET')
      .then((response) => ({ ...response, assessment: normalizeAssessment(response.assessment) }))
  },
  async startAssessment(slug: string) {
    const assessmentResponse = await request<{ success: boolean; assessment: AssessmentPayload }>(
      '/assessments/' + encodeURIComponent(slug),
      'GET',
    )
    const attemptResponse = await request<{
      success: boolean
      attempt: {
        attemptId: string
        startedAt: string
        expiresAt: string
      }
    }>('/assessments/' + encodeURIComponent(slug) + '/start', 'POST', {})
    return {
      success: attemptResponse.success,
      attempt: {
        id: attemptResponse.attempt.attemptId,
        assessment: normalizeAssessment(assessmentResponse.assessment),
        startedAt: attemptResponse.attempt.startedAt,
        endsAt: attemptResponse.attempt.expiresAt,
        questions: [],
      } satisfies AssessmentAttempt,
    }
  },
  assessmentQuestions(attemptId: string) {
    return request<{ success: boolean; questions: QuestionPayload[] }>(
      '/assessments/attempts/' + encodeURIComponent(attemptId) + '/questions',
      'GET',
    ).then((response) => ({
      ...response,
      questions: response.questions.map((question) => ({
        id: question.questionId,
        text: question.prompt,
        options: question.options,
        topic: question.topic ?? 'Assessment question',
        difficulty: toDifficulty(question.difficulty),
      })),
    }))
  },
  submitAssessment(attemptId: string, answers: Record<string, string>) {
    return request<{
      success: boolean
      result: {
        attemptId: string
        assessment: AssessmentPayload
        score: number
        passed: boolean
        totalQuestions: number
        correctCount: number
        submittedAt: string
        certificateId: string | null
      }
    }>(
      '/assessments/attempts/' + encodeURIComponent(attemptId) + '/submit',
      'POST',
      { answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId })) },
    ).then((response) => ({
      success: response.success,
      result: {
        id: response.result.attemptId,
        assessment: normalizeAssessment(response.result.assessment),
        score: response.result.score,
        passed: response.result.passed,
        totalQuestions: response.result.totalQuestions,
        correctAnswers: response.result.correctCount,
        submittedAt: response.result.submittedAt,
        certificateId: response.result.certificateId,
      } satisfies AssessmentResult,
    }))
  },
  assessmentResult(attemptId: string) {
    return request<{
      success: boolean
      result: {
        attemptId: string
        assessment: AssessmentPayload
        score: number
        passed: boolean
        totalQuestions: number
        correctCount: number
        submittedAt: string
        certificateId: string | null
      }
    }>(
      '/assessments/results/' + encodeURIComponent(attemptId),
      'GET',
    ).then((response) => ({
      success: response.success,
      result: {
        id: response.result.attemptId,
        assessment: normalizeAssessment(response.result.assessment),
        score: response.result.score,
        passed: response.result.passed,
        totalQuestions: response.result.totalQuestions,
        correctAnswers: response.result.correctCount,
        submittedAt: response.result.submittedAt,
        certificateId: response.result.certificateId,
      } satisfies AssessmentResult,
    }))
  },
  myCertificates() {
    return request<{ success: boolean; certificates: CertificatePayload[] }>('/certificates/me', 'GET')
      .then((response) => ({ ...response, certificates: response.certificates.map(normalizeCertificate) }))
  },
  myDeveloperRating() {
    return request<{ success: boolean; rating: DeveloperRating | null }>('/users/me/kdr', 'GET')
  },
  recalculateDeveloperRating() {
    return request<{ success: boolean; rating: DeveloperRating | null }>('/users/me/kdr/recalculate', 'POST', {})
  },
  developerRatingHistory() {
    return request<{ success: boolean; snapshots: DeveloperRating[] }>('/users/me/kdr/history', 'GET')
  },
  myCertificate(certificateId: string) {
    return request<{ success: boolean; certificate: CertificatePayload }>(
      '/certificates/me/' + encodeURIComponent(certificateId),
      'GET',
    ).then((response) => ({ ...response, certificate: normalizeCertificate(response.certificate) }))
  },
  verifyCertificate(certificateId: string) {
    return request<{ success: boolean; verified: boolean; certificate?: CertificatePayload }>(
      '/certificates/verify/' + encodeURIComponent(certificateId),
      'GET',
    ).then((response) => ({
      success: response.success,
      valid: response.verified,
      certificate: response.certificate ? normalizeCertificate(response.certificate) : undefined,
    })).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return { success: true, valid: false, certificate: undefined }
      }
      throw error
    })
  },
  contests(params: URLSearchParams) {
    return request<ContestListResponse>(`/contests?${params.toString()}`, 'GET')
  },
  contestDetails(contestId: string) {
    return request<{ success: boolean; contest: Record<string, unknown> }>(
      `/contests/${encodeURIComponent(contestId)}`,
      'GET',
    )
  },
  contestPerformance() {
    return request<ContestPerformanceResponse>('/contests/performance', 'GET')
  },
  contestRatings(platform: string) {
    return request<ContestRatingsResponse>(`/contests/ratings?platform=${encodeURIComponent(platform)}`, 'GET')
  },
  myContests() {
    return request<{ success: boolean; contests: UserContestApiRecord[] }>('/contests/my-contests', 'GET')
  },
  bookmarkContest(contestId: string) {
    return request<{ success: boolean; saved: boolean; userContest?: UserContestApiRecord }>(
      `/contests/${encodeURIComponent(contestId)}/bookmark`,
      'POST',
      {},
    )
  },
  removeContestBookmark(contestId: string) {
    return request<{ success: boolean; saved: boolean }>(
      `/contests/${encodeURIComponent(contestId)}/bookmark`,
      'DELETE',
    )
  },
  updateContestParticipation(contestId: string, status: string, personalNote?: string) {
    return request<{ success: boolean; userContest: UserContestApiRecord }>(
      `/contests/${encodeURIComponent(contestId)}/participation`,
      'PATCH',
      { status, ...(personalNote ? { personalNote } : {}) },
    )
  },
  updateDashboardProfile(profile: DashboardProfile) {
    return request<{ success: boolean; profile: DashboardProfile }>('/users/me/profile', 'PUT', {
      avatar: profile.avatar,
      profileLinks: profile.profileLinks,
      projects: profile.projects.map(({ id, title, description, url, repositoryUrl, isPublic }) => ({
        ...(id ? { id } : {}),
        title,
        description,
        url,
        repositoryUrl,
        isPublic,
      })),
      platforms: profile.platforms,
      visibility: profile.visibility,
    })
  },
  publicDeveloperRating(username: string) {
    return request<{ success: boolean; rating: DeveloperRating | null }>(
      `/users/public/${encodeURIComponent(username)}/kdr`,
      'GET',
    )
  },
  uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append('avatar', file)
    return request<{ success: boolean; avatar: string }>('/users/me/avatar', 'POST', formData)
  },
  deleteAvatar() {
    return request<{ success: boolean; avatar: null }>('/users/me/avatar', 'DELETE')
  },
  uploadProjectImages(projectId: string, cover: File | null, screenshots: File[]) {
    const formData = new FormData()
    if (cover) formData.append('cover', cover)
    screenshots.forEach((file) => formData.append('screenshots', file))
    return request<{ success: boolean; project: Project }>('/users/me/projects/' + encodeURIComponent(projectId) + '/images', 'POST', formData)
  },
  deleteProjectImage(projectId: string, imageId: string) {
    return request<{ success: boolean }>(
      `/users/me/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(imageId)}`,
      'DELETE',
    )
  },
}

export function isAuthResponse(payload: unknown): payload is AuthResponse {
  return Boolean((payload as { success?: boolean })?.success)
}
