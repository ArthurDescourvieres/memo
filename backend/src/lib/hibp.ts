import { createHash } from 'node:crypto'

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/'

/**
 * Vérification k-anonyme chez Have I Been Pwned (§5.3) : seuls les 5 premiers
 * caractères du SHA-1 partent, le suffixe est comparé localement. `Add-Padding`
 * brouille la taille du lot renvoyé, d'où les entrées à compte 0 à ignorer.
 *
 * Échoue en mode permissif : une panne du service ne doit pas bloquer toutes
 * les inscriptions.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  try {
    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return false

    const body = await res.text()
    for (const line of body.split('\n')) {
      const [hashSuffix, countStr] = line.split(':')
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        return Number.parseInt(countStr ?? '0', 10) > 0
      }
    }
    return false
  } catch {
    return false
  }
}
