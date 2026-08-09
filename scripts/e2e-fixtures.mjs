/*
  Fixtures E2E pour la suite Playwright : crée/supprime une offre et un
  exposant factices, uniquement pour la durée d'une exécution Playwright.

  Offre (Lot 4B-2, parcours Offres) : nécessaire car les 5 offres TEST du
  catalogue public (voir docs/OFFRES.md, src/lib/offres.ts::estOffreTest)
  masquent volontairement le bouton de sélection — impossible de tester
  l'ajout/retrait/limite de sélection sans une offre « réelle ».

  Exposant (Lot Admin-1, voir docs/ADMIN.md) : la collection `exposants` est
  vide en conditions réelles (aucun import réel à ce jour) — nécessaire pour
  tester la table/fiche exposant de l'admin. Son `exposantId` correspond à
  celui de l'offre fixture, pour tester le rattachement offres <-> exposant.

  Ces fixtures ne sont *jamais* committées : elles sont écrites juste avant
  `npm run build` (voir playwright.config.ts, webServer.command) et
  supprimées par le globalTeardown Playwright (voir e2e/global-teardown.ts),
  qu'importe l'issue des tests. `.gitignore` les exclut aussi par sécurité.

  Usage : node scripts/e2e-fixtures.mjs create|remove
*/
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURE_REFERENCE = 'E2E-FIXTURE-001';
export const FIXTURE_INTITULE = 'Assistant logistique (fixture Playwright — non publié en dehors des tests E2E)';
export const FIXTURE_SLUG = 'e2e-fixture-offre';
export const FIXTURE_SECTEUR = 'Logistique et transport (fixture E2E)';
export const FIXTURE_LIEU = 'Fixture E2E';
export const FIXTURE_TYPE_CONTRAT = 'CDI';
export const FIXTURE_EXPOSANT_ID = 'EXP26-999';
export const FIXTURE_EXPOSANT_NOM = 'Fixture E2E LabEvents';
export const FIXTURE_EXPOSANT_SLUG = 'e2e-fixture-exposant';

const cheminFixtureOffre = path.join(__dirname, '..', 'src', 'content', 'offres', `${FIXTURE_SLUG}.md`);
const cheminFixtureExposant = path.join(__dirname, '..', 'src', 'content', 'exposants', `${FIXTURE_EXPOSANT_SLUG}.md`);

const contenuFixtureOffre = `---
reference: "${FIXTURE_REFERENCE}"
status: "publiee"
intitule: "${FIXTURE_INTITULE}"
exposantId: "${FIXTURE_EXPOSANT_ID}"
exposantNom: "${FIXTURE_EXPOSANT_NOM}"
formule: "standard"
secteur: "${FIXTURE_SECTEUR}"
typeContrat:
  - "${FIXTURE_TYPE_CONTRAT}"
lieu: "${FIXTURE_LIEU}"
nombrePostes: 1
niveauFormation:
  - "Bac"
niveauExperience: "Débutant accepté"
sansExperience: true
descriptionCourte: "Fiche générée automatiquement par scripts/e2e-fixtures.mjs pour les tests Playwright du Lot 4B-2. Ne doit jamais apparaître en dehors d'une exécution de tests."
missions:
  - "Fixture de test — aucune mission réelle"
competencesPrerequis:
  - "Fixture de test — aucun prérequis réel"
accepteCandidaturesEnLigne: true
datePublication: 2026-08-08
---
`;

const contenuFixtureExposant = `---
exposantId: "${FIXTURE_EXPOSANT_ID}"
nom: "${FIXTURE_EXPOSANT_NOM}"
univers: "emploi"
type_structure: "entreprise"
secteurs:
  - "${FIXTURE_SECTEUR}"
accroche: "Fiche générée automatiquement par scripts/e2e-fixtures.mjs pour les tests Playwright du Lot Admin-1."
description: "Fiche fixture E2E — ne doit jamais apparaître en dehors d'une exécution de tests."
numero_stand: "E2E-01"
publie: true
---
`;

function creer() {
  writeFileSync(cheminFixtureOffre, contenuFixtureOffre, 'utf8');
  writeFileSync(cheminFixtureExposant, contenuFixtureExposant, 'utf8');
}

function supprimer() {
  if (existsSync(cheminFixtureOffre)) rmSync(cheminFixtureOffre);
  if (existsSync(cheminFixtureExposant)) rmSync(cheminFixtureExposant);
}

/*
  Le dispatch CLI ne doit s'exécuter que si ce fichier est lancé directement
  (`node scripts/e2e-fixtures.mjs create|remove`), jamais lors d'un simple
  import des constantes (voir e2e/offres-selection.spec.ts, qui importe
  FIXTURE_REFERENCE / FIXTURE_INTITULE sans vouloir déclencher create/remove).
*/
const executeDirectement = import.meta.url === `file://${process.argv[1]}`;
if (executeDirectement) {
  const commande = process.argv[2];
  if (commande === 'create') creer();
  else if (commande === 'remove') supprimer();
  else {
    console.error('Usage : node scripts/e2e-fixtures.mjs create|remove');
    process.exit(1);
  }
}
