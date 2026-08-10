import { test, expect } from '@playwright/test';
import { FIXTURE_SLUG } from '../scripts/e2e-fixtures.mjs';

/*
  Lot 4B-3 : contrôle fonctionnel du sitemap (@astrojs/sitemap) et de
  robots.txt (astro-robots-txt), sans dépendre d'un nom de fichier ou d'un
  décompte de pages qu'Astro pourrait légitimement faire évoluer (sitemap
  unique vs. sitemap index + enfants — voir astro.config.mjs).
*/

const ROUTES_PUBLIQUES_ATTENDUES = ['/', '/le-salon', '/preparer-ma-visite', '/exposer', '/exposants', '/programme', '/offres'];

async function recupererToutesLesUrlsDuSitemap(request: import('@playwright/test').APIRequestContext, baseURL: string) {
  const reponseIndex = await request.get(`${baseURL}/sitemap-index.xml`);
  expect(reponseIndex.ok()).toBeTruthy();
  const indexXml = await reponseIndex.text();

  // Sitemap index (fichiers enfants) OU sitemap unique directement : on
  // s'adapte au format réellement produit plutôt que d'en imposer un.
  const sitemapsEnfants = [...indexXml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const urlsSitemaps = sitemapsEnfants.length > 0 ? sitemapsEnfants : [`${baseURL}/sitemap-index.xml`];

  const toutesLesUrls: string[] = [];
  for (const urlSitemap of urlsSitemaps) {
    const reponse = await request.get(urlSitemap);
    expect(reponse.ok()).toBeTruthy();
    const xml = await reponse.text();
    const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    toutesLesUrls.push(...urls);
  }
  return toutesLesUrls;
}

test.describe('Sitemap', () => {
  test('le sitemap est généré, contient les routes publiques et exclut les fiches TEST', async ({
    request,
    baseURL,
  }) => {
    const urls = await recupererToutesLesUrlsDuSitemap(request, baseURL as string);
    expect(urls.length).toBeGreaterThan(0);

    const chemins = urls.map((url) => new URL(url).pathname.replace(/\/$/, '') || '/');

    for (const route of ROUTES_PUBLIQUES_ATTENDUES) {
      const cheminAttendu = route === '/' ? '/' : route;
      expect(chemins, `route publique attendue dans le sitemap : ${route}`).toContain(cheminAttendu);
    }

    // Les 18 offres TEST du dépôt (SEF26-001 à SEF26-018 — voir CLAUDE.md
    // section 15 et docs/OFFRES.md section 4bis) ne doivent jamais
    // apparaître dans le sitemap, qu'elles soient visibles ou non dans le
    // catalogue public /offres (`demo: true` pilote le SEO indépendamment
    // de `afficherCatalogue` — voir astro.config.mjs, filter).
    const referencesTestExclues = Array.from({ length: 18 }, (_, i) => `sef26-${String(i + 1).padStart(3, '0')}`);
    for (const slug of referencesTestExclues) {
      expect(chemins.some((chemin) => chemin.includes(`/offres/${slug}`)), `${slug} ne doit pas figurer dans le sitemap`).toBe(
        false,
      );
    }

    // La fixture E2E non-TEST (Lot 4B-2) est une offre publiée normale :
    // elle doit apparaître dans le sitemap comme n'importe quelle offre
    // publique, ce qui confirme que le filtre ne cible bien que les TEST.
    expect(chemins.some((chemin) => chemin.includes(`/offres/${FIXTURE_SLUG}`))).toBe(true);

    // Admin (Lot Admin-0, voir docs/ADMIN.md) : jamais indexé, la balise
    // noindex sur la page ne suffit pas, il doit aussi être absent du
    // sitemap (astro.config.mjs, filtre sitemap()).
    expect(chemins.some((chemin) => chemin.includes('/admin')), '/admin ne doit pas figurer dans le sitemap').toBe(
      false,
    );
  });
});

test.describe('robots.txt', () => {
  test('robots.txt est accessible, autorise l’indexation et référence le sitemap', async ({ request, baseURL }) => {
    const reponse = await request.get(`${baseURL}/robots.txt`);
    expect(reponse.ok()).toBeTruthy();
    const contenu = await reponse.text();

    expect(contenu).toMatch(/User-agent:\s*\*/i);
    // Ne doit pas interdire globalement l'indexation (cas réservé à
    // PUBLIC_NOINDEX=true en préproduction — pas la config de ce run QA).
    expect(contenu).not.toMatch(/Disallow:\s*\/\s*$/im);

    const correspondanceSitemap = /Sitemap:\s*(\S+)/i.exec(contenu);
    expect(correspondanceSitemap).not.toBeNull();
    expect(correspondanceSitemap?.[1]).toContain(baseURL as string);

    // Admin (Lot Admin-0) : disallow explicite indépendant de PUBLIC_NOINDEX
    // (astro.config.mjs). Rappel : cette directive n'est qu'une convention
    // pour les robots respectueux, pas une protection — la vraie barrière
    // est l'authentification .htaccess côté OVH (voir docs/ADMIN.md).
    expect(contenu).toMatch(/Disallow:\s*\/admin\/?\s*$/im);
  });
});
