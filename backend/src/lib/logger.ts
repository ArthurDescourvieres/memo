/**
 * Journalisation structurée (OWASP A09). Remplace `hono/logger` par Pino : une
 * ligne JSON par requête, secrets caviardés avant tout transport.
 */
import pino from 'pino'
import type { MiddlewareHandler } from 'hono'

const isProd = process.env.NODE_ENV === 'production'

/** Chemins caviardés en `[REDACTED]`, à quelque profondeur qu'ils apparaissent. */
const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  'headers.authorization',
  'req.headers.authorization',
  'headers.cookie',
  'req.headers.cookie',
  'headers["set-cookie"]',
  'res.headers["set-cookie"]',
]

// Exporté pour que les tests rejouent la même config sur un flux de capture.
export const loggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: { service: 'memo-api' },
  formatters: { level: (label: string) => ({ level: label }) },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
} satisfies pino.LoggerOptions

export const logger = pino(loggerOptions)

// Le repli `string` garde l'autocomplétion sur ces événements sans obliger à
// éditer l'union pour en ajouter un.
export type SecurityEvent =
  | 'login_failed'
  | 'login_deactivated'
  | 'refresh_blacklisted'
  | 'refresh_version_mismatch'
  | 'refresh_invalid'
  | 'unauthorized'
  | 'access_denied'
  | 'member_role_changed'
  | 'password_changed'
  | 'password_change_failed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_reset_invalid_token'

/** Audit de sécurité : toujours en `warn` et marqué `security:true` pour le routage. */
export function securityLog(
  event: SecurityEvent | (string & {}),
  data: Record<string, unknown> = {},
): void {
  logger.warn({ security: true, event, ...data }, `security:${event}`)
}

/** Une ligne par requête ; 401/403 remontent en événement de sécurité, 5xx en erreur. */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID()

  try {
    await next()
  } finally {
    const status = c.res.status
    const line = {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Date.now() - start,
    }

    if (status === 401 || status === 403) {
      logger.warn(
        { security: true, event: status === 401 ? 'unauthorized' : 'access_denied', ...line },
        'request',
      )
    } else if (status >= 500) {
      logger.error(line, 'request')
    } else {
      logger.info(line, 'request')
    }
  }
}
