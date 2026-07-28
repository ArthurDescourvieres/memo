import { Hono } from 'hono'
import type { AppEnv } from '../types/hono.js'
import { authMiddleware } from '../middlewares/auth.js'
import {
  loginRateLimit,
  passwordChangeRateLimit,
  passwordResetRateLimit,
  passwordResetSubmitRateLimit,
} from '../middlewares/rate-limit.js'
import { authController } from '../controllers/auth.controller.js'

const authRouter = new Hono<AppEnv>()

authRouter.post('/register', authController.register)
authRouter.post('/login', loginRateLimit, authController.login)
authRouter.post('/refresh', authController.refresh)
authRouter.post('/logout', authController.logout)
authRouter.get('/me', authMiddleware, authController.me)

// Mot de passe — changement depuis un compte connecté, et parcours « oublié »
// (demande du lien puis soumission du nouveau mot de passe), tous trois limités
// en débit car directement exposés à la force brute ou à l'abus d'envoi.
authRouter.patch(
  '/password',
  passwordChangeRateLimit,
  authMiddleware,
  authController.changePassword,
)
authRouter.post('/forgot-password', passwordResetRateLimit, authController.forgotPassword)
authRouter.post('/reset-password', passwordResetSubmitRateLimit, authController.resetPassword)

export { authRouter }
