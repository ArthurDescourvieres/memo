// Shared header + class names for the sidebar sections (Workspaces, Dossiers,
// Notes). Extracted from WorkspaceShell so each section lives in its own file.
export function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-[1px] opacity-50">{title}</span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="cursor-pointer border-none bg-transparent text-sm text-inherit opacity-60"
          title={`Ajouter ${title.toLowerCase()}`}
        >
          +
        </button>
      )}
    </div>
  )
}

export const sectionClass = 'flex flex-col gap-1.5'

export const listClass = 'm-0 flex list-none flex-col gap-0.5 p-0'

// Volontairement sans largeur ni fond : chaque section ajoute `w-auto` + le fond
// conditionnel (sélection), pour éviter les conflits d'utilitaires Tailwind.
export const listItemClass =
  'block cursor-pointer rounded border-none px-2 py-1.5 text-left text-[13px] text-inherit'

export const rowClass = 'flex items-center gap-0.5'

export const rowActionClass =
  'shrink-0 cursor-pointer rounded border-none bg-transparent px-1.5 py-1 text-sm leading-none text-inherit opacity-40'

export const smallInputClass =
  'min-w-0 flex-1 rounded border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-2 py-1 text-xs text-inherit'

// `shrink-0` + largeur mini : le bouton garde une forme carrée lisible même
// quand l'input occupe tout l'espace restant.
export const smallButtonClass =
  'inline-flex w-7 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-[var(--color-accent)] text-sm leading-none text-[var(--color-on-accent)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

export const loadingClass = 'text-xs opacity-40'

export const emptyClass = 'px-2 py-1 text-xs opacity-40'
