/**
 * Mémorise la dernière position de l'utilisateur dans l'application (workspace,
 * dossier, note ouverte) pour la restaurer après un rechargement de page.
 *
 * L'app ne route pas les notes dans l'URL : sans cette persistance, un F5
 * ramenait sur l'écran d'accueil, avec l'arbre replié — il fallait redérouler
 * dossiers et sous-dossiers pour retrouver sa note.
 *
 * Le stockage est cloisonné par utilisateur (deux comptes sur le même
 * navigateur ne se marchent pas dessus) et toute donnée illisible est ignorée :
 * une position invalide ne doit jamais empêcher l'app de démarrer.
 */
export type LastLocation = {
  workspaceId: string | null
  folderId: string | null
  noteId: string | null
}

const PREFIX = 'memo:last-location:'

function keyFor(userId: string): string {
  return `${PREFIX}${userId}`
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    // Cookies/stockage bloqués (mode strict, iframe tierce) : on s'en passe.
    return null
  }
}

function asIdOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function readLastLocation(userId: string | null): LastLocation | null {
  if (!userId) return null
  const store = safeStorage()
  if (!store) return null
  try {
    const raw = store.getItem(keyFor(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    const loc: LastLocation = {
      workspaceId: asIdOrNull(o.workspaceId),
      folderId: asIdOrNull(o.folderId),
      noteId: asIdOrNull(o.noteId),
    }
    return loc.workspaceId ? loc : null
  } catch {
    return null
  }
}

export function writeLastLocation(userId: string | null, loc: LastLocation): void {
  if (!userId) return
  const store = safeStorage()
  if (!store) return
  try {
    store.setItem(keyFor(userId), JSON.stringify(loc))
  } catch {
    /* quota plein ou stockage indisponible : la restauration est un confort */
  }
}

export function clearLastLocation(userId: string | null): void {
  if (!userId) return
  const store = safeStorage()
  if (!store) return
  try {
    store.removeItem(keyFor(userId))
  } catch {
    /* idem */
  }
}
