import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { CORS_ORIGINS } from '../lib/env.js'

/** Liste blanche explicite, jamais de joker : Hono ne reflète que les origines listées (§7.1). */
export const corsMiddleware = cors({
  origin: CORS_ORIGINS,
  credentials: true,
})

/**
 * `secure-headers` couvre nosniff / HSTS / X-Frame-Options, mais pas la CSP :
 * elle est écrite ici. L'API ne sert que du JSON et des fichiers authentifiés,
 * `default-src 'none'` est donc tenable (§7.1).
 */
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    baseUri: ["'none'"],
    frameAncestors: ["'none'"],
  },
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
})
