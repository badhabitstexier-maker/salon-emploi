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

test('les deux workflows de déploiement substituent bien les deux placeholders avant le transfert FTP', async () => {
  for (const workflow of ['.github/workflows/deploy-preprod.yml', '.github/workflows/deploy-production.yml']) {
    const contenu = await lire(workflow);
    assert.match(contenu, /vars\.VISIBILITES_AUTH_USER_FILE/, `${workflow} doit lire la variable VISIBILITES_AUTH_USER_FILE`);
    assert.match(contenu, /vars\.VISIBILITES_DATA_DIR/, `${workflow} doit lire la variable VISIBILITES_DATA_DIR`);
    assert.match(contenu, new RegExp(AUTH_PLACEHOLDER), `${workflow} doit substituer ${AUTH_PLACEHOLDER}`);
    assert.match(contenu, new RegExp(DATA_DIR_PLACEHOLDER), `${workflow} doit substituer ${DATA_DIR_PLACEHOLDER}`);

    const indexInjection = contenu.indexOf(AUTH_PLACEHOLDER);
    const indexFtp = contenu.indexOf('FTP-Deploy-Action');
    assert.ok(indexInjection !== -1 && indexFtp !== -1 && indexInjection < indexFtp, `${workflow} doit injecter la configuration Visibilité AVANT le transfert FTP`);
  }
});
