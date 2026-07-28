import { useState, type FormEvent } from 'react'
import { ApiError, useAuth } from '../lib/auth/AuthContext'
import { PasswordInput, authButtonClass, authInputClass } from './auth/PasswordInput'

type Mode = 'login' | 'register'

type LoginProps = {
  initialMode?: Mode
  onBack?: () => void
  onSwitchMode?: () => void
  // Invite flow: prefill and lock the email so acceptance (which requires an
  // exact email match) can't silently fail; `inviteNote` explains the context.
  lockedEmail?: string
  inviteNote?: string
  // Absent in the invite flow, where the visitor is tied to a specific address.
  onForgotPassword?: () => void
}

export function Login({
  initialMode = 'login',
  onBack,
  onSwitchMode,
  lockedEmail,
  inviteNote,
  onForgotPassword,
}: LoginProps = {}) {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [identifier, setIdentifier] = useState(lockedEmail ?? '')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
        className="flex w-full max-w-[360px] flex-col gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-3)] p-7 shadow-[0_8px_32px_var(--color-shadow)]"
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
              className={authInputClass}
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
            className={`${authInputClass}${lockedEmail ? ' cursor-not-allowed opacity-70' : ''}`}
          />
        </label>

        <div className="flex flex-col gap-1">
          <label htmlFor="login-password" className="text-xs opacity-70">
            Mot de passe
          </label>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 12 : undefined}
            describedBy={passwordDescribedBy}
            invalid={Boolean(error)}
          />
          {mode === 'register' && (
            <span id="login-pwd-hint" className="text-[11px] opacity-[0.55]">
              12 caractères minimum.
            </span>
          )}
          {mode === 'login' && onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              data-testid="forgot-password-link"
              className="cursor-pointer self-start border-none bg-transparent p-0 text-[11px] text-inherit underline opacity-60"
            >
              Mot de passe oublié ?
            </button>
          )}
        </div>

        {error && (
          <div id="login-error" role="alert" className="text-[13px] text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={authButtonClass}
          data-testid="auth-submit"
        >
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
