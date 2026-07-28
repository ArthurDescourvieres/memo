import type { Folder } from '../../lib/types'
import type { FolderTreeNode } from './buildFolderTree'

export type FlatNote = { id: string; title: string }

/**
 * La virtualisation exige une liste linéaire : chaque ligne porte donc sa
 * profondeur, pour l'indentation et `aria-level`.
 */
export type FlatRow =
  | {
      kind: 'folder'
      key: string
      id: string
      folder: Folder
      depth: number
      parentId: string | null
      isOpen: boolean
    }
  | { kind: 'note'; key: string; id: string; note: FlatNote; depth: number; parentId: string }
  | { kind: 'create'; key: string; parentId: string; createKind: 'note' | 'folder'; depth: number }
  | { kind: 'placeholder'; key: string; parentId: string; depth: number; label: string }

type FlattenInput = {
  roots: FolderTreeNode[]
  expanded: Set<string>
  notesByFolder: Map<string, FlatNote[]>
  pendingFolders: Set<string>
  creating: { parentId: string; kind: 'note' | 'folder' } | null
}

/** Parcours en profondeur, dans l'ordre d'affichage. */
export function flattenTree({
  roots,
  expanded,
  notesByFolder,
  pendingFolders,
  creating,
}: FlattenInput): FlatRow[] {
  const rows: FlatRow[] = []

  const walk = (nodes: FolderTreeNode[], depth: number) => {
    for (const node of nodes) {
      const { folder, children } = node
      const isOpen = expanded.has(folder.id)
      rows.push({
        kind: 'folder',
        key: `f:${folder.id}`,
        id: folder.id,
        folder,
        depth,
        parentId: folder.parentId,
        isOpen,
      })
      if (!isOpen) continue

      const creatingHere = creating?.parentId === folder.id
      if (creatingHere) {
        rows.push({
          kind: 'create',
          key: `c:${folder.id}`,
          parentId: folder.id,
          createKind: creating!.kind,
          depth: depth + 1,
        })
      }

      walk(children, depth + 1)

      const notes = notesByFolder.get(folder.id)
      if (!notes && pendingFolders.has(folder.id)) {
        rows.push({
          kind: 'placeholder',
          key: `l:${folder.id}`,
          parentId: folder.id,
          depth: depth + 1,
          label: '…',
        })
      } else if (notes) {
        for (const n of notes) {
          rows.push({
            kind: 'note',
            key: `n:${n.id}`,
            id: n.id,
            note: n,
            depth: depth + 1,
            parentId: folder.id,
          })
        }
        if (notes.length === 0 && children.length === 0 && !creatingHere) {
          rows.push({
            kind: 'placeholder',
            key: `e:${folder.id}`,
            parentId: folder.id,
            depth: depth + 1,
            label: 'Vide',
          })
        }
      }
    }
  }

  walk(roots, 0)
  return rows
}
