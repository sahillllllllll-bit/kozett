import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
  FRONTEND_ORIGIN: z.string().trim().min(1, 'FRONTEND_ORIGIN is required'),
  SESSION_COOKIE_NAME: z.string().trim().min(1).default('kozett_session'),
  SESSION_SECRET: z.string().trim().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(30),
  CSRF_COOKIE_NAME: z.string().trim().min(1).default('kozett_csrf'),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
  ASSESSMENT_EXCELLENT_MIN: z.coerce.number().min(0).max(100).default(85),
  ASSESSMENT_INTERMEDIATE_MIN: z.coerce.number().min(0).max(100).default(60),
  ASSESSMENT_BEGINNER_MIN: z.coerce.number().min(0).max(100).default(40),
  KDR_MIN_DATA_COVERAGE: z.coerce.number().gt(0).max(1).default(0.6),
  KDR_PROBLEM_VOLUME_NORMALIZER: z.coerce.number().positive().default(300),
  EARN_MIN_WITHDRAWAL_PAISE: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).default(10000),
  EARN_DAILY_CHECK_IN_ENABLED: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  PASSWORD_RESET_DEV_OTP_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DEMO_ACCOUNT_PASSWORD: z.string().min(12).optional(),
  INITIAL_ADMIN_EMAIL: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().trim().email().optional(),
  ),
  INITIAL_ADMIN_PASSWORD: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().min(12).optional(),
  ),
})

const result = envSchema.superRefine((value, context) => {
  const cloudinaryValues = [
    value.CLOUDINARY_CLOUD_NAME,
    value.CLOUDINARY_API_KEY,
    value.CLOUDINARY_API_SECRET,
  ]
  const configuredCount = cloudinaryValues.filter(Boolean).length

  if (configuredCount > 0 && configuredCount < cloudinaryValues.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLOUDINARY_CLOUD_NAME'],
      message: 'Set all Cloudinary variables together, or leave all three unset.',
    })
  }
  if (
    value.ASSESSMENT_EXCELLENT_MIN <= value.ASSESSMENT_INTERMEDIATE_MIN ||
    value.ASSESSMENT_INTERMEDIATE_MIN <= value.ASSESSMENT_BEGINNER_MIN
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ASSESSMENT_EXCELLENT_MIN'],
      message: 'Assessment score thresholds must descend from excellent to beginner.',
    })
  }
  if (Boolean(value.INITIAL_ADMIN_EMAIL) !== Boolean(value.INITIAL_ADMIN_PASSWORD)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INITIAL_ADMIN_PASSWORD'],
      message: 'Set both initial admin bootstrap variables, or leave both unset.',
    })
  }
  if (value.PASSWORD_RESET_DEV_OTP_ENABLED) {
    let frontendUrl: URL | null = null
    try {
      frontendUrl = new URL(value.FRONTEND_ORIGIN)
    } catch {
      // FRONTEND_ORIGIN is validated as a non-empty string above.
    }
    if (value.NODE_ENV !== 'development') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PASSWORD_RESET_DEV_OTP_ENABLED'],
        message: 'Development OTP display is allowed only with NODE_ENV=development.',
      })
    }
    if (!frontendUrl || frontendUrl.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(frontendUrl.hostname)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PASSWORD_RESET_DEV_OTP_ENABLED'],
        message: 'Development OTP display requires FRONTEND_ORIGIN to use a loopback HTTP address.',
      })
    }
  }
}).safeParse(process.env)

if (!result.success) {
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  throw new Error(
    `Backend environment configuration is invalid:\n${problems}\n` +
      'Create backend\\.env from backend\\.env.example and set the required values.',
  )
}

export const env = result.data
