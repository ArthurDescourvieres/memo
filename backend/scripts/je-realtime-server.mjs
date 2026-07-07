// Serveur de test pour le jeu d'essai temps réel (dossier CDA).
//
// Réutilise TEL QUEL le code applicatif réel — `app` (Hono + toutes les routes)
// et `registerRealtime` (middleware JWT io.use, canAccessNote, note:join /
// note:live / note:update) — mais écoute sur un PORT configurable (défaut 3100)
// au lieu du 3000 codé en dur dans src/index.ts, qui est occupé par la stack
// dev. Seules différences avec src/index.ts : le port paramétrable et l'absence
// du planificateur de purge RGPD (hors périmètre temps réel). La source de
// données (DATABASE_URL / REDIS_URL) est fournie par l'environnement au
// lancement → test-db (5434) + test-redis (6380).
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
