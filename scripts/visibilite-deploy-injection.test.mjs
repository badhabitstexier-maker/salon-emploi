/*
  Tests de l'injection de configuration Visibilité au déploiement (voir
  scripts/lib/visibilite-deploy-injection.mjs). Couvre le durcissement
  contre les CR/LF parasites qui cassaient auparavant l'ancienne
  implémentation à base de `sed` (voir historique de ce fichier / PR de
  correction) : valeur normale, LF final, CRLF final, valeur vide,
  placeholder résiduel.

  Usage : npm run visibilites:deploy-injection-test
*/
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  PLACEHOLDER_AUTH_USER_FILE,
  PLACEHOLDER_DATA_DIR,
  nettoyerValeur,
  validerValeur,
  substituerPlaceholder,
  trouverPlaceholdersResiduels,
  injecterConfigurationVisibilite,
} from './lib/visibilite-deploy-injection.mjs';

// ---------------------------------------------------------------------------
// Fonctions pures : nettoyage et validation des valeurs
// ---------------------------------------------------------------------------

test('nettoyerValeur : valeur normale inchangée', () => {
  assert.equal(nettoyerValeur('/home/salonez/salon-emploi-data-preprod'), '/home/salonez/salon-emploi-data-preprod');
});

test('nettoyerValeur : LF final supprimé', () => {
  assert.equal(nettoyerValeur('/home/salonez/salon-emploi-data-preprod\n'), '/home/salonez/salon-emploi-data-preprod');
});

test('nettoyerValeur : CRLF final supprimé', () => {
  assert.equal(nettoyerValeur('/home/salonez/salon-emploi-data-preprod\r\n'), '/home/salonez/salon-emploi-data-preprod');
});

test('nettoyerValeur : CR seul (sans LF) supprimé', () => {
  assert.equal(nettoyerValeur('/home/salonez/salon-emploi-data-preprod\r'), '/home/salonez/salon-emploi-data-preprod');
});

test('nettoyerValeur : valeur absente (undefined/null) -> chaîne vide', () => {
  assert.equal(nettoyerValeur(undefined), '');
  assert.equal(nettoyerValeur(null), '');
});

test('validerValeur : valeur normale acceptée telle quelle', () => {
  assert.equal(validerValeur('VISIBILITES_DATA_DIR', '/home/salonez/salon-emploi-data-preprod'), '/home/salonez/salon-emploi-data-preprod');
});

test('validerValeur : LF/CRLF finaux nettoyés puis acceptés', () => {
  assert.equal(validerValeur('VISIBILITES_DATA_DIR', '/chemin\n'), '/chemin');
  assert.equal(validerValeur('VISIBILITES_DATA_DIR', '/chemin\r\n'), '/chemin');
});

test('validerValeur : chaîne vide -> rejetée', () => {
  assert.throws(() => validerValeur('VISIBILITES_DATA_DIR', ''), /absente ou vide/);
});

test('validerValeur : uniquement des espaces/retours à la ligne -> rejetée (vide après nettoyage)', () => {
  assert.throws(() => validerValeur('VISIBILITES_DATA_DIR', '   \n'), /absente ou vide/);
});

test('validerValeur : valeur absente -> rejetée', () => {
  assert.throws(() => validerValeur('VISIBILITES_DATA_DIR', undefined), /absente ou vide/);
});

test("validerValeur : le message d'erreur ne contient jamais la valeur elle-même", () => {
  try {
    validerValeur('VISIBILITES_DATA_DIR', '');
    assert.fail('devait lever une erreur');
  } catch (erreur) {
    assert.doesNotMatch(erreur.message, /home|salonez/);
  }
});

// ---------------------------------------------------------------------------
// Substitution littérale et détection de résidu
// ---------------------------------------------------------------------------

