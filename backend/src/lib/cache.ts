/**
 * Cache read-through Redis pour `GET /api/workspaces/:id`, invalidé à chaque
 * écriture sur le workspace ou ses membres. Les compteurs hit/miss alimentent
 * la mesure d'efficacité du dossier.
 */
import { redis } from './redis.js'

export const WORKSPACE_CACHE_TTL = 60 // secondes

const HIT_KEY = 'cache:hits'
const MISS_KEY = 'cache:misses'

export function workspaceCacheKey(id: string): string {
  return `cache:workspace:${id}`
}

export type CachedResult = { json: string; hit: boolean }

/** Une erreur de `produce` se propage et n'est jamais mise en cache. */
export async function cachedJson(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<unknown>,
): Promise<CachedResult> {
  const cached = await redis.get(key)
  if (cached !== null) {
    await redis.incr(HIT_KEY)
    return { json: cached, hit: true }
  }

  const value = await produce()
  const json = JSON.stringify(value)
  await redis.set(key, json, 'EX', ttlSeconds)
  await redis.incr(MISS_KEY)
  return { json, hit: false }
}

export async function invalidate(key: string): Promise<void> {
  await redis.del(key)
}

export async function invalidateWorkspaceCache(workspaceId: string): Promise<void> {
  await invalidate(workspaceCacheKey(workspaceId))
}

/** Totaux depuis le dernier démarrage de Redis. */
export async function cacheStats(): Promise<{ hits: number; misses: number; ratio: number }> {
  const [hits, misses] = await redis.mget(HIT_KEY, MISS_KEY)
  const h = Number(hits ?? 0)
  const m = Number(misses ?? 0)
  const total = h + m
  return { hits: h, misses: m, ratio: total === 0 ? 0 : h / total }
}
