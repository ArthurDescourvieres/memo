import { useMutation } from '@tanstack/react-query'
import { api, setAccessToken } from '../lib/api'
import type { AuthUser } from '../lib/auth/AuthContext'

type ChangePasswordInput = { currentPassword: string; newPassword: string }
type ChangePasswordResponse = { accessToken: string; user: AuthUser }

/**
 * Le serveur invalide toutes les sessions et en réémet une pour celle-ci :
 * il faut adopter le nouveau jeton tout de suite, sinon la requête suivante
 * part avec un jeton caduc.
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

/** La réponse est la même que l'adresse existe ou non : l'UI ne dit pas qui est inscrit. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        json: { email },
      }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        json: input,
      }),
  })
}
