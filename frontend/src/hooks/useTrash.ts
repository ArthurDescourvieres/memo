import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Folder, Note, Paginated } from '../lib/types'
import { useDeleteFolder } from './useWorkspaces'

// `enabled` retarde la requête jusqu'à l'ouverture du panneau corbeille.
export function useDeletedNotes(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['trash', workspaceId],
    queryFn: () =>
      api<Paginated<Note>>(`/api/workspaces/${workspaceId}/trash`).then((page) => page.items),
    enabled: Boolean(workspaceId) && enabled,
  })
}

export function useDeletedFolders(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['trash-folders', workspaceId],
    queryFn: () => api<Folder[]>(`/api/workspaces/${workspaceId}/trash/folders`),
    enabled: Boolean(workspaceId) && enabled,
  })
}

/** Dépôt d'un élément sur la corbeille : soft-delete restaurable dans les deux cas. */
export function useTrashDrop(workspaceId: string) {
  const qc = useQueryClient()
  const deleteFolder = useDeleteFolder(workspaceId)
  const deleteNote = useMutation({
    mutationFn: (id: string) => api<void>(`/api/notes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['trash', workspaceId] })
      // Si la note est ouverte elle revient avec `deletedAt`, ce qui referme
      // l'éditeur (voir NoteEditor).
      qc.invalidateQueries({ queryKey: ['note', id] })
    },
  })
  return { deleteFolder, deleteNote }
}

export function useRestoreNote(workspaceId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => api<Note>(`/api/notes/${noteId}/restore`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash', workspaceId] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useRestoreFolder(workspaceId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (folderId: string) =>
      api<void>(`/api/workspaces/${workspaceId}/folders/${folderId}/restore`, { method: 'PATCH' }),
    onSuccess: () => {
      // Tout le sous-arbre revient avec le dossier.
      qc.invalidateQueries({ queryKey: ['trash-folders', workspaceId] })
      qc.invalidateQueries({ queryKey: ['folders', workspaceId] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
