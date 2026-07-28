import { createHash, randomBytes } from 'node:crypto'
import { redis } from './redis.js'

/**
 * Jetons de réinitialisation de mot de passe (§5.3). Stockés dans Redis plutôt
 * qu'en base : éphémères par nature, le TTL fait office de purge.
 *
 * Seul le SHA-256 du jeton est conservé — une fuite de Redis ne permet pas de
 * fabriquer un lien. Pas de sel ni d'argon2 ici : 256 bits d'entropie ne se
 * brute-forcent pas.
 */
const RESET_TTL_SEC = 60 * 60 // 1 heure

const tokenKey = (tokenHash: string) => `pwreset:tok:${tokenHash}`
const userKey = (userId: string) => `pwreset:user:${userId}`

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Renvoie le jeton en clair — seul instant où il existe. À n'insérer que dans
 * le lien e-mail : jamais de journal, jamais de réponse HTTP.
 */
export async function issueResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)

  // Un seul lien actif par compte : en redemander un périme le précédent.
  const previous = await redis.get(userKey(userId))
  if (previous) await redis.del(tokenKey(previous))

  await redis
    .multi()
    .setex(tokenKey(tokenHash), RESET_TTL_SEC, userId)
    .setex(userKey(userId), RESET_TTL_SEC, tokenHash)
    .exec()

  return token
}

/** Résout un jeton sans le consommer, pour valider le mot de passe avant de le brûler. */
export async function peekResetToken(token: string): Promise<string | null> {
  return redis.get(tokenKey(hashToken(token)))
}

/**
 * `GETDEL` lit et supprime en une commande : deux requêtes concurrentes avec le
 * même jeton ne peuvent pas aboutir toutes les deux.
 */
export async function consumeResetToken(token: string): Promise<string | null> {
  const userId = await redis.getdel(tokenKey(hashToken(token)))
  if (!userId) return null
  await redis.del(userKey(userId))
  return userId
}

export async function revokeResetTokens(userId: string): Promise<void> {
  const pending = await redis.getdel(userKey(userId))
  if (pending) await redis.del(tokenKey(pending))
}
