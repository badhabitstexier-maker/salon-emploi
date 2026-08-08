import { test, expect } from '@playwright/test';
import { offreCards, offreCardsVisibles, offreCardsData } from './helpers/offres';

test.describe('Catalogue /offres — filtres', () => {
  test('filtre par secteur d’activité', async ({ page }) => {
    await page.goto('/offres');
    const cartes = await offreCardsData(page);
    const secteur = cartes[0].secteur;
    const attendu = cartes.filter((carte) => carte.secteur === secteur).length;

    await page.getByLabel("Secteur d'activité").selectOption(secteur);

    await expect(offreCardsVisibles(page)).toHaveCount(attendu);
    await expect(page.locator('#resultats-compte-offres')).toContainText(String(attendu));
  });

  test('filtre par lieu de travail', async ({ page }) => {
    await page.goto('/offres');
    const cartes = await offreCardsData(page);
    const lieu = cartes[0].lieu;
    const attendu = cartes.filter((carte) => carte.lieu === lieu).length;

    await page.getByLabel('Lieu de travail').selectOption(lieu);

    await expect(offreCardsVisibles(page)).toHaveCount(attendu);
    await expect(page.locator('#resultats-compte-offres')).toContainText(String(attendu));
  });

  test('filtre par type de contrat', async ({ page }) => {
    await page.goto('/offres');
    const cartes = await offreCardsData(page);
    const typeContrat = cartes[0].typesContrat[0];
    const attendu = cartes.filter((carte) => carte.typesContrat.includes(typeContrat)).length;

    await page.getByLabel('Type de contrat').selectOption(typeContrat);

    await expect(offreCardsVisibles(page)).toHaveCount(attendu);
    await expect(page.locator('#resultats-compte-offres')).toContainText(String(attendu));
  });

  test('la combinaison de deux filtres restreint les résultats en conséquence', async ({ page }) => {
    await page.goto('/offres');
    const cartes = await offreCardsData(page);
    const { secteur, lieu } = cartes[0];
    const attendu = cartes.filter((carte) => carte.secteur === secteur && carte.lieu === lieu).length;

    await page.getByLabel("Secteur d'activité").selectOption(secteur);
    await page.getByLabel('Lieu de travail').selectOption(lieu);

    await expect(offreCardsVisibles(page)).toHaveCount(attendu);
    await expect(page.locator('#resultats-compte-offres')).toContainText(String(attendu));
  });

  test('la zone de résultats est annoncée via aria-live', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.locator('#resultats-compte-offres')).toHaveAttribute('aria-live', 'polite');
  });

  test('réinitialiser les filtres restaure la liste complète', async ({ page }) => {
    await page.goto('/offres');
    const total = await offreCards(page).count();
    const cartes = await offreCardsData(page);

    await page.getByLabel("Secteur d'activité").selectOption(cartes[0].secteur);
    await expect(offreCardsVisibles(page)).not.toHaveCount(total);

    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();

    await expect(offreCardsVisibles(page)).toHaveCount(total);
    await expect(page.locator('#resultats-compte-offres')).toContainText(String(total));
  });

  test('aucun résultat affiche le message dédié et un compteur à zéro', async ({ page }) => {
    await page.goto('/offres');

    await page.getByLabel('Rechercher').fill('zzzzzz-aucune-offre-ne-correspond-e2e');

    await expect(offreCardsVisibles(page)).toHaveCount(0);
    await expect(page.locator('#resultats-compte-offres')).toContainText('0');
    await expect(page.locator('#aucun-resultat-offres')).toBeVisible();
  });
});
