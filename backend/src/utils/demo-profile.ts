import type { IDemoProfile } from '../models/User.js'

export function serializeDemoProfile(
  profile?: IDemoProfile,
  visible: { platforms?: boolean; github?: boolean; projects?: boolean; skills?: boolean; certifications?: boolean } = {},
) {
  if (!profile || profile.marker !== 'DEMO DATA') return null

  const platforms = (visible.platforms === false ? [] : profile.platforms ?? []).map((item) => ({
    platform: item.platform,
    username: item.username,
    url: item.url,
    solved: item.solved ?? null,
    rating: item.rating ?? null,
    rank: item.rank ?? null,
    syncedAt: item.syncedAt,
    isDemo: true as const,
  }))
  const reported = platforms.filter((item) => item.solved !== null)
  const totalReportedSolves = reported.reduce((total, item) => total + (item.solved ?? 0), 0)
  const maxSolved = Math.max(0, ...reported.map((item) => item.solved ?? 0))
  const topPlatforms = reported
    .filter((item) => item.solved === maxSolved)
    .map((item) => item.platform)
    .sort()

  return {
    marker: 'DEMO DATA' as const,
    sectionsVisible: {
      platforms: visible.platforms !== false,
      github: visible.github !== false,
      projects: visible.projects !== false,
      skills: visible.skills !== false,
      certifications: visible.certifications !== false,
    },
    totalReportedSolves,
    linkedPlatforms: platforms.length,
    topPlatform: topPlatforms.length > 1 ? `Tie: ${topPlatforms.join(', ')}` : topPlatforms[0] ?? null,
    lastSyncedAt: platforms.reduce<Date | null>(
      (latest, item) => !latest || item.syncedAt > latest ? item.syncedAt : latest,
      null,
    ),
    platforms,
    github: visible.github === false ? null : {
      username: profile.github.username,
      publicRepos: profile.github.publicRepos,
      followers: profile.github.followers,
      following: profile.github.following,
      contributions: profile.github.contributions,
      repositories: profile.github.repositories.map(({ name, language, stars }) => ({ name, language, stars })),
      syncedAt: profile.github.syncedAt,
      isDemo: true as const,
    },
    projects: visible.projects === false ? [] : profile.projects.map((project) => ({
      title: project.title,
      category: project.category,
      description: project.description,
      technologies: [...project.technologies],
      featured: project.featured,
      demoUrl: project.demoUrl,
      repositoryUrl: project.repositoryUrl,
      isDemo: true as const,
    })),
    skills: visible.skills === false ? [] : profile.skills.map((skill) => ({
      name: skill.name,
      level: skill.level,
      stars: skill.isVerified && skill.isDemo ? skill.stars : null,
      assessmentScore: skill.assessmentScore,
      isVerified: skill.isVerified && skill.isDemo,
      isDemo: true as const,
    })),
    certifications: visible.certifications === false ? [] : profile.certifications.map((certificate) => ({
      name: certificate.name,
      issuer: certificate.issuer,
      skill: certificate.skill,
      score: certificate.score,
      credentialId: certificate.credentialId,
      isVerified: false as const,
      isDemo: true as const,
    })),
  }
}
