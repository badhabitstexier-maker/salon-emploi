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
import { test, before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
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

function attendreServeurPret(tentativesRestantes = 40) {
  return new Promise((resolve, reject) => {
    const essayer = async () => {
      try {
        const reponse = await fetch(`${base}/api/visibilites.php?page=accueil&emplacement=principal`);
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
      setTimeout(() => attendreServeurPret(tentativesRestantes - 1).then(resolve, reject), 100);
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

  await attendreServeurPret();
});

after(() => {
  processusPhp?.kill();
  if (dossierDonnees && existsSync(dossierDonnees)) {
    rmSync(dossierDonnees, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Aide : session Admin (cookie + jeton CSRF), obtenue via un premier GET —
// exactement le flux décrit dans le cadrage Admin-2B §6.
// ---------------------------------------------------------------------------
async function ouvrirSessionAdmin() {
  const reponse = await fetch(`${base}/admin-api/visibilites.php`);
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

async function creerViaAdmin(session, overrides = {}) {
  const reponse = await fetch(`${base}/admin-api/visibilites.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookie,
      Origin: base,
    },
    body: JSON.stringify(corpsMinimalValide(overrides)),
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
    ['alt', 'annonceur', 'dateDebut', 'dateFin', 'id', 'lien', 'poids', 'visuel'].sort(),
  );
  assert.equal('nomInterne' in trouvee, false);
  assert.equal('typeAnnonceur' in trouvee, false);
  assert.equal('exposantId' in trouvee, false);

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