test('substituerPlaceholder : remplacement littéral, aucune interprétation regex', () => {
  const contenu = `AuthUserFile ${PLACEHOLDER_AUTH_USER_FILE}`;
  // Une valeur contenant des caractères spéciaux pour une regex ($1, \1, etc.)
  // ne doit jamais être interprétée : substitution littérale uniquement.
  const valeur = '/home/salonez/$1-\\1-bizarre';
  assert.equal(substituerPlaceholder(contenu, PLACEHOLDER_AUTH_USER_FILE, valeur), `AuthUserFile ${valeur}`);
});

test('trouverPlaceholdersResiduels : détecte les deux placeholders indépendamment', () => {
  assert.deepEqual(trouverPlaceholdersResiduels('rien ici'), []);
  assert.deepEqual(trouverPlaceholdersResiduels(`x ${PLACEHOLDER_AUTH_USER_FILE} y`), [PLACEHOLDER_AUTH_USER_FILE]);
  assert.deepEqual(
    trouverPlaceholdersResiduels(`${PLACEHOLDER_AUTH_USER_FILE} ${PLACEHOLDER_DATA_DIR}`),
    [PLACEHOLDER_AUTH_USER_FILE, PLACEHOLDER_DATA_DIR],
  );
});

// ---------------------------------------------------------------------------
// Injection de bout en bout sur un dossier `dist/` simulé
// ---------------------------------------------------------------------------

async function creerDistSimule(contenuSupplementaire) {
  const racine = await mkdtemp(path.join(os.tmpdir(), 'visibilite-dist-'));
  await mkdir(path.join(racine, 'admin'), { recursive: true });
  await mkdir(path.join(racine, 'admin-api'), { recursive: true });
  await mkdir(path.join(racine, 'api'), { recursive: true });
  await writeFile(path.join(racine, 'admin/.htaccess'), `AuthUserFile ${PLACEHOLDER_AUTH_USER_FILE}\nRequire valid-user\n`);
  await writeFile(path.join(racine, 'admin-api/.htaccess'), `AuthUserFile ${PLACEHOLDER_AUTH_USER_FILE}\nRequire valid-user\n`);
  await writeFile(
    path.join(racine, 'api/_visibilites-lib.php'),
    `<?php\nconst VISIBILITES_DATA_DIR_DEFAUT = '${PLACEHOLDER_DATA_DIR}';\n`,
  );
  if (contenuSupplementaire) {
    for (const [cheminRelatif, contenu] of Object.entries(contenuSupplementaire)) {
      const cheminAbsolu = path.join(racine, cheminRelatif);
      await mkdir(path.dirname(cheminAbsolu), { recursive: true });
      await writeFile(cheminAbsolu, contenu);
    }
  }
  return racine;
}

test('injecterConfigurationVisibilite : substitution réussie avec des valeurs propres', async () => {
  const dossierDist = await creerDistSimule();
  try {
    await injecterConfigurationVisibilite({
      dossierDist,
      env: {
        VISIBILITES_AUTH_USER_FILE: '/home/salonez/.htpasswd-salonemploi-preprod',
        VISIBILITES_DATA_DIR: '/home/salonez/salon-emploi-data-preprod',
      },
    });
    const admin = await readFile(path.join(dossierDist, 'admin/.htaccess'), 'utf8');
    const adminApi = await readFile(path.join(dossierDist, 'admin-api/.htaccess'), 'utf8');
    const lib = await readFile(path.join(dossierDist, 'api/_visibilites-lib.php'), 'utf8');
    assert.match(admin, /AuthUserFile \/home\/salonez\/\.htpasswd-salonemploi-preprod/);
    assert.match(adminApi, /AuthUserFile \/home\/salonez\/\.htpasswd-salonemploi-preprod/);
    assert.match(lib, /VISIBILITES_DATA_DIR_DEFAUT = '\/home\/salonez\/salon-emploi-data-preprod'/);
    assert.equal(trouverPlaceholdersResiduels(admin + adminApi + lib).length, 0);
  } finally {
    await rm(dossierDist, { recursive: true, force: true });
  }
});

