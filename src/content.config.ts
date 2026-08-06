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
const exposants = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exposants' }),
  schema: z.object({
    nom: z.string(),
    slug: z.string().optional(),
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

const programme = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programme' }),
  schema: z.object({
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

export const collections = { exposants, programme };
