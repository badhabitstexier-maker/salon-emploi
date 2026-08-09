/*
  Tests unitaires du pipeline d'import des offres (Lot 3). Utilise le
  testeur intégré à Node (`node --test`, alias `npm run offres:test`) —
  aucune dépendance de test supplémentaire.

  Couvre les scénarios listés dans la mission Lot 3, section 19, sur la
  logique pure de scripts/lib/offres-import-core.mjs (pas d'accès disque ici
  — voir la section « bout en bout » du compte rendu de PR pour le test
  manuel avec de vrais fichiers).
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validerLigne,
  ligneEstVide,
  assignerReferencesManquantes,
  detecterDoublonsReferences,
  verifierQuotas,
  verifierExposantsConnus,
  verifierFormuleCoherente,
  genererContenuOffre,
} from './lib/offres-import-core.mjs';

function ligneValide(overrides = {}) {
  return {
    reference: 'SEF26-001',
    status: 'publiee',
    intitule: 'Technicien de maintenance',
    exposantId: 'EXP26-001',
    exposantNom: 'Exemple Structure',
    formule: 'standard',
    secteur: 'Maintenance',
    typeContrat: 'CDI',
    lieu: 'Nouméa',
    nombrePostes: '2',
    datePrisePoste: '',
    niveauFormation: '',
    niveauExperience: 'Débutant accepté',
    sansExperience: 'oui',
    descriptionCourte: 'Une offre fictive pour les tests.',
    missions: '',
    competencesPrerequis: '',
    accepteCandidaturesEnLigne: 'oui',
    datePublication: '2026-09-01',
    dateCloture: '2026-10-20',
    miseEnAvant: '',
    ...overrides,
  };
}

test('1. une offre standard valide passe la validation', () => {
  const r = validerLigne(ligneValide(), 2);
  assert.equal(r.ok, true);
  assert.equal(r.offre.reference, 'SEF26-001');
});

test('2-3. quota standard : 5 offres passent, 6 offres échouent', () => {
  const cinq = Array.from({ length: 5 }, (_, i) => ({
    reference: `SEF26-${String(i + 1).padStart(3, '0')}`,
    status: 'publiee',
    exposantId: 'exemple-structure',
    formule: 'standard',
  }));
  assert.equal(verifierQuotas(cinq, []).erreurs.length, 0);

  const six = [
    ...cinq,
    { reference: 'SEF26-006', status: 'publiee', exposantId: 'exemple-structure', formule: 'standard' },
  ];
  const resultat = verifierQuotas(six, []);
  assert.equal(resultat.erreurs.length, 1);
  assert.match(resultat.erreurs[0], /plafond 5 dépassé/);
});

test('4-5. quota silver : 10 offres passent, 11 offres échouent', () => {
  const dix = Array.from({ length: 10 }, (_, i) => ({
    reference: `SEF26-${String(i + 1).padStart(3, '0')}`,
    status: 'publiee',
    exposantId: 'exposant-silver',
    formule: 'silver',
  }));
  assert.equal(verifierQuotas(dix, []).erreurs.length, 0);

  const onze = [
    ...dix,
    { reference: 'SEF26-011', status: 'publiee', exposantId: 'exposant-silver', formule: 'silver' },
  ];
  const resultat = verifierQuotas(onze, []);
  assert.equal(resultat.erreurs.length, 1);
  assert.match(resultat.erreurs[0], /plafond 10 dépassé/);
});

test('6. plus de 10 offres gold : accepté structurellement, avertissement seulement', () => {
  const onze = Array.from({ length: 11 }, (_, i) => ({
    reference: `SEF26-${String(i + 1).padStart(3, '0')}`,
    status: 'publiee',
    exposantId: 'exposant-gold',
    formule: 'gold',
  }));
  const resultat = verifierQuotas(onze, []);
  assert.equal(resultat.erreurs.length, 0);
  assert.equal(resultat.avertissements.length, 1);
});

test('7. référence dupliquée détectée', () => {
  const doublons = detecterDoublonsReferences([
    { reference: 'SEF26-001' },
    { reference: 'SEF26-002' },
    { reference: 'SEF26-001' },
  ]);
  assert.equal(doublons.length, 1);
  assert.equal(doublons[0].reference, 'SEF26-001');
});

test('8. référence mal formée refusée', () => {
  const r = validerLigne(ligneValide({ reference: 'SEF-1' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /mal formée/.test(e)));
});

test('9. intitulé vide : la ligne est traitée comme un bloc non déclaré', () => {
  assert.equal(ligneEstVide(ligneValide({ intitule: '' })), true);
  assert.equal(ligneEstVide(ligneValide()), false);
});

test('10. type de contrat invalide refusé', () => {
  const r = validerLigne(ligneValide({ typeContrat: 'Bénévolat' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /Type de contrat/.test(e)));
});

test('11. entreprise (exposantNom) manquante refusée', () => {
  const r = validerLigne(ligneValide({ exposantNom: '' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /exposantNom/.test(e)));
});

test('12. offre sans candidature en ligne reste valide', () => {
  const r = validerLigne(ligneValide({ accepteCandidaturesEnLigne: 'non' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.offre.accepteCandidaturesEnLigne, false);
});

test('13. offre non publiée (status = recue) reste valide', () => {
  const r = validerLigne(ligneValide({ status: 'recue' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.offre.status, 'recue');
});

test('14. réimport du même CSV : contenu généré strictement identique (idempotent)', () => {
  const r1 = validerLigne(ligneValide(), 2);
  const r2 = validerLigne(ligneValide(), 2);
  assert.equal(genererContenuOffre(r1.offre), genererContenuOffre(r2.offre));
});

test('15. modification d’une offre existante : le contenu généré change en conséquence', () => {
  const r1 = validerLigne(ligneValide(), 2).offre;
  const r2 = validerLigne(ligneValide({ intitule: 'Technicien de maintenance senior' }), 2).offre;
  assert.notEqual(genererContenuOffre(r1), genererContenuOffre(r2));
});

test('références manquantes assignées de façon séquentielle et déterministe', () => {
  const offres = [
    { reference: null, intitule: 'Offre A', __numeroLigne: 2 },
    { reference: null, intitule: 'Offre B', __numeroLigne: 3 },
  ];
  const journal = assignerReferencesManquantes(offres, ['SEF26-003']);
  assert.equal(offres[0].reference, 'SEF26-004');
  assert.equal(offres[1].reference, 'SEF26-005');
  assert.equal(journal.length, 2);
});

test('formule incohérente pour un même exposant est une erreur', () => {
  const offres = [
    { reference: 'SEF26-001', status: 'publiee', exposantId: 'x', formule: 'standard' },
    { reference: 'SEF26-002', status: 'publiee', exposantId: 'x', formule: 'silver' },
  ];
  const resultat = verifierQuotas(offres, []);
  assert.equal(resultat.erreurs.length, 1);
  assert.match(resultat.erreurs[0], /formule incohérente/);
});

test('offre sans dateCloture est valide (champ facultatif, jamais inventé)', () => {
  const r = validerLigne(ligneValide({ dateCloture: '' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.offre.dateCloture, undefined);
  assert.equal(r.avertissements.length, 0);
});

test('offre avec dateCloture correcte est valide', () => {
  const r = validerLigne(ligneValide({ dateCloture: '2026-10-20' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.offre.dateCloture, '2026-10-20');
});

test('dateCloture mal formatée est une erreur', () => {
  const r = validerLigne(ligneValide({ dateCloture: '20-10-2026' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /dateCloture.*format/.test(e)));
});

test('génération Markdown sans dateCloture : le champ est absent du frontmatter', () => {
  const r = validerLigne(ligneValide({ dateCloture: '' }), 2);
  const contenu = genererContenuOffre(r.offre);
  assert.ok(!/^dateCloture:/m.test(contenu));
});

test('génération Markdown avec dateCloture : le champ est présent dans le frontmatter', () => {
  const r = validerLigne(ligneValide({ dateCloture: '2026-10-20' }), 2);
  const contenu = genererContenuOffre(r.offre);
  assert.ok(/^dateCloture: 2026-10-20$/m.test(contenu));
});

/*
  Lot Admin-1C — exposantId canonique EXP26-XXX pour les offres réelles,
  identifiant TEST séparé pour les offres de démonstration, contrôle croisé
  avec le référentiel exposants, cohérence de `formule`.
*/

