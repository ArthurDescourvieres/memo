import type { Folder } from '../../lib/types'
import { ancestorFolderIds } from './buildFolderTree'
import type { DragItem } from './dragItem'

export type DropTarget = { kind: 'folder'; id: string } | { kind: 'root' }

/**
 * Le serveur applique les mêmes garde-fous ; ici on évite seulement de proposer
 * une cible qui serait refusée, ou sans effet. Une note ne peut pas atterrir sur
 * la racine (`folderId` est non nul en base), et un dossier ne peut pas entrer
 * dans son propre sous-arbre.
 */
export function canDropOn(item: DragItem, target: DropTarget, folders: Folder[]): boolean {
  if (target.kind === 'root') {
    return item.kind === 'folder' && item.parentId !== null
  }
  if (item.parentId === target.id) return false
  if (item.kind === 'note') return true
  if (item.id === target.id) return false
  return !ancestorFolderIds(folders, target.id).includes(item.id)
}
