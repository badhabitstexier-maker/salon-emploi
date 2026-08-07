/*
  Logique pure du pipeline d'import du programme (Lot 4A, voir
  docs/PROGRAMME_IMPORT.md). Même architecture que le pipeline Offres
  (Lot 3) et le pipeline Exposants (Lot 4A) : ce module ne touche ni au
  système de fichiers ni à la sortie console — scripts/import-programme.mjs
  orchestre les effets de bord.

  Source de vérité du schéma : src/content.config.ts (collection
  `programme`). Ne pas ajouter ici un champ que le schéma Astro n'utilise
  pas.
*/
import { listeDepuisCellule, boolDepuisCellule, SLUG_REGEX, DATE_REGEX } from './import-shared.mjs';

export const DATES = ['2026-10-30', '2026-10-31'];
export const UNIVERS = ['emploi', 'formation', 'transversal'];
export const TYPES = ['conference', 'atelier', 'demonstration', 'rencontre', 'information', 'autre'];

export const PROGRAMME_ID_REGEX = /^PROG26-\d{3,}$/;

const HEURE_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/* Horaires publics du salon (CLAUDE.md, section 2) : 9h–17h les deux jours. */
export const SALON_DEBUT = '09:00';
export const SALON_FIN = '17:00';

export const COLONNES_REQUISES = ['programmeId', 'slug', 'titre', 'date', 'heure_debut', 'univers', 'type', 'accroche', 'description'];
export const COLONNES_FACULTATIVES = [
  'heure_fin',
  'lieu',
  'publics',
  'intervenants',
  'organisateur',
  'exposant_lie',
  'inscription_requise',
  'lien_inscription',
  'capacite_limitee',
  'mise_en_avant',
  'publie',
  'ordre',
  'date_mise_a_jour',
];
export const COLONNES_CONNUES = [...COLONNES_REQUISES, ...COLONNES_FACULTATIVES];

/** Une ligne est un « bloc vide » (activité non déclarée) si le titre est vide. */
export function ligneEstVide(ligne) {
  return (ligne.titre ?? '').trim() === '';
}

/** Compare deux heures « HH:MM » (ordre lexicographique valide sur ce format). */
function heureAvant(a, b) {
  return a < b;
}

/**
 * Parse la cellule `intervenants` : plusieurs intervenants séparés par
 * `|`, chacun au format `nom;fonction;organisme` (fonction et organisme
 * facultatifs). Exemple : `"Jeanne Dupont;Chargée de recrutement;Pacific
 * Industrie|Marc Martin"`.
 */
function intervenantsDepuisCellule(valeur, erreurs) {
  const brut = (valeur ?? '').trim();
  if (brut === '') return [];
  return brut
    .split('|')
    .map((bloc) => bloc.trim())
    .filter((bloc) => bloc.length > 0)
    .map((bloc) => {
      const [nom, fonction, organisme] = bloc.split(';').map((v) => (v ?? '').trim());
      if (!nom) {
        erreurs.push(`« intervenants » : bloc « ${bloc} » sans nom (format attendu : nom;fonction;organisme).`);
        return null;
      }
      const intervenant = { nom };
      if (fonction) intervenant.fonction = fonction;
      if (organisme) intervenant.organisme = organisme;
      return intervenant;
    })
    .filter(Boolean);
}

/**
 * Valide et transforme une ligne CSV brute. Ne consulte ni les autres
 * lignes (doublons/conflits d'horaires) ni le disque — délégués à
 * l'appelant.
 */
