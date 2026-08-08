import { test, expect } from '@playwright/test';

test.describe('Socle QA — smoke tests', () => {
  test('accueil chargé avec le titre attendu', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Salon de l'Emploi & de la Formation 2026/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('navigation principale vers /offres', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      await page.locator('#menu-toggle').click();
      await page.locator('#mobile-menu').getByRole('link', { name: 'Offres', exact: true }).click();
    } else {
      await page.getByRole('link', { name: 'Offres', exact: true }).first().click();
    }

    await expect(page).toHaveURL(/\/offres\/?$/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('catalogue /offres chargé avec les offres TEST', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.getByText(/TEST —/).first()).toBeVisible();
  });

  test('menu burger mobile ouvre et affiche la navigation', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Contrôle réservé au projet mobile');

    await page.goto('/');
    const toggle = page.locator('#menu-toggle');
    const menu = page.locator('#mobile-menu');

    await expect(menu).toBeHidden();
    await toggle.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Offres', exact: true })).toBeVisible();
  });
});
