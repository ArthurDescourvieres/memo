import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Server } from 'socket.io'
import { emitToUser, setIo, userRoom } from './emitter.js'

afterEach(() => setIo(null))

function fakeIo() {
  const emit = vi.fn()
  const to = vi.fn(() => ({ emit }))
  return { io: { to } as unknown as Server, to, emit }
}

describe('realtime emitter', () => {
  it('émet dans la room personnelle du destinataire', () => {
    const { io, to, emit } = fakeIo()
    setIo(io)

    emitToUser('u1', 'workspace:role', { workspaceId: 'w1', role: 'VIEWER' })

    expect(to).toHaveBeenCalledWith(userRoom('u1'))
    expect(emit).toHaveBeenCalledWith('workspace:role', { workspaceId: 'w1', role: 'VIEWER' })
  })

  it('ne fait rien tant qu’aucun serveur Socket.IO n’est enregistré', () => {
    expect(() => emitToUser('u1', 'workspace:role', {})).not.toThrow()
  })
})
