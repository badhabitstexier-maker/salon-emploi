#!/usr/bin/env node
/*
  Import du programme dans la collection Astro `programme`
  (src/content/programme/), à partir d'un CSV normalisé (une activité par
  ligne). Voir docs/PROGRAMME_IMPORT.md pour la procédure complète.

  Usage :
    node scripts/import-programme.mjs <fichier.csv> [--dry-run]
    node scripts/import-programme.mjs --check

  Le mode --dry-run n'écrit jamais sur le disque. Sans --dry-run, l'import
  est « tout ou rien » : s'il reste une seule erreur bloquante (y compris un
  conflit de programmation), aucun fichier n'est écrit ni supprimé.
*/
import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjets } from './lib/csv.mjs';
import {
  COLONNES_REQUISES,
  ligneEstVide,
  validerLigne,
  rapprocherIdentifiantsParSlug,
  detecterDoublons,
  detecterConflits,
  genererContenuProgramme,
  lireResumeFrontmatterProgramme,
} from './lib/programme-import-core.mjs';
import { assignerIdentifiantsManquants } from './lib/import-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');
const DOSSIER_PROGRAMME = path.join(RACINE, 'src/content/programme');

function parseArgs(argv) {
  const args = { dryRun: false, check: false, fichier: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check') args.check = true;
    else if (!a.startsWith('--')) args.fichier = a;
  }
  return args;
}

async function listerProgrammeExistant() {
  if (!existsSync(DOSSIER_PROGRAMME)) return [];
  const fichiers = (await readdir(DOSSIER_PROGRAMME)).filter((f) => f.endsWith('.md'));
  const resultats = [];
  for (const fichier of fichiers) {
    const contenu = await readFile(path.join(DOSSIER_PROGRAMME, fichier), 'utf8');
    const resume = lireResumeFrontmatterProgramme(contenu);
    if (resume.programmeId) {
      resultats.push({ ...resume, slug: fichier.replace(/\.md$/, ''), fichier, contenu });
    }
  }
  return resultats;
}

function verifierColonnes(entetes) {
  const avertissements = [];
  const manquantes = COLONNES_REQUISES.filter((c) => !entetes.includes(c));
  if (manquantes.length > 0) {
    avertissements.push(`Colonnes absentes du CSV (traitées comme vides) : ${manquantes.join(', ')}.`);
  }
  return avertissements;
}

