import { test, expect } from '@playwright/test';
import {
  FIXTURE_REFERENCE,
  FIXTURE_INTITULE,
  FIXTURE_EXPOSANT_NOM,
  FIXTURE_EXPOSANT_SLUG,
  FIXTURE_ANOMALIE_EXPOSANT_REFERENCE,
  FIXTURE_ANOMALIE_EXPOSANT_ID,
  FIXTURE_ANOMALIE_FORMULE_REFERENCE,
} from '../scripts/e2e-fixtures.mjs';

/*
  Lot Admin-1 (voir CLAUDE.md section 14, docs/ADMIN.md) : tableau de bord,
  liste/fiche exposants, liste/fiche offres. Toujours en lecture seule — pas
  de test de la protection .htaccess ici (voir e2e/admin-acces.spec.ts et
  docs/ADMIN.md, procédure de test manuelle sur OVH).
*/

test.describe('Admin — tableau de bord (Lot Admin-1)', () => {
  test('affiche des indicateurs et les blocs d\'accès rapide', async ({ page }) => {
    const reponse = await page.goto('/admin/dashboard');
    expect(reponse?.status()).toBe(200);

    const meta = page.locator('meta[name="robots"]');
    await expect(meta).toHaveAttribute('content', /noindex/);

    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voir les exposants' })).toHaveAttribute('href', '/admin/exposants');
    await expect(page.getByRole('link', { name: 'Voir les offres' })).toHaveAttribute('href', '/admin/offres');
  });

  /*
    En environnement E2E, la collection contient les 18 offres TEST commitées
    (SEF26-001 à 018 — voir CLAUDE.md section 15 et docs/OFFRES.md section
    4bis) et 3 offres réelles fixture (la fixture principale + 2 fixtures
    d'anomalie, voir scripts/e2e-fixtures.mjs, Lot Admin-1C) : « Offres
    réelles » doit donc valoir 3, et l'indicateur secondaire doit signaler
    les 18 offres TEST sans les compter dans les KPI principaux.

    Le dashboard (src/pages/admin/dashboard.astro) calcule `offresTest` via
    `estOffreTest()` sur l'intégralité de la collection `offres` — il ne
    tient pas compte des champs `demo`/`afficherCatalogue` (qui ne pilotent
    que le SEO et le catalogue public /offres, voir docs/OFFRES.md section
    4bis). Le compte attendu ici est donc bien 18 (les 11 offres TEST
    visibles dans /offres + les 7 masquées du catalogue), pas 11.
  */
  test('exclut les offres TEST des KPI et les signale séparément', async ({ page }) => {
    await page.goto('/admin/dashboard');

    const carteTotal = page.locator('p', { hasText: 'Offres réelles — total' }).locator('..');
    await expect(carteTotal.locator('p').nth(1)).toHaveText('3');

    const cartePubliees = page.locator('p', { hasText: 'Offres réelles — publiées' }).locator('..');
    await expect(cartePubliees.locator('p').nth(1)).toHaveText('3');

    await expect(page.getByText('18 offres TEST')).toBeVisible();

    const blocExposants = page.locator('h2', { hasText: 'Offres par exposant' }).locator('..');
    await expect(blocExposants.getByText(FIXTURE_EXPOSANT_NOM)).toBeVisible();
    await expect(blocExposants.getByText('Entreprise Test NC')).toHaveCount(0);
  });
});

test.describe('Admin — exposants (Lot Admin-1)', () => {
  test('la table liste l\'exposant fixture, la recherche filtre, le lien mène à la fiche', async ({ page }) => {
    await page.goto('/admin/exposants');

    const ligneFixture = page.locator('[data-exposant-row]', { hasText: FIXTURE_EXPOSANT_NOM });
    await expect(ligneFixture).toBeVisible();

    await page.getByLabel('Rechercher un nom').fill('introuvable-xyz');
    await expect(ligneFixture).toBeHidden();
    await expect(page.getByText('Aucun exposant ne correspond')).toBeVisible();

    await page.getByLabel('Rechercher un nom').fill('Fixture E2E');
    await expect(ligneFixture).toBeVisible();

    await ligneFixture.getByRole('link', { name: FIXTURE_EXPOSANT_NOM }).click();
    await expect(page).toHaveURL(`/admin/exposants/${FIXTURE_EXPOSANT_SLUG}`);
    await expect(page.getByRole('heading', { name: FIXTURE_EXPOSANT_NOM })).toBeVisible();
  });

  test('la fiche exposant affiche l\'offre rattachée', async ({ page }) => {
    await page.goto(`/admin/exposants/${FIXTURE_EXPOSANT_SLUG}`);
    const blocOffres = page.locator('h2', { hasText: 'Offres rattachées' });
    await expect(blocOffres).toBeVisible();
    await expect(page.getByRole('link', { name: FIXTURE_INTITULE })).toBeVisible();
  });
});

