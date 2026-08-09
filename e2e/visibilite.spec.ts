import { test, expect } from '@playwright/test';
import {
  FIXTURE_VIS_ACCUEIL_ALT,
  FIXTURE_VIS_ACCUEIL_ANNONCEUR,
  FIXTURE_VIS_OFFRES_ALT,
  FIXTURE_VIS_OFFRES_ANNONCEUR,
  FIXTURE_VIS_PROGRAMMEE_ALT,
  FIXTURE_VIS_PROGRAMMEE_ANNONCEUR,
  FIXTURE_VIS_PROGRAMMEE_DATE_DEBUT,
  FIXTURE_VIS_PROGRAMMEE_DATE_FIN,
  FIXTURE_EXPOSANT_NOM,
  FIXTURE_EXPOSANT_SLUG,
} from '../scripts/e2e-fixtures.mjs';

/*
  Lot Admin-2 — Visibilité (voir docs/VISIBILITE.md). Fixtures créées par
  scripts/e2e-fixtures.mjs : une visibilité active par page (accueil,
  offres) — un seul candidat éligible par emplacement, donc un tirage
  pondéré déterministe (pas d'aléatoire à gérer côté test) — plus une
  désactivée, une programmée dans le futur et une expirée (toutes scoping
  sur `accueil`, jamais affichées sous l'horloge réelle) et une « programmée »
  ciblant `programme` avec une fenêtre de dates dans l'an 3000, utilisée
  pour prouver la réévaluation côté client sans rebuild (voir tests dédiés
  plus bas, avec `page.clock`).
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

  test('filtrage par page : le bandeau offres ne fuite pas sur exposants, aucun espace vide laissé', async ({ page }) => {
    // /exposants ne porte aucune fixture de visibilité : aucune section
    // n'est même envoyée par le build (voir visibilitesEnvoyables).
    await page.goto('/exposants');
    await expect(page.locator('[id^="visibilite-slot-"]')).toHaveCount(0);
    // Alt du bandeau uniquement — l'annonceur "Fixture E2E LabEvents" est
    // volontairement le même nom que l'exposant fixture, qui, lui, apparaît
    // légitimement sur /exposants (sa fiche) : vérifier le texte de
    // l'annonceur donnerait un faux positif.
    await expect(page.getByAltText(FIXTURE_VIS_ACCUEIL_ALT)).toHaveCount(0);
    await expect(page.getByAltText(FIXTURE_VIS_OFFRES_ALT)).toHaveCount(0);
  });

  test('filtrage par page : /programme ne reçoit jamais le bandeau accueil/offres, et sa propre campagne programmée reste masquée sous l\'horloge réelle', async ({ page }) => {
    await page.goto('/programme');
    await expect(page.getByAltText(FIXTURE_VIS_ACCUEIL_ALT)).toHaveCount(0);
    await expect(page.getByAltText(FIXTURE_VIS_OFFRES_ALT)).toHaveCount(0);

    // La section peut exister dans le DOM (la campagne est bien "envoyable"
    // — active et scopée sur `programme`) mais reste hors de sa fenêtre de
    // dates (an 3000) sous l'horloge réelle du test : elle doit rester
    // entièrement masquée, sans occuper d'espace visible.
    const slot = page.locator('#visibilite-slot-programme-principal');
    await expect(slot).toBeHidden();
  });

  test('une campagne démarre puis expire sans nouveau build, réévaluée à chaque chargement de page', async ({ page }) => {
    const debut = new Date(FIXTURE_VIS_PROGRAMMEE_DATE_DEBUT);
    const fin = new Date(FIXTURE_VIS_PROGRAMMEE_DATE_FIN);
    const slot = page.locator('#visibilite-slot-programme-principal');

    // Avant dateDebut : masquée.
    await page.clock.install({ time: new Date(debut.getTime() - 60_000) });
    await page.goto('/programme');
    await expect(slot).toBeHidden();

    // dateDebut atteinte, sans rebuild (même serveur, simple rechargement
    // après avoir avancé l'horloge du navigateur) : visible.
    await page.clock.setFixedTime(new Date(debut.getTime() + 1_000));
    await page.reload();
    await expect(slot).toBeVisible();
    await expect(slot.locator('img')).toHaveAttribute('alt', FIXTURE_VIS_PROGRAMMEE_ALT);

    // dateFin dépassée, toujours sans rebuild : masquée à nouveau.
    await page.clock.setFixedTime(new Date(fin.getTime() + 60_000));
    await page.reload();
    await expect(slot).toBeHidden();
  });

  test("accueil : le bandeau se trouve juste après le hero et avant « Le salon en chiffres »", async ({ page }) => {
    await page.goto('/');
    const ordre = await page.evaluate(() => {
      const enfants = Array.from(document.querySelector('main')?.children ?? []);
      const heroIndex = enfants.findIndex((el) => el.querySelector('h1'));
      const slotIndex = enfants.findIndex((el) => el.id?.startsWith('visibilite-slot-accueil-'));
      const chiffresIndex = enfants.findIndex((el) => el.querySelector('#chiffres-titre'));
      return { heroIndex, slotIndex, chiffresIndex };
    });

    expect(ordre.heroIndex).toBeGreaterThanOrEqual(0);
    expect(ordre.chiffresIndex).toBeGreaterThan(ordre.heroIndex);
    expect(ordre.slotIndex).toBe(ordre.heroIndex + 1);
    expect(ordre.slotIndex).toBeLessThan(ordre.chiffresIndex);
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

  test('le payload JSON envoyé au navigateur ne contient aucune donnée interne (nomInterne, typeAnnonceur, exposantId)', async ({ page }) => {
    await page.goto('/');
    const payload = await page.locator('script[data-visibility-json]').first().textContent();
    const candidats = JSON.parse(payload ?? '[]');
    expect(candidats.length).toBeGreaterThan(0);
    for (const candidat of candidats) {
      expect(Object.keys(candidat).sort()).toEqual(
        ['alt', 'annonceur', 'dateDebut', 'dateFin', 'id', 'lien', 'poids', 'visuel'].filter(
          (cle) => cle in candidat,
        ).sort(),
      );
      expect(candidat).not.toHaveProperty('nomInterne');
      expect(candidat).not.toHaveProperty('typeAnnonceur');
      expect(candidat).not.toHaveProperty('exposantId');
    }
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

    // Textes complets des fixtures (voir scripts/e2e-fixtures.mjs), pas de
    // simple sous-chaîne : depuis l'ajout de la fixture « programmée »
    // (également « À venir »), un filtre trop court sur 'à venir' matche
    // aussi bien la ligne visée que le badge de statut d'une autre ligne.
    const ligneInactive = page.locator('[data-visibilite-row]', { hasText: 'ne doit jamais apparaître (désactivée)' });
    await expect(ligneInactive.getByText('Désactivé', { exact: true })).toBeVisible();

    const ligneFuture = page.locator('[data-visibilite-row]', { hasText: 'ne doit jamais apparaître (à venir)' });
    await expect(ligneFuture.getByText('À venir', { exact: true })).toBeVisible();

    const ligneExpiree = page.locator('[data-visibilite-row]', { hasText: 'ne doit jamais apparaître (expirée)' });
    await expect(ligneExpiree.getByText('Expiré', { exact: true })).toBeVisible();
  });

  test('une campagne désactivée reste « Désactivé » même avec des dates qui seraient autrement « Actif »', async ({ page }) => {
    // La fixture inactive porte volontairement dateDebut/dateFin couvrant
    // l'horloge réelle du test (voir scripts/e2e-fixtures.mjs) : si le
    // statut affiché était « Actif », ce serait la preuve que `actif`
    // n'est pas prioritaire sur les dates.
    await page.goto('/admin/visibilite');
    const ligneInactive = page.locator('[data-visibilite-row]', { hasText: 'ne doit jamais apparaître (désactivée)' });
    await expect(ligneInactive.getByText('Désactivé', { exact: true })).toBeVisible();
    await expect(ligneInactive.getByText('Actif', { exact: true })).toHaveCount(0);
  });

  test('le statut affiché est recalculé côté navigateur, sans rebuild, au fil des dates', async ({ page }) => {
    const debut = new Date(FIXTURE_VIS_PROGRAMMEE_DATE_DEBUT);
    const fin = new Date(FIXTURE_VIS_PROGRAMMEE_DATE_FIN);
    const ligne = () => page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_PROGRAMMEE_ANNONCEUR });

    // Avant dateDebut : À venir.
    await page.clock.install({ time: new Date(debut.getTime() - 60_000) });
    await page.goto('/admin/visibilite');
    await expect(ligne().getByText('À venir', { exact: true })).toBeVisible();
    await expect(ligne()).toHaveAttribute('data-statut', 'a-venir');

    // dateDebut atteinte, sans rebuild (même serveur, simple rechargement
    // après avoir avancé l'horloge du navigateur) : Actif.
    await page.clock.setFixedTime(new Date(debut.getTime() + 1_000));
    await page.reload();
    await expect(ligne().getByText('Actif', { exact: true })).toBeVisible();
    await expect(ligne()).toHaveAttribute('data-statut', 'actif');

    // dateFin dépassée, toujours sans rebuild : Expiré.
    await page.clock.setFixedTime(new Date(fin.getTime() + 60_000));
    await page.reload();
    await expect(ligne().getByText('Expiré', { exact: true })).toBeVisible();
    await expect(ligne()).toHaveAttribute('data-statut', 'expire');
  });

  test('le filtre Statut reste cohérent avec le statut recalculé (pas celui du build)', async ({ page }) => {
    const debut = new Date(FIXTURE_VIS_PROGRAMMEE_DATE_DEBUT);
    const ligne = () => page.locator('[data-visibilite-row]', { hasText: FIXTURE_VIS_PROGRAMMEE_ANNONCEUR });

    // Une fois la campagne « programmée » entrée dans sa fenêtre (sans
    // rebuild), le filtre "Actif" doit la retenir — alors que le HTML
    // généré au build la marquait "À venir".
    await page.clock.install({ time: new Date(debut.getTime() + 1_000) });
    await page.goto('/admin/visibilite');
    await expect(ligne().getByText('Actif', { exact: true })).toBeVisible();

    await page.selectOption('#filtre-statut-admin', 'actif');
    await expect(ligne()).toBeVisible();

    await page.selectOption('#filtre-statut-admin', 'a-venir');
    await expect(ligne()).toBeHidden();
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
