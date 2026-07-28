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
 * Limiteur à fenêtre fixe sur Redis (§5.6). L'IP vient de X-Forwarded-For, que
 * Caddy renseigne en production.
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

// Anti-force brute (§5.6, T-AUTH-02).
export const loginRateLimit = rateLimit({ keyPrefix: 'login', limit: 5, windowSec: 60 })

// Limite l'abus du stockage (§7.3).
export const uploadRateLimit = rateLimit({ keyPrefix: 'upload', limit: 20, windowSec: 60 })

// Empêche de bombarder des boîtes mail depuis le formulaire « mot de passe
// oublié » (le service ajoute un plafond par compte).
export const passwordResetRateLimit = rateLimit({
  keyPrefix: 'pwreset',
  limit: 5,
  windowSec: 60 * 60,
})

// Le jeton de 256 bits n'est pas devinable : la limite protège surtout le coût
// du point d'entrée (argon2id, appel HIBP).
export const passwordResetSubmitRateLimit = rateLimit({
  keyPrefix: 'pwreset-submit',
  limit: 10,
  windowSec: 60 * 60,
})

// Le mot de passe actuel y est exigé : même exposition qu'un login.
export const passwordChangeRateLimit = rateLimit({
  keyPrefix: 'pwchange',
  limit: 5,
  windowSec: 60,
})
