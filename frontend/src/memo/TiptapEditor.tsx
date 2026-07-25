import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { useEffect, useRef } from 'react'
import type { TiptapDoc } from '../lib/types'
import { AttachmentAwareImage } from './TiptapImageNode'
import { useUploadAttachment, attachmentFileUrl } from '../hooks/useAttachments'
import { useDialog } from './dialog/DialogProvider'

const lowlight = createLowlight(common)

export type TiptapEditorProps = {
  noteId: string
  initialContent: TiptapDoc | null
  remoteContent?: TiptapDoc | null
  onChange: (doc: TiptapDoc) => void
  editable?: boolean
}

export function TiptapEditor({
  noteId,
  initialContent,
  remoteContent,
  onChange,
  editable = true,
}: TiptapEditorProps) {
  const upload = useUploadAttachment(noteId)
  const dialog = useDialog()
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      AttachmentAwareImage.configure({ inline: false, allowBase64: false }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    editable,
    content: initialContent ?? defaultDoc(),
    editorProps: {
      // Hook stable pour les tests E2E : pose le data-testid directement sur
      // l'élément contenteditable de ProseMirror (aucun impact comportemental).
      attributes: { 'data-testid': 'note-editor-content' },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as TiptapDoc)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
    // Sans `contenteditable`, la zone n'est plus focalisable : on lui rend un
    // tabindex pour qu'elle reçoive quand même le focus et les évènements
    // clavier — l'appelant peut alors expliquer pourquoi la frappe n'écrit rien.
    const dom = editor.view.dom
    if (editable) dom.removeAttribute('tabindex')
    else dom.setAttribute('tabindex', '0')
  }, [editor, editable])

  // Apply remote updates without re-firing onUpdate (avoid feedback loops).
  useEffect(() => {
    if (!editor || !remoteContent) return
    const current = editor.getJSON() as TiptapDoc
    if (JSON.stringify(current) === JSON.stringify(remoteContent)) return
    editor.commands.setContent(remoteContent, { emitUpdate: false })
  }, [editor, remoteContent])

  if (!editor) return <div className="p-6 opacity-50">Chargement de l'éditeur…</div>

  const handleUpload = async (file: File) => {
    try {
      const attachment = await upload.mutateAsync(file)
      editor
        .chain()
        .focus()
        .setImage({ src: attachmentFileUrl(attachment.id), alt: attachment.filename })
        .run()
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'payload' in e
          ? JSON.stringify((e as { payload: unknown }).payload)
          : 'Échec de l’envoi'
      void dialog.alert({ title: 'Upload refusé', message: msg, variant: 'danger' })
    }
  }

  return (
    <div className="tiptap-wrapper flex flex-col gap-3">
      {/* En lecture seule, la barre d'outils n'aurait aucun effet : on la retire
          plutôt que d'offrir des boutons morts. */}
      {editable && <Toolbar editor={editor} onUpload={handleUpload} uploading={upload.isPending} />}
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  )
}

function defaultDoc(): TiptapDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

const separatorClass = 'mx-1 w-px bg-[var(--color-line-strong)]'

function Toolbar({
  editor,
  onUpload,
  uploading,
}: {
  editor: Editor
  onUpload: (file: File) => void
  uploading: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const btn = (label: string, isActive: boolean, onClick: () => void): React.ReactNode => (
    <button
      type="button"
      onClick={onClick}
      className={`${
        isActive ? 'bg-[var(--color-accent-soft)]' : 'bg-[var(--color-surface)]'
      } cursor-pointer rounded border border-[var(--color-line)] px-2 py-1 text-xs text-inherit`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap gap-1.5">
      {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn('U', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
      {btn('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
      <span className={separatorClass} />
      {btn('H1', editor.isActive('heading', { level: 1 }), () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
      )}
      {btn('H2', editor.isActive('heading', { level: 2 }), () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
      )}
      {btn('H3', editor.isActive('heading', { level: 3 }), () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(),
      )}
      <span className={separatorClass} />
      {btn('• Liste', editor.isActive('bulletList'), () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {btn('1. Liste', editor.isActive('orderedList'), () =>
        editor.chain().focus().toggleOrderedList().run(),
      )}
      {btn('Code', editor.isActive('codeBlock'), () =>
        editor.chain().focus().toggleCodeBlock().run(),
      )}
      <span className={separatorClass} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`${
          uploading ? 'cursor-wait' : 'cursor-pointer'
        } rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-xs text-inherit`}
      >
        {uploading ? '…' : '+ Image'}
      </button>
    </div>
  )
}
