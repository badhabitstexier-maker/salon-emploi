import type { CollectionEntry } from 'astro:content';

export type Exposant = CollectionEntry<'exposants'>;
export type Offre = CollectionEntry<'offres'>;

/*
  Espace Admin LabEvents (Lot Admin-1, voir CLAUDE.md section 14 et
  docs/ADMIN.md) — lecture seule, calculée uniquement à partir des Content
  Collections `exposants` et `offres`. Aucun chiffre codé en dur ici.

  Rattachement offres <-> exposant : par égalité stricte entre
  `offre.data.exposantId` et `exposant.data.exposantId` (les deux champs
  existent réellement dans le schéma — voir src/content.config.ts). Tant
  que la collection `exposants` n'est pas alimentée avec des données
  réelles, ce rattachement reste vide pour les offres réelles : c'est un
  état de données attendu, pas un bug de cette fonction.
*/
export function offresRattachees(exposant: Exposant, offres: Offre[]): Offre[] {
  return offres.filter((offre) => offre.data.exposantId === exposant.data.exposantId);
}

export interface Repartition {
  valeur: string;
  total: number;
}

/** Regroupe une liste par une clé texte simple, triée par effectif décroissant puis alphabétique. */
export function repartitionPar<T>(items: T[], cle: (item: T) => string): Repartition[] {
  const compte = new Map<string, number>();
  for (const item of items) {
    const valeur = cle(item);
    compte.set(valeur, (compte.get(valeur) ?? 0) + 1);
  }
  return [...compte.entries()]
    .map(([valeur, total]) => ({ valeur, total }))
    .sort((a, b) => b.total - a.total || a.valeur.localeCompare(b.valeur, 'fr'));
}

/** Idem, pour une clé à valeurs multiples par élément (ex. typeContrat, un tableau par offre). */
export function repartitionParMultiple<T>(items: T[], cles: (item: T) => string[]): Repartition[] {
  const compte = new Map<string, number>();
  for (const item of items) {
    for (const valeur of cles(item)) {
      compte.set(valeur, (compte.get(valeur) ?? 0) + 1);
    }
  }
  return [...compte.entries()]
    .map(([valeur, total]) => ({ valeur, total }))
    .sort((a, b) => b.total - a.total || a.valeur.localeCompare(b.valeur, 'fr'));
}

/** Normalisation texte pour la recherche (minuscules, sans accents) — même logique que les filtres publics. */
export function normaliserRecherche(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
