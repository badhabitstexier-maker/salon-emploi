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
  Fenêtre de dates — brique commune réutilisée à la fois par statutVisibilite
  (Admin, calculé côté serveur) ET par le contrôleur client
  (src/lib/visibilite-ui.ts), pour que les deux évaluent la même règle avec
  la même définition de « maintenant ».

  IMPORTANT (site statique, voir docs/VISIBILITE.md section 7) : sur
  l'Admin, `maintenant` vaut l'heure du build — le statut affiché reflète
  donc l'état au dernier déploiement. Côté site public en revanche, cette
  même fonction est appelée par le navigateur à chaque chargement de page
  (voir estDansPeriodeResume ci-dessous), avec l'heure réelle du visiteur :
  une campagne démarre ou s'arrête donc bien à l'heure dite, sans dépendre
  d'un nouveau build.
*/
export function estDansPeriode(dateDebut: Date | undefined, dateFin: Date | undefined, maintenant: Date): boolean {
  if (dateDebut && maintenant.getTime() < dateDebut.getTime()) return false;
  if (dateFin && maintenant.getTime() > dateFin.getTime()) return false;
  return true;
}

/** Statut calculé au moment de l'appel — jamais stocké en frontmatter (voir docs/VISIBILITE.md). */
export function statutVisibilite(visibilite: Visibilite, maintenant: Date = new Date()): StatutVisibilite {
  if (!visibilite.data.actif) return 'desactive';
  const { dateDebut, dateFin } = visibilite.data;
  if (estDansPeriode(dateDebut, dateFin, maintenant)) return 'actif';
  if (dateDebut && maintenant.getTime() < dateDebut.getTime()) return 'a-venir';
  return 'expire';
}

export interface CriteresEligibilite {
  page: PageVisibilite;
  emplacement: EmplacementVisibilite;
}

/** Page + emplacement couverts par la visibilité, indépendamment de `actif` et des dates. */
export function couvre(visibilite: Visibilite, criteres: CriteresEligibilite): boolean {
  if (visibilite.data.emplacement !== criteres.emplacement) return false;
  return visibilite.data.pages.includes(criteres.page);
}

/*
  Éligible à un (page, emplacement) donné à un instant `maintenant` donné :
  actif + page/emplacement couverts + dans la fenêtre de dates. Utile pour
  un contrôle ponctuel (tests, futurs usages serveur) — le site public
  n'utilise PAS cette fonction pour décider quoi envoyer au navigateur (voir
  visibilitesEnvoyables plus bas : les dates doivent être réévaluées côté
  client, pas figées au build).
*/
export function estEligible(
  visibilite: Visibilite,
  criteres: CriteresEligibilite,
  maintenant: Date = new Date(),
): boolean {
  if (!visibilite.data.actif) return false;
  if (!couvre(visibilite, criteres)) return false;
  return estDansPeriode(visibilite.data.dateDebut, visibilite.data.dateFin, maintenant);
}

export function visibilitesEligibles(
  liste: Visibilite[],
  criteres: CriteresEligibilite,
  maintenant: Date = new Date(),
): Visibilite[] {
  return liste.filter((visibilite) => estEligible(visibilite, criteres, maintenant));
}

/*
  Ce que le build envoie au navigateur pour un (page, emplacement) donné :
  actif + page/emplacement couverts, SANS filtrer sur les dates — les dates
  sont volontairement réévaluées côté client à chaque chargement de page
  (voir src/lib/visibilite-ui.ts, estDansPeriodeResume), pour qu'une
  campagne démarre/s'arrête à l'heure dite sans nécessiter un nouveau build.
  Une visibilité `actif: false` ou hors scope (page/emplacement) n'est en
  revanche jamais envoyée : ce sont des leviers manuels, pas des dates.
*/
export function visibilitesEnvoyables(liste: Visibilite[], criteres: CriteresEligibilite): Visibilite[] {
  return liste.filter((visibilite) => visibilite.data.actif && couvre(visibilite, criteres));
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

/*
  Résumé public d'une visibilité — strictement ce qui est nécessaire pour
  l'affichage et le tirage côté client (voir VisibilitySlot.astro). Ne
  jamais y ajouter `nomInterne`, `typeAnnonceur` ou `exposantId` : ce sont
  des données réservées à l'usage interne LabEvents (voir Admin), sans
  utilité pour le rendu public. `dateDebut`/`dateFin` sont en ISO (pas des
  `Date`, non sérialisables telles quelles dans le JSON embarqué) et ne
  sont présentes que si la campagne les définit — indispensables pour que
  le client puisse réévaluer la fenêtre de dates lui-même (voir
  estDansPeriodeResume ci-dessous).
*/
export interface VisibiliteResume {
  id: string;
  annonceur: string;
  visuel: string;
  alt: string;
  lien?: string;
  poids: number;
  dateDebut?: string;
  dateFin?: string;
}

export function visibiliteResume(visibilite: Visibilite): VisibiliteResume {
  return {
    id: visibilite.id,
    annonceur: visibilite.data.annonceur,
    visuel: visibilite.data.visuel,
    alt: visibilite.data.alt,
    lien: visibilite.data.lien,
    poids: visibilite.data.poids,
    dateDebut: visibilite.data.dateDebut?.toISOString(),
    dateFin: visibilite.data.dateFin?.toISOString(),
  };
}

/** Même règle que `estDansPeriode`, appliquée à un VisibiliteResume (dates en ISO côté client). */
export function estDansPeriodeResume(resume: Pick<VisibiliteResume, 'dateDebut' | 'dateFin'>, maintenant: Date): boolean {
  const dateDebut = resume.dateDebut ? new Date(resume.dateDebut) : undefined;
  const dateFin = resume.dateFin ? new Date(resume.dateFin) : undefined;
  return estDansPeriode(dateDebut, dateFin, maintenant);
}
