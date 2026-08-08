import { test, expect } from '@playwright/test';
import { EMPTY_BASE_URL } from './support/constants';

test.describe('Exposants — avec fixtures', () => {
  test('le catalogue affiche les fiches publiées, avec nom, hall et stand @smoke', async ({ page }) => {
    await page.goto('/exposants');

    const carteEmploi = page.locator('[data-exposant-card]', { hasText: 'Entreprise Test E2E' });
    await expect(carteEmploi).toBeVisible();
    await expect(carteEmploi).toContainText('Hall Emploi');
    await expect(carteEmploi).toContainText('Stand T01');

    const carteFormation = page.locator('[data-exposant-card]', { hasText: 'Organisme Formation Test E2E' });
    await expect(carteFormation).toBeVisible();
    await expect(carteFormation).toContainText('Hall Formation');
  });

  test('les fiches non publiées (publie: false) ne sont jamais affichées', async ({ page }) => {
    await page.goto('/exposants');
    await expect(page.getByText('Exposant Test Non Publié E2E')).toHaveCount(0);
  });

  test('la page de détail affiche le contenu et le retour au catalogue fonctionne', async ({ page }) => {
    await page.goto('/exposants');
    await page.locator('[data-exposant-card]', { hasText: 'Entreprise Test E2E' }).getByRole('link').click();

    await expect(page).toHaveURL(/\/exposants\/fixture-entreprise-e2e\/?$/);
    await expect(page.locator('h1')).toContainText('Entreprise Test E2E');
    await expect(page.getByText('Stand T01')).toBeVisible();

    await page.getByRole('link', { name: /voir tous les exposants/i }).first().click();
    await expect(page).toHaveURL(/\/exposants\/?$/);
  });

  test('la page de détail d’une fiche non publiée n’est pas accessible (404)', async ({ page }) => {
    const response = await page.goto('/exposants/fixture-non-publie-e2e');
    expect(response?.status()).toBe(404);
  });

  test('logo absent : un pictogramme de repli est affiché, jamais d’image cassée', async ({ page }) => {
    await page.goto('/exposants');
    const carte = page.locator('[data-exposant-card]', { hasText: 'Entreprise Test E2E' });
    // Aucune des deux fixtures ne définit de logo : le composant doit afficher le pictogramme SVG de repli, pas un <img> cassé.
    await expect(carte.locator('img')).toHaveCount(0);
    await expect(carte.locator('svg').first()).toBeAttached();
  });

  test('filtre univers et recherche texte réduisent correctement la grille', async ({ page }) => {
    await page.goto('/exposants');
    await page.selectOption('#filtre-univers', 'formation');
    await expect(page.locator('[data-exposant-card]', { hasText: 'Organisme Formation Test E2E' })).toBeVisible();
    await expect(page.locator('[data-exposant-card]', { hasText: 'Entreprise Test E2E' })).toBeHidden();

    await page.getByRole('button', { name: /réinitialiser les filtres/i }).click();
    await page.fill('#recherche-exposant', 'Organisme Formation Test E2E');
    await expect(page.locator('[data-exposant-card]', { hasText: 'Organisme Formation Test E2E' })).toBeVisible();
    await expect(page.locator('[data-exposant-card]', { hasText: 'Entreprise Test E2E' })).toBeHidden();
  });
});

test.describe('Exposants — collection vide', () => {
  test.use({ baseURL: EMPTY_BASE_URL });

  test('aucun crash, message utilisateur propre, aucun lien détail fantôme', async ({ page }) => {
    const response = await page.goto('/exposants');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByRole('heading', { name: /seront annoncés prochainement/i })).toBeVisible();
    await expect(page.locator('[data-exposant-card]')).toHaveCount(0);
    await expect(page.locator('a[href^="/exposants/"]')).toHaveCount(0);
  });
});
