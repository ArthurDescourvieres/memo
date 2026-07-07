import { renderHook, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Replace the socket.io singleton with a controllable fake. vi.hoisted exposes a
// mutable ref the factory can read, so each test gets a fresh socket.
const { socketRef } = vi.hoisted(() => ({
  socketRef: { current: null as unknown as ReturnType<typeof create> },
}))
vi.mock('../lib/socket', () => ({
  getSocket: () => socketRef.current,
  disconnectSocket: () => {},
}))

import { useNoteRealtime } from './useNoteRealtime'

type Handler = (...args: unknown[]) => void
function create() {
  const handlers = new Map<string, Set<Handler>>()
  return {
    connected: false,
    on: vi.fn((ev: string, h: Handler) => {
      const set = handlers.get(ev) ?? new Set<Handler>()
      set.add(h)
      handlers.set(ev, set)
    }),
    off: vi.fn((ev: string, h: Handler) => handlers.get(ev)?.delete(h)),
    emit: vi.fn(),
    /** test-only: invoke every handler bound to an event */
    trigger(ev: string, ...args: unknown[]) {
      handlers.get(ev)?.forEach((h) => h(...args))
    },
  }
}

function joinCallback(sock: ReturnType<typeof create>) {
  const call = sock.emit.mock.calls.find((c) => c[0] === 'note:join')
  return call?.[2] as (res: { ok: boolean; presence?: unknown[]; error?: string }) => void
}

describe('useNoteRealtime', () => {
  beforeEach(() => {
    socketRef.current = create()
  })
  afterEach(() => cleanup())

  it('does not touch the socket when no note is selected', () => {
    const { result } = renderHook(() => useNoteRealtime(null))
    expect(result.current.presence).toEqual([])
    expect(result.current.connected).toBe(false)
    expect(socketRef.current.emit).not.toHaveBeenCalled()
  })

  it('joins the note room and stores the returned presence', () => {
    const { result } = renderHook(() => useNoteRealtime('n1'))

    const join = socketRef.current.emit.mock.calls.find((c) => c[0] === 'note:join')
    expect(join?.[1]).toEqual({ noteId: 'n1' })

    act(() =>
      joinCallback(socketRef.current)({
        ok: true,
        presence: [{ socketId: 's1', userId: 'u1', name: 'Alice' }],
      }),
    )
    expect(result.current.presence).toEqual([{ socketId: 's1', userId: 'u1', name: 'Alice' }])
  })

  it('surfaces a refused join as an error', () => {
    const { result } = renderHook(() => useNoteRealtime('n1'))
    act(() => joinCallback(socketRef.current)({ ok: false, error: 'NO_ACCESS' }))
    expect(result.current.error).toBe('NO_ACCESS')
  })

  it('adds and removes presence, ignoring events for other notes', () => {
    const { result } = renderHook(() => useNoteRealtime('n1'))

    act(() =>
      socketRef.current.trigger('presence:joined', {
        noteId: 'n1',
        socketId: 's2',
        userId: 'u2',
        name: 'Bob',
      }),
    )
    expect(result.current.presence).toContainEqual({ socketId: 's2', userId: 'u2', name: 'Bob' })

    act(() =>
      socketRef.current.trigger('presence:joined', {
        noteId: 'other',
        socketId: 's3',
        userId: 'u3',
        name: 'Eve',
      }),
    )
    expect(result.current.presence.some((p) => p.socketId === 's3')).toBe(false)

    act(() => socketRef.current.trigger('presence:left', { noteId: 'n1', socketId: 's2' }))
    expect(result.current.presence.some((p) => p.socketId === 's2')).toBe(false)
  })

  it('invokes onRemoteUpdate only for the active note', () => {
    const onRemoteUpdate = vi.fn()
    renderHook(() => useNoteRealtime('n1', { onRemoteUpdate }))

    act(() => socketRef.current.trigger('note:update', { noteId: 'n1', title: 'X' }))
    expect(onRemoteUpdate).toHaveBeenCalledWith({ noteId: 'n1', title: 'X' })

    act(() => socketRef.current.trigger('note:update', { noteId: 'zzz', title: 'Y' }))
    expect(onRemoteUpdate).toHaveBeenCalledTimes(1)
  })

  it('tracks the connection state', () => {
    const { result } = renderHook(() => useNoteRealtime('n1'))
    act(() => socketRef.current.trigger('connect'))
    expect(result.current.connected).toBe(true)
    act(() => socketRef.current.trigger('disconnect'))
    expect(result.current.connected).toBe(false)
  })

  it('re-joins the room and resyncs only after a reconnect', () => {
    const onResync = vi.fn()
    renderHook(() => useNoteRealtime('n1', { onResync }))
    const sock = socketRef.current
    const joinCount = () => sock.emit.mock.calls.filter((c) => c[0] === 'note:join').length

    // Initial mount joins exactly once and does not resync.
    expect(joinCount()).toBe(1)
    expect(onResync).not.toHaveBeenCalled()

    // A first `connect` (no prior disconnect) must not re-join or resync.
    act(() => sock.trigger('connect'))
    expect(joinCount()).toBe(1)
    expect(onResync).not.toHaveBeenCalled()

    // Drop then reconnect: re-join the room and resync the content once.
    act(() => sock.trigger('disconnect'))
    act(() => sock.trigger('connect'))
    expect(joinCount()).toBe(2)
    expect(onResync).toHaveBeenCalledTimes(1)
  })

  it('sendLive emits a note:live payload scoped to the note', () => {
    const { result } = renderHook(() => useNoteRealtime('n1'))
    act(() => result.current.sendLive({ title: 'Live' }))
    expect(socketRef.current.emit).toHaveBeenCalledWith('note:live', {
      noteId: 'n1',
      title: 'Live',
    })
  })

  it('leaves the room and unbinds handlers on unmount', () => {
    const { unmount } = renderHook(() => useNoteRealtime('n1'))
    const sock = socketRef.current
    unmount()
    expect(sock.emit).toHaveBeenCalledWith('note:leave', { noteId: 'n1' })
    expect(sock.off).toHaveBeenCalled()
  })
})
