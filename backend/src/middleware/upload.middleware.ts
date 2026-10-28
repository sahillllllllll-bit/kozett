import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppError } from './error.middleware.js'

const allowedImageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export async function detectSupportedImageMime(buffer: Buffer) {
  const detectedType = await fileTypeFromBuffer(buffer)
  return detectedType && allowedImageTypes.has(detectedType.mime) ? detectedType.mime : null
}

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
    fields: 0,
    parts: 6,
  },
})

function handleUpload(upload: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (error) => {
      if (error) {
        return uploadErrorMiddleware(error, req, res, next)
      }

      return next()
    })
  }
}

export const uploadAvatarFile = handleUpload(memoryUpload.single('avatar'))
export const uploadFeedImageFile = handleUpload(memoryUpload.single('image'))
export const uploadProjectImageFiles = handleUpload(memoryUpload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'screenshots', maxCount: 5 },
]))

export async function validateImageFiles(req: Request, _res: Response, next: NextFunction) {
  try {
    const files = req.file ? [req.file] : Object.values(req.files ?? {}).flat()

    if (files.length === 0) {
      throw new AppError('Select at least one image to upload.', 400)
    }

    for (const file of files) {
      const detectedMime = await detectSupportedImageMime(file.buffer)
      if (!detectedMime) {
        throw new AppError('Only valid JPEG, PNG, and WebP image files are accepted.', 400)
      }

      file.mimetype = detectedMime
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

export function uploadErrorMiddleware(
  error: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 5 MB or smaller.'
        : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many image files were submitted.'
          : 'The image upload request is invalid.'

    return next(new AppError(message, 400))
  }

  return next(error)
}
