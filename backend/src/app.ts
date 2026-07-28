import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { corsMiddleware, securityHeaders } from './middlewares/security.js'
import { logger, requestLogger } from './lib/logger.js'
import { router } from './routes/index.js'

export const app = new Hono()

// Ordre imposé (§7.1) : journalisation → CORS → en-têtes de sécurité → routes.
app.use('*', requestLogger)
app.use('*', corsMiddleware)
app.use('*', securityHeaders)

// Les HTTPException du framework (401 du middleware JWT…) passent telles
// quelles ; le reste est journalisé côté serveur et masqué derrière un 500.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  logger.error(
    { err: { message: err.message, stack: err.stack }, path: c.req.path, method: c.req.method },
    'unhandled error',
  )
  return c.json({ error: 'Erreur interne du serveur.' }, 500)
})

app.route('/api', router)
