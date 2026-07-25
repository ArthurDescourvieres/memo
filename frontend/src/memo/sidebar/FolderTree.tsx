import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTreeData } from '../../hooks/useTreeData'
import type { Folder } from '../../lib/types'
import { ancestorFolderIds, buildFolderTree } from './buildFolderTree'
import { flattenTree } from './flattenTree'
import { resolveTreeKey } from './treeKeyboard'
import { TreeRow, type TreeRowEdit, type TreeRowHandlers } from './TreeRow'
import { useDialog } from '../dialog/DialogProvider'
import {
  SectionHeader,
  sectionClass,
  smallInputClass,
  smallButtonClass,
  loadingClass,
  emptyClass,
} from './common'

type RenameState = { id: string; kind: 'folder' | 'note'; value: string }
type CreateState = { parentId: string; kind: 'note' | 'folder'; value: string }

/**
 * Arborescence accessible ET virtualisée : l'arbre est aplati en liste linéaire
 * (flattenTree), seuls les ~éléments visibles sont rendus (@tanstack/react-virtual),
 * et la navigation clavier travaille sur les index (resolveTreeKey) puisque les
 * lignes hors écran n'existent pas dans le DOM. ARIA « tree » à plat : chaque
 * ligne porte aria-level / aria-expanded / aria-selected.
 */
