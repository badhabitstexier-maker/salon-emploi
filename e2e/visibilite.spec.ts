import { test, expect } from '@playwright/test';
import { mockApiPublique, mockApiPubliqueIndisponible, mockApiAdmin, type VisibiliteMock } from './visibilite-mock';

/*
  Lot Admin-2 / Admin-2B — Visibilité (voir docs/VISIBILITE.md). Depuis
  Admin-2B, il n'y a plus de fixture Markdown (voir scripts/e2e-fixtures.mjs) :
  chaque test simule l'API réelle (publique et Admin) via
  e2e/visibilite-mock.ts, `page.route()` interceptant les appels fetch() du
  navigateur. Le VRAI code PHP est testé séparément et fidèlement dans
  scripts/visibilites-api.test.mjs (serveur `php -S` réel).
*/

const VISUEL = '/brand/logo-salon-emploi-formation-mark-512.png';

function campagne(overrides: Partial<VisibiliteMock> = {}): VisibiliteMock {
  return {
    id: 'vis-fixture',
    nomInterne: 'Fixture',
    annonceur: 'Annonceur fixture',
    typeAnnonceur: 'sponsor',
    format: 'bandeau_horizontal',
    visuel: VISUEL,
    alt: 'Alt fixture',
    pages: ['accueil'],
    emplacement: 'principal',
    poids: 1,
    actif: true,
    ...overrides,
  };
}

