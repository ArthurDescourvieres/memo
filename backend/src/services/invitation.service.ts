import { randomBytes } from 'node:crypto'
import { WorkspaceRole, InvitationStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { sendInvitationEmail } from '../lib/mailer.js'
import { MAIL_ENABLED } from '../lib/env.js'
import { logger } from '../lib/logger.js'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

// L'invitation est toujours indexée par e-mail : un pseudo est résolu ici, ce
// qui garde l'acceptation sur une simple comparaison d'adresses.
async function resolveInviteeEmail(identifier: string): Promise<string> {
  if (identifier.includes('@')) return identifier.toLowerCase()
  const user = await prisma.user.findUnique({ where: { name: identifier } })
  if (!user) {
    throw Object.assign(new Error('No user with that username'), { code: 'USER_NOT_FOUND' })
  }
  return user.email.toLowerCase()
}

// Détaché pour être lancé sans `await`, et avale ses erreurs : un échec d'envoi
// ne doit jamais remonter jusqu'à la requête.
async function dispatchInvitationEmail(invitation: {
  email: string
  token: string
  role: WorkspaceRole
  workspaceId: string
  invitedById: string
}): Promise<void> {
  try {
    const [workspace, inviter] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: invitation.workspaceId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: invitation.invitedById },
        select: { name: true },
      }),
    ])
    await sendInvitationEmail({
      to: invitation.email,
      token: invitation.token,
      role: invitation.role,
      workspaceName: workspace?.name ?? 'un espace de travail',
      invitedByName: inviter?.name ?? 'Un membre',
    })
  } catch (err) {
    logger.error({ err: { message: (err as Error).message } }, 'invitation email dispatch failed')
  }
}

export const invitationService = {
  async createInvitation(
    workspaceId: string,
    identifier: string,
    role: WorkspaceRole,
    invitedById: string,
  ) {
    const email = await resolveInviteeEmail(identifier)
    const invitation = await prisma.invitation.create({
      data: {
        workspaceId,
        email,
        role,
        token: generateToken(),
        invitedById,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    })

    // Hors de la requête : la latence SMTP ne doit pas retarder la réponse.
    if (MAIL_ENABLED) void dispatchInvitationEmail(invitation)

    return invitation
  },

  async listPending(workspaceId: string) {
    return prisma.invitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    })
  },

  // Lu sans authentification par la page d'atterrissage. Tout ce qui n'est pas
  // une invitation vivante renvoie NOT_FOUND, pour ne pas révéler qu'un jeton
  // consommé ou révoqué a existé. Rendre l'e-mail lié est sans risque : le
  // jeton de 32 octets est lui-même le secret.
  async getInvitationByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      select: {
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        workspace: { select: { name: true } },
      },
    })
    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' })
    }
    return {
      email: invitation.email,
      role: invitation.role,
      workspaceName: invitation.workspace.name,
    }
  },

  async revokeInvitation(workspaceId: string, invitationId: string) {
    const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } })
    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' })
    }
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    })
  },

  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.invitation.findUnique({ where: { token } })
    if (!invitation || invitation.status === InvitationStatus.REVOKED) {
      throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' })
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw Object.assign(new Error('Invitation already accepted'), { code: 'CONFLICT' })
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      })
      throw Object.assign(new Error('Invitation expired'), { code: 'EXPIRED' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw Object.assign(new Error('Invitation is for a different email'), { code: 'FORBIDDEN' })
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: invitation.workspaceId } },
      })
      if (!existing) {
        await tx.workspaceMember.create({
          data: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
        })
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      })
      return { workspaceId: invitation.workspaceId, role: invitation.role }
    })
  },
}
