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

/*
  Fixtures d'anomalie (Lot Admin-1C, voir src/lib/admin.ts et
  docs/EXPOSANTS_IMPORT.md) : deux offres réelles supplémentaires pour
  exercer les badges internes Admin sans dépendre d'un vrai import CSV —
  l'une avec un exposantId absent de la collection `exposants`, l'autre
  rattachée à l'exposant fixture mais avec une formule dupliquée divergente.
*/
export const FIXTURE_ANOMALIE_EXPOSANT_REFERENCE = 'E2E-ANOMALIE-EXPOSANT';
export const FIXTURE_ANOMALIE_EXPOSANT_INTITULE = 'Offre fixture — exposant introuvable (Playwright)';
export const FIXTURE_ANOMALIE_EXPOSANT_SLUG = 'e2e-fixture-offre-anomalie-exposant';
export const FIXTURE_ANOMALIE_EXPOSANT_ID = 'EXP26-998';

export const FIXTURE_ANOMALIE_FORMULE_REFERENCE = 'E2E-ANOMALIE-FORMULE';
export const FIXTURE_ANOMALIE_FORMULE_INTITULE = 'Offre fixture — formule incohérente (Playwright)';
export const FIXTURE_ANOMALIE_FORMULE_SLUG = 'e2e-fixture-offre-anomalie-formule';

/*
  Fixtures Visibilité (Lot Admin-2, voir docs/VISIBILITE.md). Une seule
  visibilité éligible par page utilisée dans ces tests (accueil / offres) :
  le tirage pondéré devient ainsi déterministe (un seul candidat = pas
  d'aléatoire à gérer côté test) pour les assertions de contenu, tout en
  laissant /exposants et /programme sans aucune campagne éligible (utile
  pour tester l'absence d'espace vide).
*/
export const FIXTURE_VIS_ACCUEIL_SLUG = 'e2e-fixture-visibilite-accueil';
export const FIXTURE_VIS_ACCUEIL_ANNONCEUR = 'Fixture E2E — annonceur externe';
export const FIXTURE_VIS_ACCUEIL_ALT = "Bandeau fixture Playwright — visible sur l'accueil";

export const FIXTURE_VIS_OFFRES_SLUG = 'e2e-fixture-visibilite-offres';
export const FIXTURE_VIS_OFFRES_ANNONCEUR = 'Fixture E2E LabEvents'; // même raison sociale que l'exposant fixture
export const FIXTURE_VIS_OFFRES_ALT = 'Bandeau fixture Playwright — visible sur le catalogue offres';

export const FIXTURE_VIS_INACTIVE_SLUG = 'e2e-fixture-visibilite-inactive';
export const FIXTURE_VIS_FUTURE_SLUG = 'e2e-fixture-visibilite-future';
export const FIXTURE_VIS_EXPIREE_SLUG = 'e2e-fixture-visibilite-expiree';

/*
  Fixture dédiée à la réévaluation des dates CÔTÉ CLIENT, sans rebuild (voir
  docs/VISIBILITE.md §7) : seule campagne ciblant `programme`, avec une
  fenêtre de dates suffisamment loin dans le futur (année 3000) pour ne
  jamais être active sous l'horloge réelle d'une exécution Playwright — les
  tests qui doivent la voir apparaître avancent l'horloge du navigateur via
  `page.clock` puis rechargent la page (jamais de nouveau build entre les
  deux), pour prouver que la fenêtre est bien réévaluée à chaque chargement.
*/
export const FIXTURE_VIS_PROGRAMMEE_SLUG = 'e2e-fixture-visibilite-programmee';
export const FIXTURE_VIS_PROGRAMMEE_ANNONCEUR = 'Fixture E2E — programmée (an 3000)';
export const FIXTURE_VIS_PROGRAMMEE_ALT = 'Bandeau fixture Playwright — programmé (réévaluation des dates côté client)';
export const FIXTURE_VIS_PROGRAMMEE_DATE_DEBUT = '3000-01-01T00:00:00.000Z';
export const FIXTURE_VIS_PROGRAMMEE_DATE_FIN = '3000-01-02T00:00:00.000Z';

const cheminFixtureOffre = path.join(__dirname, '..', 'src', 'content', 'offres', `${FIXTURE_SLUG}.md`);
const cheminFixtureExposant = path.join(__dirname, '..', 'src', 'content', 'exposants', `${FIXTURE_EXPOSANT_SLUG}.md`);
const cheminFixtureAnomalieExposant = path.join(
  __dirname,
  '..',
  'src',
  'content',
  'offres',
  `${FIXTURE_ANOMALIE_EXPOSANT_SLUG}.md`,
);
const cheminFixtureAnomalieFormule = path.join(
  __dirname,
  '..',
  'src',
  'content',
  'offres',
  `${FIXTURE_ANOMALIE_FORMULE_SLUG}.md`,
);

