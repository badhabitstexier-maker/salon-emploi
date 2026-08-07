#!/usr/bin/env node
/*
  Import des exposants dans la collection Astro `exposants`
  (src/content/exposants/), à partir d'un CSV normalisé (un exposant par
  ligne). Voir docs/EXPOSANTS_IMPORT.md pour la procédure complète.

  Usage :
    node scripts/import-exposants.mjs <fichier.csv> [--dry-run]
    node scripts/import-exposants.mjs --check

  Le mode --dry-run n'écrit jamais sur le disque. Sans --dry-run, l'import
  est « tout ou rien » : s'il reste une seule erreur bloquante, aucun
  fichier n'est écrit ni supprimé.
*/
import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjets } from './lib/csv.mjs';
import {
  COLONNES_REQUISES,
  COLONNES_CONNUES,
  ligneEstVide,
  validerLigne,
  rapprocherIdentifiantsParSlug,
  detecterDoublons,
  verifierCapacitesEtStands,
  genererContenuExposant,
  lireResumeFrontmatterExposant,
} from './lib/exposants-import-core.mjs';
import { assignerIdentifiantsManquants } from './lib/import-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');
const DOSSIER_EXPOSANTS = path.join(RACINE, 'src/content/exposants');
const DOSSIER_PUBLIC = path.join(RACINE, 'public');

function parseArgs(argv) {
  const args = { dryRun: false, check: false, fichier: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check') args.check = true;
    else if (!a.startsWith('--')) args.fichier = a;
  }
  return args;
}

