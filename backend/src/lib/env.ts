/**
 * Configuration d'environnement en fail-fast (§5.1) : importer ce module lève
 * si un secret manque, plutôt que de démarrer sur une valeur par défaut connue.
 */

export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const JWT_SECRET = requireEnv('JWT_SECRET')

/** Origines autorisées, séparées par des virgules. Par défaut : le serveur de dev Vite. */
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

/** Base des liens envoyés par e-mail. Slash final retiré : la concaténation reste prévisible. */
export const APP_URL = (process.env.APP_URL ?? CORS_ORIGINS[0] ?? 'http://localhost:5173').replace(
  /\/+$/,
  '',
)

/**
 * SMTP transactionnel (Brevo). Tout est optionnel : sans configuration le
 * mailer devient inerte et les invitations passent par le lien à copier.
 */
export const MAIL = {
  host: process.env.SMTP_HOST ?? '',
  port: Number(process.env.SMTP_PORT ?? '587'),
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_KEY ?? '',
  from: process.env.MAIL_FROM ?? 'Memo <noreply@localhost>',
}

export const MAIL_ENABLED = Boolean(MAIL.host && MAIL.user && MAIL.pass)
