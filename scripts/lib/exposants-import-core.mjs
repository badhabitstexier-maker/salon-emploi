/*
  Logique pure du pipeline d'import des exposants (Lot 4A, voir
  docs/EXPOSANTS_IMPORT.md). Même architecture que le pipeline Offres (Lot 3,
  scripts/lib/offres-import-core.mjs) : ce module ne touche ni au système de
  fichiers ni à la sortie console — scripts/import-exposants.mjs orchestre
  les effets de bord.

  Source de vérité du schéma : src/content.config.ts (collection
  `exposants`). Ne pas ajouter ici un champ que le schéma Astro n'utilise
  pas.
*/
import { listeDepuisCellule, boolDepuisCellule, SLUG_REGEX, DATE_REGEX } from './import-shared.mjs';

export const UNIVERS = ['emploi', 'formation'];
export const TYPES_STRUCTURE = ['entreprise', 'organisme-formation', 'institution', 'accompagnement', 'association', 'autre'];

/*
  Formule commerciale de l'exposant (Lot Admin-1B, docs/EXPOSANTS_IMPORT.md).
  Convention identique à `offres.formule` (scripts/lib/offres-import-core.mjs).
  Appartient à l'exposant, n'est jamais déduite de ses offres.
*/
export const FORMULES = ['standard', 'silver', 'gold'];

export const EXPOSANT_ID_REGEX = /^EXP26-\d{3,}$/;

/*
  Capacités confirmées par Philippe le 06/08/2026 (CLAUDE.md, section 2) :
  Hall Emploi 21 stands, Hall Formation 16 stands, total 37 emplacements
  commercialisés.
*/
export const CAPACITES = { emploi: 21, formation: 16 };
export const CAPACITE_TOTALE = 37;

/*
  Emplacements 22, 23 et 24 du plan initial : non commercialisés en 2026
  (information confirmée). Ne vaut que pour un `numero_stand` purement
  numérique — voir docs/EXPOSANTS_IMPORT.md, section « stands » sur les
  limites de cette règle (pas de table numéro → hall disponible).
*/
export const STANDS_NON_COMMERCIALISES = ['22', '23', '24'];

export const EXTENSIONS_LOGO_AUTORISEES = ['svg', 'png', 'jpg', 'jpeg', 'webp'];
export const EXTENSIONS_IMAGE_AUTORISEES = ['svg', 'png', 'jpg', 'jpeg', 'webp'];

/*
  Plateformes de réseaux sociaux reconnues (Lot « exposants-statuts »,
  identique à `reseauSocial.plateforme` dans src/content.config.ts).
*/
export const PLATEFORMES_RESEAUX_SOCIAUX = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'autre'];

/*
  Longueur maximale de la présentation courte (`accroche`) selon le statut
  commercial — identique à `PRESENTATION_COURTE_MAX` dans
  src/content.config.ts (voir ce fichier pour le détail de la règle).
*/
export const PRESENTATION_COURTE_MAX = { standard: 300, silver: 500, gold: 500 };

/* Colonnes toujours attendues dans l'en-tête (même si la valeur peut être vide). */
export const COLONNES_REQUISES = ['exposantId', 'slug', 'nom', 'formule', 'univers', 'type_structure', 'secteurs', 'accroche', 'mise_en_avant', 'publie'];

/*
  Colonnes facultatives reconnues — absence de l'en-tête tolérée sans
  avertissement. `description` (présentation longue), `lien_recrutement`,
  `reseaux_sociaux`, `image_couverture` et `galerie` sont réservées à
  certains statuts (voir `validerLigne` ci-dessous et
  src/content.config.ts) : la colonne peut exister dans le CSV, mais sa
  valeur doit rester vide pour les exposants qui n'y ont pas droit.
*/
export const COLONNES_FACULTATIVES = [
  'description',
  'logo',
  'site_web',
  'numero_stand',
  'email_public',
  'telephone_public',
  'lien_recrutement',
  'reseaux_sociaux',
  'image_couverture',
  'galerie',
  'demo',
  'ordre',
  'date_mise_a_jour',
  'metiers',
  'formations',
  'opportunites',
  'mots_cles',
];

