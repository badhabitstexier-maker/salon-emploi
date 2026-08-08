import { defineConfig, devices } from '@playwright/test';

const port = 4321;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    // La fixture E2E (scripts/e2e-fixtures.mjs) doit exister sur le disque
    // *avant* `astro build` (site statique) pour apparaître dans le build —
    // elle est retirée après coup par globalTeardown, jamais committée.
    command: `node scripts/e2e-fixtures.mjs create && npm run build && npm run preview -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PUBLIC_SITE_URL: baseURL,
      PUBLIC_WEB3FORMS_ACCESS_KEY: 'check-only',
    },
  },
});
