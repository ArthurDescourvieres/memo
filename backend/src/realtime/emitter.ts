import type { Server } from 'socket.io'

/**
 * Pont entre les services Hono et Socket.IO. Une référence de module plutôt
 * qu'un import direct de `realtime/index.ts`, qui formerait un cycle. Nulle
 * (tests, worker de purge), les émissions deviennent des no-op.
 */
let ioRef: Server | null = null

export function setIo(io: Server | null): void {
  ioRef = io
}

/** Room personnelle : tous les onglets d'un même utilisateur y sont joints. */
export function userRoom(userId: string): string {
  return `user:${userId}`
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioRef?.to(userRoom(userId)).emit(event, payload)
}
