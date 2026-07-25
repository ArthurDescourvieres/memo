import { expect, type Page } from '@playwright/test'
import type { TestUser } from './users'

/** data-testid de la coquille applicative connectée (rendue à la route `/`). */
const APP_SHELL = 'workspace-shell'

/**
 * Inscription via l'UI puis attente de l'arrivée dans l'app connectée.
 * Champs : #login-name, #login-identifier, #login-password (cf. Login.tsx).
 */
export async function registerViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register')
  await page.locator('#login-name').fill(user.name)
  await page.locator('#login-identifier').fill(user.email)
  await page.locator('#login-password').fill(user.password)
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId(APP_SHELL)).toBeVisible()
}

/**
 * Remplit et soumet le formulaire de connexion SANS présumer du résultat.
 * Utilisé quand l'appelant veut inspecter la réponse (ex. attendre un 403).
 */
export async function fillLogin(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-identifier').fill(identifier)
  await page.locator('#login-password').fill(password)
  await page.getByTestId('auth-submit').click()
}

/**
 * Crée un workspace depuis l'écran d'accueil (compte neuf) et attend la
 * fermeture de la modale — le nouveau workspace devient courant.
 */
export async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByTestId('empty-action-workspace').click()
  await page.getByTestId('workspace-name-input').fill(name)
  await page.getByTestId('workspace-submit').click()
  await expect(page.getByTestId('workspace-name-input')).toHaveCount(0)
}

/**
 * Crée une note depuis l'écran d'accueil (crée un dossier « Mes notes » au
 * besoin) et attend l'ouverture de l'éditeur Tiptap.
 */
export async function createNoteFromEmptyState(page: Page): Promise<void> {
  // `empty-action-note` n'apparaît qu'une fois le rôle OWNER résolu (refetch de
  // la liste des workspaces) : Playwright patiente automatiquement.
  await page.getByTestId('empty-action-note').click()
  await expect(page.getByTestId('note-editor-content')).toBeVisible()
}

/**
 * Ouvre la 1re note via la sidebar : déplier le 1er dossier puis cliquer la 1re
 * note. Sur un compte de test il n'existe qu'un dossier et qu'une note.
 *
 * L'app restaure désormais la dernière note ouverte (stockage local) : après un
 * rechargement — ou dans un contexte cloné via `storageState` — l'éditeur peut
 * déjà être à l'écran. On ne re-clique alors rien : cliquer le dossier déplié le
 * replierait et ferait disparaître la ligne de note.
 */
export async function openFirstNoteViaSidebar(page: Page): Promise<void> {
  const editor = page.getByTestId('note-editor-content')
  await expect(async () => {
    if (await editor.isVisible()) return
    await page.getByTestId('tree-folder').first().click()
    await page.getByTestId('tree-note').first().click()
    await expect(editor).toBeVisible()
  }).toPass()
}
