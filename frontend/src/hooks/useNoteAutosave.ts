import { useCallback, useEffect, useRef, useState } from 'react'
import { useUpdateNote } from './useWorkspaces'
import type { TiptapDoc } from '../lib/types'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 2000

export function useNoteAutosave(noteId: string | null) {
  const mutation = useUpdateNote(noteId)
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ title?: string; content?: TiptapDoc } | null>(null)

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const payload = pendingRef.current
    if (!payload || !noteId) return
    pendingRef.current = null
    setStatus('saving')
    try {
      await mutation.mutateAsync(payload)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [mutation, noteId])

  /**
   * Abandonne la sauvegarde en attente sans l'envoyer. Utilisé quand l'écriture
   * vient d'être interdite (rétrogradation en VIEWER) : le débounce en cours
   * partirait vers un serveur qui répond 403, et l'UI afficherait « Erreur »
   * pour une frappe désormais sans objet.
   */
  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
    setStatus('idle')
  }, [])

  const schedule = useCallback(
    (patch: { title?: string; content?: TiptapDoc }) => {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch }
      setStatus('pending')
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void flush()
      }, DEBOUNCE_MS)
    },
    [flush],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  return { status, schedule, flush, cancel }
}
