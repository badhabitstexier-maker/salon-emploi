import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/*
  Collection « exposants » — Lot 4 du CLAUDE.md.
  Une fiche = un fichier Markdown dans src/content/exposants/ (frontmatter
  uniquement ; le corps du fichier n'est pas utilisé). Voir docs/EXPOSANTS.md
  pour la procédure d'ajout.

  L'identifiant (slug d'URL) est dérivé du nom de fichier par défaut ; le
  champ `slug` en frontmatter permet de le forcer explicitement (utile pour
  les noms accentués ou en cas de renommage de fichier).
*/
/*
  `exposantId` (Lot 4A, voir docs/EXPOSANTS_IMPORT.md) : identifiant métier
  stable, indépendant du nom affiché et du slug, attribué séquentiellement
  par le pipeline d'import (scripts/import-exposants.mjs) et destiné à
  rester constant même si l'exposant change de nom. Introduit pendant que la
  collection est encore vide (aucune fiche existante à migrer) — obligatoire
  pour toute nouvelle fiche, manuelle ou importée.
*/
const EXPOSANT_ID_REGEX = /^EXP26-\d{3,}$/;

const exposants = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exposants' }),
  schema: z.object({
    exposantId: z.string().regex(EXPOSANT_ID_REGEX, 'Format attendu : EXP26-XXX'),
    nom: z.string(),
    slug: z.string().optional(),
    // Formule commerciale de l'exposant (Lot Admin-1B, docs/EXPOSANTS_IMPORT.md).
    // Appartient à l'exposant, n'est jamais déduite de ses offres — voir
    // docs/ADMIN.md. Convention identique à `offres.formule`.
    formule: z.enum(['standard', 'silver', 'gold']),
    univers: z.enum(['emploi', 'formation']),
    type_structure: z.enum([
      'entreprise',
      'organisme-formation',
      'institution',
      'accompagnement',
      'association',
      'autre',
    ]),
    secteurs: z.array(z.string()).default([]),
    accroche: z.string(),
    description: z.string(),
    logo: z.string().optional(),
    site_web: z.string().optional(),
    numero_stand: z.string().optional(),
    email_public: z.string().optional(),
    telephone_public: z.string().optional(),
    mise_en_avant: z.boolean().default(false),
    publie: z.boolean().default(false),
    ordre: z.number().optional(),
    date_mise_a_jour: z.coerce.date().optional(),
    // Facultatifs — à n'afficher que s'ils sont renseignés (section 6 du Lot 4).
    metiers: z.array(z.string()).optional(),
    formations: z.array(z.string()).optional(),
    opportunites: z.array(z.string()).optional(),
    mots_cles: z.array(z.string()).optional(),
  }),
});

/*
  Collection « programme » — Lot 5 du CLAUDE.md.
  Une entrée = un fichier Markdown dans src/content/programme/ (frontmatter
  uniquement ; le corps du fichier n'est pas utilisé). Voir docs/PROGRAMME.md
  pour la procédure d'ajout.

  L'identifiant (slug d'URL) est dérivé du nom de fichier par défaut ; le
  champ `slug` en frontmatter permet de le forcer explicitement (utile pour
  les noms accentués ou en cas de renommage de fichier).
*/
const intervenant = z.object({
  nom: z.string(),
  fonction: z.string().optional(),
  organisme: z.string().optional(),
});

const heureRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/*
  `programmeId` (Lot 4A, voir docs/PROGRAMME_IMPORT.md) : identifiant
  métier stable, indépendant du titre et du slug, attribué séquentiellement
  par le pipeline d'import (scripts/import-programme.mjs). Une correction de
  titre ne doit jamais créer une nouvelle activité. Introduit pendant que la
  collection est encore vide — obligatoire pour toute nouvelle fiche.
*/
const PROGRAMME_ID_REGEX = /^PROG26-\d{3,}$/;

const programme = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programme' }),
  schema: z.object({
    programmeId: z.string().regex(PROGRAMME_ID_REGEX, 'Format attendu : PROG26-XXX'),
    titre: z.string(),
    slug: z.string().optional(),
    date: z.enum(['2026-10-30', '2026-10-31']),
    heure_debut: z.string().regex(heureRegex, 'Format attendu : HH:MM (ex. 09:30)'),
    heure_fin: z.string().regex(heureRegex, 'Format attendu : HH:MM (ex. 09:30)').optional(),
    univers: z.enum(['emploi', 'formation', 'transversal']),
    type: z.enum(['conference', 'atelier', 'demonstration', 'rencontre', 'information', 'autre']),
    lieu: z.string().optional(),
    accroche: z.string(),
    description: z.string(),
    publics: z.array(z.string()).optional(),
    intervenants: z.array(intervenant).optional(),
    organisateur: z.string().optional(),
    exposant_lie: z.string().optional(),
    inscription_requise: z.boolean().default(false),
    lien_inscription: z.string().optional(),
    capacite_limitee: z.boolean().default(false),
    mise_en_avant: z.boolean().default(false),
    publie: z.boolean().default(false),
    ordre: z.number().optional(),
    date_mise_a_jour: z.coerce.date().optional(),
  }),
});

/*
  Collection « offres » — Lot 1 du dispositif « Offres et candidatures »
  (voir docs/OFFRES.md). Une entrée = un fichier Markdown dans
  src/content/offres/ (frontmatter uniquement ; le corps du fichier n'est
  pas utilisé).

  Contrairement à `exposants` et `programme`, il n'y a pas de champ `slug` :
  le nom de fichier fait foi (voir docs/OFFRES.md, procédure d'ajout). Le
  champ `reference` (ex. SEF26-001) est un identifiant métier distinct,
  utilisé pour la sélection par paramètres URL (`offre1`..`offre5`) — il
  n'est pas nécessairement égal au nom de fichier.
*/
const offres = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/offres' }),
  schema: z.object({
    reference: z.string(),
    status: z.enum(['recue', 'a-completer', 'validee', 'publiee', 'retiree', 'cloturee']),
    intitule: z.string(),
    exposantId: z.string(),
    exposantNom: z.string(),
    formule: z.enum(['standard', 'silver', 'gold']),
    secteur: z.string(),
    typeContrat: z
      .array(z.enum(['CDI', 'CDD', 'Alternance', 'Stage', 'Intérim', 'Saisonnier', 'Autre']))
      .min(1),
    lieu: z.string(),
    nombrePostes: z.number().int().positive().default(1),
    datePrisePoste: z.string().optional(),
    niveauFormation: z.array(z.string()).default([]),
    niveauExperience: z.string(),
    sansExperience: z.boolean().default(false),
    descriptionCourte: z.string(),
    missions: z.array(z.string()).default([]),
    competencesPrerequis: z.array(z.string()).default([]),
    accepteCandidaturesEnLigne: z.boolean().default(true),
    datePublication: z.coerce.date(),
    // Date facultative de fin de validité de l'offre / fin de période de
    // candidature (ex. alimente `validThrough` du JSON-LD JobPosting sur la
    // fiche offre). Ne pas confondre avec la durée de conservation des
    // données candidat au 31 décembre 2026 : celle-ci concerne les données
    // collectées via Tally (voir docs/CANDIDATURES_TALLY.md), pas les
    // fiches offres.
    dateCloture: z.coerce.date().optional(),
    // Champ conservé pour un usage éditorial futur — ne doit PAS influencer
    // le tri ni le classement des offres (docs/OFFRES.md, section « tri »).
    miseEnAvant: z.boolean().default(false),
  }),
});

export const collections = { exposants, programme, offres };
