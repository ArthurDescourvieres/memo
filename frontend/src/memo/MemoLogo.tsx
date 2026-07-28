interface MemoLogoProps {
  size?: number
  /** `tile` = pastille pleine ; `mono` = M seul en `currentColor`, sans fond. */
  variant?: 'tile' | 'mono'
  /** Sans titre, le logo est décoratif (`aria-hidden`). */
  title?: string
  className?: string
}

/** Couleurs prises dans les tokens : le logo suit le thème clair/sombre. */
export function MemoLogo({ size = 28, variant = 'tile', title, className }: MemoLogoProps) {
  const tile = variant === 'tile'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      {tile && (
        <>
          <rect x="6" y="6" width="88" height="88" rx="22" fill="var(--color-accent)" />
          <rect
            x="6.8"
            y="6.8"
            width="86.4"
            height="86.4"
            rx="21.4"
            fill="none"
            stroke="var(--color-on-accent)"
            strokeOpacity="0.15"
            strokeWidth="0.9"
          />
        </>
      )}
      <g transform={tile ? undefined : 'translate(50 50) scale(1.18) translate(-50 -50)'}>
        <path
          d="M30 72 L30 32 L50 58 L70 32 L70 72"
          fill="none"
          stroke={tile ? 'var(--color-on-accent)' : 'currentColor'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="70" r="3.4" fill="var(--color-gold)" />
      </g>
    </svg>
  )
}
