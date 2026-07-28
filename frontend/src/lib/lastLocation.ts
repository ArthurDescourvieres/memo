/**
 * Dernière position dans l'app, restaurée au rechargement — les notes n'étant
 * pas routées dans l'URL, un F5 ramènerait sinon à l'accueil avec l'arbre replié.
 *
 * Cloisonné par utilisateur, et tolérant à la donnée illisible : une position
 * invalide ne doit jamais empêcher l'app de démarrer.
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
    return null // stockage bloqué (mode strict, iframe tierce)
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
    /* quota plein : la restauration n'est qu'un confort */
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
