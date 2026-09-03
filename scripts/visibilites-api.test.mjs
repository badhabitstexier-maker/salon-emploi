/*
  Tests fonctionnels de l'API PHP du module Visibilité (Admin-2B, voir
  docs/VISIBILITE.md). Contrairement à scripts/visibilites-lib.test.mjs (qui
  teste la logique pure TypeScript, jamais exécutée par un vrai serveur PHP),
  ce fichier fait tourner le VRAI code PHP (public/api/_visibilites-lib.php,
  public/api/visibilites.php, public/admin-api/visibilites.php) via le
  serveur intégré `php -S`, et l'exerce par de vraies requêtes HTTP
  (`fetch`) — c'est la manière la plus fidèle de tester ce code sans accès à
  l'hébergement OVH réel (voir l'échange d'architecture Admin-2B, point 8).

  Portée volontairement PARTIELLE : `php -S` ne traite pas les fichiers
  .htaccess, donc la protection Basic Auth Apache (public/admin-api/.htaccess)
  n'est PAS exercée ici — exactement comme documenté pour /admin dans
  docs/ADMIN.md §5 (« test manuel », l'environnement de test ne reproduit pas
  Apache). Ce fichier teste tout ce qui EST vérifiable sans Apache : CSRF,
  contrôle d'origine, méthodes HTTP, validation métier, CRUD réel sur
  disque (écriture atomique, verrouillage), whitelist de l'API publique.

  Usage : npm run visibilites:api-test (voir package.json). Nécessite `php`
  dans le PATH (voir .github/workflows/qa.yml pour l'installation en CI).
*/
import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const racineDepot = path.join(__dirname, '..');
const dossierPublic = path.join(racineDepot, 'public');

const port = 20000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;

let processusPhp;
let dossierDonnees;

function attendreServeurPret(baseUrl, tentativesRestantes = 40) {
  return new Promise((resolve, reject) => {
    const essayer = async () => {
      try {
        const reponse = await fetch(`${baseUrl}/api/visibilites.php?page=accueil&emplacement=principal`);
        if (reponse.ok) {
          resolve();
          return;
        }
      } catch {
        // Serveur pas encore prêt à accepter des connexions — on retente.
      }
      if (tentativesRestantes <= 0) {
        reject(new Error('Le serveur PHP de test ne répond pas.'));
        return;
      }
      setTimeout(() => attendreServeurPret(baseUrl, tentativesRestantes - 1).then(resolve, reject), 100);
    };
    void essayer();
  });
}

before(async () => {
  dossierDonnees = mkdtempSync(path.join(tmpdir(), 'visibilites-api-test-'));

  processusPhp = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', dossierPublic], {
    env: { ...process.env, VISIBILITES_DATA_DIR_TEST: dossierDonnees },
    stdio: 'ignore',
  });

  await attendreServeurPret(base);
});

after(() => {
  processusPhp?.kill();
  if (dossierDonnees && existsSync(dossierDonnees)) {
    rmSync(dossierDonnees, { recursive: true, force: true });
  }
});

/*
  Démarre un serveur PHP DÉDIÉ, sur son propre dossier temporaire vide et son
  propre port — totalement indépendant du serveur/dossier partagé ci-dessus.
  Utilisé par les tests de « premier démarrage » (ci-dessous) : ils doivent
  garantir un dossier réellement vierge, sans dépendre de l'ordre
  d'exécution des autres tests de ce fichier (qui, eux, partagent
  `dossierDonnees` et peuvent y avoir déjà écrit).
*/
async function demarrerServeurIsole() {
  const dossier = mkdtempSync(path.join(tmpdir(), 'visibilites-api-test-isole-'));
  const portIsole = 20000 + Math.floor(Math.random() * 10000);
  const baseIsolee = `http://127.0.0.1:${portIsole}`;
  const processus = spawn('php', ['-S', `127.0.0.1:${portIsole}`, '-t', dossierPublic], {
    env: { ...process.env, VISIBILITES_DATA_DIR_TEST: dossier },
    stdio: 'ignore',
  });
  await attendreServeurPret(baseIsolee);
  return { dossier, base: baseIsolee, processus };
}

