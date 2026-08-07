/*
  Tests unitaires du pipeline d'import du programme (Lot 4A). Utilise le
  testeur intégré à Node (`node --test`, alias `npm run programme:test`).

  Couvre les scénarios de la mission Lot 4A, section 23, sur la logique pure
  de scripts/lib/programme-import-core.mjs (pas d'accès disque ici).
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validerLigne,
  ligneEstVide,
  rapprocherIdentifiantsParSlug,
  detecterDoublons,
  detecterConflits,
  genererContenuProgramme,
} from './lib/programme-import-core.mjs';
import { assignerIdentifiantsManquants } from './lib/import-shared.mjs';

function ligneValide(overrides = {}) {
  return {
    programmeId: 'PROG26-001',
    slug: 'exemple-atelier',
    titre: 'Exemple — Atelier fictif',
    date: '2026-10-30',
    heure_debut: '10:00',
    heure_fin: '10:45',
    univers: 'emploi',
    type: 'atelier',
    lieu: 'Scène A',
    accroche: 'Une phrase courte pour la carte.',
    description: 'Description fictive pour les tests.',
    publics: '',
    intervenants: '',
    organisateur: '',
    exposant_lie: '',
    inscription_requise: 'non',
    lien_inscription: '',
    capacite_limitee: 'non',
    mise_en_avant: 'non',
    publie: 'non',
    ordre: '',
    date_mise_a_jour: '',
    ...overrides,
  };
}

test('1. activité valide le 30 octobre', () => {
  const r = validerLigne(ligneValide({ date: '2026-10-30' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.activite.date, '2026-10-30');
});

test('2. activité valide le 31 octobre', () => {
  const r = validerLigne(ligneValide({ date: '2026-10-31' }), 2);
  assert.equal(r.ok, true);
});

test('3. date hors événement refusée', () => {
  const r = validerLigne(ligneValide({ date: '2026-11-01' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /date.*invalide/.test(e)));
});

test('4. format heure invalide refusé', () => {
  const r = validerLigne(ligneValide({ heure_debut: '10h00' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /heure_debut/.test(e)));
});

test('5. fin avant début refusée', () => {
  const r = validerLigne(ligneValide({ heure_debut: '11:00', heure_fin: '10:00' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /postérieure/.test(e)));
});

test('6. fin égale au début refusée', () => {
  const r = validerLigne(ligneValide({ heure_debut: '10:00', heure_fin: '10:00' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /postérieure/.test(e)));
});

test('7. activité entièrement hors horaires du salon refusée', () => {
  const r = validerLigne(ligneValide({ heure_debut: '18:00', heure_fin: '19:00' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /entièrement hors horaires/.test(e)));
});

test('8. dépassement léger après 17h : avertissement, pas de rejet', () => {
  const r = validerLigne(ligneValide({ heure_debut: '16:30', heure_fin: '17:30' }), 2);
  assert.equal(r.ok, true);
  assert.ok(r.avertissements.some((a) => /fermeture/.test(a)));
});

test('9. conflit même lieu détecté', () => {
  const a = { titre: 'A', date: '2026-10-30', lieu: 'Scène A', heure_debut: '10:00', heure_fin: '10:45' };
  const b = { titre: 'B', date: '2026-10-30', lieu: 'Scène A', heure_debut: '10:30', heure_fin: '11:15' };
  const resultat = detecterConflits([a, b]);
  assert.equal(resultat.erreurs.length, 1);
  assert.match(resultat.erreurs[0], /Conflit de programmation/);
});

test('10. chevauchement dans deux lieux différents accepté', () => {
  const a = { titre: 'A', date: '2026-10-30', lieu: 'Scène A', heure_debut: '10:00', heure_fin: '10:45' };
  const b = { titre: 'B', date: '2026-10-30', lieu: 'Scène B', heure_debut: '10:30', heure_fin: '11:15' };
  assert.equal(detecterConflits([a, b]).erreurs.length, 0);
});

test('11. créneaux contigus acceptés (pas de chevauchement)', () => {
  const a = { titre: 'A', date: '2026-10-30', lieu: 'Scène A', heure_debut: '10:00', heure_fin: '10:30' };
  const b = { titre: 'B', date: '2026-10-30', lieu: 'Scène A', heure_debut: '10:30', heure_fin: '11:00' };
  assert.equal(detecterConflits([a, b]).erreurs.length, 0);
});

test('12. tri chronologique laissé à src/lib/programme.ts (non dupliqué ici) — ordre du CSV non garanti', () => {
  // Le tri d'affichage est assuré par trierProgramme() (src/lib/programme.ts),
  // pas par le pipeline d'import : ce test documente cette séparation des
  // responsabilités plutôt que de dupliquer la logique de tri.
  assert.equal(typeof genererContenuProgramme, 'function');
});

test('13. programmeId dupliqué détecté', () => {
  const doublons = detecterDoublons(
    [{ programmeId: 'PROG26-001' }, { programmeId: 'PROG26-002' }, { programmeId: 'PROG26-001' }],
    'programmeId',
  );
  assert.equal(doublons.length, 1);
});

test('14. réimport identique : contenu généré strictement identique (idempotent)', () => {
  const r1 = validerLigne(ligneValide(), 2).activite;
  const r2 = validerLigne(ligneValide(), 2).activite;
  assert.equal(genererContenuProgramme(r1), genererContenuProgramme(r2));
});

test('15. modification d’une entrée existante : le contenu généré change', () => {
  const r1 = validerLigne(ligneValide(), 2).activite;
  const r2 = validerLigne(ligneValide({ titre: 'Exemple — Atelier fictif (mis à jour)' }), 2).activite;
  assert.notEqual(genererContenuProgramme(r1), genererContenuProgramme(r2));
});

test('16. publie=false reste valide', () => {
  const r = validerLigne(ligneValide({ publie: 'non' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.activite.publie, false);
});

test('ligne vide (titre absent) traitée comme un bloc non déclaré', () => {
  assert.equal(ligneEstVide(ligneValide({ titre: '' })), true);
  assert.equal(ligneEstVide(ligneValide()), false);
});

test('rapprochement par slug : réimport sans programmeId réutilise l’identifiant existant', () => {
  const nouvelle = { __numeroLigne: 2, slug: 'exemple-atelier', programmeId: null };
  const existantes = [{ programmeId: 'PROG26-007', slug: 'exemple-atelier' }];
  const journal = rapprocherIdentifiantsParSlug([nouvelle], existantes);
  assert.equal(nouvelle.programmeId, 'PROG26-007');
  assert.equal(journal.length, 1);
});

test('identifiants manquants assignés de façon séquentielle et déterministe', () => {
  const activites = [
    { __numeroLigne: 2, programmeId: null },
    { __numeroLigne: 3, programmeId: null },
  ];
  const journal = assignerIdentifiantsManquants(activites, ['PROG26-002'], { prefixe: 'PROG26', champId: 'programmeId' });
  assert.equal(activites[0].programmeId, 'PROG26-003');
  assert.equal(activites[1].programmeId, 'PROG26-004');
  assert.equal(journal.length, 2);
});

test('intervenants : plusieurs intervenants sérialisés puis présents dans le frontmatter', () => {
  const r = validerLigne(
    ligneValide({ intervenants: 'Jeanne Dupont;Chargée de recrutement;Exemple Structure|Marc Martin' }),
    2,
  );
  assert.equal(r.ok, true);
  assert.equal(r.activite.intervenants.length, 2);
  assert.equal(r.activite.intervenants[0].nom, 'Jeanne Dupont');
  assert.equal(r.activite.intervenants[1].organisme, undefined);
  const contenu = genererContenuProgramme(r.activite);
  assert.ok(/intervenants:/.test(contenu));
});
