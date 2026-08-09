/*
  Tests unitaires du moteur pur de visibilité publicitaire (Lot Admin-2, voir
  docs/VISIBILITE.md). Utilise le testeur intégré à Node (`node --test`,
  alias `npm run visibilites:test`) — même principe que
  scripts/import-offres.test.mjs : aucune dépendance de test supplémentaire,
  import direct de src/lib/visibilites.ts (les imports de type
  `astro:content` y sont uniquement des imports de type, éliminés par le
  décapage TypeScript natif de Node, donc aucune résolution de module réelle
  n'est nécessaire ici).

  Couvre les scénarios listés dans le cadrage Admin-2, section 17 : statuts
  (actif/à venir/expiré/désactivé), éligibilité (page/emplacement/dates),
  sélection pondérée déterministe, indépendance formule/poids.
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  statutVisibilite,
  estEligible,
  visibilitesEligibles,
  visibilitesEnvoyables,
  estDansPeriode,
  estDansPeriodeResume,
  visibiliteResume,
  selectionnerPonderee,
} from '../src/lib/visibilites.ts';

/** Fabrique une fausse entrée de collection (id + data), avec des valeurs par défaut raisonnables. */
function visibilite(overrides = {}) {
  return {
    id: overrides.id ?? 'fixture',
    collection: 'visibilites',
    data: {
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
      ...overrides.data,
    },
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
  const v = visibilite({ data: { actif: false, dateDebut: new Date('2020-01-01'), dateFin: new Date('2099-01-01') } });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'desactive');
});

test('statutVisibilite : dateDebut future -> a-venir', () => {
  const v = visibilite({ data: { dateDebut: new Date('2099-01-01') } });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'a-venir');
});

test('statutVisibilite : dateFin passée -> expire', () => {
  const v = visibilite({ data: { dateFin: new Date('2020-01-01') } });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'expire');
});

test('statutVisibilite : maintenant entre dateDebut et dateFin -> actif', () => {
  const v = visibilite({ data: { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') } });
  assert.equal(statutVisibilite(v, new Date('2026-08-09')), 'actif');
});

// ---------------------------------------------------------------------------
// estEligible / visibilitesEligibles
// ---------------------------------------------------------------------------

test('estEligible : refuse une page non couverte', () => {
  const v = visibilite({ data: { pages: ['offres'] } });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), false);
});

test('estEligible : refuse un emplacement différent', () => {
  const v = visibilite({ data: { emplacement: 'secondaire' } });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), false);
});

test('estEligible : refuse une visibilité désactivée, expirée ou à venir', () => {
  assert.equal(estEligible(visibilite({ data: { actif: false } }), { page: 'accueil', emplacement: 'principal' }), false);
  assert.equal(
    estEligible(visibilite({ data: { dateFin: new Date('2020-01-01') } }), { page: 'accueil', emplacement: 'principal' }, new Date('2026-08-09')),
    false,
  );
  assert.equal(
    estEligible(visibilite({ data: { dateDebut: new Date('2099-01-01') } }), { page: 'accueil', emplacement: 'principal' }, new Date('2026-08-09')),
    false,
  );
});

test('estEligible : accepte un annonceur externe sans exposantId', () => {
  const v = visibilite({ data: { typeAnnonceur: 'annonceur_externe', exposantId: undefined } });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), true);
});

test('estEligible : accepte un exposant, quelle que soit sa formule (le moteur ne lit jamais `formule`)', () => {
  // La collection `visibilites` ne porte d'ailleurs aucun champ `formule` —
  // seul `exposantId` existe ; ce test vérifie que rien ne dépend d'une
  // valeur qui n'est même pas présente dans le schéma.
  const v = visibilite({ data: { typeAnnonceur: 'exposant', exposantId: 'EXP26-001' } });
  assert.equal(estEligible(v, { page: 'accueil', emplacement: 'principal' }), true);
});

