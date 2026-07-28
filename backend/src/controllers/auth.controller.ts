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

  /** Renvoie de nouveaux jetons : la session courante survit, les autres non. */
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
      // 403 et non 401 : la session est valide, c'est la saisie qui est fausse.
      // Un 401 relancerait le rafraîchissement puis un second essai (lib/api),
      // soit deux jetons de rate limit brûlés par erreur de frappe.
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
   * Toujours 202 avec le même message, adresse connue ou non : le formulaire ne
   * doit pas servir à tester l'existence d'un compte. Même une adresse mal
   * formée reçoit cette réponse, ce qui évite un second cas à traiter dans l'UI.
   */
  async forgotPassword(c: Context) {
    const body = await c.req.json()
    const result = forgotPasswordSchema.safeParse(body)
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
   * Aucune session n'est ouverte : l'utilisateur se reconnecte, ce qui vérifie
   * au passage qu'il a mémorisé son nouveau mot de passe.
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