async function commandeImport(cheminCsv, dryRun) {
  const texte = await readFile(cheminCsv, 'utf8');
  const { entetes, lignes } = parseCsvObjets(texte);

  const avertissementsGlobaux = verifierColonnes(entetes);

  const valides = [];
  const enErreur = [];
  const ignorees = [];

  lignes.forEach((ligne, index) => {
    const numeroLigne = index + 2;
    if (ligneEstVide(ligne)) {
      ignorees.push({ numeroLigne, raison: 'titre vide (bloc non déclaré)' });
      return;
    }
    const resultat = validerLigne(ligne, numeroLigne);
    if (!resultat.ok) {
      enErreur.push(resultat);
      return;
    }
    resultat.activite.__numeroLigne = numeroLigne;
    valides.push(resultat.activite);
    if (resultat.avertissements.length > 0) {
      avertissementsGlobaux.push(...resultat.avertissements.map((a) => `Ligne ${numeroLigne} : ${a}`));
    }
  });

  const existantes = await listerProgrammeExistant();

  const journalRapprochements = rapprocherIdentifiantsParSlug(valides, existantes);
  const journalIdentifiants = assignerIdentifiantsManquants(
    valides,
    existantes.map((e) => e.programmeId),
    { prefixe: 'PROG26', champId: 'programmeId' },
  );

  const doublonsSlug = detecterDoublons(valides, 'slug');
  const doublonsId = detecterDoublons(valides, 'programmeId');

  const collisionsSlug = [];
  const renommages = [];
  for (const activite of valides) {
    const existanteMemeSlug = existantes.find((e) => e.slug === activite.slug);
    if (existanteMemeSlug && existanteMemeSlug.programmeId !== activite.programmeId) {
      collisionsSlug.push({ slug: activite.slug, existant: existanteMemeSlug.programmeId, lot: activite.programmeId });
    }
    const existanteMemeId = existantes.find((e) => e.programmeId === activite.programmeId);
    if (existanteMemeId && existanteMemeId.slug !== activite.slug) {
      renommages.push({ programmeId: activite.programmeId, ancienSlug: existanteMemeId.slug, nouveauSlug: activite.slug, ancienFichier: existanteMemeId.fichier });
    }
  }

  const idsDuLot = new Set(valides.map((a) => a.programmeId));
  const etatFinal = [...existantes.filter((e) => !idsDuLot.has(e.programmeId)), ...valides];
  const { erreurs: erreursConflits, avertissements: avertissementsConflits } = detecterConflits(etatFinal);

  const erreursBloquantes = [
    ...enErreur.map((e) => `Ligne ${e.numeroLigne} : ${e.erreurs.join(' ')}`),
    ...doublonsSlug.map((d) => `Slug dupliqué dans le CSV : ${d.valeur} (${d.occurrences} occurrences).`),
    ...doublonsId.map((d) => `programmeId dupliqué dans le CSV : ${d.valeur} (${d.occurrences} occurrences).`),
    ...collisionsSlug.map((c) => `Slug « ${c.slug} » déjà utilisé par l'activité « ${c.existant} » — ne peut pas être réattribué à « ${c.lot} ».`),
    ...erreursConflits,
  ];

  const plan = valides.map((activite) => {
    const fichier = `${activite.slug}.md`;
    const cheminComplet = path.join(DOSSIER_PROGRAMME, fichier);
    const contenuGenere = genererContenuProgramme(activite);
    const renommage = renommages.find((r) => r.programmeId === activite.programmeId);
    return { activite, fichier, cheminComplet, contenuGenere, ancienFichier: renommage?.ancienFichier };
  });

  console.log(`\nLecture : ${lignes.length} ligne(s) de données dans ${path.basename(cheminCsv)}.`);
  console.log(`Activités valides : ${valides.length}`);
  console.log(`Lignes ignorées (bloc vide) : ${ignorees.length}`);
  console.log(`Lignes en erreur : ${enErreur.length}`);

  if (journalRapprochements.length > 0) {
    console.log("\nIdentifiants rapprochés d'une entrée existante (même slug) :");
    for (const j of journalRapprochements) console.log(`  - ligne ${j.ligne} → ${j.programmeId} (${j.slug})`);
  }
  if (journalIdentifiants.length > 0) {
    console.log('\nIdentifiants assignés automatiquement (nouvelle activité) :');
    for (const j of journalIdentifiants) console.log(`  - ligne ${j.ligne} → ${j.id}`);
  }
  if (renommages.length > 0) {
    console.log('\nRenommages détectés (même programmeId, nouveau slug) :');
    for (const r of renommages) console.log(`  - ${r.programmeId} : ${r.ancienSlug} → ${r.nouveauSlug} (ancien fichier ${r.ancienFichier} supprimé)`);
  }
  if (avertissementsGlobaux.length > 0 || avertissementsConflits.length > 0) {
    console.log('\nAvertissements :');
    for (const a of [...avertissementsGlobaux, ...avertissementsConflits]) console.log(`  - ${a}`);
  }
  if (erreursBloquantes.length > 0) {
    console.log('\nErreurs bloquantes :');
    for (const e of erreursBloquantes) console.log(`  - ${e}`);
  }

  const resume = { creees: 0, misesAJour: 0, inchangees: 0, ignorees: ignorees.length, erreurs: erreursBloquantes.length };

  console.log(dryRun ? '\nFichiers qui seraient écrits (dry-run, aucune écriture réelle) :' : '\nFichiers :');
  for (const item of plan) {
    let etat;
    if (existsSync(item.cheminComplet)) {
      const contenuActuel = await readFile(item.cheminComplet, 'utf8');
      etat = contenuActuel === item.contenuGenere ? 'inchangée' : 'mise à jour';
    } else {
      etat = item.ancienFichier ? 'renommée' : 'créée';
    }
    if (etat === 'créée') resume.creees += 1;
    else if (etat === 'inchangée') resume.inchangees += 1;
    else resume.misesAJour += 1;
    console.log(`  - ${item.fichier} : ${etat}`);
  }

  console.log(
    `\nRésumé : ${resume.creees} créée(s), ${resume.misesAJour} mise(s) à jour, ${resume.inchangees} inchangée(s), ${resume.ignorees} ignorée(s), ${resume.erreurs} erreur(s) bloquante(s).`,
  );

  if (erreursBloquantes.length > 0) {
    console.log("\nImport annulé : aucun fichier n'a été écrit (au moins une erreur bloquante). Corrigez le CSV et relancez.");
    return 1;
  }

  if (dryRun) {
    console.log('\nDry-run terminé : aucune écriture effectuée. Relancez sans --dry-run pour appliquer.');
    return 0;
  }

  await mkdir(DOSSIER_PROGRAMME, { recursive: true });
  for (const item of plan) {
    if (item.ancienFichier && item.ancienFichier !== item.fichier) {
      await unlink(path.join(DOSSIER_PROGRAMME, item.ancienFichier));
    }
    await writeFile(item.cheminComplet, item.contenuGenere, 'utf8');
  }
  console.log(`\n${plan.length} fichier(s) écrit(s) dans ${path.relative(RACINE, DOSSIER_PROGRAMME)}/.`);
  return 0;
}

async function commandeCheck() {
  const existantes = await listerProgrammeExistant();
  const doublonsId = detecterDoublons(existantes, 'programmeId');
  const { erreurs, avertissements } = detecterConflits(existantes);

  console.log(`Collection actuelle : ${existantes.length} activité(s).`);
  if (doublonsId.length > 0) {
    console.log('\nIdentifiants dupliqués :');
    for (const d of doublonsId) console.log(`  - ${d.valeur} (${d.occurrences} fichiers)`);
  }
  if (erreurs.length > 0) {
    console.log('\nConflits de programmation :');
    for (const e of erreurs) console.log(`  - ${e}`);
  }
  if (avertissements.length > 0) {
    console.log('\nAvertissements :');
    for (const a of avertissements) console.log(`  - ${a}`);
  }
  const enErreur = doublonsId.length > 0 || erreurs.length > 0;
  console.log(enErreur ? '\nContrôle en échec.' : '\nContrôle OK.');
  return enErreur ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let code;
  if (args.check) {
    code = await commandeCheck();
  } else {
    if (!args.fichier) {
      console.error('Usage : node scripts/import-programme.mjs <fichier.csv> [--dry-run]');
      console.error('        node scripts/import-programme.mjs --check');
      process.exit(1);
    }
    code = await commandeImport(args.fichier, args.dryRun);
  }
  process.exit(code);
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
