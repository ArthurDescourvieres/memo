import { test, expect } from '@playwright/test'
import { uniqueUser } from '../helpers/users'
import { registerViaUi, fillLogin } from '../helpers/app'

test('Parcours 4 — Suppression de compte : déconnexion puis reconnexion impossible (403)', async ({
  page,
}) => {
  const user = uniqueUser()

  await registerViaUi(page, user)

  await page.getByTestId('profile-menu-button').click()
  await page.getByTestId('profile-settings').click()
  await page.getByTestId('account-delete').click()
  await page.getByTestId('account-delete-confirm').click()

  await expect(page.getByTestId('workspace-shell')).toHaveCount(0)

  // Le compte est désactivé : l'API doit répondre 403, pas 401.
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
  )
  await fillLogin(page, user.email, user.password)
  expect((await loginResponse).status()).toBe(403)

  await expect(page.getByTestId('workspace-shell')).toHaveCount(0)
  await expect(page.getByRole('alert')).toBeVisible()
})
