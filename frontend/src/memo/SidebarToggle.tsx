import { MemoIcon } from './MemoIcon'

/**
 * Bouton de repli, posé dans l'en-tête de la sidebar (sidebar ouverte).
 * En mobile le panneau occupe tout l'écran : le replier revient à retourner sur
 * la note ouverte, d'où le libellé paramétrable — l'icône, elle, reste la même
 * partout pour que le geste « ouvrir/fermer le panneau » soit reconnaissable.
 */
export function SidebarToggleButton({
  onClick,
  label = 'Réduire le panneau',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[var(--r-sm)] border border-[var(--color-line-strong)] bg-transparent p-0 text-inherit"
    >
      <MemoIcon name="panel-left" size={16} />
    </button>
  )
}

/**
 * Bouton flottant de réouverture, visible quand le panneau n'est pas affiché :
 * sidebar repliée en desktop, éditeur plein écran en mobile. Même icône que le
 * bouton de repli — c'est le même panneau qu'on montre ou qu'on cache.
 */
export function SidebarOpenButton({
  visible,
  onClick,
  className,
  label = 'Afficher le panneau',
}: {
  visible: boolean
  onClick: () => void
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-hidden={!visible}
      className={`absolute z-20 grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] p-0 text-[var(--color-text)] shadow-[0_2px_10px_var(--color-shadow)] backdrop-blur-[8px] transition-[opacity,transform] duration-[250ms] ease-[var(--ease-out-expo)] ${className ?? 'left-[14px] top-[14px]'} ${
        visible
          ? 'pointer-events-auto translate-x-0 opacity-100'
          : 'pointer-events-none -translate-x-[8px] opacity-0'
      }`}
    >
      <MemoIcon name="panel-left" size={18} />
    </button>
  )
}
