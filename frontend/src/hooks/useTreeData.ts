import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Folder, Note, Paginated } from '../lib/types'
import { useCreateFolder, useDeleteFolder, useUpdateFolder } from './useWorkspaces'
import type { FlatNote } from '../memo/sidebar/flattenTree'

/**
 * Un fetch par dossier déplié, plus les mutations de l'arbre. Centralisé ici
 * parce que la virtualisation impose de connaître toutes les notes visibles
 * d'un coup : impossible de charger note par note dans des composants enfants.
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
      // Deux dossiers changent de contenu, et la note porte son `folderId` dont
      // la coquille se sert pour rouvrir l'arbre au bon endroit.
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