test('injecterConfigurationVisibilite : réussit malgré un LF final dans les deux variables', async () => {
  const dossierDist = await creerDistSimule();
  try {
    await injecterConfigurationVisibilite({
      dossierDist,
      env: {
        VISIBILITES_AUTH_USER_FILE: '/home/salonez/.htpasswd-salonemploi-preprod\n',
        VISIBILITES_DATA_DIR: '/home/salonez/salon-emploi-data-preprod\n',
      },
    });
    const lib = await readFile(path.join(dossierDist, 'api/_visibilites-lib.php'), 'utf8');
    assert.match(lib, /VISIBILITES_DATA_DIR_DEFAUT = '\/home\/salonez\/salon-emploi-data-preprod'/);
    assert.doesNotMatch(lib, /\n'/); // pas de saut de ligne injecté avant le guillemet fermant
  } finally {
    await rm(dossierDist, { recursive: true, force: true });
  }
});

test('injecterConfigurationVisibilite : réussit malgré un CRLF final (cas historique du bug)', async () => {
  const dossierDist = await creerDistSimule();
  try {
    await injecterConfigurationVisibilite({
      dossierDist,
      env: {
        VISIBILITES_AUTH_USER_FILE: '/home/salonez/.htpasswd-salonemploi-preprod\r\n',
        VISIBILITES_DATA_DIR: '/home/salonez/salon-emploi-data-preprod\r\n',
      },
    });
    const admin = await readFile(path.join(dossierDist, 'admin/.htaccess'), 'utf8');
    assert.match(admin, /^AuthUserFile \/home\/salonez\/\.htpasswd-salonemploi-preprod$/m);
  } finally {
    await rm(dossierDist, { recursive: true, force: true });
  }
});

test('injecterConfigurationVisibilite : variable vide -> échec, aucun fichier modifié', async () => {
  const dossierDist = await creerDistSimule();
  try {
    await assert.rejects(
      injecterConfigurationVisibilite({
        dossierDist,
        env: { VISIBILITES_AUTH_USER_FILE: '', VISIBILITES_DATA_DIR: '/home/salonez/salon-emploi-data-preprod' },
      }),
      /VISIBILITES_AUTH_USER_FILE est absente ou vide/,
    );
    // Échec avant toute écriture : les placeholders sont encore là.
    const admin = await readFile(path.join(dossierDist, 'admin/.htaccess'), 'utf8');
    assert.match(admin, new RegExp(PLACEHOLDER_AUTH_USER_FILE));
  } finally {
    await rm(dossierDist, { recursive: true, force: true });
  }
});

test('injecterConfigurationVisibilite : variable absente -> échec explicite', async () => {
  const dossierDist = await creerDistSimule();
  try {
    await assert.rejects(
      injecterConfigurationVisibilite({ dossierDist, env: { VISIBILITES_DATA_DIR: '/home/salonez/salon-emploi-data-preprod' } }),
      /VISIBILITES_AUTH_USER_FILE est absente ou vide/,
    );
  } finally {
    await rm(dossierDist, { recursive: true, force: true });
  }
});

test('injecterConfigurationVisibilite : placeholder résiduel ailleurs dans dist/ -> échec après substitution', async () => {
  // Simule une régression : un quatrième fichier texte porte encore le
  // placeholder (jamais substitué par cette fonction, volontairement, pour
  // vérifier que le filet de sécurité final le détecte).
  const dossierDist = await creerDistSimule({
    'admin/une-autre-page.html': `<p>${PLACEHOLDER_DATA_DIR}</p>`,
  });
  try {
    await assert.rejects(
      injecterConfigurationVisibilite({
        dossierDist,
        env: {
          VISIBILITES_AUTH_USER_FILE: '/home/salonez/.htpasswd-salonemploi-preprod',
          VISIBILITES_DATA_DIR: '/home/salonez/salon-emploi-data-preprod',
        },
      }),
      /une-autre-page\.html.*non substitué/s,
    );
  } finally {
    await rm(dossierDist, { recursive: true, force: true });
  }
});
