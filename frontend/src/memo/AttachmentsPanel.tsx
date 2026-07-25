import { useRef } from 'react'
import {
  attachmentFileUrl,
  useDeleteAttachment,
  useNoteAttachments,
  useUploadAttachment,
  type Attachment,
} from '../hooks/useAttachments'
import { useBlobUrl } from './AttachmentImage'
import { useDialog } from './dialog/DialogProvider'

const KB = 1024
const MB = KB * 1024

function formatSize(bytes: number): string {
  if (bytes < KB) return `${bytes} o`
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} ko`
  return `${(bytes / MB).toFixed(1)} Mo`
}

export function AttachmentsPanel({
  noteId,
  canEdit = true,
}: {
  noteId: string
  canEdit?: boolean
}) {
  const { data, isPending } = useNoteAttachments(noteId)
  const upload = useUploadAttachment(noteId)
  const remove = useDeleteAttachment(noteId)
  const dialog = useDialog()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onPickFile = () => fileInputRef.current?.click()
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await upload.mutateAsync(file)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'payload' in err
          ? JSON.stringify((err as { payload: unknown }).payload)
          : 'Échec'
      void dialog.alert({ title: 'Upload refusé', message: msg, variant: 'danger' })
    }
  }

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
      <header className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[1px] opacity-50">Pièces jointes</span>
        {/* Lecture seule : les pièces jointes restent consultables, mais aucune
            action d'écriture n'est proposée (le serveur les refuserait). */}
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={onChange}
            />
            <button
              type="button"
              onClick={onPickFile}
              disabled={upload.isPending}
              className={`${
                upload.isPending ? 'cursor-wait' : 'cursor-pointer'
              } rounded border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs text-inherit`}
            >
              {upload.isPending ? 'Envoi…' : '+ Ajouter un fichier'}
            </button>
          </>
        )}
      </header>

      {isPending ? (
        <div className="text-xs opacity-40">…</div>
      ) : !data || data.length === 0 ? (
        <div className="text-xs opacity-40">Aucune pièce jointe</div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-0">
          {data.map((a) => (
            <AttachmentItem
              key={a.id}
              attachment={a}
              onDelete={canEdit ? () => remove.mutate(a.id) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function AttachmentItem({
  attachment,
  onDelete,
}: {
  attachment: Attachment
  onDelete?: () => void
}) {
  const isImage = attachment.mimeType.startsWith('image/')
  const url = attachmentFileUrl(attachment.id)
  const { url: blobUrl } = useBlobUrl(isImage ? url : null)

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-[var(--color-surface-strong)] bg-[var(--color-surface)] p-2">
      {isImage ? (
        blobUrl ? (
          <img
            src={blobUrl}
            alt={attachment.filename}
            className="h-[100px] w-full rounded object-cover"
          />
        ) : (
          <div className="grid h-[100px] place-items-center opacity-40">…</div>
        )
      ) : (
        <div className="grid h-[100px] place-items-center rounded bg-[var(--color-surface)] text-[11px] opacity-60">
          {attachment.mimeType.split('/')[1]?.toUpperCase() ?? 'FILE'}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="truncate text-xs">{attachment.filename}</span>
        <span className="text-[11px] opacity-50">{formatSize(attachment.size)}</span>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="cursor-pointer rounded border border-[var(--color-danger-border)] bg-transparent px-1.5 py-0.5 text-[11px] text-[var(--color-danger)]"
        >
          Supprimer
        </button>
      )}
    </li>
  )
}
