import type { Server } from 'socket.io'

/**
 * Pont entre le monde HTTP (contrôleurs / services Hono) et Socket.IO.
 *
 * Les services n'ont pas accès à l'instance `io` (créée dans index.ts) et ne
 * doivent pas importer `realtime/index.ts` (cycle : realtime → services →
 * realtime). On garde donc ici une référence de module, posée au démarrage par
 * `registerRealtime`. Tant qu'elle est nulle (tests unitaires, worker de purge),
 * les émissions sont des no-op silencieux.
 *
 * L'adaptateur Redis se charge de propager l'émission aux autres instances :
 * le socket destinataire n'est pas forcément connecté à ce processus.
 */
let ioRef: Server | null = null

export function setIo(io: Server | null): void {
  ioRef = io
}

/** Room personnelle d'un utilisateur : tous ses onglets/sockets y sont joints. */
export function userRoom(userId: string): string {
  return `user:${userId}`
}

/** Émet un évènement à toutes les sockets ouvertes d'un utilisateur donné. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioRef?.to(userRoom(userId)).emit(event, payload)
}
