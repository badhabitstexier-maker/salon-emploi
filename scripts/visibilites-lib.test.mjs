/*
  Tests unitaires du moteur pur de visibilité publicitaire (Lot Admin-2 /
  Admin-2B, voir docs/VISIBILITE.md). Utilise le testeur intégré à Node
  (`node --test`, alias `npm run visibilites:test`) — import direct de
  src/lib/visibilites.ts.

  Depuis Admin-2B, `Visibilite` est un objet plat (plus de wrapper
  `{ id, data }` issu d'une Content Collection Astro) et les dates sont des
  chaînes ISO 8601, comme reçues du JSON servi par l'API PHP (voir
  scripts/visibilites-api.test.mjs pour les tests contre le vrai code PHP).

  Couvre les scénarios du cadrage Admin-2/Admin-2B : statuts
  (actif/à venir/expiré/désactivé), éligibilité (page/emplacement/dates),
  sélection pondérée déterministe, indépendance formule/poids, whitelist du
  résumé public.
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  statutVisibilite,
  calculerStatut,
  estEligible,
  visibilitesEligibles,
  visibilitesEnvoyables,
  estDansPeriode,
  estDansPeriodeResume,
  visibiliteResume,
  estResumePublicValide,
  estUrlVisibiliteSure,
  selectionnerPonderee,
} from '../src/lib/visibilites.ts';

/** Fabrique une visibilité plate, avec des valeurs par défaut raisonnables. */
function visibilite(overrides = {}) {
  return {
    id: 'fixture',
    nomInterne: 'Fixture',
    annonceur: 'Annonceur fixture',
    typeAnnonceur: 'sponsor',
    format: 'bandeau_horizontal',
    visuel: '/fixture.png',
    alt: 'Fixture',
    pages: ['accueil'],
    emplacement: 'principal',
    poids: 1,
    actif: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// statutVisibilite
// ---------------------------------------------------------------------------

test('statutVisibilite : actif, sans dates -> actif', () => {
  const v = visibilite();
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'actif');
});

test('statutVisibilite : actif=false -> desactive, quelles que soient les dates', () => {
  const v = visibilite({ actif: false, dateDebut: '2020-01-01', dateFin: '2099-01-01' });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'desactive');
});

test('statutVisibilite : dateDebut future -> a-venir', () => {
  const v = visibilite({ dateDebut: '2099-01-01' });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'a-venir');
});

test('statutVisibilite : dateFin passée -> expire', () => {
  const v = visibilite({ dateFin: '2020-01-01' });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'expire');
});

test('statutVisibilite : maintenant entre dateDebut et dateFin -> actif', () => {
  const v = visibilite({ dateDebut: '2026-01-01', dateFin: '2026-12-31' });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'actif');
});

// ---------------------------------------------------------------------------
// estEligible / visibilitesEligibles
// ---------------------------------------------------------------------------

test('estEligible : refuse une page non couverte', () => {
  const v = visibilite({ pages: ['offres'] });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), false);
});

test('estEligible : refuse un emplacement différent', () => {
  const v = visibilite({ emplacement: 'secondaire' });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), false);
});

test('estEligible : refuse une visibilité désactivée, expirée ou à venir', () => {
  assert.equal(estEligible(visibilite({ actif: false }), { page: 'accueil', emplacement: 'principal' }), false);
  assert.equal(
    estEligible(visibilite({ dateFin: '2020-01-01' }), { page: 'accueil', emplacement: 'principal' }, new Date('2026-08-09')),
    false,
  );
  assert.equal(
    estEligible(visibilite({ dateDebut: '2099-01-01' }), { page: 'accueil', emplacement: 'principal' }, new Date('2026-08-09')),
    false,
  );
});

test('estEligible : accepte un annonceur externe sans exposantId', () => {
  const v = visibilite({ typeAnnonceur: 'annonceur_externe', exposantId: undefined });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), true);
});

test('estEligible : accepte un exposant, quelle que soit sa formule (le moteur ne lit jamais `formule`)', () => {
  // Le schéma des visibilités ne porte d'ailleurs aucun champ `formule` —
  // seul `exposantId` existe ; ce test vérifie que rien ne dépend d'une
  // valeur qui n'est même pas présente dans le schéma.
  const v = visibilite({ typeAnnonceur: 'exposant', exposantId: 'EXP26-001' });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), true);
});

