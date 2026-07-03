import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost'
type Size = 'md' | 'lg'

/**
 * Bouton de la landing en Tailwind — remplace les classes `.lp-btn*` du CSS.
 * Les couleurs (bg-accent, text-ink…) et l'easing (ease-expo) viennent des
 * design tokens mappés dans index.css (@theme), donc le rendu suit le thème.
 */
const BASE =
  'inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-md)] border border-transparent ' +
  'font-medium transition-[transform,background-color,border-color,box-shadow] duration-200 ' +
  'ease-expo active:translate-y-px'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent shadow-[0_8px_24px_-12px_var(--color-accent)] ' +
    'hover:-translate-y-0.5 hover:bg-accent-hi hover:shadow-[0_16px_34px_-14px_var(--color-accent)]',
  ghost: 'bg-overlay text-ink border-line-strong hover:bg-overlay-hi',
}

const SIZES: Record<Size, string> = {
  md: 'px-[18px] py-[10px]',
  lg: 'px-6 py-[14px] text-base',
}

/** Classes du bouton, réutilisables sur un `<a>` (lien GitHub, etc.). */
export function landingButtonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim()
}

type LandingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function LandingButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: LandingButtonProps) {
  return (
    <button type="button" className={landingButtonClass(variant, size, className)} {...props}>
      {children}
    </button>
  )
}
