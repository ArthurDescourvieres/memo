/**
 * Validation des fichiers uploadés (§7.3). Les formats binaires sont confirmés
 * par leurs « magic bytes » (`file-type`) ; le texte brut n'en a pas, d'où le
 * contrôle UTF-8 séparé qui rejette un binaire renommé en `.txt`.
 */
export const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
])

export function looksLikeText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false
  if (buffer.includes(0)) return false // un octet nul = contenu binaire
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}
