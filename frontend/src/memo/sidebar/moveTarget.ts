import type { Folder } from '../../lib/types'
import { ancestorFolderIds } from './buildFolderTree'
import type { DragItem } from './dragItem'

/**
 * Cible d'un dépôt dans l'arbre : un dossier, ou la racine du workspace (le
 * bandeau de section, qui sert à ressortir un dossier de son parent).
 */
export type DropTarget = { kind: 'folder'; id: string } | { kind: 'root' }

/**
 * Décide si l'élément glissé peut être déposé sur la cible. Le serveur applique
 * les mêmes garde-fous (même workspace, anti-cycle) ; ici on évite simplement de
 * proposer une cible qui serait refusée — ou sans effet.
 *
 * Règles :
 *  - une note vit toujours dans un dossier (`Note.folderId` est non nul côté
 *    base) : elle ne peut pas être déposée sur la racine ;
 *  - un dépôt sur le conteneur d'origine ne change rien : refusé ;
 *  - un dossier ne peut aller ni sur lui-même ni dans son propre sous-arbre,
 *    sans quoi l'arborescence formerait une boucle.
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