const dossierVisibilites = path.join(__dirname, '..', 'src', 'content', 'visibilites');
const cheminFixtureVisAccueil = path.join(dossierVisibilites, `${FIXTURE_VIS_ACCUEIL_SLUG}.md`);
const cheminFixtureVisOffres = path.join(dossierVisibilites, `${FIXTURE_VIS_OFFRES_SLUG}.md`);
const cheminFixtureVisInactive = path.join(dossierVisibilites, `${FIXTURE_VIS_INACTIVE_SLUG}.md`);
const cheminFixtureVisFuture = path.join(dossierVisibilites, `${FIXTURE_VIS_FUTURE_SLUG}.md`);
const cheminFixtureVisExpiree = path.join(dossierVisibilites, `${FIXTURE_VIS_EXPIREE_SLUG}.md`);
const cheminFixtureVisProgrammee = path.join(dossierVisibilites, `${FIXTURE_VIS_PROGRAMMEE_SLUG}.md`);

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
formule: "standard"
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

const contenuFixtureAnomalieExposant = `---
reference: "${FIXTURE_ANOMALIE_EXPOSANT_REFERENCE}"
status: "publiee"
intitule: "${FIXTURE_ANOMALIE_EXPOSANT_INTITULE}"
exposantId: "${FIXTURE_ANOMALIE_EXPOSANT_ID}"
exposantNom: "Fixture E2E — exposant absent de la collection"
formule: "standard"
secteur: "${FIXTURE_SECTEUR}"
typeContrat:
  - "${FIXTURE_TYPE_CONTRAT}"
lieu: "${FIXTURE_LIEU}"
nombrePostes: 1
niveauExperience: "Débutant accepté"
sansExperience: true
descriptionCourte: "Fiche générée automatiquement par scripts/e2e-fixtures.mjs (Lot Admin-1C) : exposantId sans exposant correspondant dans la collection, pour tester le badge d'anomalie Admin."
accepteCandidaturesEnLigne: true
datePublication: 2026-08-08
---
`;

const contenuFixtureAnomalieFormule = `---
reference: "${FIXTURE_ANOMALIE_FORMULE_REFERENCE}"
status: "publiee"
intitule: "${FIXTURE_ANOMALIE_FORMULE_INTITULE}"
exposantId: "${FIXTURE_EXPOSANT_ID}"
exposantNom: "${FIXTURE_EXPOSANT_NOM}"
formule: "gold"
secteur: "${FIXTURE_SECTEUR}"
typeContrat:
  - "${FIXTURE_TYPE_CONTRAT}"
lieu: "${FIXTURE_LIEU}"
nombrePostes: 1
niveauExperience: "Débutant accepté"
sansExperience: true
descriptionCourte: "Fiche générée automatiquement par scripts/e2e-fixtures.mjs (Lot Admin-1C) : formule 'gold' alors que l'exposant fixture est 'standard', pour tester le badge d'anomalie Admin."
accepteCandidaturesEnLigne: true
datePublication: 2026-08-08
---
`;

// Visuel réel existant dans public/ (voir docs/VISIBILITE.md) — évite une image cassée dans les tests.
const FIXTURE_VIS_VISUEL = '/brand/logo-salon-emploi-formation-mark-512.png';

const contenuFixtureVisAccueil = `---
nomInterne: "Fixture E2E — accueil"
annonceur: "${FIXTURE_VIS_ACCUEIL_ANNONCEUR}"
typeAnnonceur: "annonceur_externe"
format: "bandeau_horizontal"
visuel: "${FIXTURE_VIS_VISUEL}"
alt: "${FIXTURE_VIS_ACCUEIL_ALT}"
pages:
  - "accueil"
emplacement: "principal"
poids: 1
actif: true
---
`;

const contenuFixtureVisOffres = `---
nomInterne: "Fixture E2E — offres, rattachée à l'exposant fixture"
annonceur: "${FIXTURE_VIS_OFFRES_ANNONCEUR}"
typeAnnonceur: "exposant"
exposantId: "${FIXTURE_EXPOSANT_ID}"
format: "bandeau_horizontal"
visuel: "${FIXTURE_VIS_VISUEL}"
alt: "${FIXTURE_VIS_OFFRES_ALT}"
lien: "/exposants/${FIXTURE_EXPOSANT_SLUG}"
pages:
  - "offres"
emplacement: "principal"
poids: 3
actif: true
---
`;

