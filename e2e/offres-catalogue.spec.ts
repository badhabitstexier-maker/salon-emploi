import { test, expect } from '@playwright/test';
import { offreCards, offreCardsVisibles, offreCardsData } from './helpers/offres';

test.describe('Catalogue /offres — chargement', () => {
  test('la page se charge avec un titre et les offres du catalogue', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(offreCards(page).first()).toBeVisible();
  });

  /*
    État actuel du dépôt (voir CLAUDE.md section 15 et docs/OFFRES.md
    section 4bis) : 18 offres TEST existent, mais 7 sont volontairement
    masquées du catalogue (`afficherCatalogue: false` — une offre de
    démonstration secondaire par exposant démo, accessible uniquement par
    URL directe ou depuis sa fiche exposant). Le catalogue public /offres
    n'affiche donc que 11 offres TEST : les 5 historiques
    (`SEF26-001`-`SEF26-005`) et 1 offre représentative par exposant démo.
    0 offre réelle à ce jour.
  */
  const REFERENCES_CATALOGUE_ATTENDUES = [
    'SEF26-001',
    'SEF26-002',
    'SEF26-003',
    'SEF26-004',
    'SEF26-005',
    'SEF26-006',
    'SEF26-009',
    'SEF26-011',
    'SEF26-013',
    'SEF26-015',
    'SEF26-017',
  ];
  const REFERENCES_HORS_CATALOGUE = ['SEF26-007', 'SEF26-008', 'SEF26-010', 'SEF26-012', 'SEF26-014', 'SEF26-016', 'SEF26-018'];

  test('les 11 offres TEST visibles dans le catalogue sont présentes, les 7 masquées en sont absentes', async ({ page }) => {
    await page.goto('/offres');
    const cartes = await offreCardsData(page);
    const references = cartes.map((carte) => carte.reference);

    expect(cartes.filter((carte) => carte.estTest)).toHaveLength(REFERENCES_CATALOGUE_ATTENDUES.length);
    for (const reference of REFERENCES_CATALOGUE_ATTENDUES) {
      expect(references).toContain(reference);
    }
    for (const reference of REFERENCES_HORS_CATALOGUE) {
      expect(references).not.toContain(reference);
    }
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
