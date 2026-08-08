import { test, expect } from '@playwright/test';

/*
  Lot 4B-3 : contrôle des balises SEO essentielles produites par
  src/components/Seo.astro sur les pages publiques principales. On teste
  l'existence et la cohérence, pas le texte exact (fragile et hors
  périmètre — voir consigne du lot).
*/

const PAGES_PUBLIQUES = ['/', '/le-salon', '/preparer-ma-visite', '/exposer', '/exposants', '/programme', '/offres'];

test.describe('SEO — balises essentielles', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} — title, meta description et canonical présents, pas de noindex`, async ({ page, baseURL }) => {
      await page.goto(chemin);

      await expect(page).toHaveTitle(/.+/);

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveCount(1);
      const contenuDescription = await description.getAttribute('content');
      expect(contenuDescription?.trim().length ?? 0).toBeGreaterThan(0);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const hrefCanonical = await canonical.getAttribute('href');
      expect(hrefCanonical).toBeTruthy();
      const normaliser = (pathname: string) => (pathname === '/' ? pathname : pathname.replace(/\/$/, ''));
      const urlAttendue = new URL(chemin, baseURL ?? undefined);
      const urlCanonique = new URL(hrefCanonical as string);
      expect(normaliser(urlCanonique.pathname)).toBe(normaliser(urlAttendue.pathname));

      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }
});
