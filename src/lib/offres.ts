import { getCollection, type CollectionEntry } from 'astro:content';

export type Offre = CollectionEntry<'offres'>;

export const RECENT_THRESHOLD_JOURS = 14;

export const statutLabels: Record<Offre['data']['status'], string> = {
  recue: 'Reçue',
  'a-completer': 'À compléter',
  validee: 'Validée',
  publiee: 'Publiée',
  retiree: 'Retirée',
  cloturee: 'Clôturée',
};

export const formuleLabels: Record<Offre['data']['formule'], string> = {
  standard: 'Standard',
  silver: 'Exposant partenaire',
  gold: 'Partenaire premium',
};

/** Slug d'URL de l'offre : le nom de fichier (pas de champ `slug` dédié — voir docs/OFFRES.md). */
export function offreSlug(offre: Offre): string {
  return offre.id;
}

/** Offres publiées uniquement — jamais les fiches au statut différent de `publiee`. */
export async function getOffresPubliees(): Promise<Offre[]> {
  const toutes = await getCollection('offres');
  return toutes.filter((offre) => offre.data.status === 'publiee');
}

/**
 * Tri par défaut : date de publication (plus récente d'abord), puis référence.
 * Ni `formule` (badges partenaires) ni `miseEnAvant` n'interviennent dans ce
 * tri — le classement ne doit pas créer de hiérarchie artificielle entre
 * offres Standard, Silver et Gold (voir docs/OFFRES.md).
 */
export function trierOffres(liste: Offre[]): Offre[] {
  return [...liste].sort((a, b) => {
    const dateA = a.data.datePublication.getTime();
    const dateB = b.data.datePublication.getTime();
    if (dateA !== dateB) return dateB - dateA;
    return a.data.reference.localeCompare(b.data.reference, 'fr');
  });
}

/** Une offre est « récente » si publiée depuis moins de RECENT_THRESHOLD_JOURS jours (calculé au build). */
export function estRecente(offre: Offre, maintenant: Date = new Date()): boolean {
  const joursEcoules = (maintenant.getTime() - offre.data.datePublication.getTime()) / 86_400_000;
  return joursEcoules >= 0 && joursEcoules <= RECENT_THRESHOLD_JOURS;
}

/** Retrouve une offre publiée à partir de sa référence métier (ex. SEF26-001). */
export function trouverOffreParReference(liste: Offre[], reference: string): Offre | undefined {
  return liste.find((offre) => offre.data.reference === reference);
}

function valeursDistinctesTriees(valeurs: Iterable<string>): string[] {
  return [...new Set(valeurs)].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function secteursDisponibles(liste: Offre[]): string[] {
  return valeursDistinctesTriees(liste.map((offre) => offre.data.secteur));
}

export function entreprisesDisponibles(liste: Offre[]): string[] {
  return valeursDistinctesTriees(liste.map((offre) => offre.data.exposantNom));
}

export function lieuxDisponibles(liste: Offre[]): string[] {
  return valeursDistinctesTriees(liste.map((offre) => offre.data.lieu));
}

export function typesContratDisponibles(liste: Offre[]): string[] {
  return valeursDistinctesTriees(liste.flatMap((offre) => offre.data.typeContrat));
}

export function niveauxFormationDisponibles(liste: Offre[]): string[] {
  return valeursDistinctesTriees(liste.flatMap((offre) => offre.data.niveauFormation));
}
