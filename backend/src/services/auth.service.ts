import { sign, verify } from 'hono/jwt'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { JWT_SECRET } from '../lib/env.js'
import { hashPassword, verifyPassword, needsRehash } from '../lib/password.js'
import { isPasswordPwned } from '../lib/hibp.js'
import { securityLog } from '../lib/logger.js'
import { sendPasswordResetEmail } from '../lib/mailer.js'
import {
  issueResetToken,
  peekResetToken,
  consumeResetToken,
  revokeResetTokens,
} from '../lib/password-reset.js'
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  ResetPasswordInput,
} from '../schemas/auth.schema.js'
const ACCESS_TTL = 60 * 15 // 15 minutes
const REFRESH_TTL = 60 * 60 * 24 * 7 // 7 days

type SafeUser = {
  id: string
  email: string
  name: string
  createdAt: Date
  updatedAt: Date
}

function sanitizeUser(user: SafeUser & { password: string }): SafeUser {
  const { password: _pw, ...safe } = user
  void _pw
  return safe
}

/** Liste noire jusqu'à l'expiration du jeton — au-delà, la signature suffit à le rejeter. */
async function blacklistRefreshToken(refreshToken: string): Promise<void> {
  let payload: { sub: string; exp: number }
  try {
    payload = (await verify(refreshToken, JWT_SECRET, 'HS256')) as typeof payload
  } catch {
    return
  }

  const ttl = payload.exp - Math.floor(Date.now() / 1000)
  if (ttl > 0) {
    await redis.setex(`bl:${refreshToken}`, ttl, '1')
  }
}

