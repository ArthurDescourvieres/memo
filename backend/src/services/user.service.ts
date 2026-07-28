import { prisma } from '../lib/prisma.js'
import { authService } from './auth.service.js'

export const userService = {
  /**
   * Ouvre la période de grâce de 30 jours avant purge définitive (§ RGPD).
   * Le compte est bloqué au login et toutes ses sessions tombent, la courante
   * comprise.
   */
  async deactivateAccount(userId: string, refreshToken?: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
    })
    if (refreshToken) {
      await authService.logout(refreshToken)
    }
  },

  /**
   * Export RGPD (portabilité). Les pièces jointes ne sont listées qu'en
   * métadonnées : le binaire reste derrière un lien authentifié.
   */
  async exportUserData(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    })
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            ownerId: true,
            createdAt: true,
          },
        },
      },
    })
    const notes = await prisma.note.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        title: true,
        content: true,
        contentText: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    })
    const attachments = await prisma.attachment.findMany({
      where: { uploadedById: userId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        noteId: true,
        createdAt: true,
      },
    })

    return {
      exportedAt: new Date().toISOString(),
      user,
      workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role, joinedAt: m.joinedAt })),
      notes,
      attachments: attachments.map((a) => ({ ...a, downloadUrl: `/api/attachments/${a.id}/file` })),
    }
  },
}
