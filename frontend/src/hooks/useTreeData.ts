import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Folder, Note, Paginated } from '../lib/types'
import { useCreateFolder, useDeleteFolder, useUpdateFolder } from './useWorkspaces'
import type { FlatNote } from '../memo/sidebar/flattenTree'

/**
 * Charge les notes des dossiers actuellement dépliés (lazy : un seul fetch par
 * dossier ouvert, via `useQueries`) et expose les mutations dont l'arbre a
 * besoin. Centralisé ici pour que `FolderTree` reste un composant de rendu :
 * la virtualisation impose de connaître toutes les notes visibles d'un coup,
 * donc on ne peut plus charger note par note dans des composants enfants.
 */
export function useTreeData(workspaceId: string, openIds: string[]) {
  const qc = useQueryClient()

  const notesResults = useQueries({
    queries: openIds.map((folderId) => ({
      queryKey: ['notes', workspaceId, folderId],
      queryFn: () =>
        api<Paginated<Note>>(`/api/workspaces/${workspaceId}/folders/${folderId}/notes`).then(
          (page) => page.items as FlatNote[],
        ),
      enabled: Boolean(workspaceId),
    })),
  })

  const notesByFolder = new Map<string, FlatNote[]>()
  const pendingFolders = new Set<string>()
  openIds.forEach((id, i) => {
    const r = notesResults[i]
    if (r?.data) notesByFolder.set(id, r.data)
    if (r?.isPending) pendingFolders.add(id)
  })

  const createFolder = useCreateFolder(workspaceId)
  const updateFolder = useUpdateFolder(workspaceId)
  const deleteFolder = useDeleteFolder(workspaceId)

  const createNote = useMutation({
    mutationFn: ({ folderId, title }: { folderId: string; title: string }) =>
      api<Note>(`/api/workspaces/${workspaceId}/folders/${folderId}/notes`, {
        method: 'POST',
        json: { title, folderId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  const renameNote = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api<Note>(`/api/notes/${id}`, { method: 'PATCH', json: { title } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  // Déplacements (glisser-déposer dans l'arbre). Le serveur valide la cible :
  // même workspace, et pas de cycle pour un dossier.
  const moveFolder = useMutation({
    mutationFn: ({ id, targetParentId }: { id: string; targetParentId: string | null }) =>
      api<Folder>(`/api/workspaces/${workspaceId}/folders/${id}/move`, {
        method: 'PATCH',
        json: { targetParentId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders', workspaceId] }),
  })

  const moveNote = useMutation({
    mutationFn: ({ id, targetFolderId }: { id: string; targetFolderId: string }) =>
      api<Note>(`/api/notes/${id}/move`, { method: 'PATCH', json: { targetFolderId } }),
    onSuccess: (_note, { id }) => {
      // Les deux dossiers concernés changent de contenu : on invalide toutes les
      // listes de notes. La note elle-même porte son `folderId` (la coquille s'en
      // sert pour rouvrir l'arbre au bon endroit) : à rafraîchir aussi.
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['note', id] })
    },
  })

  const deleteNote = useMutation({
    mutationFn: (id: string) => api<void>(`/api/notes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['trash', workspaceId] })
      qc.invalidateQueries({ queryKey: ['note', id] })
    },
  })

  return {
    notesByFolder,
    pendingFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    createNote,
    renameNote,
    deleteNote,
    moveFolder,
    moveNote,
  }
}
