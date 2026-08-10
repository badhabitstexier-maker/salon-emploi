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

/*
  Fiches exposants différenciées par statut (Lot « exposants-statuts »,
  voir CLAUDE.md et docs/EXPOSANTS.md). Le champ `formule` (déjà existant,
  partagé avec `offres.formule`) EST le statut commercial : standard =
  Exposant, silver = Exposant partenaire, gold = Partenaire premium — voir
  `formulePubliqueLabels` dans src/lib/exposants.ts pour les libellés
  publics. Aucun nouveau champ « statut » n'a été introduit : le champ
  existant est réutilisé tel quel, avec ses quotas déjà en place
  (`CAPACITE_OFFRES_PAR_FORMULE`, src/lib/exposants.ts).

  Nouveaux champs, tous facultatifs et réservés à certains statuts. La
  réservation est appliquée par la validation ci-dessous (superRefine),
  pas seulement par un choix d'affichage — une fiche Standard ne peut pas
  déclarer un contenu réservé aux statuts supérieurs.
*/
const reseauSocial = z.object({
  plateforme: z.enum(['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'autre']),
  url: z.string(),
});

const imageGalerie = z.object({
  src: z.string(),
  // Alt text obligatoire (section 6 du Lot) — jamais une image sans description.
  alt: z.string().min(1, "Le texte alternatif de l'image de galerie est obligatoire."),
});

const PRESENTATION_COURTE_MAX = { standard: 300, silver: 500, gold: 500 };

const exposants = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exposants' }),
  schema: z
    .object({
      exposantId: z.string().regex(EXPOSANT_ID_REGEX, 'Format attendu : EXP26-XXX'),
      nom: z.string(),
      slug: z.string().optional(),
      // Formule commerciale de l'exposant (Lot Admin-1B, docs/EXPOSANTS_IMPORT.md).
      // Appartient à l'exposant, n'est jamais déduite de ses offres — voir
      // docs/ADMIN.md. Convention identique à `offres.formule`. C'est aussi le
      // statut commercial public (voir commentaire ci-dessus).
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
      // Présentation courte : affichée sur la carte et en tête de fiche pour
      // tous les statuts. Longueur maximale dépendant du statut, contrôlée
      // ci-dessous (300 caractères Standard, 500 Partenaire/Premium).
      accroche: z.string(),
      // Présentation longue : réservée au Partenaire premium (gold), voir
      // superRefine ci-dessous. Absente/vide pour Standard et Partenaire.
      description: z.string().optional(),
      logo: z.string().optional(),
      site_web: z.string().optional(),
      numero_stand: z.string().optional(),
      email_public: z.string().optional(),
      telephone_public: z.string().optional(),
      // Lien de recrutement externe — réservé Partenaire/Premium (silver, gold).
      lien_recrutement: z.string().optional(),
      // Réseaux sociaux — réservés Partenaire/Premium (silver, gold).
      reseaux_sociaux: z.array(reseauSocial).default([]),
      // Grande image de couverture — réservée Partenaire premium (gold).
      image_couverture: z.string().optional(),
      // Galerie de photos — réservée Partenaire premium (gold).
      galerie: z.array(imageGalerie).default([]),
      mise_en_avant: z.boolean().default(false),
      publie: z.boolean().default(false),
      ordre: z.number().optional(),
      date_mise_a_jour: z.coerce.date().optional(),
      // Fiche de démonstration (Lot 14bis, voir CLAUDE.md et docs/EXPOSANTS.md) :
      // porte la distinction TEST/RÉEL dans le modèle de données plutôt que
      // dans une liste de slugs codée en dur (noindex, exclusion sitemap,
      // mention « FICHE DE DÉMONSTRATION » — voir src/pages/exposants/[slug].astro).
      demo: z.boolean().default(false),
      // Facultatifs — à n'afficher que s'ils sont renseignés (section 6 du Lot 4).
      metiers: z.array(z.string()).optional(),
      formations: z.array(z.string()).optional(),
      opportunites: z.array(z.string()).optional(),
      mots_cles: z.array(z.string()).optional(),
    })
    .superRefine((exposant, ctx) => {
      const maxAccroche = PRESENTATION_COURTE_MAX[exposant.formule];
      if (exposant.accroche.length > maxAccroche) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accroche'],
          message: `Présentation courte trop longue pour le statut ${exposant.formule} : ${exposant.accroche.length} caractères (maximum ${maxAccroche}).`,
        });
      }

      if (exposant.formule !== 'gold' && exposant.description && exposant.description.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['description'],
          message: 'La présentation longue est réservée au statut Partenaire premium (formule gold).',
        });
      }

      if (exposant.formule === 'standard') {
        if (exposant.lien_recrutement) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['lien_recrutement'],
            message: 'Le lien de recrutement est réservé aux statuts Exposant partenaire et Partenaire premium.',
          });
        }
        if (exposant.reseaux_sociaux.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['reseaux_sociaux'],
            message: 'Les réseaux sociaux sont réservés aux statuts Exposant partenaire et Partenaire premium.',
          });
        }
      }

      if (exposant.formule !== 'gold') {
        if (exposant.image_couverture) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['image_couverture'],
            message: "L'image de couverture est réservée au statut Partenaire premium (formule gold).",
          });
        }
        if (exposant.galerie.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['galerie'],
            message: 'La galerie photos est réservée au statut Partenaire premium (formule gold).',
          });
        }
      }
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
/*
  `exposantId` sur une offre (Lot Admin-1C, voir docs/OFFRES_EXPOSANTS.md
  section 5 et docs/EXPOSANTS_IMPORT.md section 3) : doit être exactement le
  même identifiant `EXP26-XXX` que celui de l'exposant correspondant dans la
  collection `exposants` — jamais un texte libre ni le nom de l'entreprise.
  C'est la clé technique du rattachement offres <-> exposant (voir
  src/lib/admin.ts, `offresRattachees`).

  Exception : les offres TEST (préfixe `TEST —`, voir `estOffreTest()` dans
  src/lib/offres.ts) ne représentent aucun exposant réel — leur `exposantId`
  n'est donc pas soumis au format EXP26-XXX. Convention retenue :
  `TEST-EXPOSANT-NC`, un identifiant dédié qui ne peut jamais être confondu
  avec un vrai `EXP26-XXX` ni être pris pour une vraie clé de rattachement.
*/
function estIntituleOffreTest(intitule: string): boolean {
  return intitule.startsWith('TEST —');
}

