import { test, expect } from '@playwright/test';
import {
  FIXTURE_REFERENCE,
  FIXTURE_INTITULE,
  FIXTURE_EXPOSANT_NOM,
  FIXTURE_EXPOSANT_SLUG,
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
