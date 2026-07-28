import { useState, type FormEvent } from 'react'
import { ApiError } from '../../lib/api'
import { useForgotPassword } from '../../hooks/usePassword'
import { authButtonClass, authInputClass } from './PasswordInput'

/**
 * Écran « mot de passe oublié » : saisie de l'adresse e-mail.
 *
 * Le message de confirmation est volontairement neutre (« si un compte
 * existe… ») et s'affiche quelle que soit l'adresse saisie — l'écran ne doit pas
 * permettre de découvrir quelles adresses sont inscrites.
 */
export function ForgotPassword({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const forgot = useForgotPassword()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await forgot.mutateAsync(email)
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Trop de demandes. Patientez avant de réessayer.')
      } else if (err instanceof ApiError) {
        setError('Une erreur est survenue.')
      } else {
        setError('Impossible de joindre le serveur.')
      }
    }
  }

  return (
    <div className="lp-grid-bg grid min-h-screen place-items-center p-6 text-[var(--color-text)]">
      <div className="flex w-full max-w-[360px] flex-col gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-3)] p-7 shadow-[0_8px_32px_var(--color-shadow)]">
        <button
          type="button"
          onClick={onLogin}
          className="mb-1 cursor-pointer self-start border-none bg-transparent p-0 text-[13px] text-inherit opacity-60"
        >
          ← Retour à la connexion
        </button>

        <h1 className="m-0 text-[22px] font-semibold">Mot de passe oublié</h1>

        {sent ? (
          <>
            <p
              role="status"
              data-testid="forgot-sent"
              className="m-0 text-[13px] leading-[1.6] opacity-75"
            >
              Si un compte existe pour <strong>{email}</strong>, un lien de réinitialisation vient
              d’être envoyé. Il expire dans 1 heure et ne peut servir qu’une seule fois.
            </p>
            <p className="m-0 text-[12px] leading-[1.6] opacity-[0.55]">
              Pensez à vérifier vos courriers indésirables.
            </p>
            <button type="button" onClick={onBack} className={authButtonClass}>
              Revenir à l’accueil
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <p className="m-0 text-[13px] leading-[1.6] opacity-75">
              Saisissez l’adresse e-mail de votre compte : nous vous enverrons un lien pour choisir
              un nouveau mot de passe.
            </p>

            <label htmlFor="forgot-email" className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Email</span>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'forgot-error' : undefined}
                autoComplete="email"
                className={authInputClass}
              />
            </label>

            {error && (
              <div
                id="forgot-error"
                role="alert"
                className="text-[13px] text-[var(--color-danger)]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={forgot.isPending}
              className={authButtonClass}
              data-testid="forgot-submit"
            >
              {forgot.isPending ? '…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
