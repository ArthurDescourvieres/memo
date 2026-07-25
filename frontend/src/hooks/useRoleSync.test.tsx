import type { ReactNode } from 'react'
import { renderHook, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Même approche que useNoteRealtime.test : on remplace le singleton socket.io
// par un faux contrôlable, exposé via vi.hoisted pour la factory du mock.
const { socketRef } = vi.hoisted(() => ({
  socketRef: { current: null as unknown as ReturnType<typeof create> },
}))
vi.mock('../lib/socket', () => ({
  getSocket: () => socketRef.current,
  disconnectSocket: () => {},
}))

import { useRoleSync } from './useRoleSync'

type Handler = (...args: unknown[]) => void
function create() {
  const handlers = new Map<string, Set<Handler>>()
  return {
    on: vi.fn((ev: string, h: Handler) => {
      const set = handlers.get(ev) ?? new Set<Handler>()
      set.add(h)
      handlers.set(ev, set)
    }),
    off: vi.fn((ev: string, h: Handler) => handlers.get(ev)?.delete(h)),
    emit: vi.fn(),
    trigger(ev: string, ...args: unknown[]) {
      handlers.get(ev)?.forEach((h) => h(...args))
    },
    count(ev: string) {
      return handlers.get(ev)?.size ?? 0
    },
  }
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, invalidate, wrapper }
}

describe('useRoleSync', () => {
  beforeEach(() => {
    socketRef.current = create()
  })
  afterEach(() => cleanup())

  it('invalide le rôle courant quand le serveur annonce un changement', () => {
    const { invalidate, wrapper } = setup()
    renderHook(() => useRoleSync(), { wrapper })

    act(() => socketRef.current.trigger('workspace:role', { workspaceId: 'w1', role: 'VIEWER' }))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspace', 'w1'] })
  })

  it('se désabonne au démontage', () => {
    const { wrapper } = setup()
    const { unmount } = renderHook(() => useRoleSync(), { wrapper })
    expect(socketRef.current.count('workspace:role')).toBe(1)
    unmount()
    expect(socketRef.current.count('workspace:role')).toBe(0)
  })
})
