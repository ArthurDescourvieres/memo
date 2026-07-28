import type { Context } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv } from '../types/hono.js'
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js'
import { authService } from '../services/auth.service.js'

type AuthContext = Context<AppEnv>

const REFRESH_COOKIE = 'refreshToken'
const REFRESH_TTL = 60 * 60 * 24 * 7

function hasCode(e: unknown, code: string): boolean {
  return e instanceof Error && (e as Error & { code?: string }).code === code
}

function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: REFRESH_TTL,
    path: '/',
  })
}

export const authController = {
  async register(c: Context) {
    const body = await c.req.json()
    const result = registerSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: result.error.flatten() }, 400)
    }

    try {
      const { accessToken, refreshToken, user } = await authService.register(result.data)
      setRefreshCookie(c, refreshToken)
      return c.json({ accessToken, user }, 201)
    } catch (e) {
      if (hasCode(e, 'CONFLICT')) return c.json({ error: 'Cet email est déjà utilisé.' }, 409)
      if (hasCode(e, 'NAME_CONFLICT')) return c.json({ error: 'Ce pseudo est déjà utilisé.' }, 409)
      if (hasCode(e, 'PWNED')) {
        return c.json(
          {
            error:
              'Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.',
          },
          400,
        )
      }
      throw e
    }
  },

  async login(c: Context) {
    const body = await c.req.json()
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: result.error.flatten() }, 400)
    }

    try {
      const { accessToken, refreshToken, user } = await authService.login(result.data)
      setRefreshCookie(c, refreshToken)
      return c.json({ accessToken, user }, 200)
    } catch (e) {
      if (hasCode(e, 'DEACTIVATED'))
        return c.json({ error: 'Ce compte a été désactivé.', code: 'DEACTIVATED' }, 403)
      if (hasCode(e, 'UNAUTHORIZED'))
        return c.json({ error: 'Identifiant ou mot de passe invalide.' }, 401)
      throw e
    }
  },

  async refresh(c: Context) {
    const token = getCookie(c, REFRESH_COOKIE)
    if (!token) return c.json({ error: 'Non autorisé.' }, 401)

    try {
      const { accessToken } = await authService.refresh(token)
      return c.json({ accessToken }, 200)
    } catch (e) {
      if (hasCode(e, 'UNAUTHORIZED')) return c.json({ error: 'Non autorisé.' }, 401)
      throw e
    }
  },

  async logout(c: Context) {
    const token = getCookie(c, REFRESH_COOKIE)
    if (token) {
      await authService.logout(token)
    }
    deleteCookie(c, REFRESH_COOKIE, { path: '/' })
    return c.json({ message: 'Déconnecté.' }, 200)
  },

  async me(c: AuthContext) {
    const payload = c.get('jwtPayload')
    const userId = payload.sub as string
    const user = await authService.getMe(userId)
    return c.json({ user }, 200)
  },

  /**
   * PATCH /api/auth/password — change le mot de passe du compte connecté.
   * Renvoie un nouveau couple de jetons : la session courante reste ouverte,
   * toutes les autres sont invalidées côté service.
   */
  async changePassword(c: AuthContext) {
    const body = await c.req.json()
    const result = changePasswordSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: result.error.flatten() }, 400)
    }

    const userId = (c.get('jwtPayload') as { sub: string }).sub
    const currentRefreshToken = getCookie(c, REFRESH_COOKIE)

    try {
      const { accessToken, refreshToken, user } = await authService.changePassword(
        userId,
        result.data,
        currentRefreshToken,
      )
      setRefreshCookie(c, refreshToken)
      return c.json({ accessToken, user }, 200)
    } catch (e) {
      // 403 et non 401 : la session est valide, c'est le champ « mot de passe
      // actuel » qui est faux. Un 401 déclencherait le rafraîchissement
      // automatique puis un second essai côté client (lib/api), consommant deux
      // jetons de rate limit par saisie erronée.
      if (hasCode(e, 'UNAUTHORIZED'))
        return c.json(
          { error: 'Mot de passe actuel incorrect.', code: 'BAD_CURRENT_PASSWORD' },
          403,
        )
      if (hasCode(e, 'SAME_PASSWORD'))
        return c.json({ error: 'Le nouveau mot de passe doit être différent de l’ancien.' }, 400)
      if (hasCode(e, 'PWNED')) {
        return c.json(
          {
            error:
              'Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.',
          },
          400,
        )
      }
      throw e
    }
  },

  /**
   * POST /api/auth/forgot-password — envoie le lien de réinitialisation.
   *
   * Répond toujours 202 avec le même message, que l'adresse corresponde ou non
   * à un compte : le formulaire ne doit pas permettre de tester l'existence
   * d'un compte (§ anti-énumération).
   */
  async forgotPassword(c: Context) {
    const body = await c.req.json()
    const result = forgotPasswordSchema.safeParse(body)
    // Même une adresse mal formée reçoit la réponse générique — répondre 400
    // ici ne fuite rien, mais garder une réponse unique simplifie l'UI.
    if (result.success) {
      await authService.requestPasswordReset(result.data.email)
    }

    return c.json(
      {
        message:
          'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.',
      },
      202,
    )
  },

  /**
   * POST /api/auth/reset-password — applique le nouveau mot de passe à partir
   * du jeton reçu par e-mail. Aucune session n'est ouverte : l'utilisateur se
   * reconnecte, ce qui vérifie au passage qu'il a bien mémorisé son mot de passe.
   */
  async resetPassword(c: Context) {
    const body = await c.req.json()
    const result = resetPasswordSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: result.error.flatten() }, 400)
    }

    try {
      await authService.resetPassword(result.data)
      return c.json({ message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' }, 200)
    } catch (e) {
      if (hasCode(e, 'INVALID_TOKEN')) {
        return c.json(
          {
            error: 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.',
            code: 'INVALID_TOKEN',
          },
          400,
        )
      }
      if (hasCode(e, 'PWNED')) {
        return c.json(
          {
            error:
              'Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.',
          },
          400,
        )
      }
      throw e
    }
  },
}
