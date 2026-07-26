import type { DragEvent } from 'react'

/**
 * Charge utile transportée lors d'un glisser-déposer d'une ligne de l'arbre
 * (dossier ou note) vers la corbeille ou vers un autre dossier. On passe par le
 * `dataTransfer` natif — et non par un état React — pour que la source (TreeRow)
 * et les cibles (TrashDropTarget, autres lignes de l'arbre) communiquent sans
 * dépendre de la hiérarchie des composants.
 *
 * `parentId` (dossier conteneur au départ, null pour un dossier racine) permet
 * de rejeter un dépôt sans effet — sur le conteneur d'origine — sans avoir à
 * retrouver l'élément dans l'arbre.
 */
export type DragItem = {
  kind: 'folder' | 'note'
  id: string
  name: string
  parentId: string | null
}

// Type MIME custom : permet de distinguer nos lignes d'un drag quelconque et,
// pendant `dragover`, de tester `dataTransfer.types` (le contenu, lui, n'est
// lisible qu'au `drop` pour des raisons de sécurité).
const MIME = 'application/x-memo-item'

export function setDragItem(e: DragEvent, item: DragItem) {
  e.dataTransfer.setData(MIME, JSON.stringify(item))
  e.dataTransfer.effectAllowed = 'move'
}

export function getDragItem(e: DragEvent): DragItem | null {
  const raw = e.dataTransfer.getData(MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragItem
  } catch {
    return null
  }
}

export function hasDragItem(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(MIME)
}
