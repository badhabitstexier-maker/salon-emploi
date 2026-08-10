#!/usr/bin/env node
/*
  CLI de déploiement : injecte, dans le dossier de build (par défaut
  `dist/`), la configuration serveur du module Visibilité propre à
  l'environnement en cours (AuthUserFile + dossier de données) — voir
  docs/VISIBILITE.md section 15.9 et scripts/lib/visibilite-deploy-injection.mjs
  pour la logique.

  Usage (dans un workflow, après `npm run build`, avant le transfert FTP) :
    node scripts/inject-visibilite-config.mjs [dossier-dist]

  Variables d'environnement requises (via `env:` dans le workflow — jamais
  interpolées directement dans un script shell) :
    VISIBILITES_AUTH_USER_FILE
    VISIBILITES_DATA_DIR

  Échoue (code de sortie 1) si une variable est absente/vide, ou si un
  placeholder subsiste après substitution — dans les deux cas, aucun
  transfert FTP ne doit suivre. N'affiche jamais la valeur des variables.
*/
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injecterConfigurationVisibilite } from './lib/visibilite-deploy-injection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');
const dossierDist = path.resolve(RACINE, process.argv[2] ?? 'dist');

async function main() {
  try {
    await injecterConfigurationVisibilite({ dossierDist, env: process.env });
  } catch (erreur) {
    for (const ligne of String(erreur.message).split('\n')) {
      console.log(`::error::${ligne}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Configuration Visibilité injectée (AuthUserFile + dossier de données) — aucun placeholder résiduel.');
}

main();
