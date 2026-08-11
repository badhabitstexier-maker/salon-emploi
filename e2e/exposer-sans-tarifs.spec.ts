import { test, expect } from '@playwright/test';

/*
  Décision LabEvents du 10/08/2026 : les tarifs des formules exposants ne
  sont plus communiqués publiquement (transmis au cas par cas après prise
  de contact). Ce test garantit qu'aucun montant ni mention "tarif" ne
  réapparaît sur /exposer, tout en gardant les trois formules visibles.
*/
test.describe('/exposer — aucune information tarifaire publique', () => {
  test('la page ne contient aucun montant ni mention "tarif"', async ({ page }) => {
    await page.goto('/exposer');

    const texte = await page.locator('body').innerText();

    expect(texte).not.toMatch(/tarif/i);
    expect(texte).not.toMatch(/grille tarifaire/i);
    expect(texte).not.toMatch(/\b(82\s?500|105\s?000|125\s?000|95\s?000|20\s?000|8\s?000|7\s?000)\s*F\b/i);
    expect(texte).not.toMatch(/F\s*(HT|CFP)\b/i);
  });

  test('les trois formules restent présentées avec leurs avantages', async ({ page }) => {
    await page.goto('/exposer');

    await expect(page.getByRole('heading', { name: 'Standard', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Silver', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gold', exact: true })).toBeVisible();
  });
});
