import { test, expect } from '@playwright/test'
import { uniqueUser, uniqueLabel } from '../helpers/users'
import {
  registerViaUi,
  createWorkspace,
  createNoteFromEmptyState,
  openFirstNoteViaSidebar,
} from '../helpers/app'

/**
 * Même compte, deux contextes de navigateur indépendants, même note. La
 * synchronisation passe par `note:live`, qui n'est ni persisté ni rejoué.
 */
test('Parcours 3 — Collaboration temps réel : une frappe dans A apparaît dans B', async ({
  browser,
}) => {
  const user = uniqueUser()
  const marker = uniqueLabel('temps-reel')

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await registerViaUi(pageA, user)
  await createWorkspace(pageA, uniqueLabel('Espace'))
  await createNoteFromEmptyState(pageA)

  // Session clonée via le cookie de refresh plutôt qu'un second /login : en dev
  // le proxy Vite ne transmet pas l'IP cliente, tous les logins partagent donc
  // le même compteur de rate limit.
  const ctxB = await browser.newContext({ storageState: await ctxA.storageState() })
  const pageB = await ctxB.newPage()
  await pageB.goto('/')
  await expect(pageB.getByTestId('workspace-shell')).toBeVisible()
  await openFirstNoteViaSidebar(pageB)

  // Attendre la présence de B AVANT de taper : les `note:live` ne sont pas rejoués.
  await expect(pageA.getByTestId('note-presence')).toBeVisible({ timeout: 15_000 })

  const editorA = pageA.getByTestId('note-editor-content')
  const editorB = pageB.getByTestId('note-editor-content')
  await editorA.click()
  await editorA.pressSequentially(marker, { delay: 30 })

  // À l'ouverture, B arme un verrou anti-écho de ~1,5 s : la salve initiale peut
  // y tomber et être ignorée. Le verrou n'est armé qu'une fois, on repousse donc
  // de petits évènements jusqu'à ce qu'il retombe et applique le document.
  await expect(async () => {
    await editorA.pressSequentially('.', { delay: 0 })
    await expect(editorB).toContainText(marker, { timeout: 1000 })
  }).toPass({ timeout: 20_000 })

  await ctxA.close()
  await ctxB.close()
})
