import { test, expect } from '@playwright/test'
import { uniqueUser, uniqueLabel } from '../helpers/users'
import {
  registerViaUi,
  createWorkspace,
  createNoteFromEmptyState,
  openFirstNoteViaSidebar,
} from '../helpers/app'

test('Parcours 2 — Persistance : workspace + note + contenu survivent au rechargement', async ({
  page,
}) => {
  const user = uniqueUser()
  const marker = uniqueLabel('contenu-persistant')

  await registerViaUi(page, user)
  await createWorkspace(page, uniqueLabel('Espace'))
  await createNoteFromEmptyState(page)

  // On attend la vraie requête d'autosave, pas seulement l'indicateur d'UI.
  const editor = page.getByTestId('note-editor-content')
  await editor.click()
  const autosave = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && /\/api\/notes\/[^/]+$/.test(r.url()) && r.ok(),
  )
  await editor.pressSequentially(marker, { delay: 25 })
  await autosave

  await expect(page.getByTestId('note-save-status')).toHaveAttribute('data-status', 'saved')

  // Rechargement complet : l'état React est perdu, l'auth se ré-hydrate depuis
  // le cookie de refresh.
  await page.reload()
  await expect(page.getByTestId('workspace-shell')).toBeVisible()
  await openFirstNoteViaSidebar(page)
  await expect(page.getByTestId('note-editor-content')).toContainText(marker)
})