export const COLONNES_CONNUES = [...COLONNES_REQUISES, ...COLONNES_FACULTATIVES];

/** Une ligne est un « bloc vide » (exposant non déclaré) si le nom est vide. */
export function ligneEstVide(ligne) {
  return (ligne.nom ?? '').trim() === '';
}

/**
 * Valide et transforme une ligne CSV brute. Ne consulte ni les autres
 * lignes (doublons/capacités) ni le disque (existence du logo) — délégués à
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

  const exposantId = (ligne.exposantId ?? '').trim();
  if (exposantId && !EXPOSANT_ID_REGEX.test(exposantId)) {
    erreurs.push(`« exposantId » « ${exposantId} » mal formé (attendu : EXP26-XXX).`);
  }

  const slug = champTexte('slug');
  if (slug && !SLUG_REGEX.test(slug)) {
    erreurs.push(`« slug » « ${slug} » invalide (minuscules, chiffres, tirets, sans accents ni espaces).`);
  }

  const nom = champTexte('nom');

  const formule = champTexte('formule');
  if (formule && !FORMULES.includes(formule)) {
    erreurs.push(`« formule » « ${formule} » invalide (valeurs autorisées : ${FORMULES.join(', ')}).`);
  }

  const univers = champTexte('univers');
  if (univers && !UNIVERS.includes(univers)) {
    erreurs.push(`« univers » (hall) « ${univers} » invalide (valeurs autorisées : ${UNIVERS.join(', ')}).`);
  }

  const typeStructure = champTexte('type_structure');
  if (typeStructure && !TYPES_STRUCTURE.includes(typeStructure)) {
    erreurs.push(`« type_structure » « ${typeStructure} » invalide (valeurs autorisées : ${TYPES_STRUCTURE.join(', ')}).`);
  }

  const secteurs = listeDepuisCellule(ligne.secteurs);
  const accroche = champTexte('accroche');
  if (formule && FORMULES.includes(formule) && accroche) {
    const max = PRESENTATION_COURTE_MAX[formule];
    if (accroche.length > max) {
      erreurs.push(`« accroche » (présentation courte) trop longue pour le statut ${formule} : ${accroche.length} caractères (maximum ${max}).`);
    }
  }

  const description = champTexte('description', { requis: false });
  if (description && formule && formule !== 'gold') {
    erreurs.push('« description » (présentation longue) réservée au statut Partenaire premium (formule gold).');
  }

  const logo = champTexte('logo', { requis: false });
  if (logo) {
    const extension = logo.split('.').pop()?.toLowerCase();
    if (!extension || !EXTENSIONS_LOGO_AUTORISEES.includes(extension)) {
      erreurs.push(
        `« logo » « ${logo} » : extension non prise en charge (autorisées : ${EXTENSIONS_LOGO_AUTORISEES.join(', ')}).`,
      );
    }
    if (!logo.startsWith('/')) {
      erreurs.push(`« logo » « ${logo} » : chemin invalide, doit commencer par « / » (chemin public, ex. /images/exposants/nom.svg).`);
    }
  }

  const siteWeb = champTexte('site_web', { requis: false });
  if (siteWeb && !/^https?:\/\/.+/i.test(siteWeb)) {
    erreurs.push(`« site_web » « ${siteWeb} » invalide (doit commencer par http:// ou https://).`);
  }

  const numeroStand = champTexte('numero_stand', { requis: false });
  if (numeroStand && STANDS_NON_COMMERCIALISES.includes(numeroStand.trim())) {
    erreurs.push(`« numero_stand » « ${numeroStand} » : emplacement non commercialisé en 2026.`);
  }

  const emailPublic = champTexte('email_public', { requis: false });
  const telephonePublic = champTexte('telephone_public', { requis: false });

  const estPartenaireOuPlus = formule === 'silver' || formule === 'gold';
  const estPremium = formule === 'gold';

  const lienRecrutement = champTexte('lien_recrutement', { requis: false });
  if (lienRecrutement) {
    if (!/^https?:\/\/.+/i.test(lienRecrutement)) {
      erreurs.push(`« lien_recrutement » « ${lienRecrutement} » invalide (doit commencer par http:// ou https://).`);
    }
    if (formule && !estPartenaireOuPlus) {
      erreurs.push('« lien_recrutement » réservé aux statuts Exposant partenaire et Partenaire premium.');
    }
  }

  const reseauxSociauxBrut = (ligne.reseaux_sociaux ?? '').trim();
  const reseauxSociaux = [];
  if (reseauxSociauxBrut) {
    for (const entree of listeDepuisCellule(reseauxSociauxBrut)) {
      const [plateforme, ...resteUrl] = entree.split(':');
      const url = resteUrl.join(':').trim();
      if (!plateforme || !PLATEFORMES_RESEAUX_SOCIAUX.includes(plateforme.trim()) || !url) {
        erreurs.push(`« reseaux_sociaux » entrée « ${entree} » invalide (format attendu : plateforme:url, plateformes autorisées : ${PLATEFORMES_RESEAUX_SOCIAUX.join(', ')}).`);
        continue;
      }
      reseauxSociaux.push({ plateforme: plateforme.trim(), url });
    }
    if (formule && !estPartenaireOuPlus) {
      erreurs.push('« reseaux_sociaux » réservé aux statuts Exposant partenaire et Partenaire premium.');
    }
  }

  const imageCouverture = champTexte('image_couverture', { requis: false });
  if (imageCouverture) {
    const extension = imageCouverture.split('.').pop()?.toLowerCase();
    if (!extension || !EXTENSIONS_IMAGE_AUTORISEES.includes(extension)) {
      erreurs.push(`« image_couverture » « ${imageCouverture} » : extension non prise en charge (autorisées : ${EXTENSIONS_IMAGE_AUTORISEES.join(', ')}).`);
    }
    if (!imageCouverture.startsWith('/')) {
      erreurs.push(`« image_couverture » « ${imageCouverture} » : chemin invalide, doit commencer par « / » (chemin public).`);
    }
    if (formule && !estPremium) {
      erreurs.push("« image_couverture » réservée au statut Partenaire premium (formule gold).");
    }
  }

  const galerieBrut = (ligne.galerie ?? '').trim();
  const galerie = [];
  if (galerieBrut) {
    for (const entree of listeDepuisCellule(galerieBrut)) {
      const [src, alt] = entree.split('::').map((v) => v?.trim());
      if (!src || !src.startsWith('/') || !alt) {
        erreurs.push(`« galerie » entrée « ${entree} » invalide (format attendu : /chemin/image.ext::texte alternatif).`);
        continue;
      }
      const extension = src.split('.').pop()?.toLowerCase();
      if (!extension || !EXTENSIONS_IMAGE_AUTORISEES.includes(extension)) {
        erreurs.push(`« galerie » image « ${src} » : extension non prise en charge (autorisées : ${EXTENSIONS_IMAGE_AUTORISEES.join(', ')}).`);
        continue;
      }
      galerie.push({ src, alt });
    }
    if (formule && !estPremium) {
      erreurs.push('« galerie » réservée au statut Partenaire premium (formule gold).');
    }
  }

  const demo = boolDepuisCellule(ligne.demo, false);
  if (demo === undefined) erreurs.push(`« demo » doit être oui/non (reçu : « ${ligne.demo} »).`);

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

  const metiers = listeDepuisCellule(ligne.metiers);
  const formations = listeDepuisCellule(ligne.formations);
  const opportunites = listeDepuisCellule(ligne.opportunites);
  const motsCles = listeDepuisCellule(ligne.mots_cles);

  if (erreurs.length > 0) {
    return { ok: false, numeroLigne, slug: slug || null, erreurs, avertissements };
  }

  return {
    ok: true,
    numeroLigne,
    avertissements,
    exposant: {
      exposantId: exposantId || null, // null => rapprochement ou attribution automatique
      slug,
      nom,
      formule,
      univers,
      type_structure: typeStructure,
      secteurs,
      accroche,
      description: description || undefined,
      logo: logo || undefined,
      site_web: siteWeb || undefined,
      numero_stand: numeroStand || undefined,
      email_public: emailPublic || undefined,
      telephone_public: telephonePublic || undefined,
      lien_recrutement: lienRecrutement || undefined,
      reseaux_sociaux: reseauxSociaux.length > 0 ? reseauxSociaux : undefined,
      image_couverture: imageCouverture || undefined,
      galerie: galerie.length > 0 ? galerie : undefined,
      demo,
      mise_en_avant: miseEnAvant,
      publie,
      ordre,
      date_mise_a_jour: dateMiseAJour || undefined,
      metiers: metiers.length > 0 ? metiers : undefined,
      formations: formations.length > 0 ? formations : undefined,
      opportunites: opportunites.length > 0 ? opportunites : undefined,
      mots_cles: motsCles.length > 0 ? motsCles : undefined,
    },
  };
}

/**
 * Avant d'assigner un nouvel `exposantId` à une ligne qui n'en a pas,
 * tente de la faire correspondre à une fiche déjà existante portant le même
 * `slug` — garantit l'idempotence d'un réimport à `exposantId` vide. En cas
 * d'ambiguïté, ne rapproche rien (assignerIdentifiantsManquants créera un
 * nouvel identifiant).
 */
