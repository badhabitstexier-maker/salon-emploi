import { test, expect } from '@playwright/test';
import { EMPTY_BASE_URL } from './support/constants';

test.describe('Programme — avec fixtures', () => {
  test('les activités publiées sont affichées, réparties par journée dans l’ordre chronologique @smoke', async ({ page }) => {
    await page.goto('/programme');

    const jour30 = page.locator('[data-jour-wrapper][data-date="2026-10-30"]');
    const jour31 = page.locator('[data-jour-wrapper][data-date="2026-10-31"]');
    await expect(jour30.getByText('Atelier Test E2E Matin')).toBeVisible();
    await expect(jour30.getByText('Rencontre Test E2E Transversale')).toBeVisible();
    await expect(jour31.getByText('Conférence Test E2E Après-midi')).toBeVisible();

    // Ordre chronologique au sein du 30 octobre : 09:00 avant 15:30.
    const cartesJour30 = jour30.locator('[data-programme-card]');
    await expect(cartesJour30.nth(0)).toContainText('Atelier Test E2E Matin');
    await expect(cartesJour30.nth(1)).toContainText('Rencontre Test E2E Transversale');
  });

  test('les activités non publiées (publie: false) ne sont jamais affichées', async ({ page }) => {
    await page.goto('/programme');
    await expect(page.getByText('Programme Test Non Publié E2E')).toHaveCount(0);
  });

  test('la page de détail affiche le lieu, les horaires et les intervenants', async ({ page }) => {
    await page.goto('/programme');
    await page.locator('[data-programme-card]', { hasText: 'Conférence Test E2E Après-midi' }).getByRole('link').click();

    await expect(page).toHaveURL(/\/programme\/fixture-conference-e2e\/?$/);
    await expect(page.locator('h1')).toContainText('Conférence Test E2E Après-midi');
    await expect(page.getByText('Scène Test')).toBeVisible();
    await expect(page.getByText('14:00–14:45')).toBeVisible();
    await expect(page.getByText('Test Intervenant E2E')).toBeVisible();

    await page.getByRole('link', { name: /retour au programme/i }).first().click();
    await expect(page).toHaveURL(/\/programme\/?$/);
  });

  test('la page de détail d’une activité non publiée n’est pas accessible (404)', async ({ page }) => {
    const response = await page.goto('/programme/fixture-programme-non-publie-e2e');
    expect(response?.status()).toBe(404);
  });

  test('filtre par journée réduit correctement la liste', async ({ page }) => {
    await page.goto('/programme');
    await page.selectOption('#filtre-jour', '2026-10-31');
    await expect(page.getByText('Conférence Test E2E Après-midi')).toBeVisible();
    await expect(page.locator('[data-jour-wrapper][data-date="2026-10-30"]')).toBeHidden();
  });
});

test.describe('Programme — collection vide', () => {
  test.use({ baseURL: EMPTY_BASE_URL });

  test('aucun crash, message utilisateur propre, aucun lien détail fantôme', async ({ page }) => {
    const response = await page.goto('/programme');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByRole('heading', { name: /sera publié prochainement/i })).toBeVisible();
    await expect(page.locator('[data-programme-card]')).toHaveCount(0);
    await expect(page.locator('a[href^="/programme/"]')).toHaveCount(0);
  });
});
