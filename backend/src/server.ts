import { app } from './app.js'
import { connectDatabase, closeDatabase } from './config/database.js'
import { env } from './config/env.js'

async function startServer() {
  try {
    await connectDatabase()
    const onListening = () => {
      console.log(`Kozett backend listening on http://localhost:${env.PORT}`)
    }
    const server = app.listen(env.PORT, onListening)

    process.on('SIGINT', async () => {
      server.close(async () => {
        await closeDatabase()
        process.exit(0)
      })
    })

    process.on('SIGTERM', async () => {
      server.close(async () => {
        await closeDatabase()
        process.exit(0)
      })
    })
  } catch (error) {
    console.error('Unable to start server')
    process.exit(1)
  }
}

startServer().catch((error) => {
  console.error('Startup failed:', error)
  process.exit(1)
})
