import { test, expect } from '@playwright/test';
import { TALLY_BASE_URL, FIXTURES_BASE_URL } from './support/constants';

test.describe('Ma sélection — mécanique de sélection', () => {
  test('ajouter, ajouter une deuxième offre, retirer, et l’URL se met à jour sans stockage local @smoke', async ({ page }) => {
    await page.goto('/offres');

    const carteStandard = page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Standard' });
    const carteGold = page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Gold' });

    await carteStandard.getByRole('button', { name: /ajouter à ma sélection/i }).click();
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('1/5');
    await expect(page).toHaveURL(/[?&]offre1=SEF26-901/);

    await carteGold.getByRole('button', { name: /ajouter à ma sélection/i }).click();
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('2/5');
    await expect(page).toHaveURL(/offre2=SEF26-902/);

    // Le tiroir de sélection liste bien les deux offres.
    const tiroir = page.locator('#tiroir-selection');
    await expect(tiroir).toBeVisible();
    await expect(tiroir.getByText('Poste Test E2E Standard')).toBeVisible();
    await expect(tiroir.getByText('Poste Test E2E Gold')).toBeVisible();

    // Retrait via le bouton "Retirer de ma sélection" sur la carte.
    await carteStandard.getByRole('button', { name: /retirer de ma sélection/i }).click();
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('1/5');
    await expect(page).not.toHaveURL(/offre1=SEF26-901/);

    // Aucun stockage local ni de session à aucun moment de la mécanique.
    const stockage = await page.evaluate(() => ({
      localStorage: window.localStorage.length,
      sessionStorage: window.sessionStorage.length,
    }));
    expect(stockage.localStorage).toBe(0);
    expect(stockage.sessionStorage).toBe(0);
  });

  test('la sélection est restaurée depuis les paramètres d’URL au chargement', async ({ page }) => {
    await page.goto('/offres?offre1=SEF26-901&offre2=SEF26-902');
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('2/5');
    await expect(
      page.locator('[data-offre-card]', { hasText: 'Poste Test E2E Standard' }).getByRole('button', { name: /retirer de ma sélection/i }),
    ).toBeVisible();
  });

  test('une référence inconnue dans l’URL est silencieusement ignorée (jamais de crash)', async ({ page }) => {
    const response = await page.goto('/offres?offre1=REF-INCONNUE-E2E');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('[data-compteur-selection]').first()).toHaveText('0/5');
  });
});

test.describe('Ma sélection — page dédiée', () => {
  test('affiche la sélection en cours et propose le CTA « Candidater »', async ({ page }) => {
    await page.goto('/ma-selection?offre1=SEF26-901');
    await expect(page.locator('[data-selection-presente]').first()).toBeVisible();
    await expect(page.getByText('Poste Test E2E Standard')).toBeVisible();
    await expect(page.getByRole('link', { name: /candidater à ma sélection/i }).first()).toHaveAttribute(
      'href',
      /\/candidater\?offre1=SEF26-901/,
    );
  });

  test('sans sélection, affiche un état vide propre', async ({ page }) => {
    await page.goto('/ma-selection');
    await expect(page.locator('[data-selection-vide]').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /aucune offre pour l'instant/i })).toBeVisible();
  });
});

test.describe('Candidater', () => {
  test('page chargée, sélection reprise depuis l’URL, aucune erreur', async ({ page }) => {
    const response = await page.goto('/candidater?offre1=SEF26-901');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('h1')).toContainText('Candidater');
    await expect(page.locator('[data-compteur-nombre]').first()).toHaveText('1');
  });

  test('avec orientation=1, la case « orientation LabEvents » est précochée', async ({ page }) => {
    await page.goto('/candidater?orientation=1');
    await expect(page.locator('#case-orientation')).toBeChecked();
  });

  test('cocher la case orientation met à jour le paramètre orientation dans l’URL', async ({ page }) => {
    await page.goto('/candidater');
    await page.locator('#case-orientation').check();
    await expect(page).toHaveURL(/[?&]orientation=1/);
  });
});

test.describe('Candidater — fallback Tally (variable non configurée)', () => {
  test('affiche un état d’attente propre, sans iframe ni erreur JS', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'Un seul passage suffit (comportement indépendant du viewport)');

    const erreursConsole: string[] = [];
    page.on('pageerror', (error) => erreursConsole.push(error.message));

    await page.goto(FIXTURES_BASE_URL + '/candidater');
    await expect(page.getByText(/formulaire de candidature sera prochainement disponible/i)).toBeVisible();
    await expect(page.locator('#tally-candidature-iframe')).toHaveCount(0);
    expect(erreursConsole).toEqual([]);
  });
});

test.describe('Candidater — iframe Tally (variable configurée, réseau intercepté)', () => {
  test.beforeEach(async ({ page }) => {
    // Interception systématique du domaine tally.so : la recette ne doit
    // jamais dépendre du réseau réel de tally.so, et ne soumet jamais de
    // candidature réelle (mission Lot 4B, section 7 et 17).
    await page.route('https://tally.so/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<html><body>Tally mock</body></html>' }),
    );
  });

  test('l’iframe est générée avec dynamicHeight=1, la sélection et les métadonnées attendues', async ({ page }) => {
    await page.goto(TALLY_BASE_URL + '/candidater?offre1=SEF26-901');

    const iframe = page.locator('#tally-candidature-iframe');
    await expect(iframe).toHaveAttribute('src', /^https:\/\/tally\.so\/embed\/e2eTestFormId/);

    const src = await iframe.getAttribute('src');
    const url = new URL(src ?? '');
    expect(url.searchParams.get('dynamicHeight')).toBe('1');
    expect(url.searchParams.get('offre_1_ref')).toBe('SEF26-901');
    expect(url.searchParams.get('offre_1_titre')).toBe('Poste Test E2E Standard');
    expect(url.searchParams.get('offre_1_exposant')).toBe('Entreprise Test E2E');
    expect(url.searchParams.get('source')).toBe('salon-emploi.nc');
    expect(url.searchParams.get('edition')).toBe('2026');
    expect(url.searchParams.get('orientation_labevents')).toBe('false');
  });

  test('avec orientation=1, les paramètres orientation_labevents requis sont présents dans l’URL iframe', async ({ page }) => {
    await page.goto(TALLY_BASE_URL + '/candidater?orientation=1');

    const iframe = page.locator('#tally-candidature-iframe');
    await expect(iframe).toHaveAttribute('src', /orientation_labevents=true/);

    const src = await iframe.getAttribute('src');
    const url = new URL(src ?? '');
    expect(url.searchParams.get('orientation_labevents')).toBe('true');
    expect(url.searchParams.get('orientation_labevents_label')?.length).toBeGreaterThan(0);
  });
});
