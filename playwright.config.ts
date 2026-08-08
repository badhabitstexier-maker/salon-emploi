import { defineConfig, devices } from '@playwright/test';
import { FIXTURES_BASE_URL } from './tests/e2e/support/constants';

/*
  Configuration Playwright — Lot 4B (recette automatisée).

  Le site est statique (Astro `output: 'static'`) : plutôt qu'un unique
  `webServer`, le global setup (tests/e2e/global-setup.ts) produit trois
  builds distincts (collections vides / avec fixtures / avec fixtures + Tally
  fictif) et démarre un petit serveur statique pour chacun — voir ce fichier
  et docs/RECETTE_AUTOMATISEE.md pour le détail.

  `baseURL` par défaut pointe vers le build « avec fixtures », utilisé par la
  majorité des specs ; les tests « collection vide » et « Tally » redéfinissent
  `baseURL` localement via `test.use({ baseURL: ... })`.

  Chromium uniquement, deux profils (desktop / mobile).
*/
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list']] : [['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: FIXTURES_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
});
