import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { Assessment } from '../models/Assessment.js'
import { AssessmentAttempt } from '../models/AssessmentAttempt.js'
import { AssessmentQuestion } from '../models/AssessmentQuestion.js'
import { Certificate } from '../models/Certificate.js'
import { AppError } from '../middleware/error.middleware.js'
import { isAttemptExpired, scoreAssessment } from '../utils/assessment.js'
import { recalculateDeveloperRating } from '../services/developer-rating.service.js'

const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().regex(/^[a-f\d]{24}$/i),
    selectedOptionId: z.string().trim().min(1).max(20),
  }).strict()).max(100),
}).strict()

function userId(req: Request) {
  return String(req.user!._id)
}

function serializeAssessment(assessment: {
  slug: string
  title: string
  technology: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  topics: string[]
  certificateAvailable: boolean
  category: string
  description: string
  introduction: string
  durationSeconds: number
  passingScore: number
  maxAttempts: number
  questionCount: number
}) {
  return {
    slug: assessment.slug,
    title: assessment.title,
    technology: assessment.technology,
    difficulty: assessment.difficulty,
    topics: assessment.topics,
    timeLimitMinutes: assessment.durationSeconds / 60,
    certificateAvailable: assessment.certificateAvailable,
    category: assessment.category,
    description: assessment.description,
    introduction: assessment.introduction,
    durationSeconds: assessment.durationSeconds,
    passingScore: assessment.passingScore,
    maxAttempts: assessment.maxAttempts,
    questionCount: assessment.questionCount,
  }
}

async function getOwnedAttempt(req: Request) {
  const attemptId = req.params.attemptId
  if (!mongoose.isValidObjectId(attemptId)) {
    throw new AppError('Assessment attempt was not found.', 404)
  }
  const attempt = await AssessmentAttempt.findOne({ _id: attemptId, user: userId(req) })
  if (!attempt) {
    throw new AppError('Assessment attempt was not found.', 404)
  }
  return attempt
}

async function resultPayload(attemptId: string) {
  const attempt = await AssessmentAttempt.findById(attemptId)
    .populate('assessment', 'slug title technology difficulty topics category description introduction durationSeconds passingScore maxAttempts questionCount certificateAvailable')
  if (!attempt || attempt.status !== 'submitted' || !attempt.assessment) {
    throw new AppError('Assessment result was not found.', 404)
  }
  const assessment = attempt.assessment as unknown as {
    slug: string
    title: string
    technology: string
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
    topics: string[]
    category: string
    description: string
    introduction: string
    durationSeconds: number
    passingScore: number
    maxAttempts: number
    questionCount: number
    certificateAvailable: boolean
  }
  const questions = await AssessmentQuestion.find({ _id: { $in: attempt.questionIds } }).select('+correctOptionId +explanation')
  const questionsById = new Map(questions.map((question) => [String(question._id), question]))
  const answerById = new Map((attempt.answers ?? []).map((answer) => [String(answer.questionId), answer]))
  const review = attempt.questionIds.map((questionId) => {
    const question = questionsById.get(String(questionId))
    const answer = answerById.get(String(questionId))
    return question
      ? {
          questionId: String(question._id),
          prompt: question.prompt,
          options: question.options.map((option) => ({ id: option.id, text: option.text })),
          selectedOptionId: answer?.selectedOptionId ?? null,
          correctOptionId: question.correctOptionId,
          isCorrect: answer?.isCorrect ?? false,
          explanation: question.explanation,
        }
      : null
  }).filter((item) => item !== null)

  return {
    attemptId: String(attempt._id),
    assessment: {
      slug: assessment.slug,
      title: assessment.title,
      technology: assessment.technology,
      difficulty: assessment.difficulty,
      topics: assessment.topics,
      timeLimitMinutes: assessment.durationSeconds / 60,
      certificateAvailable: assessment.certificateAvailable,
      category: assessment.category,
      description: assessment.description,
      introduction: assessment.introduction,
      durationSeconds: assessment.durationSeconds,
      passingScore: assessment.passingScore,
      maxAttempts: assessment.maxAttempts,
      questionCount: assessment.questionCount,
    },
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.questionIds.length,
    passed: attempt.passed,
    certificateId: attempt.certificate ? String(attempt.certificate) : null,
    review,
  }
}

