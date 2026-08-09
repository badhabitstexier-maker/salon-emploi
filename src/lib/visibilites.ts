import type { CollectionEntry } from 'astro:content';

/*
  Moteur de visibilité publicitaire (Lot Admin-2, voir docs/VISIBILITE.md).

  IMPORTANT (principe métier — voir docs/VISIBILITE.md section 1 et
  CLAUDE.md) : rien dans ce fichier ne doit jamais lire ou dériver quoi que
  ce soit à partir de `exposant.data.formule` (standard/silver/gold). Le
  poids et l'éligibilité d'une visibilité sont des données saisies à la main
  par LabEvents dans la collection `visibilites`, jamais un automatisme lié
  à la formule commerciale exposant.

  Fonctions pures uniquement (pas d'accès à `astro:content` au runtime, pas
  de DOM) — testables directement via `node --test` (voir
  scripts/visibilites-lib.test.mjs) et réutilisables côté client dans
  src/lib/visibilite-ui.ts (voir OffreSelection/selection-ui.ts pour le même
  principe de séparation logique pure / contrôleur DOM).
*/

export type Visibilite = CollectionEntry<'visibilites'>;
export type PageVisibilite = Visibilite['data']['pages'][number];
export type EmplacementVisibilite = Visibilite['data']['emplacement'];

export const typeAnnonceurLabels: Record<Visibilite['data']['typeAnnonceur'], string> = {
  exposant: 'Exposant',
  sponsor: 'Sponsor',
  partenaire: 'Partenaire',
  institution: 'Institution',
  annonceur_externe: 'Annonceur externe',
  autre: 'Autre',
};

export const formatLabels: Record<Visibilite['data']['format'], string> = {
  bandeau_horizontal: 'Bandeau horizontal',
};

export const pageLabels: Record<PageVisibilite, string> = {
  accueil: 'Accueil',
  offres: 'Catalogue des offres',
  exposants: 'Catalogue des exposants',
  programme: 'Programme',
};

export type StatutVisibilite = 'actif' | 'a-venir' | 'expire' | 'desactive';

export const statutLabels: Record<StatutVisibilite, string> = {
  actif: 'Actif',
  'a-venir': 'À venir',
  expire: 'Expiré',
  desactive: 'Désactivé',
};

/*
  Statut calculé au moment de l'appel — jamais stocké en frontmatter (un
  seul état source : `actif` + `dateDebut`/`dateFin`, voir
  docs/VISIBILITE.md). Sur un site statique, ce calcul se fait au moment du
  build : une programmation par dates ne bascule donc qu'au prochain
  build/déploiement, pas à la seconde près (limite V1, voir docs/VISIBILITE.md).
*/
export function statutVisibilite(visibilite: Visibilite, maintenant: Date = new Date()): StatutVisibilite {
  if (!visibilite.data.actif) return 'desactive';
  const { dateDebut, dateFin } = visibilite.data;
  if (dateDebut && maintenant.getTime() < dateDebut.getTime()) return 'a-venir';
  if (dateFin && maintenant.getTime() > dateFin.getTime()) return 'expire';
  return 'actif';
}

export interface CriteresEligibilite {
  page: PageVisibilite;
  emplacement: EmplacementVisibilite;
}

/** Éligible à un (page, emplacement) donné : statut 'actif' + page couverte + même emplacement. */
export function estEligible(
  visibilite: Visibilite,
  criteres: CriteresEligibilite,
  maintenant: Date = new Date(),
): boolean {
  if (statutVisibilite(visibilite, maintenant) !== 'actif') return false;
  if (visibilite.data.emplacement !== criteres.emplacement) return false;
  return visibilite.data.pages.includes(criteres.page);
}

export function visibilitesEligibles(
  liste: Visibilite[],
  criteres: CriteresEligibilite,
  maintenant: Date = new Date(),
): Visibilite[] {
  return liste.filter((visibilite) => estEligible(visibilite, criteres, maintenant));
}

/*
  Sélection pondérée pure — un seul tirage par appel, jamais de rotation
  automatique dans le temps (voir docs/VISIBILITE.md section « rotation » :
  la stabilité pendant la consultation d'une page vient du fait que ce
  tirage n'est effectué qu'une fois, au chargement, côté client — voir
  src/lib/visibilite-ui.ts).

  `rng` doit renvoyer un nombre dans [0, 1) ; par défaut `Math.random`,
  injectable pour des tests déterministes (voir
  scripts/visibilites-lib.test.mjs).
*/
export function selectionnerPonderee<T extends { poids: number }>(
  candidats: T[],
  rng: () => number = Math.random,
): T | undefined {
  if (candidats.length === 0) return undefined;
  const poidsTotal = candidats.reduce((somme, candidat) => somme + candidat.poids, 0);
  if (poidsTotal <= 0) return undefined;
  let tirage = rng() * poidsTotal;
  for (const candidat of candidats) {
    tirage -= candidat.poids;
    if (tirage < 0) return candidat;
  }
  return candidats[candidats.length - 1];
}

/** Résumé public d'une visibilité — ce qui est réellement nécessaire côté client (voir VisibilitySlot.astro). */
export interface VisibiliteResume {
  id: string;
  annonceur: string;
  visuel: string;
  alt: string;
  lien?: string;
  poids: number;
}

export function visibiliteResume(visibilite: Visibilite): VisibiliteResume {
  return {
    id: visibilite.id,
    annonceur: visibilite.data.annonceur,
    visuel: visibilite.data.visuel,
    alt: visibilite.data.alt,
    lien: visibilite.data.lien,
    poids: visibilite.data.poids,
  };
}