test.describe('Visibilité — site public (Admin-2B, dynamique)', () => {
  test("le bandeau actif s'affiche sur l'accueil, avec alt et sans espace vide résiduel", async ({ page }) => {
    await mockApiPublique(page, [campagne({ id: 'accueil-1', annonceur: 'Sponsor accueil', alt: 'Bandeau accueil E2E', pages: ['accueil'] })]);
    await page.goto('/');
    const slot = page.locator('#visibilite-slot-accueil-principal');
    await expect(slot).toBeVisible();
    await expect(slot.locator('img')).toHaveAttribute('alt', 'Bandeau accueil E2E');
    await expect(slot.locator('a')).toHaveCount(0); // pas de lien dans cette fixture
  });

  test('un bandeau avec lien est cliquable', async ({ page }) => {
    await mockApiPublique(page, [
      campagne({ id: 'offres-1', annonceur: 'Exposant en avant', alt: 'Bandeau offres E2E', pages: ['offres'], lien: '/exposants/e2e-fixture-exposant' }),
    ]);
    await page.goto('/offres');
    const slot = page.locator('#visibilite-slot-offres-principal');
    await expect(slot).toBeVisible();
    const lien = slot.locator('a');
    await expect(lien).toHaveAttribute('href', '/exposants/e2e-fixture-exposant');
    await expect(lien.locator('img')).toHaveAttribute('alt', 'Bandeau offres E2E');
  });

  test('campagne historique (visuel unique, sans visuelMobile) : aucune <source>, le visuel desktop sert sur toutes les largeurs', async ({ page }) => {
    await mockApiPublique(page, [campagne({ id: 'historique-1', pages: ['accueil'] })]);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const slot = page.locator('#visibilite-slot-accueil-principal');
    await expect(slot).toBeVisible();
    await expect(slot.locator('picture source')).toHaveCount(0);
    await expect(slot.locator('img')).toHaveAttribute('src', VISUEL);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(slot.locator('img')).toHaveAttribute('src', VISUEL);
  });

  test('campagne desktop + mobile : le visuel mobile est utilisé sous 640px, le desktop à partir de 640px', async ({ page }) => {
    const VISUEL_MOBILE = '/brand/logo-salon-emploi-formation-mark-192.png';
    await mockApiPublique(page, [
      campagne({ id: 'responsive-1', pages: ['accueil'], visuel: VISUEL, visuelMobile: VISUEL_MOBILE }),
    ]);

    await page.goto('/');
    const slot = page.locator('#visibilite-slot-accueil-principal');
    await expect(slot).toBeVisible();

    // Repli natif <picture>/<source> : une seule structure DOM, le
    // navigateur choisit la source active selon la largeur (voir
    // docs/VISIBILITE.md §4/§5bis) — pas de logique JS de correspondance.
    const source = slot.locator('picture source');
    await expect(source).toHaveAttribute('media', '(min-width: 640px)');
    await expect(source).toHaveAttribute('srcset', VISUEL);
    await expect(slot.locator('img')).toHaveAttribute('src', VISUEL_MOBILE);

    await page.setViewportSize({ width: 375, height: 800 });
    await expect.poll(() => slot.locator('img').evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(VISUEL_MOBILE);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => slot.locator('img').evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(VISUEL);
  });

  test('une visibilité désactivée, future ou expirée ne s\'affiche jamais', async ({ page }) => {
    const maintenant = Date.now();
    await mockApiPublique(page, [
      campagne({ id: 'desactivee', annonceur: 'Ne doit jamais apparaître (désactivée)', actif: false, dateDebut: '2020-01-01', dateFin: '2099-01-01' }),
      campagne({ id: 'future', annonceur: 'Ne doit jamais apparaître (à venir)', dateDebut: new Date(maintenant + 3_600_000).toISOString() }),
      campagne({ id: 'expiree', annonceur: 'Ne doit jamais apparaître (expirée)', dateFin: new Date(maintenant - 3_600_000).toISOString() }),
    ]);
    await page.goto('/');
    // Envoyées par l'API (actif+page couverts pour "désactivee" ce n'est
    // même pas le cas puisqu'elle est actif:false — l'API publique ne
    // l'aurait pas incluse non plus, cohérent avec visibilitesEnvoyablesPhp),
    // mais le slot doit dans tous les cas rester masqué : aucun candidat
    // n'est dans sa fenêtre de dates au moment du chargement.
    await expect(page.locator('#visibilite-slot-accueil-principal')).toBeHidden();
    await expect(page.getByText('ne doit jamais apparaître', { exact: false })).toHaveCount(0);
  });

  test('filtrage par page : le bandeau offres ne fuite pas sur exposants, section masquée (pas d\'espace vide)', async ({ page }) => {
    await mockApiPublique(page, [campagne({ id: 'offres-1', annonceur: 'Offres uniquement', pages: ['offres'] })]);
    await page.goto('/exposants');
    // Le slot existe désormais toujours dans le DOM (rendu inconditionnel,
    // voir VisibilitySlot.astro) mais reste masqué : l'API, appelée avec
    // page=exposants, ne renvoie rien pour cette page.
    const slot = page.locator('#visibilite-slot-exposants-principal');
    await expect(slot).toBeHidden();
    await expect(page.getByText('Offres uniquement')).toHaveCount(0);
  });

  test('une campagne démarre puis expire sans nouveau build, réévaluée à chaque chargement (dates côté client)', async ({ page }) => {
    const debut = new Date('3000-01-01T00:00:00.000Z');
    const fin = new Date('3000-01-02T00:00:00.000Z');
    await mockApiPublique(page, [
      campagne({ id: 'programmee', annonceur: 'Programmée an 3000', alt: 'Bandeau programmé', pages: ['programme'], dateDebut: debut.toISOString(), dateFin: fin.toISOString() }),
    ]);
    const slot = page.locator('#visibilite-slot-programme-principal');

    await page.clock.install({ time: new Date(debut.getTime() - 60_000) });
    await page.goto('/programme');
    await expect(slot).toBeHidden();

    await page.clock.setFixedTime(new Date(debut.getTime() + 1_000));
    await page.reload();
    await expect(slot).toBeVisible();
    await expect(slot.locator('img')).toHaveAttribute('alt', 'Bandeau programmé');

    await page.clock.setFixedTime(new Date(fin.getTime() + 60_000));
    await page.reload();
    await expect(slot).toBeHidden();
  });

  test("accueil : le bandeau se trouve juste après le hero et avant « Le salon en chiffres »", async ({ page }) => {
    await mockApiPublique(page, [campagne({ id: 'accueil-1', pages: ['accueil'] })]);
    await page.goto('/');
    await expect(page.locator('#visibilite-slot-accueil-principal')).toBeVisible();
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
    await mockApiPublique(page, [campagne({ id: 'accueil-1', pages: ['accueil'] })]);
    await page.goto('/');
    const slot = page.locator('#visibilite-slot-accueil-principal');
    await expect(slot).toBeVisible();
    const contenuInitial = await slot.innerHTML();

    await page.waitForTimeout(1500);

    const contenuApresAttente = await slot.innerHTML();
    expect(contenuApresAttente).toBe(contenuInitial);
  });

  test('fallback réseau : API publique indisponible -> aucun bandeau, aucune erreur, le reste de la page fonctionne', async ({ page }) => {
    await mockApiPubliqueIndisponible(page);
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursConsole.push(erreur.message));

    await page.goto('/');
    await expect(page.locator('#visibilite-slot-accueil-principal')).toBeHidden();
    // Le reste de la page reste utilisable : navigation toujours cliquable.
    await expect(page.getByRole('navigation').first()).toBeVisible();
    expect(erreursConsole).toEqual([]);
  });
});

