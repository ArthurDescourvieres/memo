import { MemoIcon } from './MemoIcon'

/**
 * Le libellé est paramétrable — en mobile, replier le panneau revient à revenir
 * sur la note. L'icône ne change jamais : c'est le même geste.
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

/** Pendant flottant du précédent : sidebar repliée en desktop, éditeur plein écran en mobile. */
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
