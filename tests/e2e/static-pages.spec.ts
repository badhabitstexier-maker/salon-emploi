import { test, expect } from '@playwright/test';
import { collecterErreursConsole, erreursApplicatives, verifierAucunDebordementHorizontal } from './support/helpers';

test.describe('Le salon', () => {
  test('route accessible, titre principal, informations événement, navigation, responsive', async ({ page }) => {
    const { erreurs } = collecterErreursConsole(page);
    const response = await page.goto('/le-salon');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator('h1')).toContainText('avenir professionnel');
    await expect(page.locator('main').getByText('30 et 31 octobre 2026').first()).toBeVisible();
    await expect(page.locator('main').getByText("Salle d'exposition de Nouville").first()).toBeVisible();
    await expect(page.locator('main').getByRole('heading', { name: 'Hall Emploi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hall Formation' })).toBeVisible();

    await verifierAucunDebordementHorizontal(page);
    expect(erreursApplicatives(erreurs), erreurs.join('\n')).toEqual([]);
  });

  test('/village redirige proprement (Village Maintenance & Industrie suspendu)', async ({ page }) => {
    const response = await page.goto('/village');
    expect(response?.status()).toBeLessThan(400);
    // Redirection actée (astro.config.mjs) : /village -> /le-salon. Ni logo ni
    // mention de partenariat AMD ne doit apparaître (CLAUDE.md, section 2).
    await expect(page).toHaveURL(/\/le-salon\/?$/);
    await expect(page.getByText(/village maintenance/i)).toHaveCount(0);
  });
});

test.describe('Préparer ma visite', () => {
  test('page accessible, infos pratiques, horaires, lieu, entrée gratuite, CTA utiles', async ({ page }) => {
    const { erreurs } = collecterErreursConsole(page);
    const response = await page.goto('/preparer-ma-visite');
    expect(response?.status()).toBeLessThan(400);

    const main = page.locator('main');
    await expect(page.locator('h1')).toContainText('visite');
    await expect(main.getByText('Vendredi 30 et samedi 31 octobre 2026').first()).toBeVisible();
    await expect(main.getByText('De 9 h à 17 h les deux jours')).toBeVisible();
    await expect(main.getByText("Salle d'exposition de Nouville — Nouméa").first()).toBeVisible();
    await expect(main.getByText('Libre et gratuite').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /consulter le programme/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /voir les exposants/i }).first()).toBeVisible();

    await verifierAucunDebordementHorizontal(page);
    expect(erreursApplicatives(erreurs), erreurs.join('\n')).toEqual([]);
  });
});

test.describe('Exposer', () => {
  test('page accessible, formulaire présent, ancres principales, aucun texte obsolète', async ({ page }) => {
    const { erreurs } = collecterErreursConsole(page);
    const response = await page.goto('/exposer');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator('h1')).toContainText('Exposez');
    await expect(page.locator('#demande-exposant form[data-web3forms]')).toBeAttached();
    await expect(page.locator('#contact-visiteur form[data-web3forms]')).toBeAttached();

    // Aucune mention du Village Maintenance & Industrie (suspendu, CLAUDE.md section 2).
    await expect(page.getByText(/village maintenance/i)).toHaveCount(0);

    await verifierAucunDebordementHorizontal(page);
    expect(erreursApplicatives(erreurs), erreurs.join('\n')).toEqual([]);
  });

  test('ancres #demande-exposant et #contact-visiteur résolvent vers des sections existantes', async ({ page }) => {
    await page.goto('/exposer#demande-exposant');
    await expect(page.locator('#demande-exposant')).toBeVisible();
    await page.goto('/exposer#contact-visiteur');
    await expect(page.locator('#contact-visiteur')).toBeVisible();
  });

  test('ne soumet jamais réellement le formulaire externe Web3Forms', async ({ page }) => {
    let requeteWeb3Forms = false;
    await page.route('https://api.web3forms.com/**', (route) => {
      requeteWeb3Forms = true;
      route.abort();
    });
    await page.goto('/exposer');
    // On vérifie uniquement la présence du formulaire, sans jamais cliquer sur "Envoyer" :
    // ce test garantit qu'aucune requête sortante n'est déclenchée par le simple chargement de la page.
    await expect(page.locator('#demande-exposant form[data-web3forms]')).toBeAttached();
    expect(requeteWeb3Forms).toBe(false);
  });
});

test.describe('Mentions légales et confidentialité', () => {
  test('mentions légales : page accessible, navigation footer, aucune erreur', async ({ page }) => {
    const { erreurs } = collecterErreursConsole(page);
    const response = await page.goto('/mentions-legales');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('h1')).toContainText('Mentions légales');
    expect(erreursApplicatives(erreurs), erreurs.join('\n')).toEqual([]);
  });

  test('confidentialité : page accessible et mentionne la conservation des données candidats jusqu’au 31 décembre 2026', async ({
    page,
  }) => {
    const response = await page.goto('/confidentialite');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('h1')).toContainText('confidentialité');
    await expect(page.getByText('31 décembre 2026')).toBeVisible();
  });
});