export async function listAssessments(_req: Request, res: Response, next: NextFunction) {
  try {
    const assessments = await Assessment.find({ isActive: true }).sort({ title: 1 }).lean()
    return res.json({ success: true, assessments: assessments.map(serializeAssessment) })
  } catch (error) {
    return next(error)
  }
}

export async function getAssessmentIntroduction(req: Request, res: Response, next: NextFunction) {
  try {
    const assessment = await Assessment.findOne({ slug: req.params.slug, isActive: true }).lean()
    if (!assessment) throw new AppError('Assessment was not found.', 404)
    return res.json({ success: true, assessment: serializeAssessment(assessment) })
  } catch (error) {
    return next(error)
  }
}

export async function startAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const assessment = await Assessment.findOne({ slug: req.params.slug, isActive: true })
    if (!assessment) throw new AppError('Assessment was not found.', 404)
    const owner = userId(req)

    const activeAttempt = await AssessmentAttempt.findOne({
      user: owner,
      assessment: assessment._id,
      status: 'in_progress',
    })
    if (activeAttempt && isAttemptExpired(activeAttempt.expiresAt)) {
      activeAttempt.status = 'expired'
      await activeAttempt.save()
    } else if (activeAttempt) {
      throw new AppError('You already have an active attempt for this assessment.', 409)
    }

    const attemptCount = await AssessmentAttempt.countDocuments({ user: owner, assessment: assessment._id })
    if (attemptCount >= assessment.maxAttempts) {
      throw new AppError('You have reached the attempt limit for this assessment.', 403)
    }
    const questions = await AssessmentQuestion.find({ assessment: assessment._id }).sort({ order: 1 }).select('_id')
    if (questions.length === 0 || questions.length !== assessment.questionCount) {
      throw new AppError('This assessment is not ready yet.', 503)
    }
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + assessment.durationSeconds * 1000)
    let attempt
    try {
      attempt = await AssessmentAttempt.create({
        user: owner,
        assessment: assessment._id,
        questionIds: questions.map((question) => question._id),
        startedAt,
        expiresAt,
        status: 'in_progress',
      })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new AppError('You already have an active attempt for this assessment.', 409)
      }
      throw error
    }

    return res.status(201).json({
      success: true,
      attempt: {
        attemptId: String(attempt._id),
        assessmentSlug: assessment.slug,
        status: attempt.status,
        startedAt,
        expiresAt,
        durationSeconds: assessment.durationSeconds,
        questionCount: questions.length,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getAttemptQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const attempt = await getOwnedAttempt(req)
    if (attempt.status !== 'in_progress') {
      throw new AppError('This assessment attempt is no longer active.', 409)
    }
    if (isAttemptExpired(attempt.expiresAt)) {
      attempt.status = 'expired'
      await attempt.save()
      throw new AppError('The assessment time limit has expired.', 410)
    }
    const questions = await AssessmentQuestion.find({ _id: { $in: attempt.questionIds } })
      .sort({ order: 1 })
      .select('prompt options topic difficulty order')
      .lean()
    return res.json({
      success: true,
      attempt: {
        attemptId: String(attempt._id),
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        serverTime: new Date(),
      },
      questions: questions.map((question) => ({
        questionId: String(question._id),
        prompt: question.prompt,
        topic: question.topic,
        difficulty: question.difficulty,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function submitAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = submitSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('Submit one valid answer for each assessment question.', 400)

    const attempt = await getOwnedAttempt(req)
    if (attempt.status === 'submitted') {
      return res.json({ success: true, result: await resultPayload(String(attempt._id)) })
    }
    if (attempt.status !== 'in_progress') {
      throw new AppError('This assessment attempt is no longer active.', 409)
    }
    const timedOut = isAttemptExpired(attempt.expiresAt)

    const assessment = await Assessment.findById(attempt.assessment)
    if (!assessment || !assessment.isActive) throw new AppError('Assessment was not found.', 404)
    const questions = await AssessmentQuestion.find({ _id: { $in: attempt.questionIds } })
      .select('+correctOptionId')
    let scored
    try {
      scored = scoreAssessment(
        questions.map((question) => ({
          id: String(question._id),
          correctOptionId: question.correctOptionId,
          optionIds: question.options.map((option) => option.id),
        })),
        parsed.data.answers,
        assessment.passingScore,
        timedOut,
      )
    } catch {
      throw new AppError(
        timedOut
          ? 'Answers must reference attempt questions and valid options.'
          : 'Answer every assessment question once and use a valid option before submitting.',
        400,
      )
    }

    attempt.status = 'submitted'
    attempt.submittedAt = new Date()
    attempt.score = scored.score
    attempt.correctCount = scored.correctCount
    attempt.passed = scored.passed
    attempt.answers = scored.answers.map((answer) => ({
      questionId: new mongoose.Types.ObjectId(answer.questionId),
      selectedOptionId: answer.selectedOptionId,
      isCorrect: answer.isCorrect,
    }))

    if (scored.passed && assessment.certificateAvailable) {
      const certificate = await Certificate.create({
        certificateId: randomUUID(),
        user: attempt.user,
        assessment: assessment._id,
        attempt: attempt._id,
        score: scored.score,
        issuedAt: attempt.submittedAt,
      })
      attempt.certificate = certificate._id
    }
    await attempt.save()
    try {
      await recalculateDeveloperRating(attempt.user)
    } catch (ratingError) {
      console.error('KDR recalculation failed after assessment submission:', ratingError)
    }
    return res.json({ success: true, result: await resultPayload(String(attempt._id)) })
  } catch (error) {
    return next(error)
  }
}

export async function getAssessmentResult(req: Request, res: Response, next: NextFunction) {
  try {
    const attempt = await getOwnedAttempt(req)
    if (attempt.status !== 'submitted') throw new AppError('Assessment result is not available yet.', 409)
    return res.json({ success: true, result: await resultPayload(String(attempt._id)) })
  } catch (error) {
    return next(error)
  }
}

function serializeCertificate(
  certificate: { certificateId: string; score: number; issuedAt: Date; revokedAt?: Date | null; revocationReason?: string | null },
  assessment: { title: string; technology: string; category: string },
  recipientName: string,
) {
  const verificationUrl = `/api/certificates/verify/${certificate.certificateId}`
  return {
    certificateId: certificate.certificateId,
    assessmentName: assessment.title,
    technology: assessment.technology,
    category: assessment.category,
    title: assessment.title,
    issuer: 'Kozett Certification Academy',
    recipientName,
    score: certificate.score,
    issuedAt: certificate.issuedAt,
    verified: !certificate.revokedAt,
    revokedAt: certificate.revokedAt ?? null,
    verificationUrl,
    verificationPath: verificationUrl,
  }
}

export async function listMyCertificates(req: Request, res: Response, next: NextFunction) {
  try {
    const certificates = await Certificate.find({ user: userId(req) })
      .sort({ issuedAt: -1 })
      .populate('assessment', 'title technology category')
      .populate('user', 'name')
    return res.json({
      success: true,
      certificates: certificates.map((certificate) => {
        const assessment = certificate.assessment as unknown as { title: string; technology: string; category: string }
        const recipient = certificate.user as unknown as { name: string }
        return serializeCertificate(certificate, assessment, recipient.name)
      }),
    })
  } catch (error) {
    return next(error)
  }
}

export async function getMyCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId, user: userId(req) })
      .populate('assessment', 'title technology category')
      .populate('user', 'name')
    if (!certificate) throw new AppError('Certificate was not found.', 404)
    const assessment = certificate.assessment as unknown as { title: string; technology: string; category: string }
    const recipient = certificate.user as unknown as { name: string }
    return res.json({ success: true, certificate: serializeCertificate(certificate, assessment, recipient.name) })
  } catch (error) {
    return next(error)
  }
}

export async function verifyCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId })
      .populate('assessment', 'title technology category')
      .populate('user', 'name')
    if (!certificate) throw new AppError('Certificate was not found.', 404)
    const assessment = certificate.assessment as unknown as { title: string; technology: string; category: string }
    const recipient = certificate.user as unknown as { name: string }
    return res.json({
      success: true,
      verified: !certificate.revokedAt,
      certificate: serializeCertificate(certificate, assessment, recipient.name),
    })
  } catch (error) {
    return next(error)
  }
}
