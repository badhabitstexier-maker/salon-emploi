import { test, expect } from '@playwright/test';
import {
  FIXTURE_VIS_ACCUEIL_ALT,
  FIXTURE_VIS_ACCUEIL_ANNONCEUR,
  FIXTURE_VIS_OFFRES_ALT,
  FIXTURE_VIS_OFFRES_ANNONCEUR,
  FIXTURE_EXPOSANT_NOM,
  FIXTURE_EXPOSANT_SLUG,
} from '../scripts/e2e-fixtures.mjs';

/*
  Lot Admin-2 — Visibilité (voir docs/VISIBILITE.md). Fixtures créées par
  scripts/e2e-fixtures.mjs : une visibilité active par page (accueil,
  offres) — un seul candidat éligible par emplacement, donc un tirage
  pondéré déterministe (pas d'aléatoire à gérer côté test) — plus une
  désactivée, une programmée dans le futur et une expirée, toutes scoping
  sur `accueil`, qui ne doivent jamais s'afficher.
*/

test.describe('Visibilité — site public (Lot Admin-2)', () => {
  test("le bandeau actif s'affiche sur l'accueil, avec alt et sans espace vide résiduel", async ({ page }) => {
    await page.goto('/');
    const slot = page.locator('#visibilite-slot-accueil-principal');
    await expect(slot).toBeVisible();
    await expect(slot.locator('img')).toHaveAttribute('alt', FIXTURE_VIS_ACCUEIL_ALT);
    // Pas de <a> : la fixture accueil n'a pas de lien.
    await expect(slot.locator('a')).toHaveCount(0);
  });

  test('le bandeau offres est un lien cliquable vers la fiche exposant rattachée', async ({ page }) => {
    await page.goto('/offres');
    const slot = page.locator('#visibilite-slot-offres-principal');
    await expect(slot).toBeVisible();
    const lien = slot.locator('a');
    await expect(lien).toHaveAttribute('href', `/exposants/${FIXTURE_EXPOSANT_SLUG}`);
    await expect(lien.locator('img')).toHaveAttribute('alt', FIXTURE_VIS_OFFRES_ALT);
  });

  test('une visibilité désactivée, future ou expirée ne s\'affiche jamais', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('ne doit jamais apparaître', { exact: false })).toHaveCount(0);
  });

  test('filtrage par page : le bandeau offres ne fuite pas sur exposants/programme, aucun espace vide laissé', async ({ page }) => {
    for (const chemin of ['/exposants', '/programme']) {
      await page.goto(chemin);
      await expect(page.locator('[id^="visibilite-slot-"]')).toHaveCount(0);
      // Alt du bandeau uniquement — l'annonceur "Fixture E2E LabEvents" est
      // volontairement le même nom que l'exposant fixture, qui, lui, apparaît
      // légitimement sur /exposants (sa fiche) : vérifier le texte de
      // l'annonceur donnerait un faux positif.
      await expect(page.getByAltText(FIXTURE_VIS_ACCUEIL_ALT)).toHaveCount(0);
      await expect(page.getByAltText(FIXTURE_VIS_OFFRES_ALT)).toHaveCount(0);
    }
  });

  test('un seul tirage au chargement : le contenu du bandeau ne change plus ensuite (pas de carrousel)', async ({ page }) => {
    await page.goto('/');
    const slot = page.locator('#visibilite-slot-accueil-principal');
    await expect(slot).toBeVisible();
    const contenuInitial = await slot.innerHTML();

    await page.waitForTimeout(1500);

    const contenuApresAttente = await slot.innerHTML();
    expect(contenuApresAttente).toBe(contenuInitial);
  });
});

test.describe('Visibilité — Admin (Lot Admin-2)', () => {
  test('/admin/visibilite liste les campagnes avec le bon statut calculé et reste noindex', async ({ page }) => {
    const reponse = await page.goto('/admin/visibilite');
    expect(reponse?.status()).toBe(200);

    const meta = page.locator('meta[name="robots"]');
    await expect(meta).toHaveAttribute('content', /noindex/);
    await expect(meta).toHaveAttribute('content', /nofollow/);

    await expect(page.getByRole('heading', { name: 'Visibilité' })).toBeVisible();

    const ligneAccueil = page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_ACCUEIL_ANNONCEUR });
    await expect(ligneAccueil.getByText('Actif', { exact: true })).toBeVisible();

    const ligneOffres = page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_OFFRES_ANNONCEUR });
    await expect(ligneOffres.getByText('Actif', { exact: true })).toBeVisible();
    await expect(ligneOffres.getByRole('link', { name: /Voir la fiche exposant/ })).toHaveAttribute(
      'href',
      `/admin/exposants/${FIXTURE_EXPOSANT_SLUG}`,
    );

    const ligneInactive = page.locator('[data-visibilite-row]', { hasText: 'désactivée' });
    await expect(ligneInactive.getByText('Désactivé', { exact: true })).toBeVisible();

    const ligneFuture = page.locator('[data-visibilite-row]', { hasText: 'à venir' });
    await expect(ligneFuture.getByText('À venir', { exact: true })).toBeVisible();

    const ligneExpiree = page.locator('[data-visibilite-row]', { hasText: 'expirée' });
    await expect(ligneExpiree.getByText('Expiré', { exact: true })).toBeVisible();
  });

  test('le filtre statut masque les campagnes qui ne correspondent pas', async ({ page }) => {
    await page.goto('/admin/visibilite');
    await page.selectOption('#filtre-statut-admin', 'actif');

    const ligneInactive = page.locator('[data-visibilite-row]', { hasText: 'désactivée' });
    await expect(ligneInactive).toBeHidden();

    const ligneAccueil = page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_ACCUEIL_ANNONCEUR });
    await expect(ligneAccueil).toBeVisible();
  });

  test('le filtre page ne garde que les campagnes de cette page', async ({ page }) => {
    await page.goto('/admin/visibilite');
    await page.selectOption('#filtre-page-admin', 'offres');

    const ligneOffres = page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_OFFRES_ANNONCEUR });
    await expect(ligneOffres).toBeVisible();

    const ligneAccueil = page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_ACCUEIL_ANNONCEUR });
    await expect(ligneAccueil).toBeHidden();
  });

  test('le tableau de bord affiche un résumé et un lien vers /admin/visibilite', async ({ page }) => {
    await page.goto('/admin/dashboard');
    const carte = page.locator('p', { hasText: 'Visibilité — campagnes actives' }).locator('..');
    await expect(carte.locator('p').nth(1)).toHaveText('2');
    await expect(carte.getByRole('link', { name: 'Voir la visibilité' })).toHaveAttribute('href', '/admin/visibilite');
  });
});
