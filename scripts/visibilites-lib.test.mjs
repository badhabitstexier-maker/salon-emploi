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
