import { serve } from '@hono/node-server'
import { Server as IOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { app } from '../src/app.js'
import { redis } from '../src/lib/redis.js'
import { registerRealtime } from '../src/realtime/index.js'

const PORT = Number(process.env.PORT ?? 3100)

const httpServer = serve({ fetch: app.fetch, port: PORT }, () => {
  // eslint-disable-next-line no-console
  console.log(`[JE-TEST-SERVER] listening on http://localhost:${PORT}`)
})

const io = new IOServer(httpServer, {
  cors: { origin: '*', credentials: true },
})

const pubClient = redis.duplicate()
const subClient = redis.duplicate()
io.adapter(createAdapter(pubClient, subClient))

registerRealtime(io)
