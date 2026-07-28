import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useCreateInvitation, useInvitations } from '../hooks/useInvitations'
import {
  ASSIGNABLE_ROLE_OPTIONS,
  createInviteErrorMessage,
  formatExpiry,
  inviteLink,
  roleLabel,
} from './inviteUtils'
import { Select } from './Select'

type InvitableRole = 'EDITOR' | 'VIEWER'

const inputClass =
  'min-w-0 rounded border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-2 py-1.5 text-xs text-inherit outline-none'

// OWNER-only modale : inviter un membre par e-mail ou pseudo + rôle. Le serveur
// envoie l'invitation par e-mail ; le lien copiable reste affiché en secours.
export function InviteModal({
  workspaceId,
  onClose,
}: {
  workspaceId: string
  onClose: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [role, setRole] = useState<InvitableRole>('EDITOR')
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<string | null>(null)

  const invitations = useInvitations(workspaceId)
  const create = useCreateInvitation(workspaceId)

  const pending = invitations.data ?? []

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = identifier.trim()
    if (!value) return
    try {
      const invitation = await create.mutateAsync({ identifier: value, role })
      setIdentifier('')
      setCreatedToken(invitation.token)
    } catch (err) {
      setError(createInviteErrorMessage(err))
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] grid place-items-center bg-[oklch(0_0_0_/_0.5)] p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[calc(100vh-48px)] w-[min(480px,calc(100vw-48px))] flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] p-[22px] text-[var(--color-text)] shadow-[0_16px_48px_var(--color-shadow)]"
        role="dialog"
        aria-modal="true"
        aria-label="Inviter un membre"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-base font-semibold">Inviter</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="cursor-pointer rounded border-none bg-transparent px-2 py-1 text-lg leading-none text-inherit opacity-60"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-1.5">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="email@exemple.com ou pseudo"
            className={inputClass}
            autoFocus
            required
          />
          <div className="flex gap-1.5">
            <Select
              value={role}
              onChange={setRole}
              options={ASSIGNABLE_ROLE_OPTIONS}
              ariaLabel="Rôle de l’invité"
              className="flex-1 px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="cursor-pointer rounded border-none bg-[var(--color-accent)] px-3 text-xs text-[var(--color-on-accent)]"
              disabled={create.isPending}
            >
              {create.isPending ? '…' : 'Inviter'}
            </button>
          </div>
          {error && <div className="text-[11.5px] text-[var(--color-danger)]">{error}</div>}
        </form>

        {createdToken && (
          <div className="flex flex-col gap-1.5 rounded border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] p-2">
            <div className="text-[11px] opacity-75">
              Invitation envoyée par e-mail. Lien de secours, à copier si besoin :
            </div>
            <div className="flex gap-1.5">
              <input
                readOnly
                value={inviteLink(createdToken)}
                className={`${inputClass} flex-1`}
                onFocus={(e) => e.currentTarget.select()}
              />
              <CopyButton token={createdToken} />
            </div>
          </div>
        )}

        {invitations.isPending ? (
          <div className="text-xs opacity-40">…</div>
        ) : pending.length === 0 ? (
          <div className="px-1.5 py-0.5 text-xs opacity-40">Aucune invitation en attente</div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded px-1.5 py-1"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]">
                    {inv.email}
                  </span>
                  <span className="text-[11px] opacity-50">
                    {roleLabel(inv.role)} · expire le {formatExpiry(inv.expiresAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}

function CopyButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="cursor-pointer whitespace-nowrap rounded border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-2 py-1 text-[11px] text-inherit"
      title="Copier le lien d’invitation"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(inviteLink(token))
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard indisponible */
        }
      }}
    >
      {copied ? 'Copié ✓' : 'Lien'}
    </button>
  )
}
