import { useEffect, useMemo, useRef, useState } from 'react'
import { useNote } from '../../hooks/useWorkspaces'
import { useNoteAutosave, type AutosaveStatus } from '../../hooks/useNoteAutosave'
import { useNoteRealtime, type Presence } from '../../hooks/useNoteRealtime'
import { TiptapEditor } from '../TiptapEditor'
import { AttachmentsPanel } from '../AttachmentsPanel'
import { MemoIcon } from '../MemoIcon'
import type { TiptapDoc } from '../../lib/types'

export function NoteEditor({
  noteId,
  canEdit,
  onUnavailable,
}: {
  noteId: string
  canEdit: boolean
  onUnavailable: () => void
}) {
  const note = useNote(noteId)
  const autosave = useNoteAutosave(noteId)
  const readOnly = !canEdit
  // Un compteur et non un booléen : chaque tentative doit relancer l'info-bulle,
  // même si elle est déjà visible.
  const [denied, setDenied] = useState(0)

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
      if (isTypingRef.current) return // la frappe locale prime
      if (u.title !== undefined) setTitle(u.title)
      if (u.content !== undefined) setRemoteContent(u.content)
    },
    onRemoteUpdate: (u) => {
      if (isTypingRef.current) return
      if (u.title !== undefined) setTitle(u.title)
      if (u.content !== undefined) setRemoteContent(u.content)
    },
    onResync: async () => {
      // Des `note:update` ont pu passer pendant la coupure.
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

  // Rétrogradation en cours d'édition : la frappe déjà mise en file serait
  // refusée par le serveur et afficherait « Erreur ».
  useEffect(() => {
    if (readOnly) autosave.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  // La note peut disparaître sous nos pieds (corbeille, dossier supprimé par un
  // collaborateur). Le GET ne filtre pas `deletedAt` : une note en corbeille
  // revient avec le champ renseigné, une note vraiment supprimée lève.
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
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          onKeyDown={(e) => {
            if (readOnly && !NAVIGATION_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey) {
              setDenied((n) => n + 1)
            }
          }}
          onChange={(e) => {
            if (readOnly) return
            markTyping()
            setTitle(e.target.value)
            autosave.schedule({ title: e.target.value })
            realtime.sendLive({ title: e.target.value })
          }}
          placeholder="Titre"
          data-testid="note-title-input"
          className={`flex-1 border-none bg-transparent text-[28px] font-bold text-inherit outline-none ${
            readOnly ? 'cursor-default' : ''
          }`}
        />
        <PresenceAvatars presence={realtime.presence} />
        {readOnly ? <ReadOnlyBadge /> : <SaveStatus status={autosave.status} />}
      </header>

      <div
        className="relative"
        // Un refus expliqué plutôt qu'une frappe silencieusement ignorée.
        onPointerDown={readOnly ? () => setDenied((n) => n + 1) : undefined}
        onKeyDown={
          readOnly
            ? (e) => {
                if (!NAVIGATION_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey) {
                  setDenied((n) => n + 1)
                }
              }
            : undefined
        }
      >
        <TiptapEditor
          key={noteId}
          noteId={noteId}
          initialContent={initialContent}
          remoteContent={remoteContent}
          editable={!readOnly}
          onChange={(content) => {
            if (readOnly) return
            markTyping()
            autosave.schedule({ content })
            realtime.sendLive({ content })
          }}
        />
        {readOnly && <DeniedTooltip trigger={denied} />}
      </div>

      <AttachmentsPanel noteId={noteId} canEdit={canEdit} />
    </article>
  )
}

/** Touches qui ne cherchent pas à modifier le texte : rien à refuser. */
const NAVIGATION_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Tab',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'Escape',
])

function ReadOnlyBadge() {
  return (
    <span
      data-testid="note-readonly-badge"
      title="Vous consultez cette note en lecture seule"
      className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-line-strong)] px-2 py-0.5 text-xs opacity-70"
    >
      <MemoIcon name="lock" size={12} />
      Lecture seule
    </span>
  )
}

function DeniedTooltip({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (trigger === 0) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), 3000)
    return () => window.clearTimeout(id)
  }, [trigger])

  if (!visible) return null
  return (
    <div
      role="status"
      data-testid="note-readonly-tooltip"
      className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-3 py-2 text-xs text-[var(--color-text)] shadow-[0_2px_10px_var(--color-shadow)] backdrop-blur-[8px]"
    >
      Vous n’avez pas les droits pour modifier cette note (lecture seule).
    </div>
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
