/**
 * Purge RGPD des comptes désactivés depuis plus de 30 jours, à brancher sur un
 * cron système :
 *
 *   npm run purge
 *   docker compose exec api npm run purge
 */
import { purgeService } from '../services/purge.service.js'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'

async function main() {
  const { purged } = await purgeService.purgeDeactivatedAccounts()
  console.log(`[purge] comptes purgés : ${purged}`)
}

main()
  .catch((err) => {
    console.error('[purge] échec :', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await redis.quit()
  })
