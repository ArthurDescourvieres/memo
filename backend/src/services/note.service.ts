import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { extractText } from '../lib/tiptap.js'
import { sanitizeTiptapContent } from '../lib/tiptap-sanitize.js'
import { paginated, type Pagination } from '../lib/pagination.js'
import type { CreateNoteInput, UpdateNoteInput } from '../schemas/note.schema.js'

export const noteService = {
  async createNote(data: CreateNoteInput, createdById: string) {
    const content = sanitizeTiptapContent(data.content)
    return prisma.note.create({
      data: {
        title: data.title,
        content,
        contentText: extractText(content),
        folderId: data.folderId,
        createdById,
      },
    })
  },

  async getNotesByFolder(folderId: string, p: Pagination) {
    const where: Prisma.NoteWhereInput = { folderId, deletedAt: null }
    const [items, total] = await prisma.$transaction([
      prisma.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: p.limit,
        skip: p.offset,
      }),
      prisma.note.count({ where }),
    ])
    return paginated(items, total, p)
  },

  async getNoteById(noteId: string) {
    return prisma.note.findUniqueOrThrow({ where: { id: noteId } })
  },

  async updateNote(noteId: string, data: UpdateNoteInput) {
    const patch: Prisma.NoteUpdateInput = {}
    if (data.title !== undefined) patch.title = data.title
    if (data.content !== undefined) {
      const content = sanitizeTiptapContent(data.content)
      patch.content = content
      patch.contentText = extractText(content)
    }
    return prisma.note.update({ where: { id: noteId }, data: patch })
  },

  /**
   * Le middleware a déjà validé les droits sur la note ; reste à vérifier la
   * cible, car un déplacement inter-workspaces contournerait ce contrôle.
   */
  async moveNote(noteId: string, targetFolderId: string) {
    const note = await prisma.note.findUniqueOrThrow({
      where: { id: noteId },
      select: { folder: { select: { workspaceId: true } } },
    })
    const target = await prisma.folder.findUnique({
      where: { id: targetFolderId },
      select: { workspaceId: true },
    })
    if (!target || target.workspaceId !== note.folder.workspaceId) {
      throw Object.assign(new Error('Target folder is not in the same workspace'), {
        code: 'INVALID_TARGET',
      })
    }
    return prisma.note.update({ where: { id: noteId }, data: { folderId: targetFolderId } })
  },

  async softDeleteNote(noteId: string) {
    return prisma.note.update({ where: { id: noteId }, data: { deletedAt: new Date() } })
  },

  async restoreNote(noteId: string) {
    return prisma.note.update({ where: { id: noteId }, data: { deletedAt: null } })
  },

  // Les notes dont le dossier est lui-même en corbeille sont exclues : c'est le
  // dossier qui les représente là-bas, et le restaurer les ramène.
  async getDeletedNotesByWorkspace(workspaceId: string, p: Pagination) {
    const where: Prisma.NoteWhereInput = {
      deletedAt: { not: null },
      folder: { workspaceId, deletedAt: null },
    }
    const [items, total] = await prisma.$transaction([
      prisma.note.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        take: p.limit,
        skip: p.offset,
      }),
      prisma.note.count({ where }),
    ])
    return paginated(items, total, p)
  },
}