function arreterServeurIsole(serveur) {
  serveur.processus?.kill();
  if (serveur.dossier && existsSync(serveur.dossier)) {
    rmSync(serveur.dossier, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Aide : session Admin (cookie + jeton CSRF), obtenue via un premier GET —
// exactement le flux décrit dans le cadrage Admin-2B §6. `baseUrl` est
// paramétrable pour être réutilisable par les serveurs isolés ci-dessous ;
// par défaut le serveur partagé de la suite (`base`).
// ---------------------------------------------------------------------------
async function ouvrirSessionAdmin(baseUrl = base) {
  const reponse = await fetch(`${baseUrl}/admin-api/visibilites.php`);
  const corps = await reponse.json();
  const setCookie = reponse.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0]; // "PHPSESSID=xxxx"
  return { cookie, csrfToken: corps.csrfToken };
}

function corpsMinimalValide(overrides = {}) {
  return {
    nomInterne: 'Test API — interne',
    annonceur: 'Annonceur de test',
    typeAnnonceur: 'sponsor',
    format: 'bandeau_horizontal',
    visuel: '/visibilites/test.png',
    alt: 'Texte alternatif de test',
    pages: ['accueil'],
    emplacement: 'principal',
    poids: 2,
    actif: true,
    ...overrides,
  };
}

async function creerViaAdmin(session, overrides = {}, baseUrl = base) {
  const reponse = await fetch(`${baseUrl}/admin-api/visibilites.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: baseUrl,
    },
    body: JSON.stringify(corpsMinimalValide(overrides)),
  });
  const corps = await reponse.json();
  return { statut: reponse.status, corps };
}

async function modifierViaAdmin(session, id, donnees, baseUrl = base) {
  const reponse = await fetch(`${baseUrl}/admin-api/visibilites.php?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: baseUrl,
    },
    body: JSON.stringify(donnees),
  });
  const corps = await reponse.json();
  return { statut: reponse.status, corps };
}

async function supprimerViaAdmin(session, id) {
  return fetch(`${base}/admin-api/visibilites.php?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': session.csrfToken, Cookie: session.cookie, Origin: base },
  });
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

test('API publique : aucune donnée -> liste vide, 200 (jamais d\'erreur)', async () => {
  const reponse = await fetch(`${base}/api/visibilites.php?page=accueil&emplacement=principal`);
  assert.equal(reponse.status, 200);
  const corps = await reponse.json();
  assert.deepEqual(corps.visibilites, []);
});

test('API publique : page/emplacement manquants ou invalides -> liste vide, jamais toutes les campagnes', async () => {
  const reponse = await fetch(`${base}/api/visibilites.php`);
  const corps = await reponse.json();
  assert.deepEqual(corps.visibilites, []);

  const reponseInvalide = await fetch(`${base}/api/visibilites.php?page=nimporte-quoi`);
  assert.deepEqual((await reponseInvalide.json()).visibilites, []);
});

test('API publique : méthode non-GET refusée (405)', async () => {
  const reponse = await fetch(`${base}/api/visibilites.php`, { method: 'POST' });
  assert.equal(reponse.status, 405);
});

// ---------------------------------------------------------------------------
// API Admin — CSRF / origine / méthodes
// ---------------------------------------------------------------------------

test('API Admin : GET renvoie un jeton CSRF', async () => {
  const session = await ouvrirSessionAdmin();
  assert.equal(typeof session.csrfToken, 'string');
  assert.ok(session.csrfToken.length >= 32);
});

test('API Admin : POST sans jeton CSRF -> 403, aucune écriture', async () => {
  const session = await ouvrirSessionAdmin();
  const reponse = await fetch(`${base}/admin-api/visibilites.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookie, Origin: base },
    body: JSON.stringify(corpsMinimalValide()),
  });
  assert.equal(reponse.status, 403);
});

