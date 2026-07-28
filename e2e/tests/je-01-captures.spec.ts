import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { uniqueUser, uniqueLabel } from '../helpers/users'
import {
  registerViaUi,
  createWorkspace,
  createNoteFromEmptyState,
  openFirstNoteViaSidebar,
} from '../helpers/app'

/**
 * Rejoue le Parcours 3 et capture les deux fenêtres montrant le même texte
 * propagé. Les PNG atterrissent dans jeu-essai/captures/.
 *
 * La suite tourne sur la stack de dev, pas sur le serveur de test :3100 des
 * harnais socket.io : même code temps réel, seule la source de données diffère.
 */
const cap = (name: string) =>
  fileURLToPath(new URL(`../../jeu-essai/captures/${name}`, import.meta.url))

test('JE-01 bonus — captures deux fenêtres, frappe propagée A→B', async ({ browser }) => {
  const user = uniqueUser()
  const marker = uniqueLabel('JE01-tempsreel')

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await registerViaUi(pageA, user)
  await createWorkspace(pageA, uniqueLabel('Espace'))
  await createNoteFromEmptyState(pageA)

  const ctxB = await browser.newContext({ storageState: await ctxA.storageState() })
  const pageB = await ctxB.newPage()
  await pageB.goto('/')
  await expect(pageB.getByTestId('workspace-shell')).toBeVisible()
  await openFirstNoteViaSidebar(pageB)

  await expect(pageA.getByTestId('note-presence')).toBeVisible({ timeout: 15_000 })

  const editorA = pageA.getByTestId('note-editor-content')
  const editorB = pageB.getByTestId('note-editor-content')
  await editorA.click()
  await editorA.pressSequentially(marker, { delay: 30 })

  // Verrou anti-écho ~1,5 s côté B (cf. Parcours 3) : on re-pousse jusqu'à reflet.
  await expect(async () => {
    await editorA.pressSequentially('.', { delay: 0 })
    await expect(editorB).toContainText(marker, { timeout: 1000 })
  }).toPass({ timeout: 20_000 })

  await pageA.screenshot({ path: cap('je-01-fenetreA-emetteur.png') })
  await pageB.screenshot({ path: cap('je-01-fenetreB-recepteur.png') })

  await ctxA.close()
  await ctxB.close()
})
