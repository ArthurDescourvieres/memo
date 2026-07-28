/**
 * Échappatoire administrateur pour la réinitialisation de mot de passe.
 *
 *   npm run reset-password -- --email=user@example.com        (en local)
 *   docker compose exec api node dist/jobs/generate-password-reset-link.js --email=user@example.com   (en prod)
 *
 * Sert quand SMTP n'est pas configuré (auto-hébergement sans mailer) ou en
 * dépannage ponctuel : quiconque a un accès shell au serveur a de toute façon
 * déjà accès à la base et à Redis, donc générer le jeton par ce biais n'ouvre
 * aucun privilège nouveau — contrairement à une route HTTP, qui exposerait la
 * même capacité à quiconque connaît un email.
 *
 * Le lien produit est celui envoyé par e-mail (`resetLink`) : mêmes propriétés
 * (jeton à usage unique, expiration 1 h). À transmettre à l'utilisateur par un
 * canal de confiance (l'admin l'a authentifié autrement, puisqu'il n'y a pas
 * eu d'e-mail).
 */
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { issueResetToken } from '../lib/password-reset.js'
import { resetLink } from '../lib/mailer.js'

async function main() {
  const emailArg = process.argv.find((arg) => arg.startsWith('--email='))
  const email = emailArg?.slice('--email='.length).trim().toLowerCase()
  if (!email) {
    console.error('Usage: npm run reset-password -- --email=user@example.com')
    process.exitCode = 1
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.deactivatedAt) {
    console.error(`[reset-password] aucun compte actif pour ${email}`)
    process.exitCode = 1
    return
  }

  const token = await issueResetToken(user.id)
  console.log(resetLink(token))
  console.log('Ce lien expire dans 1 heure et ne peut servir qu’une seule fois.')
}

main()
  .catch((err) => {
    console.error('[reset-password] échec :', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await redis.quit()
  })
