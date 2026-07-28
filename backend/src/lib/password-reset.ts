import { createHash, randomBytes } from 'node:crypto'
import { redis } from './redis.js'

/**
 * Jetons de réinitialisation de mot de passe (§5.3).
 *
 * Choix de conception — le jeton vit dans Redis, pas en base :
 * - il est éphémère par nature, l'expiration est native (TTL) donc aucun job de
 *   purge n'est nécessaire et aucune migration Prisma non plus ;
 * - Redis est déjà l'infrastructure des secrets à durée de vie courte de l'app
 *   (liste noire des refresh tokens, compteurs de rate limiting).
 *
 * Propriétés de sécurité :
 * - 32 octets d'aléa cryptographique (`randomBytes`) : non devinable ;
 * - seul le SHA-256 du jeton est stocké, jamais le jeton lui-même. Une fuite du
 *   contenu de Redis ne permet donc pas de fabriquer un lien valide (même
 *   raisonnement que pour le hachage des mots de passe, en plus simple : le
 *   jeton ayant 256 bits d'entropie, un simple SHA-256 suffit) ;
 * - durée de vie 1 h, usage unique (le jeton est supprimé à la consommation) ;
 * - un seul lien valide par compte : en demander un nouveau périme le précédent.
 */
const RESET_TTL_SEC = 60 * 60 // 1 heure

const tokenKey = (tokenHash: string) => `pwreset:tok:${tokenHash}`
const userKey = (userId: string) => `pwreset:user:${userId}`

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Émet un jeton pour `userId` et renvoie sa valeur en clair — la seule et
 * unique fois où elle existe. L'appelant l'insère dans le lien envoyé par
 * e-mail ; elle ne doit jamais être journalisée ni renvoyée dans une réponse HTTP.
 */
export async function issueResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)

  // Périme le lien précédent : un seul jeton actif par compte à la fois.
  const previous = await redis.get(userKey(userId))
  if (previous) await redis.del(tokenKey(previous))

  await redis
    .multi()
    .setex(tokenKey(tokenHash), RESET_TTL_SEC, userId)
    .setex(userKey(userId), RESET_TTL_SEC, tokenHash)
    .exec()

  return token
}

/**
 * Résout un jeton *sans* le consommer : renvoie l'id de l'utilisateur, ou `null`
 * si le jeton est inconnu ou expiré. Sert à valider le nouveau mot de passe
 * (longueur, fuite connue) avant de brûler le jeton — sinon un mot de passe
 * refusé obligerait à redemander un lien.
 */
export async function peekResetToken(token: string): Promise<string | null> {
  return redis.get(tokenKey(hashToken(token)))
}

/**
 * Valide et consomme un jeton : renvoie l'id de l'utilisateur, ou `null` si le
 * jeton est inconnu, expiré ou déjà utilisé. `GETDEL` lit et supprime en une
 * seule commande atomique, ce qui garantit l'usage unique même si deux requêtes
 * arrivent simultanément avec le même jeton.
 */
export async function consumeResetToken(token: string): Promise<string | null> {
  const userId = await redis.getdel(tokenKey(hashToken(token)))
  if (!userId) return null
  await redis.del(userKey(userId))
  return userId
}

/** Révoque le jeton en attente d'un compte (changement de mot de passe réussi par une autre voie). */
export async function revokeResetTokens(userId: string): Promise<void> {
  const pending = await redis.getdel(userKey(userId))
  if (pending) await redis.del(tokenKey(pending))
}
