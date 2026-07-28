/**
 * Structured logging (OWASP A09 — Security Logging & Monitoring Failures).
 *
 * Replaces `hono/logger` with Pino: every line is JSON, secrets are redacted
 * before they ever reach a transport, and security-relevant events go through a
 * dedicated `securityLog` channel so they can be filtered (`security:true`) in
 * aggregation. Per §7.x the application must never log passwords, tokens,
 * cookies or the Authorization header.
 */
import pino from 'pino'
import type { MiddlewareHandler } from 'hono'

const isProd = process.env.NODE_ENV === 'production'

/**
 * Paths whose values are replaced by `[REDACTED]`. Pino matches these against
 * every logged object, so a token nested under `req.headers.authorization` or a
 * `password` field is censored wherever it appears in our log shapes.
 */
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

// Exported so tests can build an equivalent logger over a capture stream and
// assert the redaction config actually censors secrets.
export const loggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: { service: 'memo-api' },
  // Emit the level as a label ("info") rather than the numeric value.
  formatters: { level: (label: string) => ({ level: label }) },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
} satisfies pino.LoggerOptions

export const logger = pino(loggerOptions)

/**
 * Security audit events. Always logged at `warn` and tagged `security:true`
 * so a log pipeline can route them to a dedicated stream/alert. Covers §10:
 * failed logins, refresh-token rejections (blacklist / version mismatch /
 * foreign key) and privilege changes.
 */
// Known security events. The string fallback keeps autocomplete for these while
// letting other features (RGPD account lifecycle, etc.) add their own without
// editing this union.
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

export function securityLog(
  event: SecurityEvent | (string & {}),
  data: Record<string, unknown> = {},
): void {
  logger.warn({ security: true, event, ...data }, `security:${event}`)
}

/**
 * Request logger middleware (drop-in for `hono/logger`). Logs one structured
 * line per request with method/path/status/duration and a correlation id, and
 * promotes 401/403 to security events and 5xx to errors.
 */
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
