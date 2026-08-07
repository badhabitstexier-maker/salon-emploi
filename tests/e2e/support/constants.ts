/*
  Ports et URL des trois serveurs statiques utilisés par la recette E2E
  (voir global-setup.ts) :
  - EMPTY   : build sans aucune fixture — collections exposants/programme/offres
              vides, tel qu'est actuellement le dépôt (états vides catalogue).
  - FIXTURES: build avec les fixtures E2E (tests/fixtures/) injectées puis
              retirées des collections publiques avant le démarrage des tests
              (voir docs/RECETTE_AUTOMATISEE.md).
  - TALLY   : identique à FIXTURES, avec en plus PUBLIC_TALLY_CANDIDATURE_URL
              définie sur une URL Tally fictive, pour tester la construction
              de l'iframe sans jamais dépendre du réseau réel de tally.so
              (interception systématique du domaine, voir selection-candidater.spec.ts).
*/
export const EMPTY_PORT = 4322;
export const FIXTURES_PORT = 4323;
export const TALLY_PORT = 4324;

export const EMPTY_BASE_URL = `http://localhost:${EMPTY_PORT}`;
export const FIXTURES_BASE_URL = `http://localhost:${FIXTURES_PORT}`;
export const TALLY_BASE_URL = `http://localhost:${TALLY_PORT}`;

/** URL Tally fictive utilisée uniquement par le build TALLY — jamais appelée réellement (interceptée). */
export const FAKE_TALLY_URL = 'https://tally.so/r/e2eTestFormId';
