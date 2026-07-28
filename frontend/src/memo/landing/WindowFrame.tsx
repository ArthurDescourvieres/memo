import type { ReactNode } from 'react'
import { MemoIcon } from '../MemoIcon'

type WindowFrameProps = {
  children: ReactNode
  className?: string
  /** Libellé centré dans la barre de titre. */
  title?: string
}

const FRAME =
  'overflow-hidden rounded-[14px] border border-line-strong bg-surface-1 ' +
  'shadow-[0_40px_90px_-50px_var(--color-ink-shadow),0_0_0_1px_var(--color-overlay-weak)_inset]'

export function WindowFrame({ children, className, title }: WindowFrameProps) {
  return (
    <div className={className ? `${FRAME} ${className}` : FRAME}>
      <div
        className="relative flex items-center gap-2 border-b border-line bg-surface-2 px-[14px] py-[11px]"
        aria-hidden
      >
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        {title && (
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-faint">{title}</span>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

/** Réservation d'espace en attendant l'enregistrement de la démo. */
export function VideoSlot({ label }: { label: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-2.5 text-faint">
      <span className="grid h-[46px] w-[46px] place-items-center rounded-full border border-line-strong bg-surface text-dim">
        <MemoIcon name="play" size={20} strokeWidth={1.6} />
      </span>
      <span className="text-[13px] text-dim">{label}</span>
      <span className="text-[11px]">Survole pour lire</span>
    </div>
  )
}
