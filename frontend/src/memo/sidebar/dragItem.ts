import type { DragEvent } from 'react'

/**
 * Charge utile d'un glisser-déposer dans l'arbre. Elle passe par le
 * `dataTransfer` natif et non par un état React, pour que la source et les
 * cibles communiquent sans dépendre de la hiérarchie des composants.
 *
 * `parentId` permet de rejeter un dépôt sans effet — sur le conteneur d'origine
 * — sans avoir à retrouver l'élément dans l'arbre.
 */
export type DragItem = {
  kind: 'folder' | 'note'
  id: string
  name: string
  parentId: string | null
}

// Type MIME maison : pendant `dragover`, seul `dataTransfer.types` est lisible
// (le contenu ne l'est qu'au `drop`), d'où ce marqueur pour reconnaître nos lignes.
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
