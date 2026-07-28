/**
 * Génère un lien de réinitialisation en ligne de commande, quand SMTP n'est pas
 * configuré ou en dépannage :
 *
 *   npm run reset-password -- --email=user@example.com
 *   docker compose exec api node dist/jobs/generate-password-reset-link.js --email=…
 *
 * Volontairement hors HTTP : un accès shell donne déjà la base et Redis, donc
 * rien de nouveau n'est ouvert, alors qu'une route exposerait la même capacité
 * à quiconque connaît une adresse.
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
