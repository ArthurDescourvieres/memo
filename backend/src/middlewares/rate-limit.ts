import type { Context, MiddlewareHandler } from 'hono'
import { redis } from '../lib/redis.js'

type RateLimitOptions = {
  keyPrefix: string
  limit: number
  windowSec: number
}

function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return c.req.header('x-real-ip') ?? 'unknown'
}

/**
 * Fixed-window rate limiter backed by Redis (§5.6 / §7.1). Counts requests per
 * client IP under `rl:<prefix>:<ip>`; once the limit is exceeded within the
 * window it responds 429 with a Retry-After header until the window expires.
 *
 * The client IP comes from X-Forwarded-For, which Caddy sets in production.
 */
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const key = `rl:${opts.keyPrefix}:${clientIp(c)}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, opts.windowSec)
    if (count > opts.limit) {
      const ttl = await redis.ttl(key)
      c.header('Retry-After', String(ttl > 0 ? ttl : opts.windowSec))
      return c.json({ error: 'Too many requests' }, 429)
    }
    return next()
  }
}

// Anti-brute-force on login: 5 attempts / minute / IP (§5.6, T-AUTH-02).
export const loginRateLimit = rateLimit({ keyPrefix: 'login', limit: 5, windowSec: 60 })

// Throttle attachment uploads: 20 / minute / IP — limite l'abus du stockage (§7.3).
export const uploadRateLimit = rateLimit({ keyPrefix: 'upload', limit: 20, windowSec: 60 })

// Demande de réinitialisation : 5 / heure / IP. Empêche d'utiliser le formulaire
// « mot de passe oublié » pour bombarder des boîtes mail ou balayer des adresses
// à grande échelle (le service applique en plus un plafond par compte).
export const passwordResetRateLimit = rateLimit({
  keyPrefix: 'pwreset',
  limit: 5,
  windowSec: 60 * 60,
})

// Soumission du nouveau mot de passe (lien reçu par e-mail) : 10 / heure / IP.
// Le jeton fait 256 bits, il n'est pas devinable — la limite couvre surtout
// l'abus du point d'entrée (hachage argon2id, appel HIBP).
export const passwordResetSubmitRateLimit = rateLimit({
  keyPrefix: 'pwreset-submit',
  limit: 10,
  windowSec: 60 * 60,
})

// Changement de mot de passe : 5 / minute / IP, comme le login — le mot de passe
// actuel y est exigé, ce point d'entrée est donc attaquable par force brute.
export const passwordChangeRateLimit = rateLimit({
  keyPrefix: 'pwchange',
  limit: 5,
  windowSec: 60,
})