test('visibilitesEligibles : filtre une liste sur page + emplacement + statut', () => {
  const liste = [
    visibilite({ id: 'a', data: { pages: ['accueil'] } }), // éligible
    visibilite({ id: 'b', data: { pages: ['offres'] } }), // mauvaise page
    visibilite({ id: 'c', data: { pages: ['accueil'], actif: false } }), // désactivée
    visibilite({ id: 'd', data: { pages: ['accueil'], emplacement: 'secondaire' } }), // mauvais emplacement
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
  // rng() = 0    -> tirage = 0    -> 0 - 1 = -1 < 0 -> 'leger'
  assert.equal(selectionnerPonderee(candidats, () => 0).id, 'leger');
  // rng() = 0.24 -> tirage = 0.96 -> 0.96 - 1 = -0.04 < 0 -> 'leger'
  assert.equal(selectionnerPonderee(candidats, () => 0.24).id, 'leger');
  // rng() = 0.26 -> tirage = 1.04 -> 1.04 - 1 = 0.04 (pas <0) -> 0.04 - 3 = -2.96 < 0 -> 'lourd'
  assert.equal(selectionnerPonderee(candidats, () => 0.26).id, 'lourd');
  // rng() proche de 1 -> tout au bout -> 'lourd'
  assert.equal(selectionnerPonderee(candidats, () => 0.999).id, 'lourd');
});

test('selectionnerPonderee : le poids seul pilote le tirage, aucun autre champ (ex. type/formule) n\'intervient', () => {
  const candidats = [
    { id: 'a', poids: 1, typeAnnonceur: 'exposant', formule: 'gold' },
    { id: 'b', poids: 1, typeAnnonceur: 'annonceur_externe' },
  ];
  // Poids égaux malgré des « statuts » très différents (gold vs externe) :
  // à rng identique de part et d'autre de la frontière, chacun a sa chance.
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
  // Même visibilité, seule la date de référence (« maintenant ») change —
  // aucune donnée ni aucun rebuild n'intervient entre les deux appels : ce
  // qui change, c'est l'heure à laquelle le navigateur du visiteur charge
  // la page.
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

test('estDansPeriodeResume : applique la même règle à un résumé sérialisé (dates en ISO, comme reçu du JSON client)', () => {
  const v = visibilite({ data: { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') } });
  const resume = visibiliteResume(v);
  assert.equal(typeof resume.dateDebut, 'string');
  assert.equal(typeof resume.dateFin, 'string');
  assert.equal(estDansPeriodeResume(resume, new Date('2026-06-01')), true);
  assert.equal(estDansPeriodeResume(resume, new Date('2020-01-01')), false);
  assert.equal(estDansPeriodeResume(resume, new Date('2027-01-01')), false);
});

test('visibiliteResume : n\'expose aucune donnée interne (nomInterne, typeAnnonceur, exposantId absents du résumé public)', () => {
  const v = visibilite({
    data: {
      nomInterne: 'Nom réservé LabEvents — jamais public',
      typeAnnonceur: 'exposant',
      exposantId: 'EXP26-001',
    },
  });
  const resume = visibiliteResume(v);
  assert.deepEqual(Object.keys(resume).sort(), ['alt', 'annonceur', 'dateDebut', 'dateFin', 'id', 'lien', 'poids', 'visuel'].sort());
  assert.equal('nomInterne' in resume, false);
  assert.equal('typeAnnonceur' in resume, false);
  assert.equal('exposantId' in resume, false);
});

test('visibilitesEnvoyables : envoie une campagne active même hors de sa fenêtre de dates (filtrage reporté au client)', () => {
  const future = visibilite({ id: 'future', data: { pages: ['accueil'], dateDebut: new Date('2099-01-01') } });
  const expiree = visibilite({ id: 'expiree', data: { pages: ['accueil'], dateFin: new Date('2020-01-01') } });
  const permanente = visibilite({ id: 'permanente', data: { pages: ['accueil'] } });
  const desactivee = visibilite({ id: 'desactivee', data: { pages: ['accueil'], actif: false } });
  const mauvaisePage = visibilite({ id: 'ailleurs', data: { pages: ['offres'] } });

  const envoyables = visibilitesEnvoyables(
    [future, expiree, permanente, desactivee, mauvaisePage],
    { page: 'accueil', emplacement: 'principal' },
  );

  // `future` et `expiree` sont envoyées quand même : c'est au navigateur du
  // visiteur de trancher via estDansPeriode/estDansPeriodeResume au
  // chargement. Seules `actif: false` et la mauvaise page sont exclues au
  // build — ce sont des leviers manuels, pas des dates.
  assert.deepEqual(
    envoyables.map((v) => v.id).sort(),
    ['future', 'expiree', 'permanente'].sort(),
  );
});

test('statutVisibilite : cohérent avec estDansPeriode à la même date de référence', () => {
  const casTest = [
    { dateDebut: undefined, dateFin: undefined, maintenant: new Date('2026-08-09') },
    { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), maintenant: new Date('2026-08-09') },
    { dateDebut: new Date('2099-01-01'), dateFin: undefined, maintenant: new Date('2026-08-09') },
    { dateDebut: undefined, dateFin: new Date('2020-01-01'), maintenant: new Date('2026-08-09') },
  ];
  for (const { dateDebut, dateFin, maintenant } of casTest) {
    const v = visibilite({ data: { dateDebut, dateFin } });
    const dansLaPeriode = estDansPeriode(dateDebut, dateFin, maintenant);
    const statut = statutVisibilite(v, maintenant);
    assert.equal(statut === 'actif', dansLaPeriode, `dateDebut=${dateDebut} dateFin=${dateFin} maintenant=${maintenant}`);
  }
});
