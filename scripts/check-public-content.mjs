#!/usr/bin/env node
/*
  Contrôle simple des sources publiques du site (Lot 4A, section 27) :
  recherche de mentions obsolètes ou abandonnées de l'édition actuelle
  (Village Maintenance & Industrie, ancienne capacité 40 emplacements,
  ancienne population 270 000 habitants…).

  Usage :
    npm run content:check

  Limité aux sources qui alimentent réellement le site public
  (src/pages/, src/components/, src/layouts/, src/content/) — pas
  l'historique Git, pas la documentation qui explique volontairement
  qu'une ancienne valeur a été remplacée (docs/, ce script lui-même).
*/
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');

const DOSSIERS_SURVEILLES = ['src/pages', 'src/components', 'src/layouts', 'src/content'];
const EXTENSIONS_SURVEILLEES = new Set(['.astro', '.md', '.mdx', '.ts', '.tsx', '.js', '.mjs']);

/*
  Règles interdites. `regex` doit matcher le texte tel qu'il apparaîtrait
  dans une page publique — pas dans ce fichier de règles lui-même (voir
  garde-fou plus bas).
*/
const REGLES = [
  { nom: 'Village Maintenance (Village Maintenance & Industrie suspendu — CLAUDE.md section 2)', regex: /Village Maintenance/gi },
  { nom: 'Maison des Artisans (dénomination abandonnée)', regex: /Maison des Artisans/gi },
  { nom: "Maison de l'Artisanat (dénomination abandonnée)", regex: /Maison de l['’]Artisanat/gi },
  { nom: '40 emplacements (ancienne capacité, remplacée par 37)', regex: /40\s+emplacements/gi },
  { nom: '270 000 habitants (ancienne population, remplacée par 260 000)', regex: /270\s?000\s+habitants/gi },
];

async function listerFichiers(dossier) {
  const resultats = [];
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return resultats;
  }
  for (const entree of entrees) {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      resultats.push(...(await listerFichiers(chemin)));
    } else if (EXTENSIONS_SURVEILLEES.has(path.extname(entree.name))) {
      resultats.push(chemin);
    }
  }
  return resultats;
}

async function main() {
  const fichiers = [];
  for (const dossier of DOSSIERS_SURVEILLES) {
    fichiers.push(...(await listerFichiers(path.join(RACINE, dossier))));
  }

  const trouvailles = [];
  for (const fichier of fichiers) {
    const contenu = await readFile(fichier, 'utf8');
    const chemin = path.relative(RACINE, fichier);
    for (const regle of REGLES) {
      const correspondances = contenu.match(regle.regex);
      if (correspondances) {
        trouvailles.push({ fichier: chemin, regle: regle.nom, occurrences: correspondances.length });
      }
    }
  }

  if (trouvailles.length === 0) {
    console.log(`Contrôle OK : ${fichiers.length} fichier(s) analysé(s) dans ${DOSSIERS_SURVEILLES.join(', ')}. Aucune mention obsolète détectée.`);
    return 0;
  }

  console.log('Mentions obsolètes détectées :\n');
  for (const t of trouvailles) {
    console.log(`  - ${t.fichier} : ${t.regle} (${t.occurrences} occurrence(s))`);
  }
  console.log(`\nContrôle en échec : ${trouvailles.length} problème(s) sur ${fichiers.length} fichier(s) analysé(s).`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
