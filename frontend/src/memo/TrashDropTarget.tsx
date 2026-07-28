import { useState } from 'react'
import type { DragEvent } from 'react'
import { TrashButton } from './TrashButton'
import { useTrashDrop } from '../hooks/useTrash'
import { getDragItem, hasDragItem } from './sidebar/dragItem'
import { useDialog } from './dialog/DialogProvider'

/** Le bouton corbeille de la sidebar fait aussi zone de dépôt pour l'arbre. */
export function TrashDropTarget({
  workspaceId,
  onOpen,
  className,
}: {
  workspaceId: string
  onOpen: () => void
  className?: string
}) {
  const [over, setOver] = useState(false)
  const dialog = useDialog()
  const { deleteFolder, deleteNote } = useTrashDrop(workspaceId)

  const allowDrop = (e: DragEvent) => {
    if (!hasDragItem(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const item = getDragItem(e)
    if (!item) return
    try {
      // Pas de confirmation : le dépôt est restaurable dans les deux cas.
      if (item.kind === 'folder') {
        await deleteFolder.mutateAsync(item.id)
      } else {
        await deleteNote.mutateAsync(item.id)
      }
    } catch {
      void dialog.alert({ message: 'La suppression a échoué.', variant: 'danger' })
    }
  }

  return (
    <TrashButton
      onClick={onOpen}
      className={className}
      dropActive={over}
      onDragOver={allowDrop}
      onDragEnter={(e) => {
        if (hasDragItem(e)) setOver(true)
      }}
      onDragLeave={(e) => {
        // Le SVG enfant émet aussi l'évènement : ignorer les passages internes.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={onDrop}
    />
  )
}
