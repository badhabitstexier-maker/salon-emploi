import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_SLUG } from '../scripts/e2e-fixtures.mjs';

/*
  Lot 4B-4 : contrôle automatisé des liens internes. Découvre les routes
  statiques directement depuis `src/pages/` (pas de liste figée à
  maintenir à la main) et y ajoute les deux routes dynamiques nécessaires
  pour couvrir une fiche offre TEST et une fiche offre non-TEST (fixture
  E2E — voir scripts/e2e-fixtures.mjs). Chaque page visitée inclut Header
  et Footer (BaseLayout), donc leurs liens sont couverts par la même passe.

  Un lien est « interne » s'il commence par `/` (jamais `http://`/`https://`,
  jamais testé ici). `mailto:`, `tel:` et les ancres pures (`#...`) sont
  ignorés. Les paramètres de requête et fragments sont retirés avant de
  résoudre la route à vérifier.
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, '..', 'src', 'pages');

function discoverStaticRoutes(dir: string, base = ''): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...discoverStaticRoutes(path.join(dir, entry.name), `${base}/${entry.name}`));
      continue;
    }
    if (!entry.name.endsWith('.astro') || entry.name.includes('[')) continue;
    const nom = entry.name.replace(/\.astro$/, '');
    routes.push(nom === 'index' ? base || '/' : `${base}/${nom}`);
  }
  return routes;
}

const OFFRE_TEST_SLUG = 'sef26-001';

const ROUTES_A_VISITER = [...discoverStaticRoutes(pagesDir), `/offres/${OFFRE_TEST_SLUG}`, `/offres/${FIXTURE_SLUG}`];

function estLienInterneAVerifier(href: string | null): href is string {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false; // tout schéma explicite (http:, https:, etc.) = externe
  return href.startsWith('/');
}

function cheminSansParametresNiAncre(href: string): string {
  const sansAncre = href.split('#')[0];
  const chemin = sansAncre.split('?')[0];
  return chemin || '/';
}

test.describe('Liens internes — contrôle automatisé', () => {
  test('aucun lien interne cassé sur les pages publiques principales', async ({ page, request }) => {
    const statutParChemin = new Map<string, number>();
    const liensCasses: string[] = [];

    for (const route of ROUTES_A_VISITER) {
      await page.goto(route);

      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((liens) => liens.map((lien) => lien.getAttribute('href')));

      for (const href of hrefs) {
        if (!estLienInterneAVerifier(href)) continue;
        const chemin = cheminSansParametresNiAncre(href);

        if (!statutParChemin.has(chemin)) {
          const reponse = await request.get(chemin);
          statutParChemin.set(chemin, reponse.status());
        }

        const statut = statutParChemin.get(chemin)!;
        if (statut >= 400) {
          liensCasses.push(`${route} → ${href} (statut ${statut})`);
        }
      }
    }

    expect(liensCasses, liensCasses.join('\n')).toEqual([]);
  });
});
