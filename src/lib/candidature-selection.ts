/*
  Sélection de 0 à 5 offres — représentée exclusivement par les paramètres
  d'URL `offre1` à `offre5` (voir CLAUDE.md et docs/OFFRES.md). Aucun
  stockage local, cookie ou session : ce module ne fait que lire/écrire des
  chaînes de caractères dans une URL, il ne touche jamais au DOM.

  Utilisé à la fois côté client (src/lib/selection-ui.ts) et, ponctuellement,
  côté build (Astro) — d'où l'absence de toute dépendance à `window`.
*/

export const MAX_SELECTION = 5;
export const ORIENTATION_PARAM = 'orientation';

const SELECTION_PARAM_PREFIX = 'offre';
const SELECTION_PARAMS = Array.from(
  { length: MAX_SELECTION },
  (_, index) => `${SELECTION_PARAM_PREFIX}${index + 1}`,
);

/**
 * Lit la sélection depuis des paramètres d'URL : ignore les valeurs vides,
 * déduplique en conservant la première occurrence, limite à cinq entrées.
 */
export function lireSelection(params: URLSearchParams): string[] {
  const selection: string[] = [];
  for (const cle of SELECTION_PARAMS) {
    const valeur = (params.get(cle) ?? '').trim();
    if (valeur && !selection.includes(valeur)) selection.push(valeur);
  }
  return selection.slice(0, MAX_SELECTION);
}

/** Sépare une sélection entre références connues et inconnues. */
export function filtrerReferencesConnues(
  selection: string[],
  referencesConnues: ReadonlySet<string>,
): { connues: string[]; inconnues: string[] } {
  const connues: string[] = [];
  const inconnues: string[] = [];
  for (const reference of selection) {
    (referencesConnues.has(reference) ? connues : inconnues).push(reference);
  }
  return { connues, inconnues };
}

export interface ResultatAjout {
  selection: string[];
  ajoutee: boolean;
  limiteAtteinte: boolean;
}

/** Ajoute une référence en fin de sélection, dans la limite de cinq. */
export function ajouterReference(selection: string[], reference: string): ResultatAjout {
  if (selection.includes(reference)) {
    return { selection, ajoutee: false, limiteAtteinte: false };
  }
  if (selection.length >= MAX_SELECTION) {
    return { selection, ajoutee: false, limiteAtteinte: true };
  }
  return { selection: [...selection, reference], ajoutee: true, limiteAtteinte: false };
}

/** Retire une référence de la sélection (sans effet si absente). */
export function retirerReference(selection: string[], reference: string): string[] {
  return selection.filter((ref) => ref !== reference);
}

/**
 * Reconstruit une URL propre : remplace `offre1`..`offre5` par la sélection
 * fournie et préserve tous les autres paramètres (filtres, `orientation`…).
 */
export function appliquerSelectionAlUrl(url: URL, selection: string[]): URL {
  const nouvelleUrl = new URL(url.toString());
  for (const cle of SELECTION_PARAMS) nouvelleUrl.searchParams.delete(cle);
  selection.slice(0, MAX_SELECTION).forEach((reference, index) => {
    nouvelleUrl.searchParams.set(SELECTION_PARAMS[index], reference);
  });
  return nouvelleUrl;
}

/** Construit un chemin relatif portant la sélection en paramètres (ex. pour /candidater). */
export function hrefAvecSelection(chemin: string, selection: string[]): string {
  const params = new URLSearchParams();
  selection.slice(0, MAX_SELECTION).forEach((reference, index) => {
    params.set(SELECTION_PARAMS[index], reference);
  });
  const requete = params.toString();
  return requete ? `${chemin}?${requete}` : chemin;
}

/** Vrai si le paramètre `orientation=1` est présent (candidature sans offre). */
export function estOrientationDemandee(params: URLSearchParams): boolean {
  return params.get(ORIENTATION_PARAM) === '1';
}