test('visibilitesEligibles : filtre une liste sur page + emplacement + statut', () => {
  const liste = [
    visibilite({ id: 'a', pages: ['accueil'] }), // éligible
    visibilite({ id: 'b', pages: ['offres'] }), // mauvaise page
    visibilite({ id: 'c', pages: ['accueil'], actif: false }), // désactivée
    visibilite({ id: 'd', pages: ['accueil'], emplacement: 'secondaire' }), // mauvais emplacement
  ];
  const eligibles = visibilitesEligibles(liste, { page: 'accueil', emplacement: 'principal' }, new Date('2026-08-09'));
  assert.deepEqual(eligibles.map((v) => v.id), ['a']);
});

test('visibilitesEligibles : liste vide -> aucun résultat, pas d\'erreur', () => {
  assert.deepEqual(visibilitesEligibles([], { page: 'programme', emplacement: 'principal' }), []);
});

// ---------------------------------------------------------------------------
// selectionnerPonderee — pur, déterministe via rng injecté
// ---------------------------------------------------------------------------

test('selectionnerPonderee : aucun candidat -> undefined', () => {
  assert.equal(selectionnerPonderee([]), undefined);
});

test('selectionnerPonderee : un seul candidat -> toujours lui, quel que soit le tirage', () => {
  const candidats = [{ id: 'unique', poids: 1 }];
  assert.equal(selectionnerPonderee(candidats, () => 0).id, 'unique');
  assert.equal(selectionnerPonderee(candidats, () => 0.999).id, 'unique');
});

test('selectionnerPonderee : tirage déterministe, poids [1, 3] sur un total de 4', () => {
  const candidats = [
    { id: 'leger', poids: 1 },
    { id: 'lourd', poids: 3 },
  ];
  assert.equal(selectionnerPonderee(candidats, () => 0).id, 'leger');
  assert.equal(selectionnerPonderee(candidats, () => 0.24).id, 'leger');
  assert.equal(selectionnerPonderee(candidats, () => 0.26).id, 'lourd');
  assert.equal(selectionnerPonderee(candidats, () => 0.999).id, 'lourd');
});

test('selectionnerPonderee : le poids seul pilote le tirage, aucun autre champ (ex. type/formule) n\'intervient', () => {
  const candidats = [
    { id: 'a', poids: 1, typeAnnonceur: 'exposant', formule: 'gold' },
    { id: 'b', poids: 1, typeAnnonceur: 'annonceur_externe' },
  ];
  assert.equal(selectionnerPonderee(candidats, () => 0).id, 'a');
  assert.equal(selectionnerPonderee(candidats, () => 0.99).id, 'b');
});

test('selectionnerPonderee : reste stable si rappelé avec le même rng (pas de rotation automatique)', () => {
  const candidats = [
    { id: 'x', poids: 2 },
    { id: 'y', poids: 5 },
  ];
  const rngFixe = () => 0.5;
  const premier = selectionnerPonderee(candidats, rngFixe);
  const second = selectionnerPonderee(candidats, rngFixe);
  assert.equal(premier.id, second.id);
});

// ---------------------------------------------------------------------------
// Dates évaluées « au chargement », pas au build (voir docs/VISIBILITE.md §7)
// ---------------------------------------------------------------------------

test('estDansPeriode : sans dates -> toujours vrai', () => {
  assert.equal(estDansPeriode(undefined, undefined, new Date('2026-08-09')), true);
});

test('estDansPeriode : une campagne démarre sans rebuild dès que dateDebut est atteinte', () => {
  const dateDebut = new Date('2026-08-09T10:00:00Z');
  assert.equal(estDansPeriode(dateDebut, undefined, new Date('2026-08-09T09:59:59Z')), false);
  assert.equal(estDansPeriode(dateDebut, undefined, new Date('2026-08-09T10:00:00Z')), true);
  assert.equal(estDansPeriode(dateDebut, undefined, new Date('2026-08-09T10:00:01Z')), true);
});

test('estDansPeriode : une campagne expire sans rebuild après dateFin', () => {
  const dateFin = new Date('2026-08-09T18:00:00Z');
  assert.equal(estDansPeriode(undefined, dateFin, new Date('2026-08-09T17:59:59Z')), true);
  assert.equal(estDansPeriode(undefined, dateFin, new Date('2026-08-09T18:00:00Z')), true);
  assert.equal(estDansPeriode(undefined, dateFin, new Date('2026-08-09T18:00:01Z')), false);
});

