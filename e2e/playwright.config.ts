import { defineConfig, devices } from '@playwright/test'

/**
 * Suite E2E locale (hors CI). La stack Docker doit déjà tourner : `globalSetup`
 * sonde /api/health et échoue vite si elle n'est pas joignable. L'API est
 * appelée en chemins relatifs, proxifiés par Vite — donc rien à configurer.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',

  // Chaque spec crée ses propres utilisateurs : aucun état partagé.
  fullyParallel: true,
  forbidOnly: false,
  // Filet contre une lenteur ponctuelle de la machine. Une vraie régression
  // échoue les deux tentatives.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
