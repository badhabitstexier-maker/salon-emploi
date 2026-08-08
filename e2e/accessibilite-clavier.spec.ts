import { test, expect } from '@playwright/test';

/*
  Lot 4B-3 : contrôles clavier explicites, en complément du scan axe-core
  (accessibilite.spec.ts). Axe ne vérifie pas l'activation clavier réelle
  d'un élément interactif — ces tests le font directement.
*/

test.describe('Navigation clavier — header', () => {
  test('les liens principaux du header sont accessibles et activables au clavier', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Header desktop uniquement — le menu mobile est couvert par le test burger ci-dessous');

    await page.goto('/');
    const lienOffres = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', {
      name: 'Offres',
      exact: true,
    });

    await lienOffres.focus();
    await expect(lienOffres).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/offres\/?$/);
  });

  test('le menu burger mobile est utilisable au clavier', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Contrôle réservé au projet mobile');

    await page.goto('/');
    const toggle = page.locator('#menu-toggle');
    const menu = page.locator('#mobile-menu');

    await toggle.focus();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();

    const lienOffresMobile = menu.getByRole('link', { name: 'Offres', exact: true });
    await lienOffresMobile.focus();
    await expect(lienOffresMobile).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/offres\/?$/);
  });
});

test.describe('Formulaire /exposer — clavier et labels', () => {
  test('les champs principaux sont atteignables au clavier via leur label associé, sans requête externe', async ({
    page,
  }) => {
    const requetesExternes: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes('api.web3forms.com')) requetesExternes.push(requete.url());
    });

    await page.goto('/exposer');

    // getByLabel n'aboutit que si le <label for="..."> cible bien l'id du
    // champ — ce test échoue donc si l'association label/champ se casse.
    const raisonSociale = page.getByLabel('Raison sociale / organisme *');
    const nomContact = page.getByLabel('Nom et prénom du contact *');
    const emailExposant = page.getByLabel('Adresse email *').first();

    await raisonSociale.focus();
    await expect(raisonSociale).toBeFocused();
    await page.keyboard.type('Entreprise QA Test');

    await nomContact.focus();
    await expect(nomContact).toBeFocused();
    await page.keyboard.type('Jean Test');

    await emailExposant.focus();
    await expect(emailExposant).toBeFocused();
    await page.keyboard.type('jean.test@example.com');

    await expect(raisonSociale).toHaveValue('Entreprise QA Test');
    await expect(nomContact).toHaveValue('Jean Test');
    await expect(emailExposant).toHaveValue('jean.test@example.com');

    // Aucune soumission déclenchée : on ne clique jamais le bouton d'envoi
    // ni ne provoque de submit — le test vérifie l'accessibilité du
    // formulaire, pas l'intégration Web3Forms.
    expect(requetesExternes).toEqual([]);
  });
});
