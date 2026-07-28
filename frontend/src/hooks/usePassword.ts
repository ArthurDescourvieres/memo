import { useMutation } from '@tanstack/react-query'
import { api, setAccessToken } from '../lib/api'
import type { AuthUser } from '../lib/auth/AuthContext'

type ChangePasswordInput = { currentPassword: string; newPassword: string }
type ChangePasswordResponse = { accessToken: string; user: AuthUser }

/**
 * Changement du mot de passe depuis le compte connecté.
 *
 * Le serveur invalide toutes les sessions (bump de `tokenVersion`) et renvoie un
 * couple de jetons neuf pour celle-ci : on adopte le nouveau jeton d'accès sans
 * attendre, sinon la requête suivante partirait avec un jeton devenu caduc.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const res = await api<ChangePasswordResponse>('/api/auth/password', {
        method: 'PATCH',
        json: input,
      })
      setAccessToken(res.accessToken)
      return res
    },
  })
}

/**
 * Demande d'un lien de réinitialisation. La réponse est volontairement identique
 * que l'adresse corresponde ou non à un compte : l'UI ne peut donc pas servir à
 * savoir qui est inscrit.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        json: { email },
      }),
  })
}

/** Application du nouveau mot de passe à partir du jeton reçu par e-mail. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        json: input,
      }),
  })
}
