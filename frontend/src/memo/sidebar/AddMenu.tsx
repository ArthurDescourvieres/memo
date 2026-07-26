import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { FilePlus, FolderPlus, Plus } from 'lucide-react'

/**
 * Bouton « + » du bandeau de l'arbre, déroulant deux créations : une note ou un
 * dossier (à la racine du workspace). Il double le bouton par dossier, qui
 * imposait de partir d'un dossier existant.
 *
 * Menu maison plutôt qu'un composant partagé : WorkspaceContextMenu est ancré
 * sur des coordonnées (clic droit), ici on veut un ancrage sur le bouton.
 */
export function AddMenu({
  onCreateNote,
  onCreateFolder,
}: {
  onCreateNote: () => void
  onCreateFolder: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        data-testid="tree-add-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Créer une note ou un dossier"
        title="Créer une note ou un dossier"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center rounded border-none bg-transparent p-1 text-inherit opacity-60 transition-[opacity,background-color] hover:bg-[var(--color-surface-strong)] hover:opacity-100"
      >
        <Plus size={15} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Créer"
          className="absolute right-0 top-[calc(100%+6px)] z-[200] min-w-[184px] overflow-hidden rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface-1)] py-1 shadow-[0_8px_24px_var(--color-shadow)]"
        >
          <MenuItem
            icon={FilePlus}
            testId="tree-add-note"
            onClick={pick(onCreateNote)}
            label="Nouvelle note"
          />
          <MenuItem
            icon={FolderPlus}
            testId="tree-add-folder"
            onClick={pick(onCreateFolder)}
            label="Nouveau dossier"
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  testId: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-[13px] text-inherit transition-colors duration-[120ms] hover:bg-[var(--color-line)]"
    >
      <Icon size={15} aria-hidden className="shrink-0 opacity-70" />
      {label}
    </button>
  )
}
