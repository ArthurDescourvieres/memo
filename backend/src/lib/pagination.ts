/**
 * Pagination offset/limit des listes sans borne naturelle (notes d'un dossier,
 * workspaces, corbeille). Les listes bornées par conception — arbre de dossiers,
 * membres — gardent leur forme brute avec un plafond serveur.
 */
import { z } from 'zod'
import type { Context } from 'hono'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 100

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
})

export type Pagination = z.infer<typeof paginationQuerySchema>

export type Paginated<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** Une valeur hors bornes ou illisible retombe sur les défauts plutôt que sur un 400. */
export function parsePagination(c: Context): Pagination {
  const parsed = paginationQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  return parsed.success ? parsed.data : { limit: DEFAULT_LIMIT, offset: 0 }
}

export function paginated<T>(items: T[], total: number, p: Pagination): Paginated<T> {
  return { items, total, limit: p.limit, offset: p.offset }
}
