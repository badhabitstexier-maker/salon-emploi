import { test, expect } from '@playwright/test';

/*
  Lot 4B-3 : automatise les règles SEO/UI déjà décidées pour les offres
  fictives de démonstration (intitulé "TEST —", voir src/lib/offres.ts::
  estOffreTest et CLAUDE.md section 12). Ce test ne modifie aucune règle
  fonctionnelle — il vérifie que l'implémentation actuelle les respecte.
*/

test.describe('Offres TEST — règles SEO et UI de démonstration', () => {
  test('une fiche TEST est noindex/nofollow, sans JobPosting, sans CTA, avec le message de démonstration', async ({
    page,
  }) => {
    await page.goto('/offres');
    const premiereFicheTest = page.locator('[data-offre-card]').filter({ hasText: 'TEST —' }).first();
    const reference = await premiereFicheTest.getAttribute('data-reference');
    await premiereFicheTest.getByRole('link', { name: "Voir l'offre" }).click();
    await expect(page).toHaveURL(/\/offres\//);

    // Robots : noindex, nofollow forcés indépendamment du réglage global.
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveCount(1);
    const contenuRobots = (await robots.getAttribute('content')) ?? '';
    expect(contenuRobots).toContain('noindex');
    expect(contenuRobots).toContain('nofollow');

    // Aucun JSON-LD JobPosting sur une fiche TEST.
    const scriptsLdJson = page.locator('script[type="application/ld+json"]');
    const nombreScripts = await scriptsLdJson.count();
    for (let i = 0; i < nombreScripts; i += 1) {
      const contenu = await scriptsLdJson.nth(i).textContent();
      const donnees = contenu ? JSON.parse(contenu) : null;
      expect(donnees?.['@type']).not.toBe('JobPosting');
    }

    // Aucun bouton de candidature ni d'ajout à la sélection.
    await expect(page.locator(`[data-offre-toggle="${reference}"]`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /candidater/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /ajouter cette offre à ma sélection/i })).toHaveCount(0);

    // Message explicite de démonstration.
    await expect(
      page.getByText('Offre fictive de démonstration — présentée uniquement pour illustrer le fonctionnement du catalogue.'),
    ).toBeVisible();
  });

  test('les fiches TEST sont exclues du catalogue des boutons de sélection', async ({ page }) => {
    await page.goto('/offres');
    const fichesTest = page.locator('[data-offre-card]').filter({ hasText: 'TEST —' });
    const nombre = await fichesTest.count();
    expect(nombre).toBeGreaterThan(0);

    for (let i = 0; i < nombre; i += 1) {
      const carte = fichesTest.nth(i);
      await expect(carte.getByRole('button', { name: 'Ajouter à ma sélection' })).toHaveCount(0);
    }
  });
});
