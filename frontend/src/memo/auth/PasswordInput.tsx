import { useState } from 'react'

/**
 * Champ mot de passe avec bascule « afficher / masquer ». Mutualisé par les
 * écrans de connexion, d'inscription, de changement et de réinitialisation :
 * un seul endroit porte l'icône œil et son étiquetage RGAA.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  describedBy,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  describedBy?: string
  invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        aria-required="true"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`${authInputClass} box-border w-full pr-9`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center border-none bg-transparent p-0.5 text-inherit opacity-[0.55]"
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  )
}

export const authInputClass =
  'rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-2.5 py-2 text-sm text-inherit'

export const authButtonClass =
  'mt-1 cursor-pointer rounded-md border-none bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] disabled:cursor-default disabled:opacity-60'

export function Eye() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOff() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