test.describe('Visibilité — Admin (Admin-2B, CRUD)', () => {
  test('/admin/visibilite charge la liste depuis l\'API, affiche le bon statut, reste noindex', async ({ page }) => {
    await mockApiAdmin(page, [
      campagne({ id: 'vis-1', annonceur: 'Annonceur actif', actif: true }),
      campagne({ id: 'vis-2', annonceur: 'Annonceur désactivé', actif: false }),
    ]);
    const reponse = await page.goto('/admin/visibilite');
    expect(reponse?.status()).toBe(200);

    const meta = page.locator('meta[name="robots"]');
    await expect(meta).toHaveAttribute('content', /noindex/);
    await expect(meta).toHaveAttribute('content', /nofollow/);

    await expect(page.getByRole('heading', { name: 'Visibilité' })).toBeVisible();

    const ligneActive = page.locator('[data-visibilite-row]', { hasText: 'Annonceur actif' });
    await expect(ligneActive.getByText('Actif', { exact: true })).toBeVisible();

    const ligneDesactivee = page.locator('[data-visibilite-row]', { hasText: 'Annonceur désactivé' });
    await expect(ligneDesactivee.getByText('Désactivé', { exact: true })).toBeVisible();
  });

  test('API Admin indisponible : message d\'erreur explicite avec bouton Réessayer', async ({ page }) => {
    await page.route('**/admin-api/visibilites.php*', (route) => route.abort('failed'));
    await page.goto('/admin/visibilite');
    await expect(page.getByText('Impossible de charger les campagnes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });

  test('le filtre statut masque les campagnes qui ne correspondent pas', async ({ page }) => {
    await mockApiAdmin(page, [
      campagne({ id: 'vis-1', annonceur: 'Actif un', actif: true }),
      campagne({ id: 'vis-2', annonceur: 'Désactivé un', actif: false }),
    ]);
    await page.goto('/admin/visibilite');
    await page.selectOption('#filtre-statut-admin', 'actif');
    await expect(page.locator('[data-visibilite-row]', { hasText: 'Actif un' })).toBeVisible();
    await expect(page.locator('[data-visibilite-row]', { hasText: 'Désactivé un' })).toBeHidden();
  });

  test('le filtre page ne garde que les campagnes de cette page', async ({ page }) => {
    await mockApiAdmin(page, [
      campagne({ id: 'vis-1', annonceur: 'Sur offres', pages: ['offres'] }),
      campagne({ id: 'vis-2', annonceur: 'Sur accueil', pages: ['accueil'] }),
    ]);
    await page.goto('/admin/visibilite');
    await page.selectOption('#filtre-page-admin', 'offres');
    await expect(page.locator('[data-visibilite-row]', { hasText: 'Sur offres' })).toBeVisible();
    await expect(page.locator('[data-visibilite-row]', { hasText: 'Sur accueil' })).toBeHidden();
  });

  test('activer/désactiver depuis la liste envoie bien le jeton CSRF et met à jour l\'affichage', async ({ page }) => {
    await mockApiAdmin(page, [campagne({ id: 'vis-1', annonceur: 'À basculer', actif: true })]);
    await page.goto('/admin/visibilite');
    const ligne = page.locator('[data-visibilite-row]', { hasText: 'À basculer' });
    await expect(ligne.getByText('Actif', { exact: true })).toBeVisible();

    await ligne.getByRole('button', { name: 'Désactiver' }).click();
    await expect(ligne.getByText('Désactivé', { exact: true })).toBeVisible();
  });

  test('supprimer demande confirmation avant d\'appeler l\'API', async ({ page }) => {
    await mockApiAdmin(page, [campagne({ id: 'vis-1', annonceur: 'À supprimer' })]);
    await page.goto('/admin/visibilite');

    page.once('dialog', (dialogue) => dialogue.dismiss());
    await page.getByRole('button', { name: 'Supprimer' }).click();
    // Refus de la confirmation : la ligne reste présente.
    await expect(page.locator('[data-visibilite-row]', { hasText: 'À supprimer' })).toBeVisible();

    page.once('dialog', (dialogue) => dialogue.accept());
    await page.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('[data-visibilite-row]', { hasText: 'À supprimer' })).toHaveCount(0);
  });

  test('création : le formulaire crée une campagne puis revient à la liste', async ({ page }) => {
    await mockApiAdmin(page, []);
    await page.goto('/admin/visibilite');
    await page.getByRole('link', { name: '+ Nouvelle visibilité' }).click();
    await expect(page).toHaveURL(/\/admin\/visibilite\/formulaire$/);

    await page.fill('#champ-nomInterne', 'Nouvelle campagne E2E');
    await page.fill('#champ-annonceur', 'Nouvel annonceur E2E');
    await page.fill('#champ-visuel', VISUEL);
    await page.fill('#champ-alt', 'Alt nouvelle campagne');
    await page.check('input[name="pages"][value="accueil"]');
    await page.fill('#champ-poids', '2');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/admin\/visibilite$/);
    await expect(page.locator('[data-visibilite-row]', { hasText: 'Nouvel annonceur E2E' })).toBeVisible();
  });

  test('création : le champ visuel mobile est optionnel et transmis à l\'API quand renseigné', async ({ page }) => {
    const VISUEL_MOBILE = '/brand/logo-salon-emploi-formation-mark-192.png';
    const etat = await mockApiAdmin(page, []);
    await page.goto('/admin/visibilite/formulaire');

    await expect(page.getByLabel('Visuel desktop *')).toBeVisible();
    await expect(page.getByLabel('Visuel mobile (optionnel)')).toBeVisible();

    await page.fill('#champ-nomInterne', 'Campagne responsive E2E');
    await page.fill('#champ-annonceur', 'Annonceur responsive E2E');
    await page.fill('#champ-visuel', VISUEL);
    await page.fill('#champ-visuelMobile', VISUEL_MOBILE);
    await page.fill('#champ-alt', 'Alt responsive');
    await page.check('input[name="pages"][value="accueil"]');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/admin\/visibilite$/);
    expect(etat.find((v) => v.annonceur === 'Annonceur responsive E2E')?.visuelMobile).toBe(VISUEL_MOBILE);
  });

  test('création : les erreurs renvoyées par le serveur s\'affichent sans navigation', async ({ page }) => {
    await mockApiAdmin(page, []);
    await page.goto('/admin/visibilite/formulaire');

    await page.fill('#champ-nomInterne', 'Interne');
    await page.fill('#champ-annonceur', 'DECLENCHER_ERREUR_422');
    await page.fill('#champ-visuel', VISUEL);
    await page.fill('#champ-alt', 'Alt');
    await page.check('input[name="pages"][value="accueil"]');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('annonceur est obligatoire.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/visibilite\/formulaire/);
  });

  test('modification : préremplit le formulaire depuis l\'API puis enregistre les changements', async ({ page }) => {
    await mockApiAdmin(page, [
      campagne({ id: 'vis-1', nomInterne: 'Interne existant', annonceur: 'Avant modification', visuel: VISUEL, alt: 'Alt existant', pages: ['accueil'], poids: 4 }),
    ]);
    await page.goto('/admin/visibilite/formulaire?id=vis-1');

    await expect(page.locator('#champ-annonceur')).toHaveValue('Avant modification');
    await expect(page.locator('#champ-poids')).toHaveValue('4');
    await expect(page.locator('#champ-visuelMobile')).toHaveValue(''); // campagne historique, pas de visuel mobile

    await page.fill('#champ-annonceur', 'Après modification');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page).toHaveURL(/\/admin\/visibilite$/);
    await expect(page.locator('[data-visibilite-row]', { hasText: 'Après modification' })).toBeVisible();
  });

  test('modification : une campagne avec visuel mobile existant le préremplit', async ({ page }) => {
    const VISUEL_MOBILE = '/brand/logo-salon-emploi-formation-mark-192.png';
    await mockApiAdmin(page, [
      campagne({ id: 'vis-2', annonceur: 'Avec mobile', visuel: VISUEL, visuelMobile: VISUEL_MOBILE, pages: ['accueil'] }),
    ]);
    await page.goto('/admin/visibilite/formulaire?id=vis-2');
    await expect(page.locator('#champ-visuelMobile')).toHaveValue(VISUEL_MOBILE);
  });

  test('le tableau de bord affiche un résumé issu de l\'API Admin', async ({ page }) => {
    await mockApiAdmin(page, [
      campagne({ id: 'vis-1', annonceur: 'Active un', actif: true }),
      campagne({ id: 'vis-2', annonceur: 'Active deux', actif: true }),
      campagne({ id: 'vis-3', annonceur: 'Désactivée', actif: false }),
    ]);
    await page.goto('/admin/dashboard');
    const carte = page.locator('p', { hasText: 'Visibilité — campagnes actives' }).locator('..');
    await expect(carte.locator('#dashboard-visibilites-actives')).toHaveText('2');
    await expect(carte.getByRole('link', { name: 'Voir la visibilité' })).toHaveAttribute('href', '/admin/visibilite');
  });
});
