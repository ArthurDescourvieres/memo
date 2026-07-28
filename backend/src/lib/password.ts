import argon2 from 'argon2'
import bcrypt from 'bcryptjs'

/**
 * Paramètres argon2id recommandés par l'OWASP (§5.2). Les comptes antérieurs à
 * la migration restent vérifiables en bcrypt, `needsRehash` les signale pour
 * conversion au prochain login réussi.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 Mio
  timeCost: 3,
  parallelism: 1,
} as const

function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')
}

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS)
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(plain, hash)
  }
  try {
    return await argon2.verify(hash, plain)
  } catch {
    // Hash malformé ou format inconnu : échec de vérification, pas une erreur
    // remontée à l'appelant.
    return false
  }
}

export function needsRehash(hash: string): boolean {
  if (isBcryptHash(hash)) return true
  return argon2.needsRehash(hash, ARGON2_OPTIONS)
}
