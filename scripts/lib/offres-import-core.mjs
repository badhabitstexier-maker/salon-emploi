/*
  Logique pure du pipeline d'import des offres exposants (Lot 3, voir
  docs/WORKFLOW_OFFRES_2026.md et docs/OFFRES_EXPOSANTS.md).

  Ce module ne touche ni au système de fichiers ni à la sortie console : il
  prend des données déjà lues (lignes CSV, fichiers existants) et retourne des
  structures de résultat. C'est scripts/import-offres.mjs qui orchestre les
  effets de bord (lecture/écriture disque, affichage), ce qui permet de tester
  ce fichier avec `node --test` sans manipuler de vrais fichiers.

  Source de vérité du schéma : src/content.config.ts (collection `offres`).
  Ne pas ajouter ici un champ que le schéma Astro n'utilise pas.
*/

export const STATUTS = ['recue', 'a-completer', 'validee', 'publiee', 'retiree', 'cloturee'];
export const STATUTS_ACTIFS = ['recue', 'a-completer', 'validee', 'publiee'];
export const FORMULES = ['standard', 'silver', 'gold'];
export const TYPES_CONTRAT = ['CDI', 'CDD', 'Alternance', 'Stage', 'Intérim', 'Saisonnier', 'Autre'];

export const QUOTAS = { standard: 5, silver: 10, gold: null };

export const REFERENCE_REGEX = /^SEF26-\d{3,}$/;

/*
  Colonnes du CSV normalisé (une offre par ligne) — voir
  data/templates/offres-import.csv. Elles correspondent 1:1 aux champs du
  schéma `offres` de src/content.config.ts. Les listes (typeContrat,
  niveauFormation, missions, competencesPrerequis) sont sérialisées avec
  `|` comme séparateur dans une seule cellule CSV.
*/
export const COLONNES_REQUISES = [
  'reference',
  'status',
  'intitule',
  'exposantId',
  'exposantNom',
  'formule',
  'secteur',
  'typeContrat',
  'lieu',
  'nombrePostes',
  'datePrisePoste',
  'niveauFormation',
  'niveauExperience',
  'sansExperience',
  'descriptionCourte',
  'missions',
  'competencesPrerequis',
  'accepteCandidaturesEnLigne',
  'datePublication',
  'dateCloture',
  'miseEnAvant',
];