test('API Admin : POST avec un jeton CSRF invalide -> 403', async () => {
  const session = await ouvrirSessionAdmin();
  const reponse = await fetch(`${base}/admin-api/visibilites.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'un-jeton-invente-de-toutes-pieces',
      Cookie: session.cookie,
      Origin: base,
    },
    body: JSON.stringify(corpsMinimalValide()),
  });
  assert.equal(reponse.status, 403);
});

test('API Admin : POST avec une Origin différente -> 403 même avec un jeton CSRF valide', async () => {
  const session = await ouvrirSessionAdmin();
  const reponse = await fetch(`${base}/admin-api/visibilites.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: 'https://site-tiers-malveillant.example',
    },
    body: JSON.stringify(corpsMinimalValide()),
  });
  assert.equal(reponse.status, 403);
});

test('API Admin : méthode non supportée (PATCH) -> 405', async () => {
  const reponse = await fetch(`${base}/admin-api/visibilites.php`, { method: 'PATCH' });
  assert.equal(reponse.status, 405);
});

// ---------------------------------------------------------------------------
// CRUD réel
// ---------------------------------------------------------------------------

test('CRUD : création -> apparaît dans la liste Admin, avec un id généré serveur', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { annonceur: 'CRUD — création' });
  assert.equal(statut, 200);
  assert.match(corps.visibilite.id, /^vis-[0-9a-f]{12}$/);

  const liste = await (await fetch(`${base}/admin-api/visibilites.php`)).json();
  assert.ok(liste.visibilites.some((v) => v.id === corps.visibilite.id));

  await supprimerViaAdmin(session, corps.visibilite.id);
});

test('CRUD : modification (PUT) — fusion partielle, seuls les champs envoyés changent', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps: creation } = await creerViaAdmin(session, { annonceur: 'CRUD — avant modification', poids: 5 });
  const id = creation.visibilite.id;

  const reponse = await fetch(`${base}/admin-api/visibilites.php?id=${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: base,
    },
    body: JSON.stringify({ annonceur: 'CRUD — après modification' }),
  });
  const corps = await reponse.json();
  assert.equal(reponse.status, 200);
  assert.equal(corps.visibilite.annonceur, 'CRUD — après modification');
  assert.equal(corps.visibilite.poids, 5); // champ non envoyé, conservé

  await supprimerViaAdmin(session, id);
});

test('CRUD : activer/désactiver — cas particulier de PUT, ne change que `actif`', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps: creation } = await creerViaAdmin(session, { annonceur: 'CRUD — actif/inactif', actif: true });
  const id = creation.visibilite.id;

  const reponse = await fetch(`${base}/admin-api/visibilites.php?id=${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: base,
    },
    body: JSON.stringify({ actif: false }),
  });
  const corps = await reponse.json();
  assert.equal(corps.visibilite.actif, false);
  assert.equal(corps.visibilite.annonceur, 'CRUD — actif/inactif'); // inchangé

  await supprimerViaAdmin(session, id);
});

test('CRUD : suppression — confirmée puis absente de la liste ; suppression d\'un id inconnu -> 404', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps: creation } = await creerViaAdmin(session, { annonceur: 'CRUD — à supprimer' });
  const id = creation.visibilite.id;

  const suppression = await supprimerViaAdmin(session, id);
  assert.equal(suppression.status, 200);

  const liste = await (await fetch(`${base}/admin-api/visibilites.php`)).json();
  assert.ok(!liste.visibilites.some((v) => v.id === id));

  const suppressionInconnue = await supprimerViaAdmin(session, id);
  assert.equal(suppressionInconnue.status, 404);
});

test('CRUD : modification d\'un id inexistant -> 404', async () => {
  const session = await ouvrirSessionAdmin();
  const reponse = await fetch(`${base}/admin-api/visibilites.php?id=vis-000000000000`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: base,
    },
    body: JSON.stringify({ annonceur: 'x' }),
  });
  assert.equal(reponse.status, 404);
});

// ---------------------------------------------------------------------------
// Validations métier serveur (jamais uniquement côté navigateur)
// ---------------------------------------------------------------------------

test('Validation : annonceur manquant -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { annonceur: '' });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('annonceur')));
});

