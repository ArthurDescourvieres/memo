import { z } from 'zod'

// Politique de mot de passe (§5.3) — 12 caractères minimum, partagée par
// l'inscription, le changement de mot de passe et la réinitialisation.
const passwordField = z.string().min(12, 'Le mot de passe doit contenir au moins 12 caractères')

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordField,
})

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

// Changement depuis un compte connecté : le mot de passe courant est exigé pour
// qu'un jeton d'accès volé ne suffise pas à prendre le compte (§5.3).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordField,
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordField,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
