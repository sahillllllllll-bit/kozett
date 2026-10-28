import * as dns from 'node:dns'
import mongoose from 'mongoose'
import { env } from './env.js'

dns.setServers(['8.8.8.8', '8.8.4.4'])

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    console.log('MongoDB connected successfully')
    return mongoose.connection
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined
    const host = new URL(env.MONGODB_URI).hostname
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1'

    console.error(
      `MongoDB connection failed (${errorName}${errorCode ? `, code ${errorCode}` : ''}).`,
    )

    if (isLocalHost) {
      console.error(
        'MONGODB_URI points to localhost. Start the local MongoDB service or set the Atlas URI in backend/.env.',
      )
    } else {
      console.error(
        'Check the MongoDB URI, Atlas network access list, database user credentials, and network connectivity.',
      )
    }

    throw error
  }
}

export async function closeDatabase() {
  if (mongoose.connection.readyState === 0) {
    return
  }

  await mongoose.connection.close()
  console.log('MongoDB connection closed')
}