test('Validation : alt manquant -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { alt: '' });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('alt')));
});

test('Validation : visuel manquant -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { visuel: '' });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('visuel')));
});

test('Validation : visuelMobile est optionnel — absent ou vide accepté, campagne créée sans lui', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { visuelMobile: '' });
  assert.equal(statut, 200);
  assert.equal(corps.visibilite.visuelMobile, null);
  await supprimerViaAdmin(session, corps.visibilite.id);
});

test('Validation : visuelMobile renseigné est conservé distinctement du visuel desktop', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, {
    visuel: '/visibilites/desktop.png',
    visuelMobile: '/visibilites/mobile.png',
  });
  assert.equal(statut, 200);
  assert.equal(corps.visibilite.visuel, '/visibilites/desktop.png');
  assert.equal(corps.visibilite.visuelMobile, '/visibilites/mobile.png');
  await supprimerViaAdmin(session, corps.visibilite.id);
});

test('Validation : poids invalide (0, négatif, non entier) -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  for (const poids of [0, -3, 'abc', 2.5]) {
    const { statut, corps } = await creerViaAdmin(session, { poids });
    assert.equal(statut, 422, `poids=${poids} devrait être rejeté`);
    assert.ok(corps.details.some((d) => d.includes('poids')));
  }
});

test('Validation : page invalide -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { pages: ['page-qui-nexiste-pas'] });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('page invalide')));
});

test('Validation : aucune page -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, { pages: [] });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('pages')));
});

test('Validation : format invalide -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut } = await creerViaAdmin(session, { format: 'carousel-3d' });
  assert.equal(statut, 422);
});

test('Validation : typeAnnonceur invalide -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut } = await creerViaAdmin(session, { typeAnnonceur: 'inconnu' });
  assert.equal(statut, 422);
});

test('Validation : exposantId mal formé -> 422 ; bien formé -> accepté', async () => {
  const session = await ouvrirSessionAdmin();
  const invalide = await creerViaAdmin(session, { exposantId: 'PAS-LE-BON-FORMAT' });
  assert.equal(invalide.statut, 422);

  const valide = await creerViaAdmin(session, { exposantId: 'EXP26-042' });
  assert.equal(valide.statut, 200);
  assert.equal(valide.corps.visibilite.exposantId, 'EXP26-042');
  await supprimerViaAdmin(session, valide.corps.visibilite.id);
});

test('Validation : dateFin antérieure à dateDebut -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  const { statut, corps } = await creerViaAdmin(session, {
    dateDebut: '2026-12-31',
    dateFin: '2026-01-01',
  });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('dateFin')));
});

test('Validation : id fourni par le client à la création est ignoré (id toujours généré serveur)', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps } = await creerViaAdmin(session, { id: 'vis-idfaitmaison' });
  assert.notEqual(corps.visibilite.id, 'vis-idfaitmaison');
  assert.match(corps.visibilite.id, /^vis-[0-9a-f]{12}$/);
  await supprimerViaAdmin(session, corps.visibilite.id);
});

// ---------------------------------------------------------------------------
// Whitelist du contrat public + visibilité sans rebuild
// ---------------------------------------------------------------------------

test('Contrat public : nomInterne/typeAnnonceur/exposantId jamais exposés, même si présents en Admin', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps } = await creerViaAdmin(session, {
    annonceur: 'Whitelist — test',
    nomInterne: 'Ne doit jamais sortir publiquement',
    typeAnnonceur: 'exposant',
    exposantId: 'EXP26-007',
    pages: ['accueil'],
  });
  const id = corps.visibilite.id;

  const reponsePublique = await fetch(`${base}/api/visibilites.php?page=accueil&emplacement=principal`);
  const corpsPublic = await reponsePublique.json();
  const trouvee = corpsPublic.visibilites.find((v) => v.id === id);

  assert.ok(trouvee, 'la campagne active doit apparaître sur la page accueil');
  assert.deepEqual(
    Object.keys(trouvee).sort(),
    ['alt', 'annonceur', 'dateDebut', 'dateFin', 'id', 'lien', 'poids', 'visuel', 'visuelMobile'].sort(),
  );
  assert.equal('nomInterne' in trouvee, false);
  assert.equal('typeAnnonceur' in trouvee, false);
  assert.equal('exposantId' in trouvee, false);

  await supprimerViaAdmin(session, id);
});

