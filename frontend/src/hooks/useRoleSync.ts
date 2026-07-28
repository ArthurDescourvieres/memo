import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'

type RoleEvent = { workspaceId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' | null }

/**
 * Le rôle courant vient du cache React Query. Sans ce canal, un membre
 * rétrogradé garderait un éditeur modifiable jusqu'au prochain rechargement :
 * ses écritures partiraient pour être refusées par le serveur après coup.
 */
export function useRoleSync(): void {
  const qc = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    const onRole = (e: RoleEvent) => {
      void qc.invalidateQueries({ queryKey: ['workspaces'] })
      if (e?.workspaceId) void qc.invalidateQueries({ queryKey: ['workspace', e.workspaceId] })
    }
    socket.on('workspace:role', onRole)
    return () => {
      socket.off('workspace:role', onRole)
    }
  }, [qc])
}