test('exposantId réel valide (EXP26-XXX) est accepté', () => {
  const r = validerLigne(ligneValide({ exposantId: 'EXP26-042' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.offre.exposantId, 'EXP26-042');
});

test('exposantId réel absent est une erreur', () => {
  const r = validerLigne(ligneValide({ exposantId: '' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /exposantId/.test(e)));
});

test('exposantId réel mal formé (texte libre) est une erreur', () => {
  const r = validerLigne(ligneValide({ exposantId: 'pacific-industrie' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /exposantId.*EXP26-XXX/.test(e)));
});

test('offre TEST : exposantId n\'est pas soumis au format EXP26-XXX', () => {
  const r = validerLigne(
    ligneValide({ intitule: 'TEST — Offre de démonstration', exposantId: 'TEST-EXPOSANT-NC' }),
    2,
  );
  assert.equal(r.ok, true);
});

test('rattachement exposant/offres sur EXP26-XXX : exposant connu, pas d\'erreur', () => {
  const offres = [{ reference: 'SEF26-001', intitule: 'Technicien', exposantId: 'EXP26-001' }];
  const resultat = verifierExposantsConnus(offres, new Set(['EXP26-001']));
  assert.equal(resultat.erreurs.length, 0);
});

test('rattachement exposant/offres : exposantId inconnu du référentiel est une erreur', () => {
  const offres = [{ reference: 'SEF26-001', intitule: 'Technicien', exposantId: 'EXP26-999' }];
  const resultat = verifierExposantsConnus(offres, new Set(['EXP26-001']));
  assert.equal(resultat.erreurs.length, 1);
  assert.match(resultat.erreurs[0], /EXP26-999.*inconnu/);
});

test('aucun rattachement par nom : deux exposants différents portant le même exposantNom ne sont jamais confondus par exposantId', () => {
  const offres = [{ reference: 'SEF26-001', intitule: 'Technicien', exposantId: 'EXP26-777', exposantNom: 'Pacific Industrie' }];
  // Le référentiel connaît un exposant EXP26-001 avec le même nom affiché, mais un exposantId différent.
  const resultat = verifierExposantsConnus(offres, new Set(['EXP26-001']));
  assert.equal(resultat.erreurs.length, 1);
});

test('référentiel exposants indisponible (null) : contrôle croisé ignoré', () => {
  const offres = [{ reference: 'SEF26-001', intitule: 'Technicien', exposantId: 'EXP26-999' }];
  assert.equal(verifierExposantsConnus(offres, null).erreurs.length, 0);
  assert.equal(verifierFormuleCoherente(offres, null).erreurs.length, 0);
});

test('offre TEST exclue du contrôle croisé exposant connu', () => {
  const offres = [
    { reference: 'SEF26-001', intitule: 'TEST — Offre de démonstration', exposantId: 'TEST-EXPOSANT-NC' },
  ];
  const resultat = verifierExposantsConnus(offres, new Set(['EXP26-001']));
  assert.equal(resultat.erreurs.length, 0);
});

test('formule de l\'offre incohérente avec la formule de l\'exposant est une erreur', () => {
  const offres = [{ reference: 'SEF26-001', intitule: 'Technicien', exposantId: 'EXP26-001', formule: 'gold' }];
  const formuleParExposant = new Map([['EXP26-001', 'standard']]);
  const resultat = verifierFormuleCoherente(offres, formuleParExposant);
  assert.equal(resultat.erreurs.length, 1);
  assert.match(resultat.erreurs[0], /incohérente/);
});

test('formule de l\'offre cohérente avec la formule de l\'exposant : pas d\'erreur', () => {
  const offres = [{ reference: 'SEF26-001', intitule: 'Technicien', exposantId: 'EXP26-001', formule: 'standard' }];
  const formuleParExposant = new Map([['EXP26-001', 'standard']]);
  const resultat = verifierFormuleCoherente(offres, formuleParExposant);
  assert.equal(resultat.erreurs.length, 0);
});

test('offre TEST exclue du contrôle de cohérence formule', () => {
  const offres = [
    { reference: 'SEF26-001', intitule: 'TEST — Offre de démonstration', exposantId: 'TEST-EXPOSANT-NC', formule: 'gold' },
  ];
  const formuleParExposant = new Map([['TEST-EXPOSANT-NC', 'standard']]);
  const resultat = verifierFormuleCoherente(offres, formuleParExposant);
  assert.equal(resultat.erreurs.length, 0);
});