test('Contrat public : campagne historique sans visuelMobile -> champ présent mais null (repli desktop géré côté client)', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps } = await creerViaAdmin(session, { annonceur: 'Historique — sans visuelMobile', pages: ['accueil'] });
  const id = corps.visibilite.id;

  const reponsePublique = await fetch(`${base}/api/visibilites.php?page=accueil&emplacement=principal`);
  const corpsPublic = await reponsePublique.json();
  const trouvee = corpsPublic.visibilites.find((v) => v.id === id);

  assert.ok(trouvee);
  assert.equal(trouvee.visuelMobile, null);
  await supprimerViaAdmin(session, id);
});

test('Sans rebuild : une création est immédiatement visible côté public (même processus serveur, aucun redéploiement)', async () => {
  const session = await ouvrirSessionAdmin();
  const avant = await (await fetch(`${base}/api/visibilites.php?page=offres&emplacement=principal`)).json();

  const { corps } = await creerViaAdmin(session, { annonceur: 'Sans rebuild — création', pages: ['offres'] });
  const apres = await (await fetch(`${base}/api/visibilites.php?page=offres&emplacement=principal`)).json();
  assert.equal(apres.visibilites.length, avant.visibilites.length + 1);
  assert.ok(apres.visibilites.some((v) => v.id === corps.visibilite.id));

  await supprimerViaAdmin(session, corps.visibilite.id);
  const apresSuppression = await (await fetch(`${base}/api/visibilites.php?page=offres&emplacement=principal`)).json();
  assert.ok(!apresSuppression.visibilites.some((v) => v.id === corps.visibilite.id));
});

