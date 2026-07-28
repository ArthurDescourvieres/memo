import { prisma } from '../lib/prisma.js'
import type { CreateFolderInput, UpdateFolderInput } from '../schemas/folder.schema.js'

/** Parcours en largeur sur `parentId` : le dossier et tous ses descendants. */
async function subtreeFolderIds(rootId: string): Promise<string[]> {
  const all = [rootId]
  let frontier = [rootId]
  while (frontier.length) {
    const children = await prisma.folder.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    if (children.length === 0) break
    const ids = children.map((c) => c.id)
    all.push(...ids)
    frontier = ids
  }
  return all
}

export const folderService = {
  async createFolder(data: CreateFolderInput, workspaceId: string) {
    return prisma.folder.create({ data: { ...data, workspaceId } })
  },

  async getFoldersByWorkspace(workspaceId: string) {
    // Arbre borné par nature : renvoyé entier plutôt que paginé, `take` n'est
    // qu'un garde-fou contre un workspace pathologique.
    return prisma.folder.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        children: true,
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    })
  },

  async updateFolder(folderId: string, data: UpdateFolderInput) {
    return prisma.folder.update({ where: { id: folderId }, data })
  },

  /** `targetParentId` nul = remonter à la racine. Le workspace ne change jamais. */
  async moveFolder(folderId: string, targetParentId?: string | null) {
    const folder = await prisma.folder.findUniqueOrThrow({
      where: { id: folderId },
      select: { workspaceId: true },
    })

    if (!targetParentId) {
      return prisma.folder.update({ where: { id: folderId }, data: { parentId: null } })
    }

    if (targetParentId === folderId) {
      throw Object.assign(new Error('A folder cannot be its own parent'), {
        code: 'INVALID_TARGET',
      })
    }

    const target = await prisma.folder.findUnique({
      where: { id: targetParentId },
      select: { workspaceId: true },
    })
    if (!target || target.workspaceId !== folder.workspaceId) {
      throw Object.assign(new Error('Target parent is not in the same workspace'), {
        code: 'INVALID_TARGET',
      })
    }

    const visited = new Set<string>()
    let ancestorId: string | null = targetParentId
    while (ancestorId) {
      if (ancestorId === folderId) {
        throw Object.assign(new Error('Cannot move a folder into its own descendant'), {
          code: 'CYCLE',
        })
      }
      if (visited.has(ancestorId)) break // données déjà cycliques : ne pas boucler
      visited.add(ancestorId)
      const ancestor: { parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: ancestorId },
        select: { parentId: true },
      })
      ancestorId = ancestor?.parentId ?? null
    }

    return prisma.folder.update({ where: { id: folderId }, data: { parentId: targetParentId } })
  },

  /**
   * Met le sous-arbre entier en corbeille. Le `deletedAt: null` sur les notes
   * préserve l'horodatage de celles déjà supprimées individuellement.
   */
  async softDeleteFolder(folderId: string) {
    const ids = await subtreeFolderIds(folderId)
    const deletedAt = new Date()
    return prisma.$transaction([
      prisma.note.updateMany({
        where: { folderId: { in: ids }, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.folder.updateMany({ where: { id: { in: ids } }, data: { deletedAt } }),
    ])
  },

  async restoreFolder(folderId: string) {
    const ids = await subtreeFolderIds(folderId)
    return prisma.$transaction([
      prisma.note.updateMany({ where: { folderId: { in: ids } }, data: { deletedAt: null } }),
      prisma.folder.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } }),
    ])
  },

  /**
   * Seulement les « racines » de suppression (parent vivant ou absent) : les
   * sous-dossiers tombés en cascade reviendront avec elles.
   */
  async getDeletedFoldersByWorkspace(workspaceId: string) {
    return prisma.folder.findMany({
      where: {
        workspaceId,
        deletedAt: { not: null },
        OR: [{ parentId: null }, { parent: { deletedAt: null } }],
      },
      orderBy: { deletedAt: 'desc' },
      take: 1000,
    })
  },
}
