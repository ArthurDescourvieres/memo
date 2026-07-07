import { useEffect, useMemo, useRef, useState } from 'react'
import { useNote } from '../../hooks/useWorkspaces'
import { useNoteAutosave, type AutosaveStatus } from '../../hooks/useNoteAutosave'
import { useNoteRealtime, type Presence } from '../../hooks/useNoteRealtime'
import { TiptapEditor } from '../TiptapEditor'
import { AttachmentsPanel } from '../AttachmentsPanel'
import type { TiptapDoc } from '../../lib/types'

export function NoteEditor({
  noteId,
  onUnavailable,
}: {
  noteId: string
  onUnavailable: () => void
}) {
  const note = useNote(noteId)
  const autosave = useNoteAutosave(noteId)

  const initialContent = useMemo(() => note.data?.content ?? null, [note.data?.id])
  const initialTitle = note.data?.title ?? ''
  const [title, setTitle] = useState(initialTitle)
  const [remoteContent, setRemoteContent] = useState<TiptapDoc | null>(null)
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<number | null>(null)

  const markTyping = () => {
    isTypingRef.current = true
    if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => {
      isTypingRef.current = false
    }, 1500)
  }

  const realtime = useNoteRealtime(noteId, {
    onRemoteLive: (u) => {
      // Skip if I'm currently typing — local edits take priority.
      if (isTypingRef.current) return
      if (u.title !== undefined) setTitle(u.title)
      if (u.content !== undefined) setRemoteContent(u.content)
    },
    onRemoteUpdate: (u) => {
      if (isTypingRef.current) return
      if (u.title !== undefined) setTitle(u.title)
      if (u.content !== undefined) setRemoteContent(u.content)
    },
    onResync: async () => {
      // Après une reconnexion, on a pu manquer des note:update hors-ligne :
      // on récupère la note à jour et on l'applique, sauf si l'utilisateur
      // est en train de taper (ses modifications locales priment).
      const { data } = await note.refetch()
      if (!data || isTypingRef.current) return
      setTitle(data.title)
      setRemoteContent(data.content)
    },
  })

  useEffect(() => {
    setTitle(initialTitle)
    setRemoteContent(null)
    isTypingRef.current = false
    if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.data?.id])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  // La note ouverte peut disparaître sous nos pieds : mise à la corbeille (par
  // glisser-déposer ou par un collaborateur) ou supprimée avec son dossier
  // parent. Dans tous ces cas on referme l'éditeur, sinon on continuerait
  // d'afficher une note « fantôme » qui n'est plus consultable. Le backend ne
  // filtrant pas deletedAt sur GET, une note en corbeille revient avec ce champ
  // renseigné ; une note réellement supprimée (cascade dossier) renvoie une erreur.
  const unavailable = note.isError || note.data?.deletedAt != null
  useEffect(() => {
    if (unavailable) onUnavailable()
  }, [unavailable, onUnavailable])

  if (note.isPending) return <div className="opacity-50">Chargement…</div>
  if (note.isError)
    return <div className="text-[var(--color-danger)]">Impossible de charger la note.</div>

  return (
    <article className="mx-auto flex max-w-[760px] flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <input
          value={title}
          onChange={(e) => {
            markTyping()
            setTitle(e.target.value)
            autosave.schedule({ title: e.target.value })
            realtime.sendLive({ title: e.target.value })
          }}
          placeholder="Titre"
          data-testid="note-title-input"
          className="flex-1 border-none bg-transparent text-[28px] font-bold text-inherit outline-none"
        />
        <PresenceAvatars presence={realtime.presence} />
        <SaveStatus status={autosave.status} />
      </header>

      <TiptapEditor
        key={noteId}
        noteId={noteId}
        initialContent={initialContent}
        remoteContent={remoteContent}
        onChange={(content) => {
          markTyping()
          autosave.schedule({ content })
          realtime.sendLive({ content })
        }}
      />

      <AttachmentsPanel noteId={noteId} />
    </article>
  )
}

function PresenceAvatars({ presence }: { presence: Presence[] }) {
  if (presence.length === 0) return null
  return (
    <div className="flex" data-testid="note-presence">
      {presence.slice(0, 5).map((p, i) => (
        <span
          key={p.socketId}
          title={p.name}
          className="inline-grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-bg)] text-[11px] font-semibold text-[var(--color-on-accent)]"
          style={{ background: colorForUser(p.userId), marginLeft: i === 0 ? 0 : -8 }}
        >
          {initials(p.name)}
        </span>
      ))}
      {presence.length > 5 && (
        <span className="ml-1 self-center text-[11px] opacity-60">+{presence.length - 5}</span>
      )}
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) & 0xfffffff
  const hue = hash % 360
  return `hsl(${hue}, 60%, 50%)`
}

function SaveStatus({ status }: { status: AutosaveStatus }) {
  return (
    <span
      data-testid="note-save-status"
      data-status={status}
      className="min-w-20 text-right text-xs opacity-60"
    >
      {labelFor(status)}
    </span>
  )
}

function labelFor(s: AutosaveStatus): string {
  switch (s) {
    case 'idle':
      return ''
    case 'pending':
      return 'Modifications…'
    case 'saving':
      return 'Sauvegarde…'
    case 'saved':
      return ''
    case 'error':
      return 'Erreur'
  }
}
