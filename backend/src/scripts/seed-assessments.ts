import { connectDatabase, closeDatabase } from '../config/database.js'
import { assessmentCatalog } from '../data/assessment-catalog.js'
import { Assessment } from '../models/Assessment.js'
import { AssessmentQuestion } from '../models/AssessmentQuestion.js'

async function seedAssessmentBanks() {
  await connectDatabase()
  let totalQuestions = 0

  for (const entry of assessmentCatalog) {
    const assessment = await Assessment.findOneAndUpdate(
      { slug: entry.slug },
      {
        $set: {
          title: entry.title,
          technology: entry.technology,
          difficulty: entry.difficulty,
          topics: entry.topics,
          certificateAvailable: entry.certificateAvailable,
          category: entry.category,
          description: entry.description,
          introduction: entry.introduction,
          durationSeconds: entry.durationSeconds,
          passingScore: entry.passingScore,
          maxAttempts: entry.maxAttempts,
          questionCount: entry.questions.length,
          isActive: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    const promptSet = entry.questions.map((question) => question.prompt)
    const operations = entry.questions.map((question, order) => ({
      updateOne: {
        filter: { assessment: assessment._id, prompt: question.prompt },
        update: {
          $set: {
            options: question.options,
            topic: question.topic,
            difficulty: question.difficulty,
            correctOptionId: question.correctOptionId,
            explanation: question.explanation,
            order,
          },
        },
        upsert: true,
      },
    }))
    if (operations.length) {
      await AssessmentQuestion.bulkWrite(operations)
    }
    await AssessmentQuestion.deleteMany({
      assessment: assessment._id,
      prompt: { $nin: promptSet },
    })
    totalQuestions += entry.questions.length
  }

  console.log(`Seeded ${assessmentCatalog.length} assessment banks with ${totalQuestions} questions.`)
}

seedAssessmentBanks()
  .catch((error) => {
    console.error('Unable to seed assessment banks.')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabase()
  })
