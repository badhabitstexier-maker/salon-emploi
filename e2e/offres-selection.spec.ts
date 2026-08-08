import { test, expect } from '@playwright/test';
import { FIXTURE_REFERENCE, FIXTURE_INTITULE } from '../scripts/e2e-fixtures.mjs';

/*
  Les 5 offres TEST du catalogue public masquent volontairement le bouton de
  sélection (voir CLAUDE.md, section 12). Ces tests utilisent la fixture E2E
  jetable (scripts/e2e-fixtures.mjs, créée avant le build et supprimée après
  par e2e/global-teardown.ts) — la seule offre « réelle » du jeu de données de
  test — pour exercer le mécanisme d'ajout / retrait / limite de sélection,
  sans jamais toucher au contenu public commité.
*/

test.describe('Sélection d’offres (fixture E2E)', () => {
  test('ajout et retrait de la fixture depuis le catalogue', async ({ page }) => {
    await page.goto('/offres');
    const bouton = page.locator(`[data-offre-toggle="${FIXTURE_REFERENCE}"]`);

    await expect(bouton).toHaveAttribute('aria-pressed', 'false');
    await bouton.click();

    await expect(bouton).toHaveAttribute('aria-pressed', 'true');
    await expect(bouton).toHaveText('Retirer de ma sélection');
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('1/5');
    await expect(page).toHaveURL(new RegExp(`offre1=${FIXTURE_REFERENCE}`));

    await bouton.click();

    await expect(bouton).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('0/5');
    await expect(page).not.toHaveURL(new RegExp(`offre1=${FIXTURE_REFERENCE}`));
  });

  test('la sélection portée par l’URL est restituée sur /ma-selection', async ({ page }) => {
    await page.goto(`/ma-selection?offre1=${FIXTURE_REFERENCE}`);

    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('1/5');
    const ligne = page.locator('[data-ligne-selection]').filter({ hasText: FIXTURE_INTITULE });
    await expect(ligne).toBeVisible();
    await expect(ligne.getByText(FIXTURE_REFERENCE)).toBeVisible();

    const lienCandidater = page.getByRole('link', { name: 'Candidater à ma sélection' });
    await expect(lienCandidater).toHaveAttribute('href', new RegExp(`/candidater\\?.*offre1=${FIXTURE_REFERENCE}`));
  });

  test('retrait de la fixture depuis /ma-selection', async ({ page }) => {
    await page.goto(`/ma-selection?offre1=${FIXTURE_REFERENCE}`);
    const ligne = page.locator('[data-ligne-selection]').filter({ hasText: FIXTURE_INTITULE });
    await expect(ligne).toBeVisible();

    await ligne.getByRole('button', { name: /Retirer/ }).click();

    await expect(ligne).toHaveCount(0);
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('0/5');
    await expect(page).not.toHaveURL(/offre1=/);
  });

  test('la limite de cinq offres empêche un sixième ajout', async ({ page }) => {
    // 5 références connues (les offres TEST publiées) préchargées via l'URL —
    // seul le mécanisme de sélection est exercé ici, aucune n'a de bouton
    // togglable puisqu'il s'agit d'offres TEST (voir CLAUDE.md section 12).
    const referencesTest = ['SEF26-001', 'SEF26-002', 'SEF26-003', 'SEF26-004', 'SEF26-005'];
    const params = referencesTest.map((ref, index) => `offre${index + 1}=${ref}`).join('&');

    await page.goto(`/offres?${params}`);
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('5/5');

    // Clavier plutôt que clic pointeur : à 5/5, le tiroir de sélection fixe
    // (SelectionDrawer) peut recouvrir visuellement le bouton selon le
    // viewport (mobile) — le focus clavier reste fiable indépendamment de
    // la superposition visuelle.
    const boutonFixture = page.locator(`[data-offre-toggle="${FIXTURE_REFERENCE}"]`);
    await boutonFixture.focus();
    await boutonFixture.press('Enter');

    await expect(boutonFixture).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('5/5');
    await expect(page.locator('#annonce-selection')).toHaveText(
      /jusqu.{1,2}à cinq offres/,
    );
  });

  test('mobile — ajout à la sélection au toucher', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Contrôle réservé au projet mobile');
    await page.goto('/offres');
    const bouton = page.locator(`[data-offre-toggle="${FIXTURE_REFERENCE}"]`);

    await bouton.tap();

    await expect(bouton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('1/5');
  });
});
