const protectedPaths = new Set([
  '/dashboard',
  '/profile',
  '/certifications',
  '/certificates',
  '/my-certificates',
  '/contest',
  '/feed',
  '/earn',
  '/leaderboard',
])

export function getSafeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }

  try {
    const destination = new URL(value, window.location.origin)
    const isAssessmentTest = /^\/certificates\/[a-z0-9-]+\/test$/i.test(destination.pathname)
    const isCertificateDetail = /^\/my-certificates\/[a-z0-9_-]+$/i.test(destination.pathname)
    if (
      destination.origin !== window.location.origin ||
      (!protectedPaths.has(destination.pathname) && !isAssessmentTest && !isCertificateDetail)
    ) {
      return null
    }

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return null
  }
}
