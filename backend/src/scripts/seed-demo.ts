import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase, closeDatabase } from '../config/database.js'
import { env } from '../config/env.js'
import { User, type IDemoPlatformStat, type IDemoProfile } from '../models/User.js'
import { DeveloperRating } from '../models/DeveloperRating.js'
import { DeveloperRatingSnapshot } from '../models/DeveloperRatingSnapshot.js'
import { assessmentRating } from '../utils/assessment-rating.js'
import { createDemoDeveloperRating } from '../utils/demo-developer-rating.js'

const username = 'sahilx1'
const seedKey = 'kozett-demo-sahilx1-v1'
const removeOnly = process.argv.includes('--remove')
const verifyOnly = process.argv.includes('--verify')
const syncedAt = new Date()

const platformStats: IDemoPlatformStat[] = [
  { platform: 'LeetCode', username: 'demo-sahilx1', url: 'https://leetcode.com/u/demo-sahilx1/', solved: 420, rating: 1680, rank: 'Demo: Guardian', syncedAt, isDemo: true },
  { platform: 'Codeforces', username: 'demo-sahilx1', url: 'https://codeforces.com/profile/demo-sahilx1', solved: 318, rating: 1420, rank: 'Demo: Specialist', syncedAt, isDemo: true },
  { platform: 'CodeChef', username: 'demo-sahilx1', url: 'https://www.codechef.com/users/demo-sahilx1', solved: 146, rating: 1580, rank: 'Demo: 3 Star', syncedAt, isDemo: true },
  { platform: 'GeeksforGeeks', username: 'demo-sahilx1', url: 'https://www.geeksforgeeks.org/user/demo-sahilx1/', solved: 210, rating: null, rank: null, syncedAt, isDemo: true },
  { platform: 'HackerRank', username: 'demo-sahilx1', url: 'https://www.hackerrank.com/profile/demo-sahilx1', solved: 74, rating: null, rank: 'Demo: Gold', syncedAt, isDemo: true },
  { platform: 'HackerEarth', username: 'demo-sahilx1', url: 'https://www.hackerearth.com/@demo-sahilx1/', solved: 56, rating: null, rank: null, syncedAt, isDemo: true },
]

function assessedSkill(name: string, score: number | null): IDemoProfile['skills'][number] {
  const rating = assessmentRating(score, {
    excellent: env.ASSESSMENT_EXCELLENT_MIN,
    intermediate: env.ASSESSMENT_INTERMEDIATE_MIN,
    beginner: env.ASSESSMENT_BEGINNER_MIN,
  })
  return { name, assessmentScore: score, ...rating, isDemo: true }
}

