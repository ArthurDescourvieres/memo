import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/auth/AuthContext'
import { useFolders, useNote, useWorkspaces, useDeleteWorkspace } from '../hooks/useWorkspaces'
import type { WorkspaceWithRole } from '../lib/types'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRoleSync } from '../hooks/useRoleSync'
import { readLastLocation, writeLastLocation } from '../lib/lastLocation'
import { SidebarToggleButton, SidebarOpenButton } from './SidebarToggle'
import { InviteModal } from './InviteSection'
import { InviteAcceptBanner } from './InviteAcceptBanner'
import { MembersModal } from './MembersModal'
import { WorkspaceFormModal } from './WorkspaceFormModal'
import { TrashModal } from './TrashModal'
import { SearchBox } from './sidebar/SearchBox'
import { WorkspaceBar } from './sidebar/WorkspaceBar'
import { FolderTree } from './sidebar/FolderTree'
import { NoteEditor } from './editor/NoteEditor'
import { EmptyState } from './EmptyState'
import { AccountModal } from './AccountModal'
import { ProfileMenu } from './ProfileMenu'
import { TrashDropTarget } from './TrashDropTarget'
import { useDialog } from './dialog/DialogProvider'

export function WorkspaceShell() {
  const auth = useAuth()
  const user = auth.status === 'authenticated' ? auth.user : null
  const dialog = useDialog()

  const isMobile = useIsMobile()
  const workspaces = useWorkspaces()
  // Un changement de rôle poussé par un propriétaire met `currentRole` à jour
  // sans rechargement.
  useRoleSync()

  // Les notes ne sont pas routées dans l'URL : c'est cette position mémorisée
  // qui rétablit l'écran quitté après un F5. Relue une seule fois, au montage.
  const [restored] = useState(() => readLastLocation(user?.id ?? null))
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    restored?.workspaceId ?? null,
  )
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    restored?.folderId ?? null,
  )
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(restored?.noteId ?? null)
  const [collapsed, setCollapsed] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [membersFor, setMembersFor] = useState<WorkspaceWithRole | null>(null)
  const [wsForm, setWsForm] = useState<
    { mode: 'create' } | { mode: 'edit'; workspace: WorkspaceWithRole } | null
  >(null)
  const del = useDeleteWorkspace()
  // Sur mobile, un seul volet à la fois. Ignoré sur desktop, où les deux cohabitent.
  const [mobilePane, setMobilePane] = useState<'list' | 'editor'>(
    restored?.noteId ? 'editor' : 'list',
  )
  // Cible à déplier dans l'arbre. Le nonce évite d'interférer avec les clics de
  // sélection ; `focus` distingue le saut demandé de la restauration silencieuse.
  const [reveal, setReveal] = useState<{
    folderId: string | null
    nonce: number
    focus: boolean
  }>({ folderId: null, nonce: 0, focus: true })

  // Premier workspace par défaut, et repli sur lui si le workspace restauré
  // n'existe plus (supprimé, accès révoqué entre-temps).
  useEffect(() => {
    const list = workspaces.data
    if (!list || list.length === 0) return
    if (selectedWorkspaceId && list.some((w) => w.id === selectedWorkspaceId)) return
    setSelectedWorkspaceId(list[0].id)
  }, [workspaces.data, selectedWorkspaceId])

  const folders = useFolders(selectedWorkspaceId)

  // Comparé au workspace précédent pour ne pas effacer, au montage, la
  // sélection tout juste restaurée depuis le stockage local.
  const prevWorkspaceRef = useRef(selectedWorkspaceId)
  useEffect(() => {
    if (prevWorkspaceRef.current === selectedWorkspaceId) return
    prevWorkspaceRef.current = selectedWorkspaceId
    setSelectedFolderId(null)
    setSelectedNoteId(null)
    setReveal((r) => ({ ...r, folderId: null }))
  }, [selectedWorkspaceId])

  // Une fois l'arbre chargé, déplier le chemin du dossier quitté pour que la
  // note restaurée soit visible sans redérouler les dossiers à la main.
  const revealRestored = useRef(Boolean(restored?.folderId))
  useEffect(() => {
    if (!revealRestored.current || !folders.data) return
    revealRestored.current = false
    const folderId = restored?.folderId
    if (!folderId || !folders.data.some((f) => f.id === folderId)) return
    setReveal((r) => ({ folderId, nonce: r.nonce + 1, focus: false }))
  }, [folders.data, restored])

  // Sans ça, l'écran d'accueil tenterait de créer une note dans un dossier
  // fantôme après sa suppression.
  useEffect(() => {
    if (selectedFolderId && folders.data && !folders.data.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(null)
    }
  }, [folders.data, selectedFolderId])

  // Le dossier porté par la note ouverte, pour rouvrir l'arbre au bon endroit
  // même quand elle vient de la recherche. Même clé de cache que l'éditeur,
  // donc aucune requête supplémentaire.
  const openedNote = useNote(selectedNoteId)
  const openedFolderId = openedNote.data?.id === selectedNoteId ? openedNote.data.folderId : null

  useEffect(() => {
    writeLastLocation(user?.id ?? null, {
      workspaceId: selectedWorkspaceId,
      folderId: openedFolderId ?? selectedFolderId,
      noteId: selectedNoteId,
    })
  }, [user?.id, selectedWorkspaceId, selectedFolderId, selectedNoteId, openedFolderId])

  const currentWorkspace = useMemo(
    () => workspaces.data?.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces.data, selectedWorkspaceId],
  )
  const currentRole = currentWorkspace?.role ?? null
  const canEdit = currentRole === 'OWNER' || currentRole === 'EDITOR'
  const isOwner = currentRole === 'OWNER'

  // `id` null (suppression de la note courante) ramène au menu en mobile.
  const openNote = (id: string | null) => {
    setSelectedNoteId(id)
    setMobilePane(id ? 'editor' : 'list')
  }

  // Mémoïsé : NoteEditor l'a en dépendance d'effet.
  const handleNoteGone = useCallback(() => {
    setSelectedNoteId(null)
    setMobilePane('list')
  }, [])

  const onDeleteWorkspace = async (ws: WorkspaceWithRole) => {
    const ok = await dialog.confirm({
      title: 'Supprimer le workspace',
      message: (
        <>
          Le workspace <strong>« {ws.name} »</strong> et tout son contenu (dossiers, notes, pièces
          jointes) seront définitivement perdus.
        </>
      ),
      confirmLabel: 'Supprimer',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(ws.id)
      if (ws.id === selectedWorkspaceId) setSelectedWorkspaceId(null)
    } catch {
      void dialog.alert({ message: 'La suppression a échoué.', variant: 'danger' })
    }
  }

  const showSidebar = !isMobile || mobilePane === 'list'
  const showMain = !isMobile || mobilePane === 'editor'

  return (
    <div
      data-testid="workspace-shell"
      className={`relative flex overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] ${
        isMobile ? 'h-[100dvh]' : 'h-screen'
      }`}
    >
      {showSidebar && (
        <div
          className={
            isMobile
              ? 'h-full w-full flex-auto overflow-hidden'
              : `my-4 ml-4 h-[calc(100vh-2rem)] flex-none overflow-hidden transition-[width] duration-[320ms] ease-[var(--ease-in-out)] ${
                  collapsed ? 'w-0' : 'w-[280px]'
                }`
          }
        >
          <aside
            className={`box-border flex h-full min-h-0 flex-col gap-4 overflow-x-hidden p-4 transition-transform duration-[320ms] ease-[var(--ease-in-out)] ${
              isMobile
                ? 'w-full translate-x-0 rounded-r-none border-r-0'
                : `w-[280px] rounded-[24px] border border-[var(--color-line)] ${
                    collapsed ? '-translate-x-full' : 'translate-x-0'
                  }`
            }`}
            style={{ background: 'var(--color-sidebar)' }}
          >
            <header className="flex items-center gap-2">
              {!isMobile && <SidebarToggleButton onClick={() => setCollapsed(true)} />}
              {/* En mobile le panneau couvre l'écran : le même bouton le referme
                  et ramène sur la note ouverte. */}
              {isMobile && selectedNoteId && (
                <SidebarToggleButton
                  onClick={() => setMobilePane('editor')}
                  label="Revenir à la note"
                />
              )}
              <strong>Memo</strong>
            </header>

            {user && (
              <div className="text-xs opacity-60">
                {user.name} · {user.email}
              </div>
            )}

            {/* Pas de défilement ici, c'est l'arbre qui défile. Les -mx/px
                compensés ménagent une gouttière pour que l'anneau de focus des
                champs ne soit pas rogné par le clip horizontal. */}
            <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-4 px-1.5">
              {selectedWorkspaceId && (
                <SearchBox
                  workspaceId={selectedWorkspaceId}
                  onPick={(hit) => {
                    setSelectedFolderId(hit.folderId)
                    setReveal((r) => ({ folderId: hit.folderId, nonce: r.nonce + 1, focus: true }))
                    openNote(hit.id)
                  }}
                />
              )}

              {selectedWorkspaceId && (
                <FolderTree
                  key={selectedWorkspaceId}
                  workspaceId={selectedWorkspaceId}
                  workspaceName={currentWorkspace?.name ?? 'Espace'}
                  folders={folders.data ?? []}
                  selectedFolderId={selectedFolderId}
                  selectedNoteId={selectedNoteId}
                  onSelectFolder={setSelectedFolderId}
                  onOpenNote={openNote}
                  isLoading={folders.isPending}
                  canEdit={canEdit}
                  revealFolderId={reveal.folderId}
                  revealNonce={reveal.nonce}
                  revealFocus={reveal.focus}
                />
              )}
            </div>

            {(isOwner || canEdit) && selectedWorkspaceId && (
              <div className="flex shrink-0 gap-2">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="h-10 min-w-0 flex-[2] cursor-pointer rounded-xl border border-solid border-[color:var(--invite-btn-border)] bg-[var(--color-surface)] text-sm text-inherit transition-colors hover:bg-[var(--color-surface-strong)]"
                  >
                    Inviter
                  </button>
                )}
                {canEdit && (
                  <TrashDropTarget
                    workspaceId={selectedWorkspaceId}
                    onOpen={() => setTrashOpen(true)}
                    className={`h-10 min-w-0 opacity-100 ${isOwner ? 'flex-1' : 'w-full flex-1'} rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] transition-colors hover:bg-[var(--color-surface-strong)]`}
                  />
                )}
              </div>
            )}

            <WorkspaceBar
              workspaces={workspaces.data ?? []}
              selectedId={selectedWorkspaceId}
              onSelect={setSelectedWorkspaceId}
              onCreate={() => setWsForm({ mode: 'create' })}
              onShowMembers={(ws) => setMembersFor(ws)}
              onEdit={(ws) => setWsForm({ mode: 'edit', workspace: ws })}
              onDelete={onDeleteWorkspace}
            />
          </aside>
        </div>
      )}

      {showMain && (
        <main
          className={
            isMobile
              ? 'relative w-full min-w-0 flex-1 overflow-auto px-4 pb-6 pt-16'
              : 'min-w-0 flex-1 overflow-auto p-8'
          }
        >
          {/* Même bouton qu'en desktop : on affiche un panneau, ce n'est pas un retour. */}
          {isMobile && (
            <SidebarOpenButton
              visible
              onClick={() => setMobilePane('list')}
              className="left-[14px] top-[14px]"
            />
          )}
          <InviteAcceptBanner />
          {selectedNoteId ? (
            <NoteEditor noteId={selectedNoteId} canEdit={canEdit} onUnavailable={handleNoteGone} />
          ) : (
            <EmptyState
              workspaceId={selectedWorkspaceId}
              folders={folders.data ?? []}
              selectedFolderId={selectedFolderId}
              canEdit={canEdit}
              onCreateWorkspace={() => setWsForm({ mode: 'create' })}
              onSelectFolder={setSelectedFolderId}
              onOpenNote={openNote}
            />
          )}
        </main>
      )}

      <div className="absolute right-4 top-4 z-[150]">
        <ProfileMenu
          onSettings={() => setAccountOpen(true)}
          onTrash={canEdit && selectedWorkspaceId ? () => setTrashOpen(true) : undefined}
          onLogout={auth.logout}
        />
      </div>

      <SidebarOpenButton
        visible={collapsed && !isMobile}
        onClick={() => setCollapsed(false)}
        className={!isMobile ? 'left-[30px] top-[30px]' : undefined}
      />

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}

      {trashOpen && selectedWorkspaceId && (
        <TrashModal workspaceId={selectedWorkspaceId} onClose={() => setTrashOpen(false)} />
      )}

      {inviteOpen && selectedWorkspaceId && (
        <InviteModal workspaceId={selectedWorkspaceId} onClose={() => setInviteOpen(false)} />
      )}

      {wsForm && (
        <WorkspaceFormModal
          mode={wsForm.mode}
          workspace={wsForm.mode === 'edit' ? wsForm.workspace : undefined}
          onClose={() => setWsForm(null)}
          onCreated={(id) => setSelectedWorkspaceId(id)}
        />
      )}

      {membersFor && (
        <MembersModal
          workspaceId={membersFor.id}
          canManage={membersFor.role === 'OWNER'}
          currentUserId={user?.id ?? null}
          onClose={() => setMembersFor(null)}
        />
      )}
    </div>
  )
}
