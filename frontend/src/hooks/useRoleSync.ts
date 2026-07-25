import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'

type RoleEvent = { workspaceId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' | null }

/**
 * Applique en direct les changements de droits décidés par un propriétaire.
 *
 * Le rôle courant vient de la liste des workspaces, mise en cache par React
 * Query : sans ce canal, un membre rétrogradé EDITOR → VIEWER gardait un
 * éditeur ouvert et modifiable jusqu'au prochain rechargement (ses écritures
 * partaient puis étaient refusées par le serveur — l'erreur arrivait après
 * coup). Le backend émet `workspace:role` dans la room personnelle du membre ;
 * on invalide alors les requêtes qui portent le rôle, et l'UI se verrouille.
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