const contenuFixtureVisInactive = `---
nomInterne: "Fixture E2E — désactivée"
annonceur: "Fixture E2E — ne doit jamais apparaître (désactivée)"
typeAnnonceur: "sponsor"
format: "bandeau_horizontal"
visuel: "${FIXTURE_VIS_VISUEL}"
alt: "Fixture E2E — désactivée"
pages:
  - "accueil"
emplacement: "principal"
# Dates volontairement dans la fenêtre active (2020-2099) : prouve que
# actif: false l'emporte sur les dates, pas une coïncidence liée à
# l'absence de dateDebut/dateFin (voir docs/VISIBILITE.md §1 et le test
# Admin dédié dans e2e/visibilite.spec.ts).
dateDebut: 2020-01-01
dateFin: 2099-01-01
poids: 1
actif: false
---
`;

const contenuFixtureVisFuture = `---
nomInterne: "Fixture E2E — programmée dans le futur"
annonceur: "Fixture E2E — ne doit jamais apparaître (à venir)"
typeAnnonceur: "partenaire"
format: "bandeau_horizontal"
visuel: "${FIXTURE_VIS_VISUEL}"
alt: "Fixture E2E — à venir"
pages:
  - "accueil"
emplacement: "principal"
dateDebut: 2099-01-01
poids: 1
actif: true
---
`;

const contenuFixtureVisExpiree = `---
nomInterne: "Fixture E2E — expirée"
annonceur: "Fixture E2E — ne doit jamais apparaître (expirée)"
typeAnnonceur: "institution"
format: "bandeau_horizontal"
visuel: "${FIXTURE_VIS_VISUEL}"
alt: "Fixture E2E — expirée"
pages:
  - "accueil"
emplacement: "principal"
dateFin: 2020-01-01
poids: 1
actif: true
---
`;

const contenuFixtureVisProgrammee = `---
nomInterne: "Fixture E2E — réévaluation des dates côté client"
annonceur: "${FIXTURE_VIS_PROGRAMMEE_ANNONCEUR}"
typeAnnonceur: "autre"
format: "bandeau_horizontal"
visuel: "${FIXTURE_VIS_VISUEL}"
alt: "${FIXTURE_VIS_PROGRAMMEE_ALT}"
pages:
  - "programme"
emplacement: "principal"
dateDebut: ${FIXTURE_VIS_PROGRAMMEE_DATE_DEBUT}
dateFin: ${FIXTURE_VIS_PROGRAMMEE_DATE_FIN}
poids: 1
actif: true
---
`;

function creer() {
  writeFileSync(cheminFixtureOffre, contenuFixtureOffre, 'utf8');
  writeFileSync(cheminFixtureExposant, contenuFixtureExposant, 'utf8');
  writeFileSync(cheminFixtureAnomalieExposant, contenuFixtureAnomalieExposant, 'utf8');
  writeFileSync(cheminFixtureAnomalieFormule, contenuFixtureAnomalieFormule, 'utf8');
  writeFileSync(cheminFixtureVisAccueil, contenuFixtureVisAccueil, 'utf8');
  writeFileSync(cheminFixtureVisOffres, contenuFixtureVisOffres, 'utf8');
  writeFileSync(cheminFixtureVisInactive, contenuFixtureVisInactive, 'utf8');
  writeFileSync(cheminFixtureVisFuture, contenuFixtureVisFuture, 'utf8');
  writeFileSync(cheminFixtureVisExpiree, contenuFixtureVisExpiree, 'utf8');
  writeFileSync(cheminFixtureVisProgrammee, contenuFixtureVisProgrammee, 'utf8');
}

function supprimer() {
  if (existsSync(cheminFixtureOffre)) rmSync(cheminFixtureOffre);
  if (existsSync(cheminFixtureExposant)) rmSync(cheminFixtureExposant);
  if (existsSync(cheminFixtureAnomalieExposant)) rmSync(cheminFixtureAnomalieExposant);
  if (existsSync(cheminFixtureAnomalieFormule)) rmSync(cheminFixtureAnomalieFormule);
  if (existsSync(cheminFixtureVisAccueil)) rmSync(cheminFixtureVisAccueil);
  if (existsSync(cheminFixtureVisOffres)) rmSync(cheminFixtureVisOffres);
  if (existsSync(cheminFixtureVisInactive)) rmSync(cheminFixtureVisInactive);
  if (existsSync(cheminFixtureVisFuture)) rmSync(cheminFixtureVisFuture);
  if (existsSync(cheminFixtureVisExpiree)) rmSync(cheminFixtureVisExpiree);
  if (existsSync(cheminFixtureVisProgrammee)) rmSync(cheminFixtureVisProgrammee);
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