export function validerLigne(ligne, numeroLigne) {
  const erreurs = [];
  const avertissements = [];

  const champTexte = (nom, { requis = true } = {}) => {
    const valeur = (ligne[nom] ?? '').trim();
    if (requis && valeur === '') erreurs.push(`Colonne « ${nom} » manquante ou vide.`);
    return valeur;
  };

  const programmeId = (ligne.programmeId ?? '').trim();
  if (programmeId && !PROGRAMME_ID_REGEX.test(programmeId)) {
    erreurs.push(`« programmeId » « ${programmeId} » mal formé (attendu : PROG26-XXX).`);
  }

  const slug = champTexte('slug');
  if (slug && !SLUG_REGEX.test(slug)) {
    erreurs.push(`« slug » « ${slug} » invalide (minuscules, chiffres, tirets, sans accents ni espaces).`);
  }

  const titre = champTexte('titre');

  const date = champTexte('date');
  if (date && !DATES.includes(date)) {
    erreurs.push(`« date » « ${date} » invalide (valeurs autorisées : ${DATES.join(', ')} — hors dates de l'événement).`);
  }

  const heureDebut = champTexte('heure_debut');
  if (heureDebut && !HEURE_REGEX.test(heureDebut)) {
    erreurs.push(`« heure_debut » « ${heureDebut} » invalide (format attendu : HH:MM).`);
  }

  const heureFin = champTexte('heure_fin', { requis: false });
  if (heureFin && !HEURE_REGEX.test(heureFin)) {
    erreurs.push(`« heure_fin » « ${heureFin} » invalide (format attendu : HH:MM).`);
  }

  if (heureDebut && heureFin && HEURE_REGEX.test(heureDebut) && HEURE_REGEX.test(heureFin)) {
    if (!heureAvant(heureDebut, heureFin)) {
      erreurs.push(`« heure_fin » (${heureFin}) doit être strictement postérieure à « heure_debut » (${heureDebut}).`);
    } else {
      const entierementAvant = !heureAvant(SALON_DEBUT, heureFin); // fin <= 09:00
      const entierementApres = !heureAvant(heureDebut, SALON_FIN); // debut >= 17:00
      if (entierementAvant || entierementApres) {
        erreurs.push(`Activité entièrement hors horaires du salon (${SALON_DEBUT}–${SALON_FIN}) : ${heureDebut}–${heureFin}.`);
      } else {
        if (heureAvant(heureDebut, SALON_DEBUT)) {
          avertissements.push(`Début (${heureDebut}) avant l'ouverture du salon (${SALON_DEBUT}).`);
        }
        if (heureAvant(SALON_FIN, heureFin)) {
          avertissements.push(`Fin (${heureFin}) après la fermeture du salon (${SALON_FIN}).`);
        }
      }
    }
  }

  const univers = champTexte('univers');
  if (univers && !UNIVERS.includes(univers)) {
    erreurs.push(`« univers » « ${univers} » invalide (valeurs autorisées : ${UNIVERS.join(', ')}).`);
  }

  const type = champTexte('type');
  if (type && !TYPES.includes(type)) {
    erreurs.push(`« type » « ${type} » invalide (valeurs autorisées : ${TYPES.join(', ')}).`);
  }

  const lieu = champTexte('lieu', { requis: false });
  const accroche = champTexte('accroche');
  const description = champTexte('description');

  const publics = listeDepuisCellule(ligne.publics);
  const intervenants = intervenantsDepuisCellule(ligne.intervenants, erreurs);

  const organisateur = champTexte('organisateur', { requis: false });
  const exposantLie = champTexte('exposant_lie', { requis: false });

  const inscriptionRequise = boolDepuisCellule(ligne.inscription_requise, false);
  if (inscriptionRequise === undefined) erreurs.push(`« inscription_requise » doit être oui/non (reçu : « ${ligne.inscription_requise} »).`);

  const lienInscription = champTexte('lien_inscription', { requis: false });

  const capaciteLimitee = boolDepuisCellule(ligne.capacite_limitee, false);
  if (capaciteLimitee === undefined) erreurs.push(`« capacite_limitee » doit être oui/non (reçu : « ${ligne.capacite_limitee} »).`);

  const miseEnAvant = boolDepuisCellule(ligne.mise_en_avant, false);
  if (miseEnAvant === undefined) erreurs.push(`« mise_en_avant » doit être oui/non (reçu : « ${ligne.mise_en_avant} »).`);

  const publie = boolDepuisCellule(ligne.publie, false);
  if (publie === undefined) erreurs.push(`« publie » doit être oui/non (reçu : « ${ligne.publie} »).`);

  const ordreBrut = (ligne.ordre ?? '').trim();
  let ordre;
  if (ordreBrut !== '') {
    const n = Number(ordreBrut);
    if (!Number.isFinite(n)) {
      erreurs.push(`« ordre » doit être un nombre (reçu : « ${ordreBrut} »).`);
    } else {
      ordre = n;
    }
  }

  const dateMiseAJour = (ligne.date_mise_a_jour ?? '').trim();
  if (dateMiseAJour && !DATE_REGEX.test(dateMiseAJour)) {
    erreurs.push(`« date_mise_a_jour » doit être au format AAAA-MM-JJ (reçu : « ${dateMiseAJour} »).`);
  }

  if (erreurs.length > 0) {
    return { ok: false, numeroLigne, slug: slug || null, erreurs, avertissements };
  }

  return {
    ok: true,
    numeroLigne,
    avertissements,
    activite: {
      programmeId: programmeId || null,
      slug,
      titre,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin || undefined,
      univers,
      type,
      lieu: lieu || undefined,
      accroche,
      description,
      publics: publics.length > 0 ? publics : undefined,
      intervenants: intervenants.length > 0 ? intervenants : undefined,
      organisateur: organisateur || undefined,
      exposant_lie: exposantLie || undefined,
      inscription_requise: inscriptionRequise,
      lien_inscription: lienInscription || undefined,
      capacite_limitee: capaciteLimitee,
      mise_en_avant: miseEnAvant,
      publie,
      ordre,
      date_mise_a_jour: dateMiseAJour || undefined,
    },
  };
}

