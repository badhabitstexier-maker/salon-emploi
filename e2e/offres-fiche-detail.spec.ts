import { test, expect } from '@playwright/test';
import { offreCards } from './helpers/offres';

test.describe('Fiche détail — offres TEST', () => {
  test('la fiche affiche référence, intitulé et le message de démonstration', async ({ page }) => {
    await page.goto('/offres');
    const carteTest = offreCards(page).filter({ hasText: 'TEST —' }).first();
    const reference = await carteTest.getAttribute('data-reference');
    const intitule = await carteTest.locator('h3').textContent();

    await carteTest.getByRole('link', { name: "Voir l'offre" }).click();

    await expect(page.locator('h1').first()).toContainText(intitule!.trim());
    await expect(page.getByText(reference!).first()).toBeVisible();
    await expect(
      page.getByText('Offre fictive de démonstration — présentée uniquement pour illustrer le fonctionnement du catalogue.'),
    ).toBeVisible();
  });

  test("aucun bouton de candidature ni d'ajout à la sélection n'est proposé", async ({ page }) => {
    await page.goto('/offres');
    const carteTest = offreCards(page).filter({ hasText: 'TEST —' }).first();
    await carteTest.getByRole('link', { name: "Voir l'offre" }).click();

    await expect(page.locator('[data-offre-toggle]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /candidater/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sélection/i })).toHaveCount(0);
  });
});
