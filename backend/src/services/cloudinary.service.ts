import type { UploadApiOptions, UploadApiResponse } from 'cloudinary'
import { getCloudinary } from '../config/cloudinary.js'

export type StoredCloudinaryImage = {
  url: string
  publicId: string
}

export function uploadImage(
  buffer: Buffer,
  folder: string,
  transformation: UploadApiOptions['transformation'],
): Promise<StoredCloudinaryImage> {
  const cloudinary = getCloudinary()

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation,
        unique_filename: true,
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error) {
          reject(error)
          return
        }

        if (!result?.secure_url || !result.public_id) {
          reject(new Error('Cloudinary returned an incomplete image result.'))
          return
        }

        resolve({ url: result.secure_url, publicId: result.public_id })
      },
    )

    stream.end(buffer)
  })
}

export async function deleteCloudinaryImage(publicId: string) {
  const cloudinary = getCloudinary()
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  })

  return result.result === 'ok' || result.result === 'not found'
}

export async function cleanupCloudinaryImages(publicIds: string[]) {
  for (const publicId of new Set(publicIds.filter(Boolean))) {
    try {
      const deleted = await deleteCloudinaryImage(publicId)
      if (!deleted) {
        console.error('Cloudinary image cleanup was not confirmed.')
      }
    } catch {
      console.error('Cloudinary image cleanup failed.')
    }
  }
}
