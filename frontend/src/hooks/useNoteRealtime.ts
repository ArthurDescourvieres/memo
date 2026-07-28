import { useEffect, useRef, useState, useCallback } from 'react'
import { getSocket } from '../lib/socket'
import type { TiptapDoc } from '../lib/types'

export type Presence = {
  socketId: string
  userId: string
  name: string
}

type RemoteUpdate = {
  noteId: string
  content?: TiptapDoc
  title?: string
  updatedAt?: string
  senderSocketId?: string
  senderUserId?: string
}

type JoinAck = { ok: boolean; presence?: Presence[]; error?: string }

type Options = {
  onRemoteUpdate?: (u: RemoteUpdate) => void
  onRemoteLive?: (u: RemoteUpdate) => void
  /** Appelé après une reconnexion : des `note:update` ont pu passer hors ligne. */
  onResync?: () => void
}

export function useNoteRealtime(noteId: string | null, opts: Options = {}) {
  const [presence, setPresence] = useState<Presence[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cbRef = useRef(opts.onRemoteUpdate)
  cbRef.current = opts.onRemoteUpdate
  const liveCbRef = useRef(opts.onRemoteLive)
  liveCbRef.current = opts.onRemoteLive
  const resyncRef = useRef(opts.onResync)
  resyncRef.current = opts.onResync

  useEffect(() => {
    if (!noteId) {
      setPresence([])
      return
    }
    const socket = getSocket()
    let cancelled = false
    // Passé à true à chaque coupure, pour distinguer le `connect` suivant de la
    // toute première connexion.
    let reconnecting = false

    setError(null)
    setPresence([])

    const join = () => {
      socket.emit('note:join', { noteId }, (res: JoinAck) => {
        if (cancelled) return
        if (!res?.ok) {
          setError(res?.error ?? 'JOIN_FAILED')
          return
        }
        setError(null)
        setPresence(res.presence ?? [])
      })
    }

    const onConnect = () => {
      setConnected(true)
      if (reconnecting) {
        // Le serveur nous a sortis de la room au `disconnecting` : il faut la
        // rejoindre et laisser le consommateur resynchroniser.
        reconnecting = false
        join()
        resyncRef.current?.()
      }
    }
    const onDisconnect = () => {
      setConnected(false)
      reconnecting = true
    }
    const onConnectError = (err: Error) => setError(err.message)

    const onJoined = (p: Presence & { noteId: string }) => {
      if (p.noteId !== noteId) return
      setPresence((prev) =>
        prev.some((x) => x.socketId === p.socketId)
          ? prev
          : [...prev, { socketId: p.socketId, userId: p.userId, name: p.name }],
      )
    }
    const onLeft = (p: { noteId: string; socketId: string }) => {
      if (p.noteId !== noteId) return
      setPresence((prev) => prev.filter((x) => x.socketId !== p.socketId))
    }
    const onUpdate = (u: RemoteUpdate) => {
      if (u.noteId !== noteId) return
      cbRef.current?.(u)
    }
    const onLive = (u: RemoteUpdate) => {
      if (u.noteId !== noteId) return
      liveCbRef.current?.(u)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('presence:joined', onJoined)
    socket.on('presence:left', onLeft)
    socket.on('note:update', onUpdate)
    socket.on('note:live', onLive)

    if (socket.connected) setConnected(true)

    join()

    return () => {
      cancelled = true
      socket.emit('note:leave', { noteId })
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('presence:joined', onJoined)
      socket.off('presence:left', onLeft)
      socket.off('note:update', onUpdate)
      socket.off('note:live', onLive)
    }
  }, [noteId])

  const sendLive = useCallback(
    (patch: { content?: TiptapDoc; title?: string }) => {
      if (!noteId) return
      const socket = getSocket()
      socket.emit('note:live', { noteId, ...patch })
    },
    [noteId],
  )

  return { presence, connected, error, sendLive }
}
