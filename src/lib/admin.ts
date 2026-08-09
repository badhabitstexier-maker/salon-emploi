import type { CollectionEntry } from 'astro:content';
import { estOffreTest } from './offres';

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

  Offres TEST (voir docs/OFFRES.md, `estOffreTest`) toujours exclues : ce
  sont des fiches de démonstration, pas de vraies offres exposant (Lot
  Admin-1B, « nombre d'offres RÉELLES rattachées »).
*/
export function offresRattachees(exposant: Exposant, offres: Offre[]): Offre[] {
  return offres.filter((offre) => !estOffreTest(offre) && offre.data.exposantId === exposant.data.exposantId);
}

/*
  Anomalies internes (Lot Admin-1C, voir CLAUDE.md et docs/EXPOSANTS_IMPORT.md
  section 3) — n'affectent jamais le build ni le site public, seulement
  l'affichage Admin. Une offre réelle est en anomalie quand son `exposantId`
  ne correspond à aucun exposant de la collection (import CSV réalisé avant
  la création de l'exposant, faute de frappe, etc.) ou quand sa `formule`
  dupliquée diverge de celle de l'exposant rattaché (voir Option B retenue :
  duplication contrôlée plutôt que suppression du champ, `offre.formule`
  reste utilisé pour l'affichage public — voir docs/OFFRES.md section 5).
*/

/** Offre réelle dont l'`exposantId` ne correspond à aucun exposant de la collection. */
export function exposantIntrouvable(offre: Offre, exposants: Exposant[]): boolean {
  if (estOffreTest(offre)) return false;
  return !exposants.some((exposant) => exposant.data.exposantId === offre.data.exposantId);
}

/** Offre réelle dont la `formule` diverge de celle de l'exposant rattaché (quand celui-ci est connu). */
export function formuleIncoherente(offre: Offre, exposants: Exposant[]): boolean {
  if (estOffreTest(offre)) return false;
  const exposant = exposants.find((e) => e.data.exposantId === offre.data.exposantId);
  return exposant !== undefined && exposant.data.formule !== offre.data.formule;
}

/*
  Retrouve l'exposant correspondant à un `exposantId` (Lot Admin-2, voir
  docs/VISIBILITE.md) — même rattachement par égalité stricte que
  `offresRattachees`, réutilisé ici pour permettre à l'Admin Visibilité de
  lier une campagne vers la fiche Admin de l'exposant concerné, sans
  dupliquer les données de l'exposant dans la visibilité.
*/
export function exposantParId(exposantId: string | undefined, exposants: Exposant[]): Exposant | undefined {
  if (!exposantId) return undefined;
  return exposants.find((exposant) => exposant.data.exposantId === exposantId);
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
