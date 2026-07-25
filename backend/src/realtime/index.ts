import type { Server, Socket } from 'socket.io'
import { WorkspaceRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { noteService } from '../services/note.service.js'
import { attachAuth, getUserId } from './auth.js'
import { setIo, userRoom } from './emitter.js'

type SocketDataWithUser = {
  userId: string
  name?: string
  email?: string
}

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.EDITOR]: 1,
  [WorkspaceRole.OWNER]: 2,
}

function roomFor(noteId: string): string {
  return `note:${noteId}`
}

async function canAccessNote(
  userId: string,
  noteId: string,
  minRole: WorkspaceRole = WorkspaceRole.VIEWER,
): Promise<{ ok: true; workspaceId: string } | { ok: false; reason: string }> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { folder: { select: { workspaceId: true } } },
  })
  if (!note) return { ok: false, reason: 'NOT_FOUND' }
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: note.folder.workspaceId } },
  })
  if (!member || ROLE_WEIGHT[member.role] < ROLE_WEIGHT[minRole]) {
    return { ok: false, reason: 'FORBIDDEN' }
  }
  return { ok: true, workspaceId: note.folder.workspaceId }
}

async function presenceSnapshot(io: Server, noteId: string) {
  const sockets = await io.in(roomFor(noteId)).fetchSockets()
  return sockets.map((s) => {
    const data = s.data as SocketDataWithUser
    return { socketId: s.id, userId: data.userId, name: data.name ?? 'Anonyme' }
  })
}

export function registerRealtime(io: Server): void {
  attachAuth(io)
  setIo(io)

  io.on('connection', (socket: Socket) => {
    void hydrateUser(socket)

    // Room personnelle : permet au monde HTTP (ex. changement de rôle par le
    // propriétaire) de pousser un évènement à toutes les sessions du membre.
    socket.join(userRoom(getUserId(socket)))

    socket.on('note:join', async (payload, ack) => {
      const noteId = String(payload?.noteId ?? '')
      if (!noteId) return ack?.({ ok: false, error: 'INVALID' })

      const userId = getUserId(socket)
      const access = await canAccessNote(userId, noteId)
      if (!access.ok) return ack?.({ ok: false, error: access.reason })

      socket.join(roomFor(noteId))

      const data = socket.data as SocketDataWithUser
      const me = { socketId: socket.id, userId, name: data.name ?? 'Anonyme' }

      // Tell the joiner who is already in the room (excluding themselves).
      const snapshot = (await presenceSnapshot(io, noteId)).filter((p) => p.socketId !== socket.id)

      // Tell everyone else (in this and other instances) that someone joined.
      socket.to(roomFor(noteId)).emit('presence:joined', { noteId, ...me })

      ack?.({ ok: true, presence: snapshot })
    })

    socket.on('note:leave', async (payload, ack) => {
      const noteId = String(payload?.noteId ?? '')
      if (!noteId) return ack?.({ ok: false, error: 'INVALID' })
      socket.leave(roomFor(noteId))
      const userId = getUserId(socket)
      socket.to(roomFor(noteId)).emit('presence:left', {
        noteId,
        socketId: socket.id,
        userId,
      })
      ack?.({ ok: true })
    })

    socket.on('note:update', async (payload, ack) => {
      const noteId = String(payload?.noteId ?? '')
      const content = payload?.content
      const title = typeof payload?.title === 'string' ? payload.title : undefined
      if (!noteId || (content === undefined && title === undefined)) {
        return ack?.({ ok: false, error: 'INVALID' })
      }

      const userId = getUserId(socket)
      const access = await canAccessNote(userId, noteId, WorkspaceRole.EDITOR)
      if (!access.ok) return ack?.({ ok: false, error: access.reason })

      try {
        const updated = await noteService.updateNote(noteId, {
          ...(content !== undefined ? { content } : {}),
          ...(title !== undefined ? { title } : {}),
        })
        // Broadcast to OTHERS in the room — sender already has the latest.
        socket.to(roomFor(noteId)).emit('note:update', {
          noteId,
          content: updated.content,
          title: updated.title,
          updatedAt: updated.updatedAt,
          senderSocketId: socket.id,
          senderUserId: userId,
        })
        ack?.({ ok: true, updatedAt: updated.updatedAt })
      } catch {
        ack?.({ ok: false, error: 'UPDATE_FAILED' })
      }
    })

    // Lightweight live-sync — does NOT persist. Used by clients that already
    // own HTTP autosave for durability and just want to push transient
    // changes to other open tabs in real time. Permission is still checked
    // (EDITOR) so a VIEWER can't push fake content.
    socket.on('note:live', async (payload) => {
      const noteId = String(payload?.noteId ?? '')
      const content = payload?.content
      const title = typeof payload?.title === 'string' ? payload.title : undefined
      if (!noteId || (content === undefined && title === undefined)) return

      const userId = getUserId(socket)
      const access = await canAccessNote(userId, noteId, WorkspaceRole.EDITOR)
      if (!access.ok) return

      socket.to(roomFor(noteId)).emit('note:live', {
        noteId,
        content,
        title,
        senderSocketId: socket.id,
        senderUserId: userId,
      })
    })

    socket.on('disconnecting', () => {
      const userId = getUserId(socket)
      for (const room of socket.rooms) {
        if (!room.startsWith('note:')) continue
        const noteId = room.slice('note:'.length)
        socket.to(room).emit('presence:left', {
          noteId,
          socketId: socket.id,
          userId,
        })
      }
    })
  })
}

async function hydrateUser(socket: Socket): Promise<void> {
  const data = socket.data as SocketDataWithUser
  if (!data.userId || data.name) return
  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { name: true, email: true },
    })
    if (user) {
      data.name = user.name
      data.email = user.email
    }
  } catch {
    /* ignore — name remains undefined */
  }
}
