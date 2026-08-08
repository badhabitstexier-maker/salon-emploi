/*
  Global setup Playwright — Lot 4B (recette automatisée).

  Le site est un build statique Astro : pour tester à la fois les collections
  vides et le parcours complet avec du contenu, on produit trois builds
  distincts avant de lancer le moindre test (voir docs/RECETTE_AUTOMATISEE.md) :

    - EMPTY    : build du dépôt tel quel (collections exposants/programme/offres
                 vides) — sert les tests « collection vide » (section 40 de la mission).
    - FIXTURES : build avec les fixtures de tests/fixtures/ injectées dans
                 src/content/*, retirées immédiatement après le build — jamais
                 committées, jamais présentes plus longtemps que le temps du build.
    - TALLY    : identique à FIXTURES, avec en plus une URL Tally fictive pour
                 tester la construction de l'iframe de candidature sans jamais
                 dépendre du réseau réel de tally.so (interception systématique
                 du domaine dans les specs concernées).

  Sécurité : le setup refuse de démarrer si src/content/{exposants,programme,offres}
  contiennent déjà de vraies fiches, pour ne jamais risquer de mélanger des
  fixtures avec du contenu réellement publié.
*/
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './support/static-server';
import { EMPTY_PORT, FIXTURES_PORT, TALLY_PORT, FAKE_TALLY_URL } from './support/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CONTENT_COLLECTIONS = ['exposants', 'programme', 'offres'] as const;
const FIXTURES_DIR = path.join(ROOT, 'tests/fixtures');
const DIST_ROOT = path.join(ROOT, '.e2e-dist');
const DIST_EMPTY = path.join(DIST_ROOT, 'empty');
const DIST_FIXTURES = path.join(DIST_ROOT, 'fixtures');
const DIST_TALLY = path.join(DIST_ROOT, 'tally');

function contentDir(name: string): string {
  return path.join(ROOT, 'src/content', name);
}

function assertPublicContentIsEmpty(): void {
  for (const name of CONTENT_COLLECTIONS) {
    const dir = contentDir(name);
    const fichesReelles = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
    if (fichesReelles.length > 0) {
      throw new Error(
        `[e2e] src/content/${name}/ contient déjà des fiches réelles (${fichesReelles.join(', ')}). ` +
          'La recette E2E refuse de démarrer pour ne jamais risquer de mélanger des fixtures avec du ' +
          'contenu publié. Videz ce dossier avant de relancer npm run test:e2e (voir docs/RECETTE_AUTOMATISEE.md).',
      );
    }
  }
}

function copierFixtures(): void {
  for (const name of CONTENT_COLLECTIONS) {
    const src = path.join(FIXTURES_DIR, name);
    if (!existsSync(src)) continue;
    for (const fichier of readdirSync(src)) {
      cpSync(path.join(src, fichier), path.join(contentDir(name), fichier));
    }
  }
}

function retirerFixtures(): void {
  for (const name of CONTENT_COLLECTIONS) {
    const src = path.join(FIXTURES_DIR, name);
    if (!existsSync(src)) continue;
    for (const fichier of readdirSync(src)) {
      const cible = path.join(contentDir(name), fichier);
      if (existsSync(cible)) rmSync(cible);
    }
  }
}

function build(outDir: string, extraEnv: Record<string, string> = {}): void {
  // `--force` : vide le cache du content layer avant chaque build. Sans ce
  // flag, Astro conserve les entrées de collections déjà synchronisées
  // (node_modules/.astro/data-store.json) même après suppression des
  // fichiers sources — ce qui ferait fuiter les fixtures d'un build vers le
  // suivant (notamment vers le build « collections vides »).
  execFileSync('npx', ['astro', 'build', '--outDir', outDir, '--force'], {
    cwd: ROOT,
    stdio: process.env.CI ? 'inherit' : 'ignore',
    env: {
      ...process.env,
      PUBLIC_SITE_URL: 'http://localhost:4321',
      PUBLIC_WEB3FORMS_ACCESS_KEY: 'e2e-test-key',
      ...extraEnv,
    },
  });
}

export default async function globalSetup() {
  assertPublicContentIsEmpty();

  rmSync(DIST_ROOT, { recursive: true, force: true });
  mkdirSync(DIST_EMPTY, { recursive: true });
  mkdirSync(DIST_FIXTURES, { recursive: true });
  mkdirSync(DIST_TALLY, { recursive: true });

  // 1) Build « collections vides » — état actuel du dépôt, sans aucune fixture.
  build(DIST_EMPTY);

  // 2) Build « avec fixtures » puis build « avec fixtures + Tally fictif ».
  //    Les fixtures sont retirées des collections publiques immédiatement après
  //    les deux builds, y compris en cas d'échec (finally) — jamais laissées
  //    en place plus longtemps que nécessaire (mission Lot 4B, section 6 et 53).
  copierFixtures();
  try {
    build(DIST_FIXTURES);
    build(DIST_TALLY, { PUBLIC_TALLY_CANDIDATURE_URL: FAKE_TALLY_URL });
  } finally {
    retirerFixtures();
  }

  const emptyServer = startStaticServer(DIST_EMPTY, EMPTY_PORT);
  const fixturesServer = startStaticServer(DIST_FIXTURES, FIXTURES_PORT);
  const tallyServer = startStaticServer(DIST_TALLY, TALLY_PORT);
  await Promise.all([emptyServer.ready, fixturesServer.ready, tallyServer.ready]);

  return async () => {
    await Promise.all([emptyServer.close(), fixturesServer.close(), tallyServer.close()]);
    rmSync(DIST_ROOT, { recursive: true, force: true });
  };
}
