import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { useResetPassword } from '../../hooks/usePassword'
import { PasswordInput, authButtonClass } from './PasswordInput'

const MIN_LENGTH = 12

/**
 * Écran de réinitialisation, atteint depuis le lien reçu par e-mail
 * (`/reinitialiser-mot-de-passe?token=…`).
 *
 * Le jeton reste dans l'URL et n'est jamais stocké : il ne sert qu'à cette
 * requête, puis le serveur le détruit. Aucune session n'est ouverte ici — la
 * réinitialisation invalide au contraire toutes les sessions du compte, et
 * l'utilisateur se reconnecte avec son nouveau mot de passe.
 */
export function ResetPassword({ onLogin }: { onLogin: () => void }) {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const reset = useResetPassword()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    try {
      await reset.mutateAsync({ token, password })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Trop de tentatives. Patientez avant de réessayer.')
      } else if (err instanceof ApiError) {
        const payload = err.payload as { error?: unknown }
        setError(typeof payload?.error === 'string' ? payload.error : 'Une erreur est survenue.')
      } else {
        setError('Impossible de joindre le serveur.')
      }
    }
  }

  return (
    <div className="lp-grid-bg grid min-h-screen place-items-center p-6 text-[var(--color-text)]">
      <div className="flex w-full max-w-[360px] flex-col gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-3)] p-7 shadow-[0_8px_32px_var(--color-shadow)]">
        <h1 className="m-0 text-[22px] font-semibold">Nouveau mot de passe</h1>

        {!token ? (
          <>
            <p role="alert" className="m-0 text-[13px] leading-[1.6] opacity-75">
              Ce lien est incomplet. Ouvrez-le directement depuis l’e-mail reçu, ou demandez un
              nouveau lien.
            </p>
            <button type="button" onClick={onLogin} className={authButtonClass}>
              Retour à la connexion
            </button>
          </>
        ) : done ? (
          <>
            <p
              role="status"
              data-testid="reset-done"
              className="m-0 text-[13px] leading-[1.6] opacity-75"
            >
              Votre mot de passe a été modifié. Pour votre sécurité, toutes vos sessions ont été
              déconnectées : reconnectez-vous avec le nouveau mot de passe.
            </p>
            <button
              type="button"
              onClick={onLogin}
              className={authButtonClass}
              data-testid="reset-goto-login"
            >
              Se connecter
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="reset-password" className="text-xs opacity-70">
                Nouveau mot de passe
              </label>
              <PasswordInput
                id="reset-password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                describedBy={`reset-hint${error ? ' reset-error' : ''}`}
                invalid={Boolean(error)}
              />
              <span id="reset-hint" className="text-[11px] opacity-[0.55]">
                {MIN_LENGTH} caractères minimum.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="reset-confirm" className="text-xs opacity-70">
                Confirmer le mot de passe
              </label>
              <PasswordInput
                id="reset-confirm"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                describedBy={error ? 'reset-error' : undefined}
                invalid={Boolean(error)}
              />
            </div>

            {error && (
              <div id="reset-error" role="alert" className="text-[13px] text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={reset.isPending}
              className={authButtonClass}
              data-testid="reset-submit"
            >
              {reset.isPending ? '…' : 'Changer mon mot de passe'}
            </button>

            <button
              type="button"
              onClick={onLogin}
              className="cursor-pointer border-none bg-transparent text-xs text-inherit opacity-60"
            >
              Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
