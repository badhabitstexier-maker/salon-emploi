import { getCollection, type CollectionEntry } from 'astro:content';

export type Exposant = CollectionEntry<'exposants'>;

export const universLabels: Record<Exposant['data']['univers'], string> = {
  hall: 'Hall Emploi-Formation',
  village: 'Village Maintenance & Industrie',
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
