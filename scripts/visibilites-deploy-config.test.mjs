/*
  Garde-fou pour la séparation préprod/production AU BUILD du module
  Visibilité (voir docs/VISIBILITE.md section 15.9). Vérifie que les
  fichiers commités ne portent que des placeholders — jamais un chemin OVH
  en dur — pour que deploy-preprod.yml et deploy-production.yml restent la
  seule source des chemins réels (AuthUserFile, dossier de données),
  chacun avec ses propres variables d'environnement GitHub.

  N'exécute aucun serveur (contrairement à scripts/visibilites-api.test.mjs) :
  lecture de fichiers uniquement.

  Usage : npm run visibilites:deploy-config-test
*/
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');

const AUTH_PLACEHOLDER = '__VISIBILITES_AUTH_USER_FILE__';
const DATA_DIR_PLACEHOLDER = '__VISIBILITES_DATA_DIR__';

// Chemin OVH en dur historiquement utilisé pour la préproduction (Admin-0 à
// Admin-2B) — ne doit plus jamais apparaître tel quel dans ces fichiers,
// pour ne pas réintroduire une valeur partagée par erreur entre préprod et
// production.
const CHEMIN_OVH_INTERDIT = /\/home\/salonez\//;

const FICHIERS_AUTH_USER_FILE = ['public/admin/.htaccess', 'public/admin-api/.htaccess'];
const FICHIER_DATA_DIR = 'public/api/_visibilites-lib.php';

async function lire(cheminRelatif) {
  return readFile(path.join(RACINE, cheminRelatif), 'utf8');
}

test('AuthUserFile : chaque .htaccess commité porte le placeholder, jamais un chemin en dur', async () => {
  for (const fichier of FICHIERS_AUTH_USER_FILE) {
    const contenu = await lire(fichier);
    assert.match(contenu, new RegExp(`AuthUserFile ${AUTH_PLACEHOLDER}`), `${fichier} doit contenir le placeholder ${AUTH_PLACEHOLDER}`);
    assert.doesNotMatch(contenu, CHEMIN_OVH_INTERDIT, `${fichier} ne doit plus contenir de chemin OVH en dur`);
  }
});

test('VISIBILITES_DATA_DIR_DEFAUT : la constante PHP porte le placeholder, jamais un chemin en dur', async () => {
  const contenu = await lire(FICHIER_DATA_DIR);
  assert.match(
    contenu,
    new RegExp(`VISIBILITES_DATA_DIR_DEFAUT = '${DATA_DIR_PLACEHOLDER}'`),
    `${FICHIER_DATA_DIR} doit contenir le placeholder ${DATA_DIR_PLACEHOLDER}`,
  );
  assert.doesNotMatch(contenu, CHEMIN_OVH_INTERDIT, `${FICHIER_DATA_DIR} ne doit plus contenir de chemin OVH en dur`);
});

test('les deux workflows lisent les variables GitHub via env:, jamais interpolées directement dans un script shell', async () => {
  for (const workflow of ['.github/workflows/deploy-preprod.yml', '.github/workflows/deploy-production.yml']) {
    const contenu = await lire(workflow);
    // Les valeurs doivent transiter par `env:` (le shell les lit ensuite via
    // $VISIBILITES_..., jamais collées telles quelles dans le texte du script) —
    // voir historique : une expression ${{ vars.* }} interpolée directement dans
    // un script `sed` cassait la commande si la valeur contenait un CR/LF.
    assert.match(
      contenu,
      /VISIBILITES_AUTH_USER_FILE:\s*\$\{\{\s*vars\.VISIBILITES_AUTH_USER_FILE\s*\}\}/,
      `${workflow} doit passer VISIBILITES_AUTH_USER_FILE via env:`,
    );
    assert.match(
      contenu,
      /VISIBILITES_DATA_DIR:\s*\$\{\{\s*vars\.VISIBILITES_DATA_DIR\s*\}\}/,
      `${workflow} doit passer VISIBILITES_DATA_DIR via env:`,
    );

    // Plus aucune trace de l'ancienne interpolation directe dans un script sed.
    assert.doesNotMatch(contenu, /sed -i/, `${workflow} ne doit plus utiliser sed pour cette injection`);

    assert.match(
      contenu,
      /node scripts\/inject-visibilite-config\.mjs/,
      `${workflow} doit appeler scripts/inject-visibilite-config.mjs`,
    );

    const indexInjection = contenu.indexOf('inject-visibilite-config.mjs');
    const indexFtp = contenu.indexOf('FTP-Deploy-Action');
    assert.ok(indexInjection !== -1 && indexFtp !== -1 && indexInjection < indexFtp, `${workflow} doit injecter la configuration Visibilité AVANT le transfert FTP`);
  }
});
