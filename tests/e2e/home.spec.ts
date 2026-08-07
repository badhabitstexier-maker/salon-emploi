import { test, expect } from '@playwright/test';
import { collecterErreursConsole, erreursApplicatives, verifierAucunDebordementHorizontal } from './support/helpers';

test.describe('Accueil', () => {
  test('charge, affiche le H1, la navigation et les CTA, sans erreur JS ni débordement @smoke', async ({ page }) => {
    const { erreurs } = collecterErreursConsole(page);

    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator('h1')).toContainText("Salon");
    await expect(page.getByRole('link', { name: /devenir exposant/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /préparer ma visite/i }).first()).toBeVisible();

    // Navigation principale (desktop) ou menu mobile — au moins un des deux doit
    // être présent dans le DOM (le sélecteur CSS les trouve même repliés via
    // `hidden`, contrairement à getByRole qui exclut les éléments non
    // accessibles avant l'ouverture du menu mobile).
    const nav = page.locator('nav[aria-label="Navigation principale"], nav[aria-label="Navigation mobile"]').first();
    await expect(nav).toBeAttached();

    await verifierAucunDebordementHorizontal(page);

    expect(erreursApplicatives(erreurs), erreurs.join('\n')).toEqual([]);
  });

  test('expose un JSON-LD Event valide avec les dates et le lieu officiels', async ({ page }) => {
    await page.goto('/');
    const schema = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      return script ? JSON.parse(script.textContent ?? '{}') : null;
    });

    expect(schema).not.toBeNull();
    expect(schema['@type']).toBe('Event');
    expect(schema.name).toContain("Salon de l'Emploi");
    expect(schema.startDate).toBe('2026-10-30');
    expect(schema.endDate).toBe('2026-10-31');
    expect(schema.isAccessibleForFree).toBe(true);
    expect(schema.location?.name).toContain('Nouville');
  });

  test('ne référence aucun logo de partenaire non confirmé (section « Ils seront présents » masquée)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ils seront présents' })).toHaveCount(0);
  });
});