/*
  Colonnes tolérées dans un export Google Sheets mais jamais écrites dans le
  contenu du site : données internes LabEvents (contact RH, suivi) — voir
  CLAUDE.md et mission Lot 3, section 22 (confidentialité). Toute colonne
  absente des deux listes déclenche un avertissement (faute de frappe
  probable), pas une erreur bloquante.
*/
export const COLONNES_INTERNES_IGNOREES = [
  'contactNom',
  'contactEmail',
  'contactTelephone',
  'identifiantExposant',
  'typeSoumission',
  'dateReponse',
  'statutTraitement',
  'notesInternes',
  'remuneration',
  'accesProfils',
  'pointPreparation',
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function listeDepuisCellule(valeur) {
  return (valeur ?? '')
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function boolDepuisCellule(valeur, defaut) {
  const v = (valeur ?? '').trim().toLowerCase();
  if (v === '') return defaut;
  if (['oui', 'true', 'vrai', '1', 'yes'].includes(v)) return true;
  if (['non', 'false', 'faux', '0', 'no'].includes(v)) return false;
  return undefined; // valeur invalide, détectée par l'appelant
}

/** Une ligne est un « bloc vide » (offre non déclarée) si l'intitulé est vide. */
export function ligneEstVide(ligne) {
  return (ligne.intitule ?? '').trim() === '';
}

/**
 * Valide et transforme une ligne CSV brute en données prêtes pour le
 * frontmatter Astro. Ne consulte ni les autres lignes (doublons/quotas) ni le
 * disque (délégués à la fonction appelante) — uniquement la validité
 * intrinsèque de la ligne.
 */
export function validerLigne(ligne, numeroLigne) {
  const erreurs = [];
  const avertissements = [];

  const champTexte = (nom, { requis = true } = {}) => {
    const valeur = (ligne[nom] ?? '').trim();
    if (requis && valeur === '') erreurs.push(`Colonne « ${nom} » manquante ou vide.`);
    return valeur;
  };

  const reference = (ligne.reference ?? '').trim();
  if (reference && !REFERENCE_REGEX.test(reference)) {
    erreurs.push(`Référence « ${reference} » mal formée (attendu : SEF26-XXX).`);
  }

  const status = champTexte('status', { requis: false }) || 'recue';
  if (!STATUTS.includes(status)) {
    erreurs.push(`Statut « ${status} » invalide (valeurs autorisées : ${STATUTS.join(', ')}).`);
  }

  const intitule = champTexte('intitule');
  const exposantId = champTexte('exposantId');
  const exposantNom = champTexte('exposantNom');

  const formule = champTexte('formule');
  if (formule && !FORMULES.includes(formule)) {
    erreurs.push(`Formule « ${formule} » invalide (valeurs autorisées : ${FORMULES.join(', ')}).`);
  }

  const secteur = champTexte('secteur');
  const lieu = champTexte('lieu');
  const niveauExperience = champTexte('niveauExperience');
  const descriptionCourte = champTexte('descriptionCourte');

  const typeContrat = listeDepuisCellule(ligne.typeContrat);
  if (typeContrat.length === 0) {
    erreurs.push('Colonne « typeContrat » manquante ou vide (au moins une valeur requise).');
  }
  for (const t of typeContrat) {
    if (!TYPES_CONTRAT.includes(t)) {
      erreurs.push(`Type de contrat « ${t} » invalide (valeurs autorisées : ${TYPES_CONTRAT.join(', ')}).`);
    }
  }

  const nombrePostesBrut = (ligne.nombrePostes ?? '').trim();
  let nombrePostes = 1;
  if (nombrePostesBrut !== '') {
    const n = Number(nombrePostesBrut);
    if (!Number.isInteger(n) || n <= 0) {
      erreurs.push(`« nombrePostes » doit être un entier positif (reçu : « ${nombrePostesBrut} »).`);
    } else {
      nombrePostes = n;
    }
  }

  const datePrisePoste = (ligne.datePrisePoste ?? '').trim() || undefined;
  const niveauFormation = listeDepuisCellule(ligne.niveauFormation);
  const missions = listeDepuisCellule(ligne.missions);
  const competencesPrerequis = listeDepuisCellule(ligne.competencesPrerequis);

  const sansExperience = boolDepuisCellule(ligne.sansExperience, false);
  if (sansExperience === undefined) erreurs.push(`« sansExperience » doit être oui/non (reçu : « ${ligne.sansExperience} »).`);

  const accepteCandidaturesEnLigne = boolDepuisCellule(ligne.accepteCandidaturesEnLigne, true);
  if (accepteCandidaturesEnLigne === undefined) {
    erreurs.push(`« accepteCandidaturesEnLigne » doit être oui/non (reçu : « ${ligne.accepteCandidaturesEnLigne} »).`);
  }

  const miseEnAvant = boolDepuisCellule(ligne.miseEnAvant, false);
  if (miseEnAvant === undefined) erreurs.push(`« miseEnAvant » doit être oui/non (reçu : « ${ligne.miseEnAvant} »).`);

  const datePublicationBrut = champTexte('datePublication');
  if (datePublicationBrut && !DATE_REGEX.test(datePublicationBrut)) {
    erreurs.push(`« datePublication » doit être au format AAAA-MM-JJ (reçu : « ${datePublicationBrut} »).`);
  }

  // `dateCloture` est une date facultative de fin de validité de l'offre —
  // ne pas confondre avec la conservation des données candidat (Tally, voir
  // docs/CANDIDATURES_TALLY.md). Absente : on ne l'invente jamais.
  const dateClotureBrutSaisie = (ligne.dateCloture ?? '').trim();
  let dateCloture;
  if (dateClotureBrutSaisie) {
    if (!DATE_REGEX.test(dateClotureBrutSaisie)) {
      erreurs.push(`« dateCloture » doit être au format AAAA-MM-JJ (reçu : « ${dateClotureBrutSaisie} »).`);
    } else {
      dateCloture = dateClotureBrutSaisie;
    }
  }

  if (erreurs.length > 0) {
    return { ok: false, numeroLigne, reference: reference || null, erreurs, avertissements };
  }

  return {
    ok: true,
    numeroLigne,
    avertissements,
    offre: {
      reference: reference || null, // null => à assigner automatiquement
      status,
      intitule,
      exposantId,
      exposantNom,
      formule,
      secteur,
      typeContrat,
      lieu,
      nombrePostes,
      datePrisePoste,
      niveauFormation,
      niveauExperience,
      sansExperience,
      descriptionCourte,
      missions,
      competencesPrerequis,
      accepteCandidaturesEnLigne,
      datePublication: datePublicationBrut,
      dateCloture,
      miseEnAvant,
    },
  };
}

/**
 * Assigne une référence SEF26-NNN aux offres qui n'en ont pas encore, de
 * façon déterministe et séquentielle : on part du plus grand numéro déjà vu
 * (import compris) et on incrémente. Ne réattribue jamais un numéro déjà
 * utilisé. Modifie les offres en place (mute `reference`) et retourne le
 * journal des attributions pour affichage.
 */
export function assignerReferencesManquantes(offres, referencesExistantes) {
  const utilises = new Set(referencesExistantes);
  for (const offre of offres) {
    if (offre.reference) utilises.add(offre.reference);
  }

  let max = 0;
  for (const ref of utilises) {
    const m = /^SEF26-(\d+)$/.exec(ref);
    if (m) max = Math.max(max, Number(m[1]));
  }

  const journal = [];
  for (const offre of offres) {
    if (!offre.reference) {
      max += 1;
      const nouvelle = `SEF26-${String(max).padStart(3, '0')}`;
      offre.reference = nouvelle;
      utilises.add(nouvelle);
      journal.push({ ligne: offre.__numeroLigne, reference: nouvelle, intitule: offre.intitule });
    }
  }
  return journal;
}

/** Détecte les références dupliquées à l'intérieur d'un même lot d'import. */
export function detecterDoublonsReferences(offres) {
  const vues = new Map();
  const doublons = [];
  for (const offre of offres) {
    if (!vues.has(offre.reference)) {
      vues.set(offre.reference, []);
    }
    vues.get(offre.reference).push(offre);
  }
  for (const [reference, liste] of vues) {
    if (liste.length > 1) doublons.push({ reference, occurrences: liste.length });
  }
  return doublons;
}

/**
 * Vérifie les quotas Standard(5) / Silver(10) / Gold(illimité) par exposant,
 * sur l'ensemble « offres actives » = lignes du lot + offres déjà publiées ou
 * en cours de traitement dans la collection existante, moins celles que ce
 * lot remplace (même référence). N'inclut pas les offres retirées/clôturées.
 *
 * @param offres offres valides du lot (avec référence assignée)
 * @param existantes offres déjà présentes dans src/content/offres (résumé : reference, exposantId, formule, status)
 */
export function verifierQuotas(offres, existantes) {
  const referencesDuLot = new Set(offres.map((o) => o.reference));
  const parExposant = new Map();

  const compter = (o) => {
    if (!STATUTS_ACTIFS.includes(o.status)) return;
    if (!parExposant.has(o.exposantId)) parExposant.set(o.exposantId, { formules: new Set(), references: new Set() });
    const entree = parExposant.get(o.exposantId);
    entree.formules.add(o.formule);
    entree.references.add(o.reference);
  };

  for (const o of existantes) {
    if (referencesDuLot.has(o.reference)) continue; // remplacée par le lot, comptée une seule fois plus bas
    compter(o);
  }
  for (const o of offres) compter(o);

  const erreurs = [];
  const avertissements = [];

  for (const [exposantId, { formules, references }] of parExposant) {
    if (formules.size > 1) {
      erreurs.push(
        `Exposant « ${exposantId} » : formule incohérente entre offres (${[...formules].join(', ')}) — à clarifier avant import.`,
      );
      continue;
    }
    const [formule] = formules;
    const plafond = QUOTAS[formule];
    const total = references.size;
    if (plafond !== null && total > plafond) {
      erreurs.push(
        `Exposant « ${exposantId} » (formule ${formule}) : ${total} offres actives, plafond ${plafond} dépassé.`,
      );
    } else if (formule === 'gold' && total > QUOTAS.silver) {
      avertissements.push(
        `Exposant « ${exposantId} » (formule gold) : ${total} offres actives — vérifier si des annonces très similaires peuvent être regroupées (pas de blocage automatique).`,
      );
    }
  }

  return { erreurs, avertissements };
}

/** Nom de fichier stable et déterministe : dérivé uniquement de la référence. */
export function slugDepuisReference(reference) {
  return reference.toLowerCase();
}

function ligneYamlListe(cle, valeurs) {
  if (valeurs.length === 0) return `${cle}: []`;
  const items = valeurs.map((v) => `  - ${JSON.stringify(v)}`).join('\n');
  return `${cle}:\n${items}`;
}

/**
 * Génère le contenu Markdown/frontmatter d'une offre, dans le format attendu
 * par src/content.config.ts et documenté dans docs/OFFRES.md. Sérialisation
 * déterministe (ordre de champs fixe) pour permettre une comparaison texte
 * simple lors de la détection « inchangée / mise à jour ».
 */
export function genererContenuOffre(offre) {
  const lignes = [
    '---',
    `reference: ${JSON.stringify(offre.reference)}`,
    `status: ${JSON.stringify(offre.status)}`,
    `intitule: ${JSON.stringify(offre.intitule)}`,
    `exposantId: ${JSON.stringify(offre.exposantId)}`,
    `exposantNom: ${JSON.stringify(offre.exposantNom)}`,
    `formule: ${JSON.stringify(offre.formule)}`,
    `secteur: ${JSON.stringify(offre.secteur)}`,
    ligneYamlListe('typeContrat', offre.typeContrat),
    `lieu: ${JSON.stringify(offre.lieu)}`,
    `nombrePostes: ${offre.nombrePostes}`,
  ];
  if (offre.datePrisePoste) lignes.push(`datePrisePoste: ${JSON.stringify(offre.datePrisePoste)}`);
  lignes.push(
    ligneYamlListe('niveauFormation', offre.niveauFormation),
    `niveauExperience: ${JSON.stringify(offre.niveauExperience)}`,
    `sansExperience: ${offre.sansExperience}`,
    `descriptionCourte: ${JSON.stringify(offre.descriptionCourte)}`,
    ligneYamlListe('missions', offre.missions),
    ligneYamlListe('competencesPrerequis', offre.competencesPrerequis),
    `accepteCandidaturesEnLigne: ${offre.accepteCandidaturesEnLigne}`,
    `datePublication: ${offre.datePublication}`,
  );
  if (offre.dateCloture) lignes.push(`dateCloture: ${offre.dateCloture}`);
  lignes.push(`miseEnAvant: ${offre.miseEnAvant}`, '---', '');
  return lignes.join('\n');
}

/**
 * Lecture minimale du frontmatter d'un fichier offre déjà existant — se
 * limite aux champs nécessaires au diff et aux quotas (reference, status,
 * exposantId, formule). Suppose le format généré par ce script ou celui
 * documenté dans docs/OFFRES.md (une valeur scalaire par ligne `cle: ...`).
 */
export function lireResumeFrontmatter(contenu) {
  const extraire = (cle) => {
    const m = new RegExp(`^${cle}:\\s*(.+)$`, 'm').exec(contenu);
    if (!m) return undefined;
    const brut = m[1].trim();
    try {
      return JSON.parse(brut);
    } catch {
      return brut.replace(/^["']|["']$/g, '');
    }
  };
  return {
    reference: extraire('reference'),
    status: extraire('status'),
    exposantId: extraire('exposantId'),
    formule: extraire('formule'),
    intitule: extraire('intitule'),
  };
}

/**
 * Avant d'assigner une nouvelle référence à une ligne sans `reference`,
 * tente de la faire correspondre à une offre déjà existante portant le même
 * exposant et le même intitulé (comparaison exacte, texte normalisé). Cela
 * garantit l'idempotence du réimport d'un même CSV à référence vide : sans
 * cette étape, chaque réimport créerait une nouvelle offre au lieu de
 * mettre à jour la précédente (voir docs/WORKFLOW_OFFRES_2026.md).
 *
 * Ne modifie que les offres pour lesquelles une correspondance unique et non
 * ambiguë est trouvée ; en cas d'ambiguïté (plusieurs candidates), ne
 * rapproche rien et laisse `assignerReferencesManquantes` créer une
 * référence neuve — plus sûr qu'un rapprochement incertain.
 */
export function rapprocherReferencesExistantes(offres, existantes) {
  const cleNormalisee = (v) => (v ?? '').trim().toLowerCase();
  const journal = [];

  for (const offre of offres) {
    if (offre.reference) continue;
    const candidates = existantes.filter(
      (e) => cleNormalisee(e.exposantId) === cleNormalisee(offre.exposantId) && cleNormalisee(e.intitule) === cleNormalisee(offre.intitule),
    );
    if (candidates.length === 1) {
      offre.reference = candidates[0].reference;
      journal.push({ ligne: offre.__numeroLigne, reference: candidates[0].reference, intitule: offre.intitule });
    }
  }
  return journal;
}
