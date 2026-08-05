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
    univers: z.enum(['hall', 'village']),
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

export const collections = { exposants };