test('estDansPeriodeResume : applique la même règle à un résumé (dates en ISO, comme reçu de l\'API)', () => {
  const v = visibilite({ dateDebut: '2026-01-01', dateFin: '2026-12-31' });
  const resume = visibiliteResume(v);
  assert.equal(typeof resume.dateDebut, 'string');
  assert.equal(typeof resume.dateFin, 'string');
  assert.equal(estDansPeriodeResume(resume, new Date('2026-06-01')), true);
  assert.equal(estDansPeriodeResume(resume, new Date('2020-01-01')), false);
  assert.equal(estDansPeriodeResume(resume, new Date('2027-01-01')), false);
});

test('visibiliteResume : n\'expose aucune donnée interne (nomInterne, typeAnnonceur, exposantId absents du résumé public)', () => {
  const v = visibilite({
    nomInterne: 'Nom réservé LabEvents — jamais public',
    typeAnnonceur: 'exposant',
    exposantId: 'EXP26-001',
  });
  const resume = visibiliteResume(v);
  assert.deepEqual(
    Object.keys(resume).sort(),
    ['alt', 'annonceur', 'dateDebut', 'dateFin', 'id', 'lien', 'poids', 'visuel', 'visuelMobile'].sort(),
  );
  assert.equal('nomInterne' in resume, false);
  assert.equal('typeAnnonceur' in resume, false);
  assert.equal('exposantId' in resume, false);
});

test('estResumePublicValide : accepte le résumé whitelisté, refuse tout champ interne', () => {
  assert.equal(estResumePublicValide({ id: 'x', annonceur: 'y', poids: 1 }), true);
  assert.equal(estResumePublicValide({ id: 'x', nomInterne: 'fuite' }), false);
  assert.equal(estResumePublicValide({ id: 'x', typeAnnonceur: 'sponsor' }), false);
  assert.equal(estResumePublicValide({ id: 'x', exposantId: 'EXP26-001' }), false);
  assert.equal(estResumePublicValide({ id: 'x', visuelMobile: '/m.png' }), true);
});

// ---------------------------------------------------------------------------
// visuelMobile — optionnel, rétrocompatible (voir docs/VISIBILITE.md §4/§5bis)
// ---------------------------------------------------------------------------

test('visibiliteResume : campagne historique sans visuelMobile -> champ transmis vide (repli desktop géré côté client)', () => {
  const v = visibilite(); // pas de visuelMobile, comme toute campagne créée avant ce lot
  const resume = visibiliteResume(v);
  assert.equal(resume.visuelMobile, undefined);
  assert.equal(resume.visuel, '/fixture.png');
});

test('visibiliteResume : campagne avec visuelMobile -> les deux visuels sont transmis distinctement', () => {
  const v = visibilite({ visuel: '/desktop.png', visuelMobile: '/mobile.png' });
  const resume = visibiliteResume(v);
  assert.equal(resume.visuel, '/desktop.png');
  assert.equal(resume.visuelMobile, '/mobile.png');
});

test('visibilitesEnvoyables : envoie une campagne active même hors de sa fenêtre de dates (filtrage reporté au client)', () => {
  const future = visibilite({ id: 'future', pages: ['accueil'], dateDebut: '2099-01-01' });
  const expiree = visibilite({ id: 'expiree', pages: ['accueil'], dateFin: '2020-01-01' });
  const permanente = visibilite({ id: 'permanente', pages: ['accueil'] });
  const desactivee = visibilite({ id: 'desactivee', pages: ['accueil'], actif: false });
  const mauvaisePage = visibilite({ id: 'ailleurs', pages: ['offres'] });

  const envoyables = visibilitesEnvoyables(
    [future, expiree, permanente, desactivee, mauvaisePage],
    { page: 'accueil', emplacement: 'principal' },
  );

  assert.deepEqual(
    envoyables.map((v) => v.id).sort(),
    ['future', 'expiree', 'permanente'].sort(),
  );
});

