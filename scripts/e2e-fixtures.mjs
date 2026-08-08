/*
  Fixture E2E pour le Lot 4B-2 (parcours Offres) : crée/supprime une offre
  factice, publiée et acceptant les candidatures en ligne, uniquement pour la
  durée d'une exécution Playwright.

  Nécessaire car les 5 offres TEST du catalogue public (voir docs/OFFRES.md,
  src/lib/offres.ts::estOffreTest) masquent volontairement le bouton de
  sélection — impossible de tester l'ajout/retrait/limite de sélection sans
  une offre « réelle ». Cette fixture n'est *jamais* committée : elle est
  écrite juste avant `npm run build` (voir playwright.config.ts, webServer.command)
  et supprimée par le globalTeardown Playwright (voir e2e/global-teardown.ts),
  qu'importe l'issue des tests. `.gitignore` l'exclut aussi par sécurité.

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

const cheminFixture = path.join(__dirname, '..', 'src', 'content', 'offres', `${FIXTURE_SLUG}.md`);

const contenuFixture = `---
reference: "${FIXTURE_REFERENCE}"
status: "publiee"
intitule: "${FIXTURE_INTITULE}"
exposantId: "e2e-fixture"
exposantNom: "Fixture E2E LabEvents"
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

function creer() {
  writeFileSync(cheminFixture, contenuFixture, 'utf8');
}

function supprimer() {
  if (existsSync(cheminFixture)) rmSync(cheminFixture);
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
