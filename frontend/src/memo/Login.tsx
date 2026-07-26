import { useState, type FormEvent } from 'react'
import { ApiError, useAuth } from '../lib/auth/AuthContext'

type Mode = 'login' | 'register'

type LoginProps = {
  initialMode?: Mode
  onBack?: () => void
  onSwitchMode?: () => void
  // Invite flow: prefill and lock the email so acceptance (which requires an
  // exact email match) can't silently fail; `inviteNote` explains the context.
  lockedEmail?: string
  inviteNote?: string
}

export function Login({
  initialMode = 'login',
  onBack,
  onSwitchMode,
  lockedEmail,
  inviteNote,
}: LoginProps = {}) {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [identifier, setIdentifier] = useState(lockedEmail ?? '')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') await auth.login(identifier, password)
      else await auth.register(name, identifier, password)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Email ou mot de passe invalide.')
        else if (err.status === 409) {
          const payload = err.payload as { error?: unknown }
          setError(
            typeof payload?.error === 'string'
              ? payload.error
              : 'Cet identifiant est déjà utilisé.',
          )
        } else if (err.status === 400) {
          const payload = err.payload as { error?: unknown }
          setError(typeof payload?.error === 'string' ? payload.error : 'Champs invalides.')
        } else setError('Une erreur est survenue.')
      } else {
        setError('Impossible de joindre le serveur.')
      }
    } finally {
      setLoading(false)
    }
  }

  // RGAA — lie le champ mot de passe à son aide (register) et au message d'erreur.
  const passwordDescribedBy =
    [mode === 'register' ? 'login-pwd-hint' : null, error ? 'login-error' : null]
      .filter(Boolean)
      .join(' ') || undefined

  // Le fond (--color-bg) est porté par <body> : le conteneur ne pose pas de
  // background pour laisser passer le quadrillage de `lp-grid-bg`.
  return (
    <div className="lp-grid-bg grid min-h-screen place-items-center p-6 text-[var(--color-text)]">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-[360px] flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-7 shadow-[0_8px_32px_var(--color-shadow)]"
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-1 cursor-pointer self-start border-none bg-transparent p-0 text-[13px] text-inherit opacity-60"
          >
            ← Retour à l’accueil
          </button>
        )}

        <h1 className="m-0 text-[22px] font-semibold">
          {mode === 'login' ? 'Connexion à Memo' : 'Créer un compte'}
        </h1>

        {inviteNote && (
          <div className="rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-3 py-2 text-[13px]">
            {inviteNote}
          </div>
        )}

        {mode === 'register' && (
          <label htmlFor="login-name" className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Nom</span>
            <input
              id="login-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-required="true"
              autoComplete="name"
              className={inputClass}
            />
          </label>
        )}

        <label htmlFor="login-identifier" className="flex flex-col gap-1">
          <span className="text-xs opacity-70">
            {lockedEmail || mode === 'register' ? 'Email' : 'Email ou pseudo'}
          </span>
          <input
            id="login-identifier"
            type={mode === 'login' && !lockedEmail ? 'text' : 'email'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            autoComplete={mode === 'login' ? 'username' : 'email'}
            readOnly={Boolean(lockedEmail)}
            className={`${inputClass}${lockedEmail ? ' cursor-not-allowed opacity-70' : ''}`}
          />
        </label>

        <div className="flex flex-col gap-1">
          <label htmlFor="login-password" className="text-xs opacity-70">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={passwordDescribedBy}
              minLength={mode === 'register' ? 12 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={`${inputClass} box-border w-full pr-9`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center border-none bg-transparent p-0.5 text-inherit opacity-[0.55]"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {mode === 'register' && (
            <span id="login-pwd-hint" className="text-[11px] opacity-[0.55]">
              12 caractères minimum.
            </span>
          )}
        </div>

        {error && (
          <div id="login-error" role="alert" className="text-[13px] text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className={buttonClass} data-testid="auth-submit">
          {loading ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null)
            if (onSwitchMode) {
              onSwitchMode()
              return
            }
            setMode(mode === 'login' ? 'register' : 'login')
          }}
          className="cursor-pointer border-none bg-transparent text-xs text-inherit opacity-60"
        >
          {mode === 'login'
            ? 'Pas encore de compte ? Créez-en un'
            : 'Déjà inscrit ? Connectez-vous'}
        </button>
      </form>
    </div>
  )
}

const inputClass =
  'rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-2.5 py-2 text-sm text-inherit'

const buttonClass =
  'mt-1 cursor-pointer rounded-md border-none bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)]'

function Eye() {
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

function EyeOff() {
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
