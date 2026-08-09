import { getCollection, type CollectionEntry } from 'astro:content';

export type Exposant = CollectionEntry<'exposants'>;

export const universLabels: Record<Exposant['data']['univers'], string> = {
  emploi: 'Hall Emploi',
  formation: 'Hall Formation',
};

/*
  Libellés internes (Admin uniquement) de la formule commerciale. Distincts
  des libellés publics des offres (`formuleLabels` dans `src/lib/offres.ts`,
  ex. « Exposant partenaire ») : ici on affiche la valeur brute, réservée à
  un usage interne LabEvents — ne jamais reprendre ces libellés sur une page
  publique (voir CLAUDE.md).
*/
export const formuleLabels: Record<Exposant['data']['formule'], string> = {
  standard: 'Standard',
  silver: 'Silver',
  gold: 'Gold',
};

/*
  Plafond indicatif d'offres actives par formule (voir docs/OFFRES.md,
  quotas). `gold` n'a pas de plafond automatique — alerte interne uniquement
  au-delà du seuil `silver`, jamais de blocage (voir CLAUDE.md, Lot Admin-1B).
*/
export const CAPACITE_OFFRES_PAR_FORMULE: Partial<Record<Exposant['data']['formule'], number>> = {
  standard: 5,
  silver: 10,
};

export const typeStructureLabels: Record<Exposant['data']['type_structure'], string> = {
  entreprise: 'Entreprise',
  'organisme-formation': 'Organisme de formation',
  institution: 'Institution',
  accompagnement: "Structure d'accompagnement",
  association: 'Association',
  autre: 'Autre',
};

/** Slug d'URL de l'exposant : `slug` en frontmatter si fourni, sinon l'id (nom de fichier). */
export function exposantSlug(exposant: Exposant): string {
  return exposant.data.slug || exposant.id;
}

/** Exposants publiés uniquement — jamais les fiches `publie: false`. */
export async function getExposantsPublies(): Promise<Exposant[]> {
  const tous = await getCollection('exposants');
  return tous.filter((exposant) => exposant.data.publie);
}

/** Tri : mis en avant d'abord, puis `ordre` croissant, puis ordre alphabétique. */
export function trierExposants(liste: Exposant[]): Exposant[] {
  return [...liste].sort((a, b) => {
    if (a.data.mise_en_avant !== b.data.mise_en_avant) {
      return a.data.mise_en_avant ? -1 : 1;
    }
    const ordreA = a.data.ordre ?? Number.POSITIVE_INFINITY;
    const ordreB = b.data.ordre ?? Number.POSITIVE_INFINITY;
    if (ordreA !== ordreB) return ordreA - ordreB;
    return a.data.nom.localeCompare(b.data.nom, 'fr');
  });
}

/** Liste triée des secteurs distincts présents parmi les exposants fournis. */
export function secteursDisponibles(liste: Exposant[]): string[] {
  const secteurs = new Set<string>();
  for (const exposant of liste) {
    for (const secteur of exposant.data.secteurs) secteurs.add(secteur);
  }
  return [...secteurs].sort((a, b) => a.localeCompare(b, 'fr'));
}