async function generateTokens(userId: string, tokenVersion: number) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign({ sub: userId, exp: now + ACCESS_TTL }, JWT_SECRET, 'HS256')
  const refreshToken = await sign(
    { sub: userId, tokenVersion, exp: now + REFRESH_TTL },
    JWT_SECRET,
    'HS256',
  )
  return { accessToken, refreshToken }
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } })
    if (existing) {
      throw Object.assign(new Error('Email already in use'), { code: 'CONFLICT' })
    }

    const existingName = await prisma.user.findUnique({ where: { name: input.name } })
    if (existingName) {
      throw Object.assign(new Error('Name already in use'), { code: 'NAME_CONFLICT' })
    }

    if (await isPasswordPwned(input.password)) {
      throw Object.assign(new Error('Password found in a known data breach'), { code: 'PWNED' })
    }

    const hashed = await hashPassword(input.password)
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, password: hashed },
    })

    const tokens = await generateTokens(user.id, user.tokenVersion)
    return { ...tokens, user: sanitizeUser(user) }
  },

  async login(input: LoginInput) {
    const isEmail = input.identifier.includes('@')
    const user = isEmail
      ? await prisma.user.findUnique({ where: { email: input.identifier } })
      : await prisma.user.findUnique({ where: { name: input.identifier } })
    if (!user) {
      securityLog('login_failed', { identifier: input.identifier, reason: 'unknown_user' })
      throw Object.assign(new Error('Invalid credentials'), { code: 'UNAUTHORIZED' })
    }

    const valid = await verifyPassword(user.password, input.password)
    if (!valid) {
      securityLog('login_failed', { identifier: input.identifier, reason: 'bad_password' })
      throw Object.assign(new Error('Invalid credentials'), { code: 'UNAUTHORIZED' })
    }

    // Suppression RGPD en cours (période de grâce 30 j) : plus de reconnexion.
    if (user.deactivatedAt) {
      securityLog('login_deactivated', { userId: user.id })
      throw Object.assign(new Error('Account deactivated'), { code: 'DEACTIVATED' })
    }

    // Migration silencieuse des anciens hachages bcrypt vers argon2id (§5.2).
    if (needsRehash(user.password)) {
      const upgraded = await hashPassword(input.password)
      await prisma.user.update({ where: { id: user.id }, data: { password: upgraded } })
    }

    const tokens = await generateTokens(user.id, user.tokenVersion)
    return { ...tokens, user: sanitizeUser(user) }
  },

  async refresh(refreshToken: string) {
    let payload: { sub: string; tokenVersion?: number; exp: number }
    try {
      payload = (await verify(refreshToken, JWT_SECRET, 'HS256')) as typeof payload
    } catch {
      // Signature invalide, expiré, malformé — dont les jetons signés ailleurs.
      securityLog('refresh_invalid')
      throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' })
    }

    const blacklisted = await redis.get(`bl:${refreshToken}`)
    if (blacklisted) {
      securityLog('refresh_blacklisted', { userId: payload.sub })
      throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' })
    }

    // Une `tokenVersion` décalée = toutes les sessions ont été révoquées depuis (§5.5).
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || user.tokenVersion !== payload.tokenVersion || user.deactivatedAt) {
      securityLog('refresh_version_mismatch', { userId: payload.sub })
      throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' })
    }

    const now = Math.floor(Date.now() / 1000)
    const accessToken = await sign({ sub: payload.sub, exp: now + ACCESS_TTL }, JWT_SECRET, 'HS256')
    return { accessToken }
  },

  async logout(refreshToken: string) {
    await blacklistRefreshToken(refreshToken)
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return sanitizeUser(user)
  },

  /**
   * Exiger le mot de passe courant : un jeton d'accès volé ne suffit pas à
   * s'emparer du compte. L'incrément de `tokenVersion` déconnecte partout
   * ailleurs, seule la session appelante repart avec des jetons frais.
   */
  async changePassword(userId: string, input: ChangePasswordInput, currentRefreshToken?: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    const valid = await verifyPassword(user.password, input.currentPassword)
    if (!valid) {
      securityLog('password_change_failed', { userId, reason: 'bad_current_password' })
      throw Object.assign(new Error('Invalid credentials'), { code: 'UNAUTHORIZED' })
    }

    if (input.newPassword === input.currentPassword) {
      throw Object.assign(new Error('New password is identical to the current one'), {
        code: 'SAME_PASSWORD',
      })
    }

    if (await isPasswordPwned(input.newPassword)) {
      throw Object.assign(new Error('Password found in a known data breach'), { code: 'PWNED' })
    }

    const hashed = await hashPassword(input.newPassword)
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    })

    // L'utilisateur vient de prouver qu'il maîtrise son compte : un lien de
    // réinitialisation encore en attente devient caduc.
    await revokeResetTokens(userId)
    if (currentRefreshToken) await blacklistRefreshToken(currentRefreshToken)

    securityLog('password_changed', { userId })

    const tokens = await generateTokens(updated.id, updated.tokenVersion)
    return { ...tokens, user: sanitizeUser(updated) }
  },

  /**
   * Anti-énumération de comptes (OWASP A07) : sortie silencieuse si l'e-mail
   * est inconnu, et envoi SMTP en tâche de fond pour que la latence du
   * fournisseur ne trahisse pas ce que la réponse tait.
   */
  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deactivatedAt) {
      securityLog('password_reset_requested', { email, delivered: false })
      return
    }

    // Plafond par compte (3/h) en plus du rate limit par IP : sinon on noie la
    // boîte mail d'une victime en changeant d'adresse.
    const quotaKey = `rl:pwreset:mail:${user.id}`
    const sent = await redis.incr(quotaKey)
    if (sent === 1) await redis.expire(quotaKey, 60 * 60)
    if (sent > 3) {
      securityLog('password_reset_requested', {
        userId: user.id,
        delivered: false,
        reason: 'throttled',
      })
      return
    }

    const token = await issueResetToken(user.id)
    securityLog('password_reset_requested', { userId: user.id, delivered: true })
    void sendPasswordResetEmail({ to: user.email, token })
  },

  /**
   * Le jeton n'est brûlé qu'une fois le nouveau mot de passe validé — un mot de
   * passe refusé ne doit pas coûter le lien. `tokenVersion` saute pour couper
   * l'accès d'un éventuel attaquant.
   */
  async resetPassword(input: ResetPasswordInput) {
    const userId = await peekResetToken(input.token)
    if (!userId) {
      securityLog('password_reset_invalid_token')
      throw Object.assign(new Error('Invalid or expired token'), { code: 'INVALID_TOKEN' })
    }

    if (await isPasswordPwned(input.password)) {
      throw Object.assign(new Error('Password found in a known data breach'), { code: 'PWNED' })
    }

    const confirmedUserId = await consumeResetToken(input.token)
    if (!confirmedUserId) {
      securityLog('password_reset_invalid_token')
      throw Object.assign(new Error('Invalid or expired token'), { code: 'INVALID_TOKEN' })
    }

    const user = await prisma.user.findUnique({ where: { id: confirmedUserId } })
    if (!user || user.deactivatedAt) {
      securityLog('password_reset_invalid_token', { userId: confirmedUserId })
      throw Object.assign(new Error('Invalid or expired token'), { code: 'INVALID_TOKEN' })
    }

    const hashed = await hashPassword(input.password)
    await prisma.user.update({
      where: { id: confirmedUserId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    })

    securityLog('password_reset_completed', { userId: confirmedUserId })
  },
}
