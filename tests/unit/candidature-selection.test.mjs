/*
  Tests unitaires purs (sans DOM) de la logique de sélection d'offres —
  Lot 4B, section 15 de la mission (« Ma sélection »). Complète les tests E2E
  (tests/e2e/selection-candidater.spec.ts), qui ne peuvent pas facilement
  déclencher le plafond de cinq offres avec seulement trois fixtures d'offres.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SELECTION,
  lireSelection,
  filtrerReferencesConnues,
  ajouterReference,
  retirerReference,
  appliquerSelectionAlUrl,
  appliquerOrientationAlUrl,
  hrefAvecSelection,
  hrefVersCandidater,
  estOrientationDemandee,
  construireUrlTally,
  convertirEnUrlEmbedTally,
} from '../../src/lib/candidature-selection.ts';

test('lireSelection : lit offre1..offre5, ignore les valeurs vides, déduplique, plafonne à 5', () => {
  const params = new URLSearchParams({ offre1: 'A', offre2: '', offre3: 'A', offre4: 'B' });
  assert.deepEqual(lireSelection(params), ['A', 'B']);
});

test('lireSelection : au-delà de 5 paramètres, seuls les 5 premiers slots existent', () => {
  const params = new URLSearchParams();
  ['A', 'B', 'C', 'D', 'E'].forEach((ref, i) => params.set(`offre${i + 1}`, ref));
  assert.equal(lireSelection(params).length, MAX_SELECTION);
});

test('ajouterReference : ajoute une nouvelle référence en fin de sélection', () => {
  const resultat = ajouterReference(['A'], 'B');
  assert.deepEqual(resultat, { selection: ['A', 'B'], ajoutee: true, limiteAtteinte: false });
});

test('ajouterReference : une référence déjà présente n’est pas dupliquée', () => {
  const resultat = ajouterReference(['A', 'B'], 'A');
  assert.equal(resultat.ajoutee, false);
  assert.deepEqual(resultat.selection, ['A', 'B']);
});

test('ajouterReference : refuse l’ajout au-delà de 5 offres (limiteAtteinte)', () => {
  const pleine = ['A', 'B', 'C', 'D', 'E'];
  const resultat = ajouterReference(pleine, 'F');
  assert.equal(resultat.ajoutee, false);
  assert.equal(resultat.limiteAtteinte, true);
  assert.deepEqual(resultat.selection, pleine);
});

test('retirerReference : retire une référence présente, sans effet si absente', () => {
  assert.deepEqual(retirerReference(['A', 'B'], 'A'), ['B']);
  assert.deepEqual(retirerReference(['A', 'B'], 'Z'), ['A', 'B']);
});

test('appliquerSelectionAlUrl : remplace offre1..offre5 et préserve les autres paramètres', () => {
  const url = new URL('https://example.test/offres?univers=emploi&offre1=OLD');
  const nouvelle = appliquerSelectionAlUrl(url, ['A', 'B']);
  assert.equal(nouvelle.searchParams.get('univers'), 'emploi');
  assert.equal(nouvelle.searchParams.get('offre1'), 'A');
  assert.equal(nouvelle.searchParams.get('offre2'), 'B');
  assert.equal(nouvelle.searchParams.get('offre3'), null);
});

test('appliquerSelectionAlUrl : une sélection vide supprime tous les paramètres offreN', () => {
  const url = new URL('https://example.test/offres?offre1=A&offre2=B');
  const nouvelle = appliquerSelectionAlUrl(url, []);
  assert.equal(nouvelle.searchParams.has('offre1'), false);
  assert.equal(nouvelle.searchParams.has('offre2'), false);
});

test('appliquerOrientationAlUrl : ajoute/retire orientation=1 sans toucher aux autres paramètres', () => {
  const url = new URL('https://example.test/candidater?offre1=A');
  const avecOrientation = appliquerOrientationAlUrl(url, true);
  assert.equal(avecOrientation.searchParams.get('orientation'), '1');
  const sansOrientation = appliquerOrientationAlUrl(avecOrientation, false);
  assert.equal(sansOrientation.searchParams.has('orientation'), false);
  assert.equal(sansOrientation.searchParams.get('offre1'), 'A');
});

test('filtrerReferencesConnues : sépare références connues et inconnues', () => {
  const connues = new Set(['A', 'B']);
  const resultat = filtrerReferencesConnues(['A', 'X', 'B'], connues);
  assert.deepEqual(resultat.connues, ['A', 'B']);
  assert.deepEqual(resultat.inconnues, ['X']);
});

test('hrefAvecSelection : construit un chemin avec/sans query string selon la sélection', () => {
  assert.equal(hrefAvecSelection('/ma-selection', []), '/ma-selection');
  assert.equal(hrefAvecSelection('/ma-selection', ['A']), '/ma-selection?offre1=A');
});

test('hrefVersCandidater : ajoute orientation=1 uniquement si demandé', () => {
  assert.equal(hrefVersCandidater([], false), '/candidater');
  assert.equal(hrefVersCandidater([], true), '/candidater?orientation=1');
  assert.equal(hrefVersCandidater(['A'], true), '/candidater?offre1=A&orientation=1');
});

test('estOrientationDemandee : uniquement vrai pour orientation=1', () => {
  assert.equal(estOrientationDemandee(new URLSearchParams('orientation=1')), true);
  assert.equal(estOrientationDemandee(new URLSearchParams('orientation=oui')), false);
  assert.equal(estOrientationDemandee(new URLSearchParams()), false);
});

test('convertirEnUrlEmbedTally : convertit un lien /r/ID en /embed/ID', () => {
  assert.equal(convertirEnUrlEmbedTally('https://tally.so/r/abc123'), 'https://tally.so/embed/abc123');
});

test('construireUrlTally : encode les offres, l’orientation et les paramètres techniques', () => {
  const url = construireUrlTally(
    'https://tally.so/r/abc123',
    [{ reference: 'SEF26-901', intitule: 'Poste test', exposantNom: 'Entreprise Test' }],
    false,
  );
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://tally.so/embed/abc123');
  assert.equal(parsed.searchParams.get('offre_1_ref'), 'SEF26-901');
  assert.equal(parsed.searchParams.get('offre_1_titre'), 'Poste test');
  assert.equal(parsed.searchParams.get('offre_1_exposant'), 'Entreprise Test');
  assert.equal(parsed.searchParams.get('orientation_labevents'), 'false');
  assert.equal(parsed.searchParams.has('orientation_labevents_label'), false);
  assert.equal(parsed.searchParams.get('source'), 'salon-emploi.nc');
  assert.equal(parsed.searchParams.get('edition'), '2026');
  assert.equal(parsed.searchParams.get('dynamicHeight'), '1');
});

test('construireUrlTally : ajoute orientation_labevents_label uniquement si orientation demandée', () => {
  const url = new URL(construireUrlTally('https://tally.so/r/abc123', [], true));
  assert.equal(url.searchParams.get('orientation_labevents'), 'true');
  assert.ok(url.searchParams.get('orientation_labevents_label')?.length > 0);
});