export function FolderTree({
  workspaceId,
  folders,
  selectedFolderId,
  selectedNoteId,
  onSelectFolder,
  onOpenNote,
  isLoading,
  canEdit,
  revealFolderId,
  revealNonce,
  revealFocus = true,
}: {
  workspaceId: string
  folders: Folder[]
  selectedFolderId: string | null
  selectedNoteId: string | null
  onSelectFolder: (id: string) => void
  onOpenNote: (id: string) => void
  isLoading: boolean
  canEdit: boolean
  revealFolderId: string | null
  revealNonce: number
  /** Déplier ET focaliser la ligne (saut depuis la recherche), ou déplier seul. */
  revealFocus?: boolean
}) {
  const dialog = useDialog()
  const roots = useMemo(() => buildFolderTree(folders), [folders])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [renaming, setRenaming] = useState<RenameState | null>(null)
  const [creating, setCreating] = useState<CreateState | null>(null)
  const [rootCreating, setRootCreating] = useState(false)
  const [rootName, setRootName] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)
  const pendingReveal = useRef<string | null>(null)
  // null = aucune révélation encore appliquée. Distinguer ce cas de « nonce 0 »
  // permet d'honorer une cible déjà posée au montage : en mobile la sidebar est
  // démontée quand la note est ouverte, elle doit se déplier au bon endroit en
  // revenant dessus (typiquement après restauration au rechargement).
  const lastNonce = useRef<number | null>(null)

  const openIds = useMemo(
    () => folders.filter((f) => expanded.has(f.id)).map((f) => f.id),
    [folders, expanded],
  )
  const data = useTreeData(workspaceId, openIds)

  const rows = flattenTree({
    roots,
    expanded,
    notesByFolder: data.notesByFolder,
    pendingFolders: data.pendingFolders,
    creating: creating ? { parentId: creating.parentId, kind: creating.kind } : null,
  })

  const activeIdx = rows.length ? Math.min(activeIndex, rows.length - 1) : 0

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 12,
  })

  const toggle = (id: string, open?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      const shouldOpen = open ?? !next.has(id)
      if (shouldOpen) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const focusIndex = (index: number) => {
    setActiveIndex(index)
    pendingFocus.current = true
    rowVirtualizer.scrollToIndex(index, { align: 'auto' })
  }

  // Focus différé : la ligne cible peut être hors écran (donc pas encore dans le
  // DOM) ; on la focalise dès qu'elle est rendue après le scroll.
  useEffect(() => {
    if (!pendingFocus.current) return
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-row-index="${activeIdx}"]`)
    if (el) {
      el.focus()
      pendingFocus.current = false
    }
  })

  // Dépliage « révélation » (saut via recherche, restauration au rechargement),
  // déclenché par un nouveau nonce — jamais par un clic de sélection.
  useEffect(() => {
    if (revealNonce === lastNonce.current) return
    lastNonce.current = revealNonce
    if (!revealFolderId) return
    const path = [revealFolderId, ...ancestorFolderIds(folders, revealFolderId)]
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of path) next.add(id)
      return next
    })
    // Le focus n'est pris que pour un saut demandé par l'utilisateur : une
    // restauration ne doit pas voler le clavier à l'ouverture de l'app.
    if (revealFocus) pendingReveal.current = revealFolderId
  }, [revealNonce, revealFolderId, revealFocus, folders])

  // Une fois le chemin déplié et la ligne présente, on la focalise.
  useEffect(() => {
    const target = pendingReveal.current
    if (!target) return
    const idx = rows.findIndex((r) => r.kind === 'folder' && r.id === target)
    if (idx >= 0) {
      pendingReveal.current = null
      focusIndex(idx)
    }
  })

  const commitRename = async () => {
    if (!renaming) return
    const { id, kind, value } = renaming
    const next = value.trim()
    setRenaming(null)
    if (!next) return
    try {
      if (kind === 'folder') {
        const folder = folders.find((f) => f.id === id)
        if (folder && next !== folder.name) await data.updateFolder.mutateAsync({ id, name: next })
      } else {
        await data.renameNote.mutateAsync({ id, title: next })
      }
    } catch {
      void dialog.alert({ message: 'Le renommage a échoué.', variant: 'danger' })
    }
  }

  const commitCreate = async () => {
    if (!creating) return
    const { parentId, kind, value } = creating
    const v = value.trim()
    setCreating(null)
    if (!v) return
    try {
      if (kind === 'folder') {
        await data.createFolder.mutateAsync({ name: v, parentId })
      } else {
        const note = await data.createNote.mutateAsync({ folderId: parentId, title: v })
        onOpenNote(note.id)
      }
    } catch {
      void dialog.alert({ message: 'La création a échoué.', variant: 'danger' })
    }
  }

  const handlers: TreeRowHandlers = {
    setActiveIndex,
    onSelectFolder,
    onToggleFolder: (id) => toggle(id),
    onOpenNote,
    onBeginRename: (id, kind, current) => {
      setCreating(null)
      setRenaming({ id, kind, value: current })
    },
    onStartCreate: (parentId, kind) => {
      setRenaming(null)
      setCreating({ parentId, kind, value: '' })
      toggle(parentId, true)
    },
    onDeleteFolder: async (id, name) => {
      const ok = await dialog.confirm({
        title: 'Supprimer le dossier',
        message: (
          <>
            Le dossier <strong>« {name} »</strong> et tout son contenu seront supprimés
            définitivement.
          </>
        ),
        confirmLabel: 'Supprimer',
        variant: 'danger',
      })
      if (ok) data.deleteFolder.mutate(id)
    },
    onDeleteNote: async (id, title) => {
      const ok = await dialog.confirm({
        title: 'Supprimer la note',
        message: (
          <>
            La note <strong>« {title || 'sans titre'} »</strong> sera supprimée.
          </>
        ),
        confirmLabel: 'Supprimer',
        variant: 'danger',
      })
      if (ok) data.deleteNote.mutate(id)
    },
  }

  const edit: TreeRowEdit = {
    renamingId: renaming?.id ?? null,
    renameValue: renaming?.value ?? '',
    onRenameChange: (v) => setRenaming((r) => (r ? { ...r, value: v } : r)),
    onRenameCommit: () => void commitRename(),
    onRenameCancel: () => setRenaming(null),
    createValue: creating?.value ?? '',
    onCreateChange: (v) => setCreating((c) => (c ? { ...c, value: v } : c)),
    onCreateCommit: () => void commitCreate(),
    onCreateCancel: () => setCreating(null),
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const action = resolveTreeKey(e.key, rows, activeIdx)
    if (!action) return
    e.preventDefault()
    if (action.type === 'move') {
      focusIndex(action.index)
    } else if (action.type === 'toggle') {
      toggle(action.id, action.open)
    } else {
      const row = rows[action.index]
      if (row?.kind === 'folder') {
        onSelectFolder(row.id)
        toggle(row.id)
      } else if (row?.kind === 'note') {
        onOpenNote(row.id)
      }
    }
  }

  return (
    <section className={sectionClass}>
      <SectionHeader
        title="Dossiers"
        onAdd={canEdit ? () => setRootCreating((v) => !v) : undefined}
      />
      {rootCreating && canEdit && (
        // gap-2 et pas gap-1 : l'anneau de focus (:focus-visible, 2px + 2px
        // d'offset) déborde de 4px autour de l'input et toucherait le bouton.
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const v = rootName.trim()
            if (!v) return
            const folder = await data.createFolder.mutateAsync({ name: v })
            onSelectFolder(folder.id)
            setRootName('')
            setRootCreating(false)
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setRootName('')
              setRootCreating(false)
            }
          }}
          className="flex items-stretch gap-2"
        >
          <input
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            placeholder="Nom du dossier"
            className={smallInputClass}
            autoFocus
          />
          <button type="submit" className={smallButtonClass} disabled={data.createFolder.isPending}>
            +
          </button>
        </form>
      )}
      {isLoading ? (
        <div className={loadingClass}>…</div>
      ) : rows.length === 0 ? (
        <div className={emptyClass}>Aucun dossier</div>
      ) : (
        <div
          ref={scrollRef}
          onKeyDown={onKeyDown}
          className="no-scrollbar max-h-[50vh] overflow-y-auto"
        >
          <div
            role="tree"
            aria-label="Dossiers et notes"
            style={{ position: 'relative', width: '100%', height: rowVirtualizer.getTotalSize() }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index]
              const isSelected =
                row.kind === 'folder'
                  ? selectedFolderId === row.id
                  : row.kind === 'note'
                    ? selectedNoteId === row.id
                    : false
              return (
                <TreeRow
                  key={row.key}
                  row={row}
                  index={vi.index}
                  isActive={vi.index === activeIdx}
                  isSelected={isSelected}
                  canEdit={canEdit}
                  measureRef={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                  }}
                  handlers={handlers}
                  edit={edit}
                />
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
