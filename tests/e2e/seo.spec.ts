import { test, expect } from '@playwright/test';

/*
  Audit SEO technique de base (mission Lot 4B, section 29-31) sur les pages
  publiques principales : title, meta description, canonical, Open Graph,
  lang=fr, favicon. Ne fait pas de refonte SEO — corrige uniquement les
  anomalies réelles détectées.
*/

const PAGES_PRINCIPALES = ['/', '/le-salon', '/exposants', '/offres', '/programme', '/preparer-ma-visite', '/exposer'];

test.describe('SEO technique — pages principales', () => {
  for (const chemin of PAGES_PRINCIPALES) {
    test(`${chemin} : title, meta description, canonical, OG, lang, favicon`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'Contrôle indépendant du viewport — un seul passage suffit');

      await page.goto(chemin);

      await expect(page).toHaveTitle(/.+ \| Salon de l'Emploi & de la Formation 2026/);

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', /.{20,}/);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const hrefCanonical = await canonical.getAttribute('href');
      expect(hrefCanonical).toBeTruthy();
      // La canonical ne doit jamais pointer vers la préproduction depuis un build de test/production.
      expect(hrefCanonical).not.toContain('preprod.salonemploinc.com');

      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('fr');

      await expect(page.locator('link[rel="icon"]').first()).toHaveCount(1);
    });
  }

  test('aucune balise noindex sur le build de test (équivalent production, PUBLIC_NOINDEX absente)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});

test.describe('Sitemap et robots.txt', () => {
  test('robots.txt autorise l’indexation et référence le sitemap (build sans PUBLIC_NOINDEX)', async ({ request }) => {
    test.skip(test.info().project.name !== 'desktop', 'Contrôle indépendant du viewport — un seul passage suffit');
    const reponse = await request.get('/robots.txt');
    expect(reponse.status()).toBe(200);
    const corps = await reponse.text();
    expect(corps).toContain('Allow: /');
    expect(corps).toContain('Sitemap:');
  });

  test('le sitemap liste les routes principales publiques', async ({ request }) => {
    test.skip(test.info().project.name !== 'desktop', 'Contrôle indépendant du viewport — un seul passage suffit');
    const index = await request.get('/sitemap-index.xml');
    expect(index.status()).toBe(200);

    const sitemap = await request.get('/sitemap-0.xml');
    expect(sitemap.status()).toBe(200);
    const corps = await sitemap.text();
    for (const route of ['/exposants/', '/offres/', '/programme/', '/le-salon/', '/exposer/', '/preparer-ma-visite/']) {
      expect(corps, `route manquante dans le sitemap : ${route}`).toContain(route);
    }
  });
});
