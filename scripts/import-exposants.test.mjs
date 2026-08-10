/*
  Tests unitaires du pipeline d'import des exposants (Lot 4A). Utilise le
  testeur intégré à Node (`node --test`, alias `npm run exposants:test`).

  Couvre les scénarios de la mission Lot 4A, section 22, sur la logique pure
  de scripts/lib/exposants-import-core.mjs (pas d'accès disque ici).
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validerLigne,
  ligneEstVide,
  rapprocherIdentifiantsParSlug,
  detecterDoublons,
  verifierCapacitesEtStands,
  genererContenuExposant,
} from './lib/exposants-import-core.mjs';
import { assignerIdentifiantsManquants } from './lib/import-shared.mjs';

function ligneValide(overrides = {}) {
  return {
    exposantId: 'EXP26-001',
    slug: 'exemple-structure',
    nom: 'Exemple Structure',
    formule: 'standard',
    univers: 'emploi',
    type_structure: 'entreprise',
    secteurs: 'Industrie|Maintenance',
    // Statut standard par défaut : `description` (présentation longue) reste
    // vide, réservée au statut gold (voir tests dédiés plus bas).
    accroche: 'Une phrase courte pour la carte.',
    description: '',
    logo: '',
    site_web: 'https://exemple.nc',
    numero_stand: 'A1',
    email_public: '',
    telephone_public: '',
    lien_recrutement: '',
    reseaux_sociaux: '',
    image_couverture: '',
    galerie: '',
    demo: 'non',
    mise_en_avant: 'non',
    publie: 'non',
    ordre: '',
    date_mise_a_jour: '',
    metiers: '',
    formations: '',
    opportunites: '',
    mots_cles: '',
    ...overrides,
  };
}

test('1. un exposant valide passe la validation', () => {
  const r = validerLigne(ligneValide(), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.exposantId, 'EXP26-001');
});

test('2. exposantId absent : accepté à la validation de ligne (assigné plus tard)', () => {
  const r = validerLigne(ligneValide({ exposantId: '' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.exposantId, null);
});

test('3. exposantId mal formé refusé', () => {
  const r = validerLigne(ligneValide({ exposantId: 'EXP-1' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /mal formé/.test(e)));
});

test('4. exposantId dupliqué détecté', () => {
  const doublons = detecterDoublons(
    [{ exposantId: 'EXP26-001' }, { exposantId: 'EXP26-002' }, { exposantId: 'EXP26-001' }],
    'exposantId',
  );
  assert.equal(doublons.length, 1);
  assert.equal(doublons[0].valeur, 'EXP26-001');
});

test('5. nom absent refusé', () => {
  const r = validerLigne(ligneValide({ nom: '' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /nom/.test(e)));
});

test('6. slug dupliqué détecté', () => {
  const doublons = detecterDoublons([{ slug: 'a' }, { slug: 'b' }, { slug: 'a' }], 'slug');
  assert.equal(doublons.length, 1);
  assert.equal(doublons[0].valeur, 'a');
});

test('7. hall (univers) inconnu refusé', () => {
  const r = validerLigne(ligneValide({ univers: 'village' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /univers.*hall/.test(e)));
});

test('8. capacité Hall Emploi (21) dépassée détectée', () => {
  const vingtDeux = Array.from({ length: 22 }, (_, i) => ({
    exposantId: `EXP26-${String(i + 1).padStart(3, '0')}`,
    slug: `e${i}`,
    nom: `Exposant ${i}`,
    univers: 'emploi',
  }));
  const resultat = verifierCapacitesEtStands(vingtDeux, []);
  assert.ok(resultat.erreurs.some((e) => /Hall Emploi/.test(e)));
});

test('9. capacité Hall Formation (16) dépassée détectée', () => {
  const dixSept = Array.from({ length: 17 }, (_, i) => ({
    exposantId: `EXP26-${String(i + 1).padStart(3, '0')}`,
    slug: `f${i}`,
    nom: `Exposant ${i}`,
    univers: 'formation',
  }));
  const resultat = verifierCapacitesEtStands(dixSept, []);
  assert.ok(resultat.erreurs.some((e) => /Hall Formation/.test(e)));
});

test('10. total (37) dépassé détecté même si les deux halls sont individuellement sous leur plafond', () => {
  const emploi = Array.from({ length: 21 }, (_, i) => ({
    exposantId: `EXP26-E${i}`,
    slug: `e${i}`,
    nom: `E${i}`,
    univers: 'emploi',
  }));
  const formation = Array.from({ length: 16 }, (_, i) => ({
    exposantId: `EXP26-F${i}`,
    slug: `f${i}`,
    nom: `F${i}`,
    univers: 'formation',
  }));
  // 21 + 16 = 37, pile la capacité totale : aucune erreur attendue.
  assert.equal(verifierCapacitesEtStands([...emploi, ...formation], []).erreurs.length, 0);
});

test('11. stand dupliqué dans un même hall détecté', () => {
  const deux = [
    { exposantId: 'EXP26-001', slug: 'a', nom: 'A', univers: 'emploi', numero_stand: 'A1' },
    { exposantId: 'EXP26-002', slug: 'b', nom: 'B', univers: 'emploi', numero_stand: 'A1' },
  ];
  const resultat = verifierCapacitesEtStands(deux, []);
  assert.ok(resultat.erreurs.some((e) => /Stand « A1 »/.test(e)));
});

test('12. stand non commercialisé (22/23/24) rejeté', () => {
  for (const stand of ['22', '23', '24']) {
    const r = validerLigne(ligneValide({ numero_stand: stand }), 2);
    assert.equal(r.ok, false, `stand ${stand} aurait dû être rejeté`);
    assert.ok(r.erreurs.some((e) => /non commercialisé/.test(e)));
  }
});

test('13. logo déclaré : contrôle de format à la ligne (existence du fichier vérifiée par le CLI, hors de ce module)', () => {
  const r = validerLigne(ligneValide({ logo: '/images/exposants/exemple.svg' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.logo, '/images/exposants/exemple.svg');

  const rInvalide = validerLigne(ligneValide({ logo: '/images/exposants/exemple.docx' }), 2);
  assert.equal(rInvalide.ok, false);
});

test('14. URL (site_web) invalide refusée', () => {
  const r = validerLigne(ligneValide({ site_web: 'exemple.nc' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /site_web/.test(e)));
});

test('15. réimport identique : contenu généré strictement identique (idempotent)', () => {
  const r1 = validerLigne(ligneValide(), 2).exposant;
  const r2 = validerLigne(ligneValide(), 2).exposant;
  assert.equal(genererContenuExposant(r1), genererContenuExposant(r2));
});

test('16. modification d’une fiche existante : le contenu généré change', () => {
  const r1 = validerLigne(ligneValide(), 2).exposant;
  const r2 = validerLigne(ligneValide({ accroche: 'Nouvelle accroche' }), 2).exposant;
  assert.notEqual(genererContenuExposant(r1), genererContenuExposant(r2));
});

test('17. publie=false reste valide', () => {
  const r = validerLigne(ligneValide({ publie: 'non' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.publie, false);
});

test('publie invalide refusé', () => {
  const r = validerLigne(ligneValide({ publie: 'peut-être' }), 2);
  assert.equal(r.ok, false);
});

test('rapprochement par slug : réimport sans exposantId réutilise l’identifiant existant', () => {
  const nouveau = { __numeroLigne: 2, slug: 'exemple-structure', exposantId: null };
  const existantes = [{ exposantId: 'EXP26-005', slug: 'exemple-structure' }];
  const journal = rapprocherIdentifiantsParSlug([nouveau], existantes);
  assert.equal(nouveau.exposantId, 'EXP26-005');
  assert.equal(journal.length, 1);
});

test('identifiants manquants assignés de façon séquentielle et déterministe', () => {
  const exposants = [
    { __numeroLigne: 2, exposantId: null },
    { __numeroLigne: 3, exposantId: null },
  ];
  const journal = assignerIdentifiantsManquants(exposants, ['EXP26-003'], { prefixe: 'EXP26', champId: 'exposantId' });
  assert.equal(exposants[0].exposantId, 'EXP26-004');
  assert.equal(exposants[1].exposantId, 'EXP26-005');
  assert.equal(journal.length, 2);
});

test('ligne vide (nom absent) traitée comme un bloc non déclaré', () => {
  assert.equal(ligneEstVide(ligneValide({ nom: '' })), true);
  assert.equal(ligneEstVide(ligneValide()), false);
});

test('secteurs vide reste valide (liste facultative, peut être vide)', () => {
  const r = validerLigne(ligneValide({ secteurs: '' }), 2);
  assert.equal(r.ok, true);
  assert.deepEqual(r.exposant.secteurs, []);
});

test('génération Markdown : numero_stand absent n’apparaît pas dans le frontmatter', () => {
  const r = validerLigne(ligneValide({ numero_stand: '' }), 2);
  const contenu = genererContenuExposant(r.exposant);
  assert.ok(!/^numero_stand:/m.test(contenu));
});

test('18. formule standard acceptée', () => {
  const r = validerLigne(ligneValide({ formule: 'standard' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.formule, 'standard');
});

test('19. formule silver acceptée', () => {
  const r = validerLigne(ligneValide({ formule: 'silver' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.formule, 'silver');
});

test('20. formule gold acceptée', () => {
  const r = validerLigne(ligneValide({ formule: 'gold' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.formule, 'gold');
});

test('21. formule invalide refusée', () => {
  const r = validerLigne(ligneValide({ formule: 'platine' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /formule/.test(e)));
});

test('22. formule absente refusée (colonne obligatoire)', () => {
  const r = validerLigne(ligneValide({ formule: '' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /« formule » manquante ou vide/.test(e)));
});

test('23. génération Markdown : formule présente dans le frontmatter généré', () => {
  const r = validerLigne(ligneValide({ formule: 'gold' }), 2);
  const contenu = genererContenuExposant(r.exposant);
  assert.ok(/^formule: "gold"$/m.test(contenu));
});

// ---- Statuts commerciaux différenciés (Lot « exposants-statuts ») ----

test('24. présentation courte trop longue pour le statut standard refusée (> 300 caractères)', () => {
  const r = validerLigne(ligneValide({ formule: 'standard', accroche: 'a'.repeat(301) }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /trop longue/.test(e)));
});

test('25. présentation courte de 300 caractères acceptée pour le statut standard', () => {
  const r = validerLigne(ligneValide({ formule: 'standard', accroche: 'a'.repeat(300) }), 2);
  assert.equal(r.ok, true);
});

test('26. présentation courte de 500 caractères acceptée pour le statut silver', () => {
  const r = validerLigne(ligneValide({ formule: 'silver', accroche: 'a'.repeat(500) }), 2);
  assert.equal(r.ok, true);
});

test('27. présentation courte de 501 caractères refusée pour le statut gold', () => {
  const r = validerLigne(ligneValide({ formule: 'gold', accroche: 'a'.repeat(501) }), 2);
  assert.equal(r.ok, false);
});

test('28. présentation longue (description) refusée pour le statut standard', () => {
  const r = validerLigne(ligneValide({ formule: 'standard', description: 'Un texte long.' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /présentation longue/.test(e)));
});

test('29. présentation longue acceptée pour le statut gold', () => {
  const r = validerLigne(ligneValide({ formule: 'gold', description: 'Un texte long.' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.description, 'Un texte long.');
});

test('30. lien_recrutement refusé pour le statut standard', () => {
  const r = validerLigne(ligneValide({ formule: 'standard', lien_recrutement: 'https://exemple.nc/recrutement' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /lien_recrutement/.test(e)));
});

test('31. lien_recrutement accepté pour le statut silver', () => {
  const r = validerLigne(ligneValide({ formule: 'silver', lien_recrutement: 'https://exemple.nc/recrutement' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.lien_recrutement, 'https://exemple.nc/recrutement');
});

test('32. reseaux_sociaux parsés correctement (plateforme:url séparés par |)', () => {
  const r = validerLigne(
    ligneValide({ formule: 'gold', reseaux_sociaux: 'facebook:https://facebook.com/x|linkedin:https://linkedin.com/company/x' }),
    2,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.exposant.reseaux_sociaux, [
    { plateforme: 'facebook', url: 'https://facebook.com/x' },
    { plateforme: 'linkedin', url: 'https://linkedin.com/company/x' },
  ]);
});

test('33. reseaux_sociaux refusé pour le statut standard', () => {
  const r = validerLigne(ligneValide({ formule: 'standard', reseaux_sociaux: 'facebook:https://facebook.com/x' }), 2);
  assert.equal(r.ok, false);
});

test('34. plateforme de réseau social inconnue refusée', () => {
  const r = validerLigne(ligneValide({ formule: 'gold', reseaux_sociaux: 'mastodon:https://exemple.nc' }), 2);
  assert.equal(r.ok, false);
});

test('35. image_couverture refusée pour le statut silver (réservée gold)', () => {
  const r = validerLigne(ligneValide({ formule: 'silver', image_couverture: '/images/exposants/couverture.webp' }), 2);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /image_couverture/.test(e)));
});

test('36. image_couverture acceptée pour le statut gold', () => {
  const r = validerLigne(ligneValide({ formule: 'gold', image_couverture: '/images/exposants/couverture.webp' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.image_couverture, '/images/exposants/couverture.webp');
});

test('37. galerie parsée correctement (src::alt séparés par |), réservée au statut gold', () => {
  const r = validerLigne(
    ligneValide({
      formule: 'gold',
      galerie: '/images/exposants/g1.webp::Vue du stand|/images/exposants/g2.webp::Équipe sur le salon',
    }),
    2,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.exposant.galerie, [
    { src: '/images/exposants/g1.webp', alt: 'Vue du stand' },
    { src: '/images/exposants/g2.webp', alt: 'Équipe sur le salon' },
  ]);
});

test('38. galerie refusée pour le statut standard', () => {
  const r = validerLigne(ligneValide({ formule: 'standard', galerie: '/images/exposants/g1.webp::Vue du stand' }), 2);
  assert.equal(r.ok, false);
});

test('39. entrée de galerie sans texte alternatif refusée', () => {
  const r = validerLigne(ligneValide({ formule: 'gold', galerie: '/images/exposants/g1.webp::' }), 2);
  assert.equal(r.ok, false);
});

test('40. demo=oui accepté et reporté tel quel', () => {
  const r = validerLigne(ligneValide({ demo: 'oui' }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.exposant.demo, true);
});

test('41. génération Markdown : demo, reseaux_sociaux et galerie présents dans le frontmatter (statut gold)', () => {
  const r = validerLigne(
    ligneValide({
      formule: 'gold',
      demo: 'oui',
      description: 'Présentation longue de test.',
      lien_recrutement: 'https://exemple.nc/recrutement',
      reseaux_sociaux: 'facebook:https://facebook.com/x',
      image_couverture: '/images/exposants/couverture.webp',
      galerie: '/images/exposants/g1.webp::Vue du stand',
    }),
    2,
  );
  const contenu = genererContenuExposant(r.exposant);
  assert.ok(/^demo: true$/m.test(contenu));
  assert.ok(/^lien_recrutement: "https:\/\/exemple\.nc\/recrutement"$/m.test(contenu));
  assert.ok(/^reseaux_sociaux:$/m.test(contenu));
  assert.ok(/plateforme: "facebook"/.test(contenu));
  assert.ok(/^image_couverture: "\/images\/exposants\/couverture\.webp"$/m.test(contenu));
  assert.ok(/^galerie:$/m.test(contenu));
  assert.ok(/alt: "Vue du stand"/.test(contenu));
});

test('42. génération Markdown : description absente n’apparaît pas pour un statut standard', () => {
  const r = validerLigne(ligneValide({ formule: 'standard' }), 2);
  const contenu = genererContenuExposant(r.exposant);
  assert.ok(!/^description:/m.test(contenu));
});
