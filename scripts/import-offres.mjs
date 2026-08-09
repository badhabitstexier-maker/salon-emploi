#!/usr/bin/env node
/*
  Import des offres exposants dans la collection Astro `offres`
  (src/content/offres/), à partir d'un CSV normalisé (une offre par ligne).

  Usage :
    node scripts/import-offres.mjs <fichier.csv> [--dry-run]
    node scripts/import-offres.mjs --check

  Voir docs/WORKFLOW_OFFRES_2026.md pour la procédure complète (Google Forms
  → Sheets → validation LabEvents → export CSV → cette commande).

  Le mode --dry-run n'écrit jamais sur le disque. Sans --dry-run, l'import
  est « tout ou rien » : s'il reste une seule erreur bloquante, aucun fichier
  n'est écrit (voir CLAUDE.md, prudence sur les écritures automatiques).
*/
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjets } from './lib/csv.mjs';
import {
  COLONNES_REQUISES,
  COLONNES_INTERNES_IGNOREES,
  ligneEstVide,
  validerLigne,
  assignerReferencesManquantes,
  rapprocherReferencesExistantes,
  detecterDoublonsReferences,
  verifierQuotas,
  verifierExposantsConnus,
  verifierFormuleCoherente,
  slugDepuisReference,
  genererContenuOffre,
  lireResumeFrontmatter,
} from './lib/offres-import-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');
const DOSSIER_OFFRES = path.join(RACINE, 'src/content/offres');
const DOSSIER_EXPOSANTS = path.join(RACINE, 'src/content/exposants');

function parseArgs(argv) {
  const args = { dryRun: false, check: false, fichier: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check') args.check = true;
    else if (!a.startsWith('--')) args.fichier = a;
  }
  return args;
}

async function listerOffresExistantes() {
  if (!existsSync(DOSSIER_OFFRES)) return [];
  const fichiers = (await readdir(DOSSIER_OFFRES)).filter((f) => f.endsWith('.md'));
  const resultats = [];
  for (const fichier of fichiers) {
    const contenu = await readFile(path.join(DOSSIER_OFFRES, fichier), 'utf8');
    const resume = lireResumeFrontmatter(contenu);
    if (resume.reference) resultats.push({ ...resume, fichier, contenu });
  }
  return resultats;
}

