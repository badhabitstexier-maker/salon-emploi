import { test, expect } from '@playwright/test';
import { offreCards, offreCardsVisibles, offreCardsData } from './helpers/offres';

test.describe('Catalogue /offres — chargement', () => {
  test('la page se charge avec un titre et les offres du catalogue', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(offreCards(page).first()).toBeVisible();
  });

  test('les 5 offres TEST actuellement publiées sont présentes', async ({ page }) => {
    await page.goto('/offres');
    const cartes = await offreCardsData(page);
    expect(cartes.filter((carte) => carte.estTest)).toHaveLength(5);
  });

  test('le compteur initial correspond au nombre de cartes visibles', async ({ page }) => {
    await page.goto('/offres');
    const total = await offreCards(page).count();
    await expect(page.locator('#resultats-compte-offres')).toContainText(String(total));
    await expect(offreCardsVisibles(page)).toHaveCount(total);
  });

  test('chaque carte offre un accès accessible à sa fiche détail', async ({ page }) => {
    await page.goto('/offres');
    const total = await offreCards(page).count();
    await expect(page.getByRole('link', { name: "Voir l'offre" })).toHaveCount(total);
  });

  test("navigation d'une carte vers sa fiche détail", async ({ page }) => {
    await page.goto('/offres');
    const premiereCarte = offreCards(page).first();
    const reference = await premiereCarte.getAttribute('data-reference');

    await premiereCarte.getByRole('link', { name: "Voir l'offre" }).click();

    await expect(page).toHaveURL(/\/offres\/[^/]+\/?(\?.*)?$/);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText(reference!)).toBeVisible();
  });

  test('mobile — le catalogue ne déborde pas horizontalement', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Contrôle réservé au projet mobile');
    await page.goto('/offres');
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(debordement).toBe(false);
  });
});
