import { expect, type Page } from '@playwright/test'
import type { TestUser } from './users'

const APP_SHELL = 'workspace-shell'

export async function registerViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register')
  await page.locator('#login-name').fill(user.name)
  await page.locator('#login-identifier').fill(user.email)
  await page.locator('#login-password').fill(user.password)
  await page.getByTestId('auth-submit').click()
  await expect(page.getByTestId(APP_SHELL)).toBeVisible()
}

/** Soumet sans présumer du résultat : l'appelant inspecte la réponse lui-même. */
export async function fillLogin(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-identifier').fill(identifier)
  await page.locator('#login-password').fill(password)
  await page.getByTestId('auth-submit').click()
}

export async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByTestId('empty-action-workspace').click()
  await page.getByTestId('workspace-name-input').fill(name)
  await page.getByTestId('workspace-submit').click()
  await expect(page.getByTestId('workspace-name-input')).toHaveCount(0)
}

export async function createNoteFromEmptyState(page: Page): Promise<void> {
  // Le bouton n'apparaît qu'une fois le rôle OWNER résolu ; Playwright patiente.
  await page.getByTestId('empty-action-note').click()
  await expect(page.getByTestId('note-editor-content')).toBeVisible()
}

/**
 * L'app restaurant la dernière note ouverte, l'éditeur peut déjà être à l'écran.
 * Ne rien recliquer alors : le dossier déjà déplié se replierait, emportant la
 * ligne de note avec lui.
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