/*
  Référentiel exposants (Lot Admin-1C) : lecture directe du dossier
  `src/content/exposants/` — volontairement une simple lecture de fichiers,
  pas un import du module `exposants-import-core.mjs` (les deux pipelines
  restent indépendants, voir CLAUDE.md section 16 sur le couplage entre
  mécanismes). Retourne `null` si le référentiel n'est pas disponible ou pas
  encore peuplé (aucun exposant) : `exposants` est le référentiel maître,
  donc `verifierExposantsConnus` traite ce `null` en **fail-closed** — toute
  offre réelle du lot est alors refusée (les offres TEST restent autorisées,
  voir `docs/OFFRES.md` section 3bis).
*/
async function listerReferentielExposants() {
  if (!existsSync(DOSSIER_EXPOSANTS)) return null;
  const fichiers = (await readdir(DOSSIER_EXPOSANTS)).filter((f) => f.endsWith('.md'));
  const ids = new Set();
  const formulePar = new Map();
  for (const fichier of fichiers) {
    const contenu = await readFile(path.join(DOSSIER_EXPOSANTS, fichier), 'utf8');
    const exposantId = /^exposantId:\s*(.+)$/m.exec(contenu)?.[1]?.trim().replace(/^["']|["']$/g, '');
    const formule = /^formule:\s*(.+)$/m.exec(contenu)?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (!exposantId) continue;
    ids.add(exposantId);
    if (formule) formulePar.set(exposantId, formule);
  }
  if (ids.size === 0) return null;
  return { ids, formulePar };
}

function verifierColonnes(entetes) {
  const avertissements = [];
  const manquantes = COLONNES_REQUISES.filter((c) => !entetes.includes(c));
  if (manquantes.length > 0) {
    avertissements.push(
      `Colonnes absentes du CSV (traitées comme vides) : ${manquantes.join(', ')}.`,
    );
  }
  const inconnues = entetes.filter(
    (c) => !COLONNES_REQUISES.includes(c) && !COLONNES_INTERNES_IGNOREES.includes(c),
  );
  if (inconnues.length > 0) {
    avertissements.push(
      `Colonnes non reconnues, ignorées (vérifier une faute de frappe éventuelle) : ${inconnues.join(', ')}.`,
    );
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
    const numeroLigne = index + 2; // +1 en-tête, +1 index 1-based
    if (ligneEstVide(ligne)) {
      ignorees.push({ numeroLigne, raison: 'intitulé vide (bloc non déclaré)' });
      return;
    }
    const resultat = validerLigne(ligne, numeroLigne);
    if (!resultat.ok) {
      enErreur.push(resultat);
      return;
    }
    resultat.offre.__numeroLigne = numeroLigne;
    valides.push(resultat.offre);
    if (resultat.avertissements.length > 0) {
      avertissementsGlobaux.push(...resultat.avertissements.map((a) => `Ligne ${numeroLigne} : ${a}`));
    }
  });

  const existantes = await listerOffresExistantes();

  const journalRapprochements = rapprocherReferencesExistantes(valides, existantes);
  const journalReferences = assignerReferencesManquantes(
    valides,
    existantes.map((o) => o.reference),
  );

  const doublons = detecterDoublonsReferences(valides);
  const doublonsAvecExistantesDifferentExposant = [];
  for (const offre of valides) {
    const existante = existantes.find((e) => e.reference === offre.reference);
    if (existante && existante.exposantId !== offre.exposantId) {
      doublonsAvecExistantesDifferentExposant.push({
        reference: offre.reference,
        exposantExistant: existante.exposantId,
        exposantLot: offre.exposantId,
      });
    }
  }

  const { erreurs: erreursQuotas, avertissements: avertissementsQuotas } = verifierQuotas(valides, existantes);

  const referentielExposants = await listerReferentielExposants();
  const { erreurs: erreursExposantsConnus } = verifierExposantsConnus(
    valides,
    referentielExposants?.ids ?? null,
  );
  const { erreurs: erreursFormuleCoherente } = verifierFormuleCoherente(
    valides,
    referentielExposants?.formulePar ?? null,
  );

  const erreursBloquantes = [
    ...enErreur.map((e) => `Ligne ${e.numeroLigne} : ${e.erreurs.join(' ')}`),
    ...doublons.map((d) => `Référence dupliquée dans le CSV : ${d.reference} (${d.occurrences} occurrences).`),
    ...erreursExposantsConnus,
    ...erreursFormuleCoherente,
    ...doublonsAvecExistantesDifferentExposant.map(
      (d) =>
        `Référence ${d.reference} déjà attribuée à l'exposant « ${d.exposantExistant} » — ne peut pas être réattribuée à « ${d.exposantLot} ».`,
    ),
    ...erreursQuotas,
  ];

  // Plan d'écriture (créées / mises à jour / inchangées).
  const plan = valides.map((offre) => {
    const slug = slugDepuisReference(offre.reference);
    const fichier = `${slug}.md`;
    const cheminComplet = path.join(DOSSIER_OFFRES, fichier);
    const contenuGenere = genererContenuOffre(offre);
    return { offre, fichier, cheminComplet, contenuGenere };
  });

  console.log(`\nLecture : ${lignes.length} ligne(s) de données dans ${path.basename(cheminCsv)}.`);
  console.log(`Offres valides : ${valides.length}`);
  console.log(`Lignes ignorées (bloc vide) : ${ignorees.length}`);
  console.log(`Lignes en erreur : ${enErreur.length}`);

  if (journalRapprochements.length > 0) {
    console.log('\nRéférences rapprochées d\'une offre existante (même exposant + même intitulé) :');
    for (const j of journalRapprochements) console.log(`  - ligne ${j.ligne} → ${j.reference} (${j.intitule})`);
  }

  if (journalReferences.length > 0) {
    console.log('\nRéférences assignées automatiquement (nouvelle offre) :');
    for (const j of journalReferences) console.log(`  - ligne ${j.ligne} → ${j.reference} (${j.intitule})`);
  }

  if (avertissementsGlobaux.length > 0 || avertissementsQuotas.length > 0) {
    console.log('\nAvertissements :');
    for (const a of [...avertissementsGlobaux, ...avertissementsQuotas]) console.log(`  - ${a}`);
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
      etat = 'créée';
    }
    if (etat === 'créée') resume.creees += 1;
    else if (etat === 'mise à jour') resume.misesAJour += 1;
    else resume.inchangees += 1;
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

  await mkdir(DOSSIER_OFFRES, { recursive: true });
  for (const item of plan) {
    await writeFile(item.cheminComplet, item.contenuGenere, 'utf8');
  }
  console.log(`\n${plan.length} fichier(s) écrit(s) dans ${path.relative(RACINE, DOSSIER_OFFRES)}/.`);
  return 0;
}

async function commandeCheck() {
  const existantes = await listerOffresExistantes();
  const { erreurs, avertissements } = verifierQuotas(
    existantes.map((o) => ({ ...o, __numeroLigne: null })),
    [],
  );
  const doublons = detecterDoublonsReferences(existantes);

  const referentielExposants = await listerReferentielExposants();
  const { erreurs: erreursExposantsConnus } = verifierExposantsConnus(
    existantes,
    referentielExposants?.ids ?? null,
  );
  const { erreurs: erreursFormuleCoherente } = verifierFormuleCoherente(
    existantes,
    referentielExposants?.formulePar ?? null,
  );

  console.log(`Collection actuelle : ${existantes.length} offre(s).`);
  if (doublons.length > 0) {
    console.log('\nRéférences dupliquées :');
    for (const d of doublons) console.log(`  - ${d.reference} (${d.occurrences} fichiers)`);
  }
  if (erreurs.length > 0) {
    console.log('\nQuotas dépassés :');
    for (const e of erreurs) console.log(`  - ${e}`);
  }
  if (erreursExposantsConnus.length > 0) {
    console.log('\nExposant inconnu ou référentiel indisponible :');
    for (const e of erreursExposantsConnus) console.log(`  - ${e}`);
  }
  if (erreursFormuleCoherente.length > 0) {
    console.log('\nFormule incohérente avec l\'exposant :');
    for (const e of erreursFormuleCoherente) console.log(`  - ${e}`);
  }
  if (avertissements.length > 0) {
    console.log('\nAvertissements :');
    for (const a of avertissements) console.log(`  - ${a}`);
  }
  const enErreur =
    doublons.length > 0 || erreurs.length > 0 || erreursExposantsConnus.length > 0 || erreursFormuleCoherente.length > 0;
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
      console.error('Usage : node scripts/import-offres.mjs <fichier.csv> [--dry-run]');
      console.error('        node scripts/import-offres.mjs --check');
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
