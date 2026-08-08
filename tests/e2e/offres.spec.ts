import { test, expect } from '@playwright/test';
import { EMPTY_BASE_URL } from './support/constants';

test.describe('Offres — avec fixtures', () => {
  test('le catalogue affiche les offres publiées avec leurs informations principales @smoke', async ({ page }) => {
    await page.goto('/offres');

    const carte = page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Standard' });
    await expect(carte).toBeVisible();
    await expect(carte).toContainText('Entreprise Test E2E');
    await expect(carte).toContainText('CDI');
    await expect(carte).toContainText('Nouméa');
  });

  test('les offres au statut différent de « publiee » ne sont jamais affichées', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.getByText('Poste Test E2E Non Publié')).toHaveCount(0);
  });

  test('la page de détail affiche les informations et permet la candidature en ligne si éligible', async ({ page }) => {
    await page.goto('/offres');
    await page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Standard' }).getByRole('link', { name: "Voir l'offre" }).click();

    await expect(page).toHaveURL(/\/offres\/fixture-offre-standard-e2e\/?$/);
    await expect(page.locator('h1')).toContainText('Poste Test E2E Standard');
    await expect(page.getByRole('button', { name: /ajouter à ma sélection/i })).toBeVisible();
  });

  test('une offre `accepteCandidaturesEnLigne: false` n’affiche pas de bouton d’ajout', async ({ page }) => {
    await page.goto('/offres/fixture-offre-sur-place-e2e');
    await expect(page.getByRole('button', { name: /ajouter cette offre à ma sélection/i })).toHaveCount(0);
    await expect(page.getByText(/à découvrir directement auprès de l'exposant/i)).toBeVisible();
  });

  test('filtre par type de contrat réduit correctement la grille', async ({ page }) => {
    await page.goto('/offres');
    await page.selectOption('#filtre-type-contrat', 'CDI');
    await expect(page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Standard' })).toBeVisible();
    await expect(page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Gold' })).toBeHidden();
  });

  test('JSON-LD JobPosting : champs corrects, validThrough uniquement si dateCloture existe', async ({ page }) => {
    // Fixture avec dateCloture définie.
    await page.goto('/offres/fixture-offre-standard-e2e');
    const schemaAvecCloture = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      return script ? JSON.parse(script.textContent ?? '{}') : null;
    });
    expect(schemaAvecCloture['@type']).toBe('JobPosting');
    expect(schemaAvecCloture.title).toBe('Poste Test E2E Standard');
    expect(schemaAvecCloture.datePosted).toBe('2026-09-01');
    expect(schemaAvecCloture.validThrough).toBe('2026-10-25');
    expect(schemaAvecCloture.hiringOrganization?.name).toBe('Entreprise Test E2E');
    expect(schemaAvecCloture.jobLocation?.address?.addressLocality).toBe('Nouméa');

    // Fixture sans dateCloture : validThrough ne doit jamais être inventé.
    await page.goto('/offres/fixture-offre-gold-e2e');
    const schemaSansCloture = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      return script ? JSON.parse(script.textContent ?? '{}') : null;
    });
    expect(schemaSansCloture).not.toHaveProperty('validThrough');
  });
});

test.describe('Offres — collection vide', () => {
  test.use({ baseURL: EMPTY_BASE_URL });

  test('aucun crash, message utilisateur propre, aucun lien détail fantôme', async ({ page }) => {
    const response = await page.goto('/offres');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByRole('heading', { name: /publiées progressivement/i })).toBeVisible();
    await expect(page.locator('[data-offre-card]')).toHaveCount(0);
    await expect(page.locator('a[href^="/offres/"]')).toHaveCount(0);
  });
});