test('statutVisibilite : cohérent avec estDansPeriode à la même date de référence', () => {
  const casTest = [
    { dateDebut: undefined, dateFin: undefined, maintenant: new Date('2026-08-09') },
    { dateDebut: '2026-01-01', dateFin: '2026-12-31', maintenant: new Date('2026-08-09') },
    { dateDebut: '2099-01-01', dateFin: undefined, maintenant: new Date('2026-08-09') },
    { dateDebut: undefined, dateFin: '2020-01-01', maintenant: new Date('2026-08-09') },
  ];
  for (const { dateDebut, dateFin, maintenant } of casTest) {
    const v = visibilite({ dateDebut, dateFin });
    const dateDebutObj = dateDebut ? new Date(dateDebut) : undefined;
    const dateFinObj = dateFin ? new Date(dateFin) : undefined;
    const dansLaPeriode = estDansPeriode(dateDebutObj, dateFinObj, maintenant);
    const statut = statutVisibilite(v, maintenant);
    assert.equal(statut === 'actif', dansLaPeriode, `dateDebut=${dateDebut} dateFin=${dateFin} maintenant=${maintenant}`);
  }
});

test('calculerStatut : même résultat que statutVisibilite(v) — réutilisée par /admin/visibilite côté client', () => {
  const casTest = [
    { actif: true, dateDebut: undefined, dateFin: undefined },
    { actif: true, dateDebut: '2026-01-01', dateFin: '2026-12-31' },
    { actif: true, dateDebut: '2099-01-01', dateFin: undefined },
    { actif: true, dateDebut: undefined, dateFin: '2020-01-01' },
    // actif=false l'emporte, même avec des dates qui seraient sinon "actif".
    { actif: false, dateDebut: '2020-01-01', dateFin: '2099-01-01' },
  ];
  const maintenant = new Date('2026-08-09');
  for (const { actif, dateDebut, dateFin } of casTest) {
    const v = visibilite({ actif, dateDebut, dateFin });
    const dateDebutObj = dateDebut ? new Date(dateDebut) : undefined;
    const dateFinObj = dateFin ? new Date(dateFin) : undefined;
    assert.equal(
      calculerStatut(actif, dateDebutObj, dateFinObj, maintenant),
      statutVisibilite(v, maintenant),
      `actif=${actif} dateDebut=${dateDebut} dateFin=${dateFin}`,
    );
  }
});

test('calculerStatut : actif=false prime sur des dates qui seraient sinon "actif" (indépendance du levier manuel)', () => {
  const maintenant = new Date('2026-08-09');
  assert.equal(calculerStatut(false, new Date('2020-01-01'), new Date('2099-01-01'), maintenant), 'desactive');
});

/*
  Sûreté des URL de campagne (audit sécurité, constat n°1) - miroir testé de
  estUrlVisibiliteSure(). La même règle existe en PHP
  (public/api/_visibilites-lib.php), couverte par scripts/visibilites-api.test.mjs.
*/
test('estUrlVisibiliteSure accepte http, https et les chemins internes', () => {
  for (const url of [
    'https://exemple.nc/campagne',
    'http://exemple.nc',
    'HTTPS://EXEMPLE.NC',
    '/visuels/banniere.png',
    '/exposants?filtre=x#ancre',
  ]) {
    assert.equal(estUrlVisibiliteSure(url), true, url);
  }
});

test('estUrlVisibiliteSure refuse les schémas exécutables', () => {
  for (const url of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\u0009script:alert(1)',
    ' javascript:alert(1)',
    '\u0001javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'file:///etc/passwd',
  ]) {
    assert.equal(estUrlVisibiliteSure(url), false, url);
  }
});

test('estUrlVisibiliteSure refuse les URL protocol-relative (domaine tiers déguisé)', () => {
  assert.equal(estUrlVisibiliteSure('//exemple-malveillant.tld/x'), false);
  assert.equal(estUrlVisibiliteSure('/\/exemple-malveillant.tld'), false);
});

test('estUrlVisibiliteSure refuse le vide et les valeurs non-chaîne', () => {
  for (const valeur of ['', '   ', undefined, null, 42, {}, []]) {
    assert.equal(estUrlVisibiliteSure(valeur), false, String(valeur));
  }
});

test('estUrlVisibiliteSure refuse une URL relative sans slash initial', () => {
  // Ambigu et jamais produit par l'Admin : on exige un chemin absolu.
  assert.equal(estUrlVisibiliteSure('exemple.nc/page'), false);
});