export function rapprocherIdentifiantsParSlug(exposants, existantes) {
  const journal = [];
  for (const exposant of exposants) {
    if (exposant.exposantId) continue;
    const candidates = existantes.filter((e) => e.slug === exposant.slug);
    if (candidates.length === 1) {
      exposant.exposantId = candidates[0].exposantId;
      journal.push({ ligne: exposant.__numeroLigne, exposantId: candidates[0].exposantId, slug: exposant.slug });
    }
  }
  return journal;
}

/** Détecte les doublons d'une clé donnée (`exposantId` ou `slug`) au sein du lot. */
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
 * Vérifie les capacités Hall Emploi (21) / Hall Formation (16) / total (37)
 * sur l'état final (fiches du lot + fiches existantes non remplacées par le
 * lot, c'est-à-dire dont l'exposantId n'apparaît pas dans le lot). Détecte
 * aussi les collisions de `numero_stand` au sein d'un même hall.
 *
 * @param exposants fiches valides du lot (avec exposantId assigné)
 * @param existantes résumé des fiches déjà présentes (exposantId, slug, nom, univers, numero_stand)
 */
export function verifierCapacitesEtStands(exposants, existantes) {
  const idsDuLot = new Set(exposants.map((e) => e.exposantId));
  const etatFinal = [
    ...existantes.filter((e) => !idsDuLot.has(e.exposantId)),
    ...exposants.map((e) => ({ exposantId: e.exposantId, slug: e.slug, nom: e.nom, univers: e.univers, numero_stand: e.numero_stand })),
  ];

  const erreurs = [];
  const avertissements = [];

  const parUnivers = { emploi: [], formation: [] };
  for (const e of etatFinal) {
    if (parUnivers[e.univers]) parUnivers[e.univers].push(e);
  }

  for (const univers of UNIVERS) {
    const total = parUnivers[univers].length;
    if (total > CAPACITES[univers]) {
      erreurs.push(
        `Capacité dépassée pour le Hall ${univers === 'emploi' ? 'Emploi' : 'Formation'} : ${total} exposant(s) pour ${CAPACITES[univers]} emplacements commercialisés.`,
      );
    }
  }

  const totalGlobal = etatFinal.length;
  if (totalGlobal > CAPACITE_TOTALE) {
    erreurs.push(`Capacité totale dépassée : ${totalGlobal} exposant(s) pour ${CAPACITE_TOTALE} emplacements commercialisés.`);
  }

  for (const univers of UNIVERS) {
    const parStand = new Map();
    for (const e of parUnivers[univers]) {
      if (!e.numero_stand) continue;
      if (!parStand.has(e.numero_stand)) parStand.set(e.numero_stand, []);
      parStand.get(e.numero_stand).push(e.nom);
    }
    for (const [stand, noms] of parStand) {
      if (noms.length > 1) {
        erreurs.push(`Stand « ${stand} » attribué à plusieurs exposants dans le Hall ${univers === 'emploi' ? 'Emploi' : 'Formation'} : ${noms.join(', ')}.`);
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

/**
 * Génère le contenu Markdown/frontmatter d'un exposant, dans le format
 * attendu par src/content.config.ts et docs/EXPOSANTS.md. Sérialisation
 * déterministe (ordre de champs fixe) pour la détection « inchangée / mise
 * à jour ».
 */
export function genererContenuExposant(exposant) {
  const lignes = [
    '---',
    `exposantId: ${JSON.stringify(exposant.exposantId)}`,
    `nom: ${JSON.stringify(exposant.nom)}`,
    `formule: ${JSON.stringify(exposant.formule)}`,
    `univers: ${JSON.stringify(exposant.univers)}`,
    `type_structure: ${JSON.stringify(exposant.type_structure)}`,
    ligneYamlListe('secteurs', exposant.secteurs) ?? 'secteurs: []',
    `accroche: ${JSON.stringify(exposant.accroche)}`,
  ];
  if (exposant.description) lignes.push(`description: ${JSON.stringify(exposant.description)}`);
  if (exposant.logo) lignes.push(`logo: ${JSON.stringify(exposant.logo)}`);
  if (exposant.site_web) lignes.push(`site_web: ${JSON.stringify(exposant.site_web)}`);
  if (exposant.numero_stand) lignes.push(`numero_stand: ${JSON.stringify(exposant.numero_stand)}`);
  if (exposant.email_public) lignes.push(`email_public: ${JSON.stringify(exposant.email_public)}`);
  if (exposant.telephone_public) lignes.push(`telephone_public: ${JSON.stringify(exposant.telephone_public)}`);
  if (exposant.lien_recrutement) lignes.push(`lien_recrutement: ${JSON.stringify(exposant.lien_recrutement)}`);
  if (exposant.reseaux_sociaux && exposant.reseaux_sociaux.length > 0) {
    lignes.push('reseaux_sociaux:');
    for (const reseau of exposant.reseaux_sociaux) {
      lignes.push(`  - plateforme: ${JSON.stringify(reseau.plateforme)}`, `    url: ${JSON.stringify(reseau.url)}`);
    }
  }
  if (exposant.image_couverture) lignes.push(`image_couverture: ${JSON.stringify(exposant.image_couverture)}`);
  if (exposant.galerie && exposant.galerie.length > 0) {
    lignes.push('galerie:');
    for (const image of exposant.galerie) {
      lignes.push(`  - src: ${JSON.stringify(image.src)}`, `    alt: ${JSON.stringify(image.alt)}`);
    }
  }
  lignes.push(`demo: ${exposant.demo}`, `mise_en_avant: ${exposant.mise_en_avant}`, `publie: ${exposant.publie}`);
  if (exposant.ordre !== undefined) lignes.push(`ordre: ${exposant.ordre}`);
  if (exposant.date_mise_a_jour) lignes.push(`date_mise_a_jour: ${exposant.date_mise_a_jour}`);
  const listesFacultatives = [
    ligneYamlListe('metiers', exposant.metiers),
    ligneYamlListe('formations', exposant.formations),
    ligneYamlListe('opportunites', exposant.opportunites),
    ligneYamlListe('mots_cles', exposant.mots_cles),
  ].filter(Boolean);
  lignes.push(...listesFacultatives, '---', '');
  return lignes.join('\n');
}

/** Lecture minimale du frontmatter d'une fiche exposant déjà existante. */
export function lireResumeFrontmatterExposant(contenu) {
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
    exposantId: extraire('exposantId'),
    nom: extraire('nom'),
    univers: extraire('univers'),
    numero_stand: extraire('numero_stand'),
    publie: extraire('publie'),
  };
}