test.describe('Admin — offres (Lot Admin-1)', () => {
  test('la table liste l\'offre fixture, les filtres fonctionnent, le lien mène à la fiche', async ({ page }) => {
    await page.goto('/admin/offres');

    const ligneFixture = page.locator('[data-offre-row]', { hasText: FIXTURE_REFERENCE });
    await expect(ligneFixture).toBeVisible();

    await page.getByLabel('Rechercher').fill(FIXTURE_REFERENCE);
    await expect(ligneFixture).toBeVisible();
    await expect(page.locator('[data-offre-row]:visible')).toHaveCount(1);

    await page.getByLabel('Rechercher').fill('');
    await page.getByLabel('Entreprise').selectOption(FIXTURE_EXPOSANT_NOM);
    await expect(ligneFixture).toBeVisible();

    await ligneFixture.getByRole('link', { name: FIXTURE_REFERENCE }).click();
    await expect(page).toHaveURL(`/admin/offres/${FIXTURE_REFERENCE}`);
    await expect(page.getByRole('heading', { name: FIXTURE_INTITULE })).toBeVisible();
  });

  test('la fiche offre publiée propose un lien vers la page publique', async ({ page }) => {
    await page.goto(`/admin/offres/${FIXTURE_REFERENCE}`);
    const lienPublic = page.getByRole('link', { name: 'Voir la fiche publique' });
    await expect(lienPublic).toBeVisible();
    await expect(lienPublic).toHaveAttribute('href', /\/offres\//);
  });

  /*
    Réutilise le mécanisme de détection existant (préfixe `TEST —` sur
    `intitule`, voir src/lib/offres.ts::estOffreTest) — SEF26-001 est une
    des 18 offres TEST du dépôt (voir docs/OFFRES.md section 4bis).
  */
  const REFERENCE_OFFRE_TEST = 'SEF26-001';

  test('une offre TEST reste consultable, porte un badge et le filtre « Nature » fonctionne', async ({ page }) => {
    await page.goto('/admin/offres');

    const ligneTest = page.locator('[data-offre-row]', { hasText: REFERENCE_OFFRE_TEST });
    const ligneReelle = page.locator('[data-offre-row]', { hasText: FIXTURE_REFERENCE });

    await expect(ligneTest).toBeVisible();
    await expect(ligneTest.getByText('TEST', { exact: true })).toBeVisible();

    await page.getByLabel('Nature').selectOption('reelle');
    await expect(ligneReelle).toBeVisible();
    await expect(ligneTest).toBeHidden();

    await page.getByLabel('Nature').selectOption('test');
    await expect(ligneTest).toBeVisible();
    await expect(ligneReelle).toBeHidden();

    await page.getByLabel('Nature').selectOption('');
    await expect(ligneTest).toBeVisible();
    await expect(ligneReelle).toBeVisible();

    // Reste consultable en fiche détail, avec le même badge.
    await page.goto(`/admin/offres/${REFERENCE_OFFRE_TEST}`);
    await expect(page.getByText('TEST — exclue des indicateurs du tableau de bord')).toBeVisible();
  });

  /*
    Lot Admin-1C (voir src/lib/admin.ts, docs/EXPOSANTS_IMPORT.md) : une
    offre réelle dont l'exposantId ne correspond à aucun exposant de la
    collection porte un badge « Exposant introuvable », à la fois en liste
    et en fiche détail.
  */
  test('une offre avec un exposantId inconnu porte un badge « Exposant introuvable »', async ({ page }) => {
    await page.goto('/admin/offres');
    const ligne = page.locator('[data-offre-row]', { hasText: FIXTURE_ANOMALIE_EXPOSANT_REFERENCE });
    await expect(ligne.getByText('Exposant introuvable')).toBeVisible();

    await page.goto(`/admin/offres/${FIXTURE_ANOMALIE_EXPOSANT_REFERENCE}`);
    await expect(page.getByText(`Anomalie — exposant « ${FIXTURE_ANOMALIE_EXPOSANT_ID} » introuvable`)).toBeVisible();
  });

  /*
    Une offre réelle dont la `formule` diverge de celle de l'exposant
    rattaché (duplication contrôlée, voir Option B retenue dans docs/OFFRES.md
    section 5) porte un badge « Formule incohérente ».
  */
  test('une offre avec une formule incohérente avec son exposant porte un badge « Formule incohérente »', async ({
    page,
  }) => {
    await page.goto('/admin/offres');
    const ligne = page.locator('[data-offre-row]', { hasText: FIXTURE_ANOMALIE_FORMULE_REFERENCE });
    await expect(ligne.getByText('Formule incohérente')).toBeVisible();

    await page.goto(`/admin/offres/${FIXTURE_ANOMALIE_FORMULE_REFERENCE}`);
    await expect(page.getByText('Anomalie — formule incohérente avec l\'exposant rattaché')).toBeVisible();
  });

  test('l\'offre fixture principale, cohérente, ne porte aucun badge d\'anomalie', async ({ page }) => {
    await page.goto(`/admin/offres/${FIXTURE_REFERENCE}`);
    await expect(page.getByText('Exposant introuvable')).toHaveCount(0);
    await expect(page.getByText('Formule incohérente')).toHaveCount(0);
  });
});

test.describe('Admin — navigation interne (Lot Admin-1)', () => {
  test('la navigation admin relie les 3 sections et le site public', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('navigation', { name: 'Navigation admin' }).getByRole('link', { name: 'Exposants' }).click();
    await expect(page).toHaveURL('/admin/exposants');
    await page.getByRole('navigation', { name: 'Navigation admin' }).getByRole('link', { name: 'Offres' }).click();
    await expect(page).toHaveURL('/admin/offres');
    await expect(page.getByRole('link', { name: 'Voir le site public' })).toHaveAttribute('href', '/');
  });
});
