import { getCollection, type CollectionEntry } from 'astro:content';

export type ProgrammeItem = CollectionEntry<'programme'>;

export const universLabels: Record<ProgrammeItem['data']['univers'], string> = {
  emploi: 'Hall Emploi',
  formation: 'Hall Formation',
  transversal: 'Transversal',
};

export const typeLabels: Record<ProgrammeItem['data']['type'], string> = {
  conference: 'Conférence',
  atelier: 'Atelier',
  demonstration: 'Démonstration',
  rencontre: 'Rencontre',
  information: 'Information',
  autre: 'Autre',
};

/** Libellé public d'une date ISO, une fois les dates exactes validées. */
export function journeeLabel(date: ProgrammeItem['data']['date']): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function journeesDisponibles(liste: ProgrammeItem[]): ProgrammeItem['data']['date'][] {
  return [...new Set(liste.map((item) => item.data.date))].sort();
}

/** Slug d'URL de l'entrée : `slug` en frontmatter si fourni, sinon l'id (nom de fichier). */
export function programmeSlug(item: ProgrammeItem): string {
  return item.data.slug || item.id;
}

/** Entrées publiées uniquement — jamais les fiches `publie: false`. */
export async function getProgrammePublie(): Promise<ProgrammeItem[]> {
  const toutes = await getCollection('programme');
  return toutes.filter((item) => item.data.publie);
}

/** Tri : date, puis heure de début, puis `ordre`, puis ordre alphabétique du titre. */
export function trierProgramme(liste: ProgrammeItem[]): ProgrammeItem[] {
  return [...liste].sort((a, b) => {
    if (a.data.date !== b.data.date) return a.data.date.localeCompare(b.data.date);
    if (a.data.heure_debut !== b.data.heure_debut) {
      return a.data.heure_debut.localeCompare(b.data.heure_debut);
    }
    const ordreA = a.data.ordre ?? Number.POSITIVE_INFINITY;
    const ordreB = b.data.ordre ?? Number.POSITIVE_INFINITY;
    if (ordreA !== ordreB) return ordreA - ordreB;
    return a.data.titre.localeCompare(b.data.titre, 'fr');
  });
}

/** Liste triée des publics distincts présents parmi les entrées fournies. */
export function publicsDisponibles(liste: ProgrammeItem[]): string[] {
  const publics = new Set<string>();
  for (const item of liste) {
    for (const public_ of item.data.publics ?? []) publics.add(public_);
  }
  return [...publics].sort((a, b) => a.localeCompare(b, 'fr'));
}
