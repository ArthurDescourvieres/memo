import type { CSSProperties, DragEvent, KeyboardEvent, ReactNode } from 'react'
import { ChevronRight, FilePlus, FolderPlus } from 'lucide-react'
import type { FlatRow } from './flattenTree'
import { smallInputClass } from './common'
import { setDragItem, type DragItem } from './dragItem'

const INDENT = 12

export type TreeRowHandlers = {
  setActiveIndex: (index: number) => void
  onSelectFolder: (id: string) => void
  onToggleFolder: (id: string) => void
  onOpenNote: (id: string) => void
  onBeginRename: (id: string, kind: 'folder' | 'note', current: string) => void
  onStartCreate: (parentId: string, kind: 'note' | 'folder') => void
  onDeleteFolder: (id: string, name: string) => void
  onDeleteNote: (id: string, title: string) => void
}

/**
 * Une ligne de note prend pour cible son dossier conteneur : viser la liste des
 * notes revient à viser le dossier, ce qui laisse de la marge au pointeur.
 */
export type TreeRowDnd = {
  dropFolderId: string | null
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  onDragOverFolder: (e: DragEvent, folderId: string) => void
  onDragLeaveFolder: (e: DragEvent, folderId: string) => void
  onDropFolder: (e: DragEvent, folderId: string) => void
}

export type TreeRowEdit = {
  renamingId: string | null
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  createValue: string
  onCreateChange: (v: string) => void
  onCreateCommit: () => void
  onCreateCancel: () => void
}

const rootClass =
  'block rounded-[6px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]'

function inputKeys(commit: () => void, cancel: () => void) {
  return (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') cancel()
  }
}

export function TreeRow({
  row,
  index,
  isActive,
  isSelected,
  canEdit,
  style,
  measureRef,
  handlers,
  edit,
  dnd,
}: {
  row: FlatRow
  index: number
  isActive: boolean
  isSelected: boolean
  canEdit: boolean
  style: CSSProperties
  measureRef: (el: HTMLDivElement | null) => void
  handlers: TreeRowHandlers
  edit: TreeRowEdit
  dnd: TreeRowDnd
}) {
  const common = { ref: measureRef, 'data-index': index, style } as const

  if (row.kind === 'create') {
    return (
      <div {...common} role="none" style={{ ...style }}>
        <div
          className="my-[3px] flex items-center rounded-[6px] py-1.5 pr-1.5"
          style={{ paddingLeft: row.depth * INDENT + 22 }}
        >
          <input
            value={edit.createValue}
            onChange={(e) => edit.onCreateChange(e.target.value)}
            onBlur={edit.onCreateCommit}
            onKeyDown={inputKeys(edit.onCreateCommit, edit.onCreateCancel)}
            placeholder={row.createKind === 'note' ? 'Titre de la note' : 'Nom du sous-dossier'}
            className={smallInputClass}
            autoFocus
          />
        </div>
      </div>
    )
  }

  if (row.kind === 'placeholder') {
    return (
      <div
        {...common}
        role="none"
        className="py-1 text-xs opacity-40"
        style={{ ...style, paddingLeft: row.depth * INDENT + 22 }}
      >
        {row.label}
      </div>
    )
  }

  const isRenaming = edit.renamingId === row.id
  const isFolder = row.kind === 'folder'
  const dropFolderId = isFolder ? row.id : row.parentId
  const isDropTarget = dnd.dropFolderId === dropFolderId

  return (
    <div
      {...common}
      role="treeitem"
      data-testid={`tree-${row.kind}`}
      data-id={row.id}
      aria-level={row.depth + 1}
      aria-expanded={isFolder ? row.isOpen : undefined}
      aria-selected={isSelected}
      tabIndex={isActive ? 0 : -1}
      data-row-index={index}
      draggable={canEdit && !isRenaming}
      onDragStart={(e) => {
        e.stopPropagation()
        const item: DragItem = {
          kind: row.kind,
          id: row.id,
          name: isFolder ? row.folder.name : row.note.title,
          parentId: row.parentId,
        }
        setDragItem(e, item)
        dnd.onDragStart(item)
      }}
      onDragEnd={dnd.onDragEnd}
      onDragOver={(e) => dnd.onDragOverFolder(e, dropFolderId)}
      onDragLeave={(e) => dnd.onDragLeaveFolder(e, dropFolderId)}
      onDrop={(e) => dnd.onDropFolder(e, dropFolderId)}
      onFocus={() => handlers.setActiveIndex(index)}
      onClick={() => {
        if (isFolder) {
          handlers.onSelectFolder(row.id)
          handlers.onToggleFolder(row.id)
        } else {
          handlers.onOpenNote(row.id)
        }
      }}
      onDoubleClick={(e) => {
        if (!canEdit) return
        e.stopPropagation()
        handlers.onBeginRename(row.id, row.kind, isFolder ? row.folder.name : row.note.title)
      }}
      className={rootClass}
    >
      <div
        className={`group my-[3px] flex cursor-pointer items-center gap-1 rounded-[6px] py-1.5 pr-1.5 text-[15px] ${
          isSelected || isDropTarget ? 'bg-[var(--color-accent-soft)]' : 'bg-transparent'
        } ${
          isDropTarget
            ? 'outline outline-2 -outline-offset-2 outline-dashed outline-[var(--color-accent)]'
            : ''
        }`}
        style={{ paddingLeft: row.depth * INDENT + (isFolder ? 6 : 22) }}
      >
        {isFolder && (
          <ChevronRight
            aria-hidden
            size={14}
            className={`shrink-0 opacity-60 transition-transform ${row.isOpen ? 'rotate-90' : ''}`}
          />
        )}
        {isRenaming ? (
          <input
            value={edit.renameValue}
            onChange={(e) => edit.onRenameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={edit.onRenameCommit}
            onKeyDown={inputKeys(edit.onRenameCommit, edit.onRenameCancel)}
            className={smallInputClass}
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate">
            {isFolder ? row.folder.name : row.note.title || '(sans titre)'}
          </span>
        )}
        {canEdit && !isRenaming && isFolder && (
          <span
            className={`flex shrink-0 items-center gap-0.5 transition-opacity group-hover:opacity-100 ${
              isSelected || isActive ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ActionBtn label="Nouvelle note" onClick={() => handlers.onStartCreate(row.id, 'note')}>
              <FilePlus size={15} />
            </ActionBtn>
            <ActionBtn
              label="Nouveau sous-dossier"
              onClick={() => handlers.onStartCreate(row.id, 'folder')}
            >
              <FolderPlus size={15} />
            </ActionBtn>
          </span>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex shrink-0 cursor-pointer items-center rounded border-none bg-transparent p-1 text-inherit opacity-70 transition-colors hover:bg-[var(--color-surface-strong)] hover:opacity-100"
    >
      {children}
    </button>
  )
}