/**
 * Avant d'assigner un nouveau `programmeId` à une ligne qui n'en a pas,
 * tente de la faire correspondre à une entrée déjà existante portant le
 * même `slug`. En cas d'ambiguïté, ne rapproche rien.
 */
export function rapprocherIdentifiantsParSlug(activites, existantes) {
  const journal = [];
  for (const activite of activites) {
    if (activite.programmeId) continue;
    const candidates = existantes.filter((e) => e.slug === activite.slug);
    if (candidates.length === 1) {
      activite.programmeId = candidates[0].programmeId;
      journal.push({ ligne: activite.__numeroLigne, programmeId: candidates[0].programmeId, slug: activite.slug });
    }
  }
  return journal;
}

/** Détecte les doublons d'une clé donnée (`programmeId` ou `slug`) au sein du lot. */
export function detecterDoublons(liste, cle) {
  const vues = new Map();
  for (const item of liste) {
    const valeur = item[cle];
    if (!vues.has(valeur)) vues.set(valeur, []);
    vues.get(valeur).push(item);
  }
  const doublons = [];
  for (const [valeur, occurrences] of vues) {
    if (occurrences.length > 1) doublons.push({ valeur, occurrences: occurrences.length });
  }
  return doublons;
}

/**
 * Détecte les chevauchements de créneaux : conflit si même `date`, même
 * `lieu` (non vide) et intervalles [heure_debut, heure_fin) qui se
 * chevauchent (créneaux contigus non comptés). Les entrées sans `lieu` ou
 * sans `heure_fin` sont exclues du contrôle (comparaison impossible) —
 * signalé en avertissement, jamais en erreur silencieuse.
 *
 * @param activites état final (fiches du lot + fiches existantes non remplacées par le lot)
 */
export function detecterConflits(activites) {
  const erreurs = [];
  const avertissements = [];

  const comparables = [];
  for (const a of activites) {
    if (!a.lieu || !a.heure_fin) {
      avertissements.push(`« ${a.titre} » (${a.date} ${a.heure_debut}) : lieu ou heure de fin non renseigné(e), non vérifiée pour les conflits de programmation.`);
      continue;
    }
    comparables.push(a);
  }

  for (let i = 0; i < comparables.length; i += 1) {
    for (let j = i + 1; j < comparables.length; j += 1) {
      const a = comparables[i];
      const b = comparables[j];
      if (a.date !== b.date || a.lieu !== b.lieu) continue;
      const chevauchement = heureAvant(a.heure_debut, b.heure_fin) && heureAvant(b.heure_debut, a.heure_fin);
      if (chevauchement) {
        erreurs.push(
          `Conflit de programmation le ${a.date} à « ${a.lieu} » : « ${a.titre} » (${a.heure_debut}–${a.heure_fin}) chevauche « ${b.titre} » (${b.heure_debut}–${b.heure_fin}).`,
        );
      }
    }
  }

  return { erreurs, avertissements };
}

