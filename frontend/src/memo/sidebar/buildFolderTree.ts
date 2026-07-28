import type { Folder } from '../../lib/types'

export type FolderTreeNode = {
  folder: Folder
  children: FolderTreeNode[]
}

/**
 * Un dossier dont le parent n'est pas dans le lot est traité comme racine.
 * L'ordre de l'API est préservé à chaque niveau, la liste étant parcourue telle quelle.
 */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>()
  for (const folder of folders) byId.set(folder.id, { folder, children: [] })

  const roots: FolderTreeNode[] = []
  for (const folder of folders) {
    const node = byId.get(folder.id)!
    const parent = folder.parentId ? byId.get(folder.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** Ancêtres d'un dossier, du plus proche à la racine. `visited` garde des cycles. */
export function ancestorFolderIds(folders: Folder[], folderId: string | null): string[] {
  if (!folderId) return []
  const byId = new Map(folders.map((f) => [f.id, f]))
  const ids: string[] = []
  const visited = new Set<string>([folderId])
  let current = byId.get(folderId)
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId)
    ids.push(current.parentId)
    current = byId.get(current.parentId)
  }
  return ids
}
