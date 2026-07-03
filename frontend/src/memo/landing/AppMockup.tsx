import { MemoLogo } from '../MemoLogo'
import { MemoIcon } from '../MemoIcon'

const TREE_ROW =
  'flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[var(--r-sm)] px-2 py-1.5'
const SPACE_PILL = 'rounded-full px-2.5 py-[5px] text-[11px]'
const NOTE_P = 'm-0 text-[12.5px] leading-[1.6] text-muted'
const FLOW_STEP = 'rounded-[var(--r-sm)] bg-accent-soft px-3 py-[7px] text-[11.5px] text-ink'

/**
 * Reproduction statique et stylisée de l'interface connectée (sidebar + note),
 * affichée dans le hero pour montrer le produit sans dépendre d'une capture.
 * Calquée sur WorkspaceShell : sidebar (recherche, dossiers, espaces) + éditeur.
 */
export function AppMockup() {
  return (
    <div
      className="grid h-auto grid-cols-1 text-xs leading-[1.4] min-[560px]:h-[380px] min-[560px]:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]"
      aria-hidden
    >
      <aside className="hidden min-w-0 flex-col gap-3 border-r border-line bg-[image:var(--color-sidebar)] p-[14px] min-[560px]:flex">
        <div className="flex items-center gap-2 text-sm">
          <MemoLogo size={16} />
          <strong>Memo</strong>
        </div>

        <div className="flex items-center gap-[7px] rounded-[var(--r-sm)] border border-line bg-surface px-2.5 py-[7px] text-dim">
          <MemoIcon name="search" size={13} strokeWidth={1.6} />
          <span>Rechercher…</span>
          <kbd className="ml-auto text-[11px] text-faint">⌘K</kbd>
        </div>

        <div className="text-[11px] uppercase tracking-[0.06em] text-faint">Dossiers</div>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 [&_svg]:flex-none [&_svg]:opacity-70">
          <li className={`${TREE_ROW} text-ink`}>
            <MemoIcon name="chevron-down" size={13} strokeWidth={1.8} />
            <MemoIcon name="folder" size={13} strokeWidth={1.6} />
            Cours
          </li>
          <li className={`${TREE_ROW} text-muted`}>
            <MemoIcon name="file-text" size={13} strokeWidth={1.6} />
            Merise — MCD
          </li>
          <li
            className={`${TREE_ROW} relative bg-accent-soft text-ink before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:rounded-[2px] before:bg-accent-hi before:content-['']`}
          >
            <MemoIcon name="file-text" size={13} strokeWidth={1.6} />
            React — les hooks
          </li>
          <li className={`${TREE_ROW} text-muted`}>
            <MemoIcon name="file-text" size={13} strokeWidth={1.6} />
            Docker Compose
          </li>
          <li className={`${TREE_ROW} text-ink`}>
            <MemoIcon name="chevron-right" size={13} strokeWidth={1.8} />
            <MemoIcon name="folder" size={13} strokeWidth={1.6} />
            Stage
          </li>
          <li className={`${TREE_ROW} text-ink`}>
            <MemoIcon name="chevron-right" size={13} strokeWidth={1.8} />
            <MemoIcon name="folder" size={13} strokeWidth={1.6} />
            Projets perso
          </li>
        </ul>

        <div className="mt-auto flex items-center gap-1.5">
          <span className={`${SPACE_PILL} border border-accent-border bg-accent-soft text-ink`}>
            BTS SIO
          </span>
          <span className={`${SPACE_PILL} border border-line bg-surface text-dim`}>Perso</span>
          <span
            className={`${SPACE_PILL} ml-auto inline-flex items-center border border-line bg-surface text-dim`}
          >
            <MemoIcon name="plus" size={14} strokeWidth={2} />
          </span>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col gap-3 overflow-hidden bg-canvas p-5 min-[560px]:px-6 min-[560px]:py-[22px]">
        <h3 className="m-0 text-[17px] font-semibold tracking-[-0.01em] text-ink min-[560px]:text-[19px]">
          React — les hooks essentiels
        </h3>
        <p className={NOTE_P}>
          useState garde l'état local d'un composant. useEffect synchronise avec l'extérieur :
          requêtes, abonnements, minuteurs.
        </p>
        <figure className="my-0.5 rounded-[var(--r-md)] border border-line bg-surface-1 p-4">
          <div className="flex items-center justify-center gap-2.5">
            <span className={FLOW_STEP}>Montage</span>
            <i className="h-px w-[18px] bg-line-strong" />
            <span className={FLOW_STEP}>Rendu</span>
            <i className="h-px w-[18px] bg-line-strong" />
            <span className={FLOW_STEP}>Nettoyage</span>
          </div>
          <figcaption className="mt-2.5 text-center text-[11px] text-faint">
            Cycle de vie d'un composant
          </figcaption>
        </figure>
        <p className={NOTE_P}>
          Règle d'or : un hook ne s'appelle qu'au niveau racine du composant — jamais dans une
          condition.
        </p>
      </main>
    </div>
  )
}