function ligneYamlListe(cle, valeurs) {
  if (!valeurs || valeurs.length === 0) return null;
  const items = valeurs.map((v) => `  - ${JSON.stringify(v)}`).join('\n');
  return `${cle}:\n${items}`;
}

function ligneYamlIntervenants(intervenants) {
  if (!intervenants || intervenants.length === 0) return null;
  const items = intervenants
    .map((i) => {
      const champs = [`nom: ${JSON.stringify(i.nom)}`];
      if (i.fonction) champs.push(`fonction: ${JSON.stringify(i.fonction)}`);
      if (i.organisme) champs.push(`organisme: ${JSON.stringify(i.organisme)}`);
      return `  - ${champs.join('\n    ')}`;
    })
    .join('\n');
  return `intervenants:\n${items}`;
}

/**
 * Génère le contenu Markdown/frontmatter d'une activité de programme, dans
 * le format attendu par src/content.config.ts et docs/PROGRAMME.md.
 * Sérialisation déterministe pour la détection « inchangée / mise à jour ».
 */
export function genererContenuProgramme(activite) {
  const lignes = [
    '---',
    `programmeId: ${JSON.stringify(activite.programmeId)}`,
    `titre: ${JSON.stringify(activite.titre)}`,
    `date: ${JSON.stringify(activite.date)}`,
    `heure_debut: ${JSON.stringify(activite.heure_debut)}`,
  ];
  if (activite.heure_fin) lignes.push(`heure_fin: ${JSON.stringify(activite.heure_fin)}`);
  lignes.push(`univers: ${JSON.stringify(activite.univers)}`, `type: ${JSON.stringify(activite.type)}`);
  if (activite.lieu) lignes.push(`lieu: ${JSON.stringify(activite.lieu)}`);
  lignes.push(`accroche: ${JSON.stringify(activite.accroche)}`, `description: ${JSON.stringify(activite.description)}`);
  const blocsFacultatifs = [ligneYamlListe('publics', activite.publics), ligneYamlIntervenants(activite.intervenants)].filter(Boolean);
  lignes.push(...blocsFacultatifs);
  if (activite.organisateur) lignes.push(`organisateur: ${JSON.stringify(activite.organisateur)}`);
  if (activite.exposant_lie) lignes.push(`exposant_lie: ${JSON.stringify(activite.exposant_lie)}`);
  lignes.push(`inscription_requise: ${activite.inscription_requise}`);
  if (activite.lien_inscription) lignes.push(`lien_inscription: ${JSON.stringify(activite.lien_inscription)}`);
  lignes.push(`capacite_limitee: ${activite.capacite_limitee}`, `mise_en_avant: ${activite.mise_en_avant}`, `publie: ${activite.publie}`);
  if (activite.ordre !== undefined) lignes.push(`ordre: ${activite.ordre}`);
  if (activite.date_mise_a_jour) lignes.push(`date_mise_a_jour: ${activite.date_mise_a_jour}`);
  lignes.push('---', '');
  return lignes.join('\n');
}

/** Lecture minimale du frontmatter d'une entrée programme déjà existante. */
export function lireResumeFrontmatterProgramme(contenu) {
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
    programmeId: extraire('programmeId'),
    titre: extraire('titre'),
    date: extraire('date'),
    heure_debut: extraire('heure_debut'),
    heure_fin: extraire('heure_fin'),
    lieu: extraire('lieu'),
    publie: extraire('publie'),
  };
}
