import { WorkspaceRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { storage } from '../lib/storage.js'
import { securityLog } from '../lib/logger.js'
import { paginated, type Pagination } from '../lib/pagination.js'
import {
  cachedJson,
  invalidateWorkspaceCache,
  workspaceCacheKey,
  WORKSPACE_CACHE_TTL,
  type CachedResult,
} from '../lib/cache.js'
import { emitToUser } from '../realtime/emitter.js'
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '../schemas/workspace.schema.js'

// Plafond des membres embarqués dans le détail d'un workspace : borne la taille
// de la réponse et de l'entrée de cache.
const MAX_EMBEDDED_MEMBERS = 200

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = toSlug(name)
  const existing = await prisma.workspace.findFirst({ where: { slug: { startsWith: base } } })
  if (!existing) return base
  return `${base}-${Date.now()}`
}

export const workspaceService = {
  async createWorkspace(data: CreateWorkspaceInput, ownerId: string) {
    const slug = await generateUniqueSlug(data.name)
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          icon: data.icon ?? null,
          ownerId,
        },
      })
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: ownerId, role: WorkspaceRole.OWNER },
      })
      return workspace
    })
  },

  async getWorkspacesByUser(userId: string, p: Pagination) {
    const where = { userId }
    const [memberships, total] = await prisma.$transaction([
      prisma.workspaceMember.findMany({
        where,
        include: { workspace: { include: { members: true } } },
        orderBy: { workspace: { createdAt: 'desc' } },
        take: p.limit,
        skip: p.offset,
      }),
      prisma.workspaceMember.count({ where }),
    ])
    return paginated(
      memberships.map((m) => ({ ...m.workspace, role: m.role })),
      total,
      p,
    )
  },

  async getWorkspaceById(workspaceId: string) {
    return prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        members: {
          take: MAX_EMBEDDED_MEMBERS,
          include: {
            user: {
              select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
            },
          },
        },
      },
    })
  },

  // Renvoie le JSON sérialisé et l'indicateur de hit : le contrôleur le relaie
  // tel quel et positionne X-Cache.
  async getWorkspaceJsonById(workspaceId: string): Promise<CachedResult> {
    return cachedJson(workspaceCacheKey(workspaceId), WORKSPACE_CACHE_TTL, () =>
      this.getWorkspaceById(workspaceId),
    )
  },

  async updateWorkspace(workspaceId: string, data: UpdateWorkspaceInput) {
    const updated = await prisma.workspace.update({ where: { id: workspaceId }, data })
    await invalidateWorkspaceCache(workspaceId)
    return updated
  },

  async deleteWorkspace(workspaceId: string) {
    // Lister les fichiers AVANT : la cascade efface les lignes Attachment mais
    // pas le disque. Et les effacer APRÈS le commit, sinon un échec BDD laisse
    // des notes pointant vers des fichiers disparus.
    const attachments = await prisma.attachment.findMany({
      where: { note: { folder: { workspaceId } } },
      select: { storedName: true },
    })
    const deleted = await prisma.workspace.delete({ where: { id: workspaceId } })
    await storage.removeMany(attachments.map((a) => a.storedName))
    await invalidateWorkspaceCache(workspaceId)
    return deleted
  },

  async addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
    const existing = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    })
    if (existing) {
      throw Object.assign(new Error('User is already a member'), { code: 'CONFLICT' })
    }
    const member = await prisma.workspaceMember.create({ data: { workspaceId, userId, role } })
    await invalidateWorkspaceCache(workspaceId)
    return member
  },

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole) {
    const member = await prisma.workspaceMember.findUniqueOrThrow({
      where: { userId_workspaceId: { userId, workspaceId } },
    })
    if (member.role === WorkspaceRole.OWNER) {
      throw Object.assign(new Error('Cannot change role of workspace owner'), { code: 'FORBIDDEN' })
    }
    // L'incrément de `tokenVersion` révoque ses sessions : un membre rétrogradé
    // perd ses droits dès le prochain refresh (§5.5).
    const [updated] = await prisma.$transaction([
      prisma.workspaceMember.update({
        where: { userId_workspaceId: { userId, workspaceId } },
        data: { role },
      }),
      prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ])
    securityLog('member_role_changed', { workspaceId, userId, role })
    await invalidateWorkspaceCache(workspaceId)

    emitToUser(userId, 'workspace:role', { workspaceId, role })
    return updated
  },

  async removeMember(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findUniqueOrThrow({
      where: { userId_workspaceId: { userId, workspaceId } },
    })
    if (member.role === WorkspaceRole.OWNER) {
      throw Object.assign(new Error('Cannot remove workspace owner'), {
        code: 'CANNOT_REMOVE_OWNER',
      })
    }
    await prisma.$transaction([
      prisma.workspaceMember.delete({ where: { userId_workspaceId: { userId, workspaceId } } }),
      prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ])
    await invalidateWorkspaceCache(workspaceId)
    // `role: null` = plus membre : le workspace disparaît de son UI sans rechargement.
    emitToUser(userId, 'workspace:role', { workspaceId, role: null })
  },

  async transferOwnership(workspaceId: string, newOwnerUserId: string) {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { ownerId: true },
    })
    if (workspace.ownerId === newOwnerUserId) {
      throw Object.assign(new Error('User is already the owner'), { code: 'INVALID_TARGET' })
    }
    const newOwnerMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: newOwnerUserId, workspaceId } },
    })
    if (!newOwnerMembership) {
      throw Object.assign(new Error('New owner must be a member of the workspace'), {
        code: 'NOT_A_MEMBER',
      })
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: workspaceId }, data: { ownerId: newOwnerUserId } })
      await tx.workspaceMember.update({
        where: { userId_workspaceId: { userId: workspace.ownerId, workspaceId } },
        data: { role: WorkspaceRole.EDITOR },
      })
      return tx.workspaceMember.update({
        where: { userId_workspaceId: { userId: newOwnerUserId, workspaceId } },
        data: { role: WorkspaceRole.OWNER },
      })
    })
    securityLog('ownership_transferred', {
      workspaceId,
      from: workspace.ownerId,
      to: newOwnerUserId,
    })
    await invalidateWorkspaceCache(workspaceId)
    return updated
  },
}
