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

/**
 * Ajoute un refresh token à la liste noire jusqu'à sa date d'expiration. Extrait
 * de `logout` pour être réutilisé par le changement de mot de passe, qui coupe
 * lui aussi la session en cours avant d'en ouvrir une nouvelle.
 */
async function blacklistRefreshToken(refreshToken: string): Promise<void> {
  let payload: { sub: string; exp: number }
  try {
    payload = (await verify(refreshToken, JWT_SECRET, 'HS256')) as typeof payload
  } catch {
    return // token already invalid, nothing to blacklist
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

    // Reject passwords known to be compromised (HIBP k-anonymity, §5.3).
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

    // Un compte désactivé (suppression RGPD en cours, période de grâce 30 j) ne
    // peut plus se reconnecter (§ RGPD — droit à l'effacement).
    if (user.deactivatedAt) {
      securityLog('login_deactivated', { userId: user.id })
      throw Object.assign(new Error('Account deactivated'), { code: 'DEACTIVATED' })
    }

    // Transparently upgrade legacy bcrypt hashes to argon2id on login (§5.2).
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
      // Bad signature / expired / malformed — includes tokens signed with a
      // foreign key (§10).
      securityLog('refresh_invalid')
      throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' })
    }

    const blacklisted = await redis.get(`bl:${refreshToken}`)
    if (blacklisted) {
      securityLog('refresh_blacklisted', { userId: payload.sub })
      throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' })
    }

    // Global invalidation (§5.5): the token's version must still match the
    // user's current tokenVersion, otherwise all their sessions were revoked.
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
   * Changement de mot de passe depuis un compte connecté (§5.3).
   *
   * Le mot de passe courant est exigé : un jeton d'accès volé (XSS, poste non
   * verrouillé) ne suffit donc pas à s'emparer définitivement du compte.
   *
   * Effet sur les sessions : `tokenVersion` est incrémenté, ce qui invalide tous
   * les refresh tokens émis jusque-là — l'attaquant éventuel est déconnecté
   * partout. La session qui a fait la demande reçoit immédiatement un nouveau
   * couple de jetons, elle seule survit au changement.
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

    // Un lien de réinitialisation encore en attente devient caduc : l'utilisateur
    // vient de prouver qu'il maîtrise son compte.
    await revokeResetTokens(userId)
    if (currentRefreshToken) await blacklistRefreshToken(currentRefreshToken)

    securityLog('password_changed', { userId })

    const tokens = await generateTokens(updated.id, updated.tokenVersion)
    return { ...tokens, user: sanitizeUser(updated) }
  },

  /**
   * Demande de réinitialisation (mot de passe oublié).
   *
   * Ne renvoie jamais d'information sur l'existence du compte : un e-mail
   * inconnu ou un compte désactivé sortent silencieusement, et le contrôleur
   * répond la même chose dans tous les cas (§ anti-énumération de comptes,
   * OWASP A07). L'envoi SMTP part en tâche de fond pour que la latence du
   * fournisseur d'e-mail ne devienne pas, elle, le canal qui trahit la réponse.
   */
  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deactivatedAt) {
      securityLog('password_reset_requested', { email, delivered: false })
      return
    }

    // Plafond par compte, en complément du rate limit par IP : empêche de noyer
    // la boîte mail d'une victime en variant d'adresse IP. 3 envois / heure.
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
   * Réinitialisation effective à partir du jeton reçu par e-mail.
   *
   * Le jeton n'est consommé qu'une fois le nouveau mot de passe validé (un mot
   * de passe refusé ne doit pas brûler le lien), puis de façon atomique — deux
   * requêtes concurrentes avec le même jeton ne peuvent pas aboutir toutes deux.
   *
   * Toutes les sessions sont invalidées (`tokenVersion`) : si le compte était
   * compromis, l'attaquant perd son accès. L'utilisateur se reconnecte ensuite
   * avec son nouveau mot de passe.
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

    // Consommation atomique : si le jeton a été utilisé entre-temps, on refuse.
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