test('Sans rebuild : désactiver une campagne la retire immédiatement du flux public', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps } = await creerViaAdmin(session, { annonceur: 'Sans rebuild — désactivation', pages: ['programme'] });
  const id = corps.visibilite.id;

  const avant = await (await fetch(`${base}/api/visibilites.php?page=programme&emplacement=principal`)).json();
  assert.ok(avant.visibilites.some((v) => v.id === id));

  await fetch(`${base}/admin-api/visibilites.php?id=${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: base,
    },
    body: JSON.stringify({ actif: false }),
  });

  const apres = await (await fetch(`${base}/api/visibilites.php?page=programme&emplacement=principal`)).json();
  assert.ok(!apres.visibilites.some((v) => v.id === id));

  await supprimerViaAdmin(session, id);
});

test('Indépendance formule commerciale : `poids` et `pages` restent tels que saisis, aucun champ formule dans le schéma', async () => {
  const session = await ouvrirSessionAdmin();
  const { corps } = await creerViaAdmin(session, {
    annonceur: 'Indépendance formule',
    exposantId: 'EXP26-099',
    poids: 7,
  });
  assert.equal('formule' in corps.visibilite, false);
  assert.equal(corps.visibilite.poids, 7);
  await supprimerViaAdmin(session, corps.visibilite.id);
});

// ---------------------------------------------------------------------------
// Premier démarrage — dossier de données vide, aucun visibilites.json.
//
// Ces deux blocs `describe` démarrent CHACUN leur propre serveur PHP sur
// leur propre dossier temporaire vierge (demarrerServeurIsole()) : le
// dossier n'a JAMAIS reçu la moindre écriture avant le premier test de
// chaque bloc. Volontairement indépendants du serveur/dossier partagé par
// le reste de ce fichier (`base/dossierDonnees`, qui a déjà été écrit par
// d'autres tests au moment où ils s'exécutent) — le but est de verrouiller
// durablement le comportement de premier démarrage sans dépendre de l'ordre
// d'exécution des tests dans ce fichier (voir cadrage Admin-2B, échange du
// 09/08/2026 : ce comportement avait été vérifié manuellement une fois,
// mais pas verrouillé par une assertion dédiée — ces deux blocs comblent
// exactement ce trou).
// ---------------------------------------------------------------------------

describe('Démarrage sans fichier de données (dossier vide, isolé)', () => {
  let serveur;

  before(async () => {
    serveur = await demarrerServeurIsole();
  });

  after(() => {
    arreterServeurIsole(serveur);
  });

  test('GET /api/visibilites.php sur un dossier sans visibilites.json -> 200, liste vide, aucune création de fichier par la simple lecture', async () => {
    const cheminJson = path.join(serveur.dossier, 'visibilites.json');
    assert.equal(existsSync(cheminJson), false, 'précondition : aucun fichier avant le test');

    const reponse = await fetch(`${serveur.base}/api/visibilites.php?page=accueil&emplacement=principal`);
    assert.equal(reponse.status, 200);
    const corps = await reponse.json();
    assert.deepEqual(corps.visibilites, []);

    // Une lecture seule ne doit jamais créer le fichier de données.
    assert.equal(existsSync(cheminJson), false);
  });

  test('GET /admin-api/visibilites.php sur un dossier sans visibilites.json -> 200, liste vide, jeton CSRF fourni', async () => {
    const cheminJson = path.join(serveur.dossier, 'visibilites.json');
    assert.equal(existsSync(cheminJson), false, 'précondition : aucun fichier avant le test');

    const reponse = await fetch(`${serveur.base}/admin-api/visibilites.php`);
    assert.equal(reponse.status, 200);
    const corps = await reponse.json();
    assert.deepEqual(corps.visibilites, []);
    assert.equal(typeof corps.csrfToken, 'string');
    assert.ok(corps.csrfToken.length >= 32, 'le mécanisme CSRF doit fonctionner même sans fichier de données');

    assert.equal(existsSync(cheminJson), false);
  });
});

describe('Première écriture vs écritures suivantes (dossier vide, isolé)', () => {
  let serveur;

  before(async () => {
    serveur = await demarrerServeurIsole();
  });

  after(() => {
    arreterServeurIsole(serveur);
  });

  /*
    Volontairement UN SEUL test couvrant la séquence complète (première
    création puis modification), plutôt que deux tests séparés qui se
    passeraient un id en variable partagée : la deuxième écriture n'a de
    sens qu'après une première, donc c'est une seule scène à vérifier de
    bout en bout, pas deux tests qui dépendraient implicitement l'un de
    l'autre. Ce test ne dépend d'aucun autre test de ce fichier — dossier et
    serveur dédiés (voir before() ci-dessus).
  */
  test('première création : fichier absent avant, créé sans .bak ; deuxième écriture : .bak créé et identique à la version précédente', async () => {
    const cheminJson = path.join(serveur.dossier, 'visibilites.json');
    const cheminBak = path.join(serveur.dossier, 'visibilites.json.bak');

    // --- Étape 1 : avant toute écriture ---
    assert.equal(existsSync(cheminJson), false);
    assert.equal(existsSync(cheminBak), false);

    // --- Étape 2 : première création ---
    const session = await ouvrirSessionAdmin(serveur.base);
    const premiere = await creerViaAdmin(session, { annonceur: 'Première écriture — dossier vierge' }, serveur.base);
    assert.equal(premiere.statut, 200);

    assert.equal(existsSync(cheminJson), true, 'visibilites.json doit être créé automatiquement par la première écriture');
    assert.equal(existsSync(cheminBak), false, 'pas de .bak au premier écrit : aucune version précédente à sauvegarder');

    const contenuApresPremiereEcriture = readFileSync(cheminJson, 'utf8');

    // --- Étape 3 : deuxième écriture (modification) ---
    const id = premiere.corps.visibilite.id;
    const deuxieme = await modifierViaAdmin(session, id, { poids: 9 }, serveur.base);
    assert.equal(deuxieme.statut, 200);
    assert.equal(deuxieme.corps.visibilite.poids, 9);

    assert.equal(existsSync(cheminBak), true, 'le .bak doit apparaître dès la deuxième écriture');

    // Le .bak correspond exactement au contenu du fichier AVANT cette
    // deuxième écriture (donc à l'état issu de la première création).
    const contenuBak = readFileSync(cheminBak, 'utf8');
    assert.equal(contenuBak, contenuApresPremiereEcriture);

    // Le fichier courant, lui, reflète bien la modification (poids: 9),
    // donc diffère du .bak — confirme que le .bak est une VERSION PRÉCÉDENTE,
    // pas une simple copie miroir tenue à jour en continu.
    const contenuApresDeuxiemeEcriture = readFileSync(cheminJson, 'utf8');
    assert.notEqual(contenuApresDeuxiemeEcriture, contenuBak);
  });
});

/*
  Sûreté des URL (audit sécurité, constat n°1) - `lien` finit en `href` d'une
  <a> sur le site public, `visuel`/`visuelMobile` en `src` d'une <img>. La
  validation n'exigeait qu'une chaîne non vide : un `lien` en `javascript:`
  s'exécutait dans l'origine du site pour tout visiteur cliquant le bandeau.
  Miroir PHP de estUrlVisibiliteSure() (src/lib/visibilites.ts), couvert côté
  TypeScript par scripts/visibilites-lib.test.mjs.
*/
const URLS_DANGEREUSES = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//exemple-malveillant.tld/x',
  'exemple.nc/sans-slash',
];

test('Validation : lien avec un schéma dangereux -> 422, jamais enregistré', async () => {
  const session = await ouvrirSessionAdmin();
  for (const lien of URLS_DANGEREUSES) {
    const { statut, corps } = await creerViaAdmin(session, { lien });
    assert.equal(statut, 422, `lien=${lien} devrait être rejeté`);
    assert.ok(corps.details.some((d) => d.includes('lien')), `message attendu sur « lien » pour ${lien}`);
  }
  // Aucune de ces tentatives ne doit avoir laissé de trace.
  const liste = await fetch(`${base}/admin-api/visibilites.php`, { headers: { Cookie: session.cookie } }).then((r) => r.json());
  assert.equal(liste.visibilites.filter((v) => URLS_DANGEREUSES.includes(v.lien)).length, 0);
});

test('Validation : visuel et visuelMobile avec un schéma dangereux -> 422', async () => {
  const session = await ouvrirSessionAdmin();
  for (const url of URLS_DANGEREUSES) {
    const r1 = await creerViaAdmin(session, { visuel: url });
    assert.equal(r1.statut, 422, `visuel=${url} devrait être rejeté`);
    assert.ok(r1.corps.details.some((d) => d.includes('visuel')));

    const r2 = await creerViaAdmin(session, { visuelMobile: url });
    assert.equal(r2.statut, 422, `visuelMobile=${url} devrait être rejeté`);
    assert.ok(r2.corps.details.some((d) => d.includes('visuelMobile')));
  }
});

test('Validation : les URL légitimes restent acceptées', async () => {
  const session = await ouvrirSessionAdmin();
  for (const lien of ['https://exemple.nc/campagne', 'http://exemple.nc', '/exposants', '/offres?filtre=x#a']) {
    const { statut, corps } = await creerViaAdmin(session, { lien });
    assert.equal(statut, 200, `lien=${lien} devrait être accepté`);
    assert.equal(corps.visibilite.lien, lien);
  }
});

test("Validation : une modification (PUT) ne peut pas introduire un lien dangereux", async () => {
  const session = await ouvrirSessionAdmin();
  const creation = await creerViaAdmin(session, { lien: '/exposants' });
  assert.equal(creation.statut, 200);
  const id = creation.corps.visibilite.id;

  const { statut, corps } = await modifierViaAdmin(session, id, { lien: 'javascript:alert(1)' });
  assert.equal(statut, 422);
  assert.ok(corps.details.some((d) => d.includes('lien')));

  // L'enregistrement existant doit être intact.
  const liste = await fetch(`${base}/admin-api/visibilites.php`, { headers: { Cookie: session.cookie } }).then((r) => r.json());
  assert.equal(liste.visibilites.find((v) => v.id === id).lien, '/exposants');
});