const offres = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/offres' }),
  schema: z
    .object({
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
      /*
        Offre TEST volontairement absente du catalogue public /offres (Lot
        « exposants-statuts », section 15). Réutilise la même logique que
        `exposants.demo` : la distinction est portée par le modèle de
        données, jamais par une liste de références codée en dur. Reste
        accessible par URL directe et référencée depuis la fiche de
        l'exposant démo correspondant (offresPublieesDeExposant, voir
        src/lib/exposants.ts) — seul le catalogue principal (src/pages/offres/index.astro)
        l'exclut. Réservé aux offres TEST : une offre réelle ne peut pas
        être `demo: true` (voir superRefine ci-dessous).
      */
      demo: z.boolean().default(false),
    })
    .superRefine((offre, ctx) => {
      if (estIntituleOffreTest(offre.intitule)) {
        if (offre.exposantId.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['exposantId'],
            message: 'exposantId est obligatoire, y compris pour une offre TEST (voir TEST-EXPOSANT-NC).',
          });
        }
        return;
      }
      if (offre.demo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['demo'],
          message: 'demo: true est réservé aux offres TEST (intitulé commençant par « TEST — ») — jamais à une offre réelle.',
        });
      }
      if (offre.exposantId.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposantId'],
          message: 'exposantId est obligatoire pour une offre réelle (identifiant de l\'exposant, format EXP26-XXX).',
        });
        return;
      }
      if (!EXPOSANT_ID_REGEX.test(offre.exposantId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposantId'],
          message: `Format attendu : EXP26-XXX (identifiant de l'exposant rattaché, reçu : « ${offre.exposantId} »).`,
        });
      }
    }),
});

/*
  Pas de collection « visibilites » ici depuis Admin-2B (voir CLAUDE.md et
  docs/VISIBILITE.md). Jusqu'au Lot Admin-2, les campagnes de visibilité
  publicitaire vivaient dans une Content Collection Astro (fichiers Markdown
  dans src/content/visibilites/, gérés à la main). Depuis Admin-2B, la
  source de vérité est un fichier JSON hébergé sur le serveur
  (visibilites.json, hors dépôt Git, hors webroot), géré via une API PHP
  dédiée (voir public/admin-api/visibilites.php et public/api/visibilites.php)
  et lu dynamiquement par le navigateur au chargement de chaque page — Astro
  n'a plus aucune connaissance de ces données au build. Les types, constantes
  (PAGES_VISIBILITE, etc.) et la logique métier pure (statut, éligibilité,
  tirage pondéré) vivent désormais uniquement dans src/lib/visibilites.ts,
  qui n'a plus aucune dépendance à `astro:content`.
*/

export const collections = { exposants, programme, offres };
