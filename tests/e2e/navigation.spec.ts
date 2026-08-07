import { test, expect } from '@playwright/test';

test.describe('En-tête — navigation', () => {
  test('desktop : la navigation principale est visible et pointe vers les bonnes routes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Vérification desktop uniquement');
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Le salon' })).toHaveAttribute('href', '/le-salon');
    await expect(nav.getByRole('link', { name: 'Exposants' })).toHaveAttribute('href', '/exposants');
    await expect(nav.getByRole('link', { name: 'Offres' })).toHaveAttribute('href', '/offres');
    await expect(nav.getByRole('link', { name: 'Programme' })).toHaveAttribute('href', '/programme');
  });

  test('mobile : le menu s’ouvre, expose les liens, et la navigation fonctionne', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Vérification mobile uniquement');
    await page.goto('/');

    // Sélecteur stable : l'aria-label du bouton passe de « Ouvrir » à « Fermer »
    // après le clic, ce qui invaliderait un getByRole basé sur le nom accessible.
    const toggle = page.locator('#menu-toggle');
    const menu = page.locator('nav[aria-label="Navigation mobile"]');

    await expect(menu).toBeHidden();
    await toggle.click();
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const lienExposants = menu.getByRole('link', { name: 'Exposants' });
    await expect(lienExposants).toBeVisible();
    await lienExposants.click();

    await expect(page).toHaveURL(/\/exposants\/?$/);
  });
});

test.describe('Pied de page', () => {
  test('les liens internes principaux pointent vers des routes existantes', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const liensAttendus = [
      ['Le salon', '/le-salon'],
      ['Exposants', '/exposants'],
      ['Voir les offres', '/offres'],
      ['Programme', '/programme'],
      ['Préparer ma visite', '/preparer-ma-visite'],
      ['Exposer', '/exposer'],
      ['Mentions légales', '/mentions-legales'],
      ['Politique de confidentialité', '/confidentialite'],
    ] as const;

    for (const [label, href] of liensAttendus) {
      await expect(footer.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });
});