async function listerExposantsExistants() {
  if (!existsSync(DOSSIER_EXPOSANTS)) return [];
  const fichiers = (await readdir(DOSSIER_EXPOSANTS)).filter((f) => f.endsWith('.md'));
  const resultats = [];
  for (const fichier of fichiers) {
    const contenu = await readFile(path.join(DOSSIER_EXPOSANTS, fichier), 'utf8');
    const resume = lireResumeFrontmatterExposant(contenu);
    if (resume.exposantId) {
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
  const inconnues = entetes.filter((c) => !COLONNES_CONNUES.includes(c));
  if (inconnues.length > 0) {
    avertissements.push(`Colonnes non reconnues, ignorées (vérifier une faute de frappe éventuelle) : ${inconnues.join(', ')}.`);
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
      ignorees.push({ numeroLigne, raison: 'nom vide (bloc non déclaré)' });
      return;
    }
    const resultat = validerLigne(ligne, numeroLigne);
    if (!resultat.ok) {
      enErreur.push(resultat);
      return;
    }
    resultat.exposant.__numeroLigne = numeroLigne;
    valides.push(resultat.exposant);
    if (resultat.avertissements.length > 0) {
      avertissementsGlobaux.push(...resultat.avertissements.map((a) => `Ligne ${numeroLigne} : ${a}`));
    }
  });

  // Vérification disque des logos déclarés (impure, hors module core).
  for (const exposant of valides) {
    if (exposant.logo) {
      const cheminLogo = path.join(DOSSIER_PUBLIC, exposant.logo.replace(/^\//, ''));
      if (!existsSync(cheminLogo)) {
        enErreur.push({
          numeroLigne: exposant.__numeroLigne,
          slug: exposant.slug,
          erreurs: [`Logo déclaré introuvable : ${exposant.logo} (attendu dans public${exposant.logo}).`],
          avertissements: [],
        });
      }
    }
  }
  const slugsEnErreurLogo = new Set(enErreur.filter((e) => e.slug).map((e) => e.slug));
  const valides2 = valides.filter((e) => !slugsEnErreurLogo.has(e.slug));

  const existantes = await listerExposantsExistants();

  const journalRapprochements = rapprocherIdentifiantsParSlug(valides2, existantes);
  const journalIdentifiants = assignerIdentifiantsManquants(
    valides2,
    existantes.map((e) => e.exposantId),
    { prefixe: 'EXP26', champId: 'exposantId' },
  );

  const doublonsSlug = detecterDoublons(valides2, 'slug');
  const doublonsId = detecterDoublons(valides2, 'exposantId');

  // Collisions d'identité contre l'existant : même slug mais exposantId différent
  // (ne jamais écraser une fiche dont l'identité ne correspond pas).
  const collisionsSlug = [];
  const renommages = [];
  for (const exposant of valides2) {
    const existanteMemeSlug = existantes.find((e) => e.slug === exposant.slug);
    if (existanteMemeSlug && existanteMemeSlug.exposantId !== exposant.exposantId) {
      collisionsSlug.push({ slug: exposant.slug, exposantExistant: existanteMemeSlug.exposantId, exposantLot: exposant.exposantId });
    }
    const existanteMemeId = existantes.find((e) => e.exposantId === exposant.exposantId);
    if (existanteMemeId && existanteMemeId.slug !== exposant.slug) {
      renommages.push({ exposantId: exposant.exposantId, ancienSlug: existanteMemeId.slug, nouveauSlug: exposant.slug, ancienFichier: existanteMemeId.fichier });
    }
  }

  const { erreurs: erreursCapacites, avertissements: avertissementsCapacites } = verifierCapacitesEtStands(valides2, existantes);

  const erreursBloquantes = [
    ...enErreur.map((e) => `Ligne ${e.numeroLigne} : ${e.erreurs.join(' ')}`),
    ...doublonsSlug.map((d) => `Slug dupliqué dans le CSV : ${d.valeur} (${d.occurrences} occurrences).`),
    ...doublonsId.map((d) => `exposantId dupliqué dans le CSV : ${d.valeur} (${d.occurrences} occurrences).`),
    ...collisionsSlug.map((c) => `Slug « ${c.slug} » déjà utilisé par l'exposant « ${c.exposantExistant} » — ne peut pas être réattribué à « ${c.exposantLot} ».`),
    ...erreursCapacites,
  ];

  const plan = valides2.map((exposant) => {
    const fichier = `${exposant.slug}.md`;
    const cheminComplet = path.join(DOSSIER_EXPOSANTS, fichier);
    const contenuGenere = genererContenuExposant(exposant);
    const renommage = renommages.find((r) => r.exposantId === exposant.exposantId);
    return { exposant, fichier, cheminComplet, contenuGenere, ancienFichier: renommage?.ancienFichier };
  });

  console.log(`\nLecture : ${lignes.length} ligne(s) de données dans ${path.basename(cheminCsv)}.`);
  console.log(`Exposants valides : ${valides2.length}`);
  console.log(`Lignes ignorées (bloc vide) : ${ignorees.length}`);
  console.log(`Lignes en erreur : ${enErreur.length}`);

  if (journalRapprochements.length > 0) {
    console.log("\nIdentifiants rapprochés d'une fiche existante (même slug) :");
    for (const j of journalRapprochements) console.log(`  - ligne ${j.ligne} → ${j.exposantId} (${j.slug})`);
  }
  if (journalIdentifiants.length > 0) {
    console.log('\nIdentifiants assignés automatiquement (nouvel exposant) :');
    for (const j of journalIdentifiants) console.log(`  - ligne ${j.ligne} → ${j.id}`);
  }
  if (renommages.length > 0) {
    console.log('\nRenommages détectés (même exposantId, nouveau slug) :');
    for (const r of renommages) console.log(`  - ${r.exposantId} : ${r.ancienSlug} → ${r.nouveauSlug} (ancien fichier ${r.ancienFichier} supprimé)`);
  }
  if (avertissementsGlobaux.length > 0 || avertissementsCapacites.length > 0) {
    console.log('\nAvertissements :');
    for (const a of [...avertissementsGlobaux, ...avertissementsCapacites]) console.log(`  - ${a}`);
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

  await mkdir(DOSSIER_EXPOSANTS, { recursive: true });
  for (const item of plan) {
    if (item.ancienFichier && item.ancienFichier !== item.fichier) {
      await unlink(path.join(DOSSIER_EXPOSANTS, item.ancienFichier));
    }
    await writeFile(item.cheminComplet, item.contenuGenere, 'utf8');
  }
  console.log(`\n${plan.length} fichier(s) écrit(s) dans ${path.relative(RACINE, DOSSIER_EXPOSANTS)}/.`);
  return 0;
}

async function commandeCheck() {
  const existantes = await listerExposantsExistants();
  const { erreurs, avertissements } = verifierCapacitesEtStands([], existantes);
  const doublonsId = detecterDoublons(existantes, 'exposantId');

  console.log(`Collection actuelle : ${existantes.length} exposant(s).`);
  if (doublonsId.length > 0) {
    console.log('\nIdentifiants dupliqués :');
    for (const d of doublonsId) console.log(`  - ${d.valeur} (${d.occurrences} fichiers)`);
  }
  if (erreurs.length > 0) {
    console.log('\nCapacités dépassées :');
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
      console.error('Usage : node scripts/import-exposants.mjs <fichier.csv> [--dry-run]');
      console.error('        node scripts/import-exposants.mjs --check');
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
