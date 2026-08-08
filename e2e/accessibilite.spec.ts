import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_REFERENCE } from '../scripts/e2e-fixtures.mjs';

/*
  Lot 4B-3 : contrôle d'accessibilité automatisé (axe-core) sur les pages
  publiques principales, sur les deux projets Playwright existants
  (chromium-desktop / chromium-mobile — voir playwright.config.ts).

  Règle de blocage : 0 violation "critical" ou "serious". Les violations de
  niveau "moderate"/"minor" sont loggées pour information mais ne font pas
  échouer le test — elles relèvent d'un futur lot de correction ciblée, pas
  de ce Lot 4B-3 dont le périmètre est l'automatisation des contrôles.
*/

const NIVEAUX_BLOQUANTS = new Set(['critical', 'serious']);

const PAGES_A_CONTROLER: Array<{ nom: string; chemin: string }> = [
  { nom: 'Accueil', chemin: '/' },
  { nom: 'Le salon', chemin: '/le-salon' },
  { nom: 'Préparer ma visite', chemin: '/preparer-ma-visite' },
  { nom: 'Exposer', chemin: '/exposer' },
  { nom: 'Exposants', chemin: '/exposants' },
  { nom: 'Programme', chemin: '/programme' },
  { nom: 'Catalogue des offres', chemin: '/offres' },
  { nom: 'Ma sélection', chemin: '/ma-selection' },
  { nom: 'Candidater', chemin: '/candidater' },
];

test.describe('Accessibilité automatisée (axe-core)', () => {
  for (const { nom, chemin } of PAGES_A_CONTROLER) {
    test(`${nom} (${chemin}) — aucune violation critique ou sérieuse`, async ({ page }, testInfo) => {
      await page.goto(chemin);
      const resultats = await new AxeBuilder({ page }).analyze();

      const bloquantes = resultats.violations.filter((violation) => NIVEAUX_BLOQUANTS.has(violation.impact ?? ''));
      const informatives = resultats.violations.filter((violation) => !NIVEAUX_BLOQUANTS.has(violation.impact ?? ''));

      if (informatives.length > 0) {
        testInfo.annotations.push({
          type: 'axe-info',
          description: informatives.map((v) => `${v.id} (${v.impact}) : ${v.nodes.length} nœud(s)`).join(' | '),
        });
      }

      expect(
        bloquantes,
        bloquantes.map((v) => `${v.id} (${v.impact}) : ${v.help}\n${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n\n'),
      ).toEqual([]);
    });
  }

  test("fiche offre TEST — aucune violation critique ou sérieuse", async ({ page }) => {
    await page.goto('/offres');
    const premiereFicheTest = page.locator('[data-offre-card]').filter({ hasText: 'TEST —' }).first();
    await premiereFicheTest.getByRole('link', { name: "Voir l'offre" }).click();
    await expect(page).toHaveURL(/\/offres\//);

    const resultats = await new AxeBuilder({ page }).analyze();
    const bloquantes = resultats.violations.filter((violation) => NIVEAUX_BLOQUANTS.has(violation.impact ?? ''));
    expect(bloquantes, bloquantes.map((v) => `${v.id} (${v.impact}) : ${v.help}`).join('\n')).toEqual([]);
  });

  test('fiche offre non-TEST (fixture E2E) — aucune violation critique ou sérieuse', async ({ page }) => {
    await page.goto('/offres');
    await page
      .locator('[data-offre-card]', { hasText: 'Assistant logistique' })
      .getByRole('link', { name: "Voir l'offre" })
      .click();
    await expect(page.locator(`[data-offre-toggle="${FIXTURE_REFERENCE}"]`)).toBeVisible();

    const resultats = await new AxeBuilder({ page }).analyze();
    const bloquantes = resultats.violations.filter((violation) => NIVEAUX_BLOQUANTS.has(violation.impact ?? ''));
    expect(bloquantes, bloquantes.map((v) => `${v.id} (${v.impact}) : ${v.help}`).join('\n')).toEqual([]);
  });
});