const demoProfile: IDemoProfile = {
  marker: 'DEMO DATA',
  platforms: platformStats,
  github: {
    username: 'demo-sahilx1',
    publicRepos: 18,
    followers: 42,
    following: 35,
    contributions: 286,
    repositories: [
      { name: 'kozett-demo', language: 'TypeScript', stars: 24 },
      { name: 'eventglow-demo', language: 'JavaScript', stars: 17 },
      { name: 'ai-code-analyzer-demo', language: 'TypeScript', stars: 11 },
    ],
    syncedAt,
    isDemo: true,
  },
  projects: [
    { title: 'Kozett', category: 'Developer Platform', description: 'A developer profile platform for showcasing coding progress, projects, GitHub statistics, and verified skills.', technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express', 'MongoDB'], featured: true, demoUrl: null, repositoryUrl: null, isDemo: true },
    { title: 'EventGlow', category: 'Event Management', description: 'An event management platform with registration pages, ticketing, QR check-in, and event analytics.', technologies: ['React', 'Node.js', 'MongoDB', 'Razorpay'], featured: true, demoUrl: null, repositoryUrl: null, isDemo: true },
    { title: 'AI Code Analyzer', category: 'Developer Tools', description: 'A demo concept for analyzing code repositories and presenting code-quality insights.', technologies: ['TypeScript', 'Node.js', 'GitHub API'], featured: true, demoUrl: null, repositoryUrl: null, isDemo: true },
  ],
  skills: [
    assessedSkill('C++', 91),
    assessedSkill('Data Structures and Algorithms', 72),
    assessedSkill('JavaScript', 48),
    assessedSkill('TypeScript', null),
    assessedSkill('React', null),
    assessedSkill('Node.js', null),
    assessedSkill('MongoDB', null),
    assessedSkill('Git and GitHub', null),
  ],
  certifications: [
    { name: 'C++ Fundamentals (Demo)', issuer: 'Kozett Demo Assessment', skill: 'C++', score: 91, credentialId: 'DEMO-SKILL-CPP-001', isVerified: false, isDemo: true },
    { name: 'Data Structures Assessment (Demo)', issuer: 'Kozett Demo Assessment', skill: 'Data Structures and Algorithms', score: 72, credentialId: 'DEMO-SKILL-DSA-002', isVerified: false, isDemo: true },
    { name: 'JavaScript Foundations (Demo)', issuer: 'Kozett Demo Assessment', skill: 'JavaScript', score: 48, credentialId: 'DEMO-SKILL-JS-003', isVerified: false, isDemo: true },
  ],
}

async function seedDemoRating(userId: mongoose.Types.ObjectId) {
  const rating = createDemoDeveloperRating(new Date())
  await DeveloperRating.findOneAndUpdate(
    { userId },
    { $set: { userId, ...rating } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  )
  await DeveloperRatingSnapshot.updateOne(
    { userId, snapshotHash: rating.snapshotHash },
    { $setOnInsert: { userId, ...rating } },
    { upsert: true, runValidators: true },
  )
}

async function run() {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('Demo seeding requires NODE_ENV=development or NODE_ENV=test.')
  }

  await connectDatabase()
  const existing = await User.findOne({ username }).select('+demoSeedKey')

  if (removeOnly) {
    if (!existing) {
      console.log('No sahilx1 account found; nothing to remove.')
      return
    }
    if (existing.demoSeedKey !== seedKey) {
      throw new Error('Refusing cleanup: sahilx1 is not marked as this Kozett demo account.')
    }
    await User.deleteOne({ _id: existing._id, demoSeedKey: seedKey })
    console.log('Removed the dedicated sahilx1 demo account and its demo data.')
    return
  }

  if (verifyOnly) {
    if (!existing || existing.demoSeedKey !== seedKey || !existing.demoProfile) {
      throw new Error('The dedicated sahilx1 demo profile was not found.')
    }
    const actualTotal = existing.demoProfile.platforms.reduce(
      (total, platform) => total + (platform.solved ?? 0),
      0,
    )
    const topPlatform = existing.demoProfile.platforms
      .filter((platform) => platform.solved !== null)
      .sort((left, right) => (right.solved ?? 0) - (left.solved ?? 0))[0]
    const ratings = existing.demoProfile.skills.map((skill) => skill.stars)
    const seededRating = await DeveloperRating.findOne({ userId: existing._id }).lean()

    if (
      existing.demoProfile.projects.length !== 3 ||
      actualTotal !== 1224 ||
      topPlatform?.platform !== 'LeetCode' ||
      !ratings.includes(3) ||
      !ratings.includes(2) ||
      !ratings.includes(1) ||
      !ratings.includes(null) ||
      seededRating?.dataStatus !== 'demo' ||
      seededRating.score !== 75 ||
      seededRating.rank !== 'Silver' ||
      seededRating.isProvisional !== false ||
      seededRating.algorithmVersion !== createDemoDeveloperRating().algorithmVersion ||
      seededRating.components.some((component) => !component.available || component.score === null)
    ) {
      throw new Error('Demo profile verification failed.')
    }
    console.log('Verified sahilx1: 6 platform samples, 1,224 reported solves, 3 demo projects, demo KDR 75/Silver, and all rating states.')
    return
  }

  if (existing && existing.demoSeedKey !== seedKey) {
    throw new Error('Username sahilx1 already exists and is not marked as this demo account. No data was changed.')
  }

  if (existing) {
    existing.name = 'Sahil Singh'
    existing.bio = 'Computer Science student building products, solving coding challenges, and exploring full-stack development.'
    existing.demoProfile = demoProfile
    if (env.DEMO_ACCOUNT_PASSWORD) {
      existing.passwordHash = await bcrypt.hash(env.DEMO_ACCOUNT_PASSWORD, 12)
    }
    existing.visibility = {
      publicProfile: true,
      avatar: false,
      bio: true,
      platforms: true,
      github: true,
      links: false,
      projects: true,
      skills: true,
      certifications: true,
      kdr: true,
    }
    await existing.save()
    if (!existing.demoProfile || existing.demoProfile.marker !== 'DEMO DATA') {
      throw new Error('Refusing to seed KDR: sahilx1 is not a verified demo profile.')
    }
    await seedDemoRating(existing._id)
    console.log('Updated the existing dedicated sahilx1 demo profile (idempotent).')
    return
  }

  const passwordHash = await bcrypt.hash(
    env.DEMO_ACCOUNT_PASSWORD ?? randomBytes(48).toString('hex'),
    12,
  )
  const created = await User.create({
    name: 'Sahil Singh',
    username,
    email: 'sahilx1-demo@demo.invalid',
    passwordHash,
    bio: 'Computer Science student building products, solving coding challenges, and exploring full-stack development.',
    demoSeedKey: seedKey,
    demoProfile,
    visibility: {
      publicProfile: true,
      avatar: false,
      bio: true,
      platforms: true,
      github: true,
      links: false,
      projects: true,
      skills: true,
      certifications: true,
      kdr: true,
    },
  })
  if (created.demoSeedKey !== seedKey || created.demoProfile?.marker !== 'DEMO DATA') {
    throw new Error('Refusing to seed KDR: the newly created account is not a verified demo profile.')
  }
  await seedDemoRating(created._id)
  console.log('Created the dedicated sahilx1 demo account with a randomly generated, undisclosed credential hash.')
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo seed operation failed.')
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabase()
    await mongoose.disconnect()
  })
