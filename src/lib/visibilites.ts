/*
  Moteur de visibilité publicitaire (Lot Admin-2 / Admin-2B, voir docs/VISIBILITE.md).

  IMPORTANT (principe métier — voir docs/VISIBILITE.md section 1 et
  CLAUDE.md) : rien dans ce fichier ne doit jamais lire ou dériver quoi que
  ce soit à partir de `exposant.data.formule`. Le poids et l'éligibilité
  d'une visibilité sont des données saisies à la main par LabEvents, jamais
  un automatisme lié à la formule commerciale exposant.

  Fonctions pures uniquement (aucun accès réseau, aucun DOM, aucun
  `astro:content`) — testables directement via `node --test` (voir
  scripts/visibilites-lib.test.mjs).

  CHANGEMENT Admin-2B (voir docs/VISIBILITE.md section « Admin-2B ») :
  jusqu'ici, une visibilité était une entrée `CollectionEntry<'visibilites'>`
  (Content Collection Astro alimentée par des fichiers Markdown). Depuis
  Admin-2B, la source de vérité est un fichier JSON hébergé sur le serveur
  (`visibilites.json`, hors dépôt Git, hors webroot), géré via une API PHP
  (voir public/admin-api/visibilites.php et public/api/visibilites.php) —
  Astro n'a plus aucune connaissance de ces données au build. `Visibilite`
  est donc désormais un simple objet plat (plus de wrapper `{ id, data }`),
  et les dates y sont des chaînes ISO 8601 (comme dans un JSON), jamais des
  `Date`. Les fonctions ci-dessous sont volontairement le miroir exact de la
  logique implémentée en PHP côté serveur (public/api/visibilites.php pour
  le filtrage page/emplacement/actif, public/admin-api/visibilites.php pour
  la validation) : toute évolution de règle métier doit être répercutée aux
  deux endroits, en le signalant explicitement (jamais une extension
  silencieuse d'un seul côté).
*/

export const PAGES_VISIBILITE = ['accueil', 'offres', 'exposants', 'programme'] as const;
export const EMPLACEMENTS_VISIBILITE = ['principal'] as const;
export const TYPES_ANNONCEUR = [
  'exposant',
  'sponsor',
  'partenaire',
  'institution',
  'annonceur_externe',
  'autre',
] as const;
export const FORMATS_VISIBILITE = ['bandeau_horizontal'] as const;

export type PageVisibilite = (typeof PAGES_VISIBILITE)[number];
export type EmplacementVisibilite = (typeof EMPLACEMENTS_VISIBILITE)[number];
export type TypeAnnonceur = (typeof TYPES_ANNONCEUR)[number];
export type FormatVisibilite = (typeof FORMATS_VISIBILITE)[number];

/** Enregistrement complet, tel que renvoyé par l'API Admin (`/admin-api/visibilites.php`, authentifiée). */
export interface Visibilite {
  id: string;
  nomInterne: string;
  annonceur: string;
  typeAnnonceur: TypeAnnonceur;
  exposantId?: string;
  format: FormatVisibilite;
  visuel: string;
  visuelMobile?: string;
  alt: string;
  lien?: string;
  pages: PageVisibilite[];
  emplacement: EmplacementVisibilite;
  dateDebut?: string;
  dateFin?: string;
  poids: number;
  actif: boolean;
}

export const typeAnnonceurLabels: Record<TypeAnnonceur, string> = {
  exposant: 'Exposant',
  sponsor: 'Sponsor',
  partenaire: 'Partenaire',
  institution: 'Institution',
  annonceur_externe: 'Annonceur externe',
  autre: 'Autre',
};

export const formatLabels: Record<FormatVisibilite, string> = {
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

/** Classes de badge Tailwind par statut — partagées entre le rendu serveur et le recalcul client de l'Admin. */
export const statutBadgeClasses: Record<StatutVisibilite, string> = {
  actif: 'bg-village text-marine',
  'a-venir': 'bg-orange/20 text-orange-dark',
  expire: 'bg-marine/10 text-marine/60',
  desactive: 'bg-marine/10 text-marine/60',
};

/*
  Fenêtre de dates — brique commune réutilisée par calculerStatut/estEligible
  (donc par statutVisibilite ET par le contrôleur client
  src/lib/visibilite-ui.ts), pour qu'aucune de ces évaluations n'ait sa
  propre définition de la période.
*/
export function estDansPeriode(dateDebut: Date | undefined, dateFin: Date | undefined, maintenant: Date): boolean {
  if (dateDebut && maintenant.getTime() < dateDebut.getTime()) return false;
  if (dateFin && maintenant.getTime() > dateFin.getTime()) return false;
  return true;
}

/*
  Calcul du statut à partir des champs bruts — seule définition de la règle
  Actif/À venir/Expiré/Désactivé du dépôt. Réutilisée par `statutVisibilite`
  ci-dessous, et par `src/pages/admin/visibilite/index.astro` côté client,
  pour recalculer le statut avec l'heure réelle du navigateur (voir
  docs/VISIBILITE.md section 10) — l'Admin ne doit jamais afficher un statut
  figé (et depuis Admin-2B, il n'y a de toute façon plus de « build » qui
  connaîtrait ces données : tout est calculé côté client, à chaque
  chargement, à partir de la réponse de l'API Admin).
*/
export function calculerStatut(
  actif: boolean,
  dateDebut: Date | undefined,
  dateFin: Date | undefined,
  maintenant: Date,
): StatutVisibilite {
  if (!actif) return 'desactive';
  if (estDansPeriode(dateDebut, dateFin, maintenant)) return 'actif';
  if (dateDebut && maintenant.getTime() < dateDebut.getTime()) return 'a-venir';
  return 'expire';
}

/** Statut calculé au moment de l'appel — jamais stocké. Accepte des dates en ISO (comme reçues de l'API). */
export function statutVisibilite(
  visibilite: Pick<Visibilite, 'actif' | 'dateDebut' | 'dateFin'>,
  maintenant: Date = new Date(),
): StatutVisibilite {
  const dateDebut = visibilite.dateDebut ? new Date(visibilite.dateDebut) : undefined;
  const dateFin = visibilite.dateFin ? new Date(visibilite.dateFin) : undefined;
  return calculerStatut(visibilite.actif, dateDebut, dateFin, maintenant);
}

export interface CriteresEligibilite {
  page: PageVisibilite;
  emplacement: EmplacementVisibilite;
}

/** Page + emplacement couverts par la visibilité, indépendamment de `actif` et des dates. */
export function couvre(visibilite: Pick<Visibilite, 'pages' | 'emplacement'>, criteres: CriteresEligibilite): boolean {
  if (visibilite.emplacement !== criteres.emplacement) return false;
  return visibilite.pages.includes(criteres.page);
}

/*
  Éligible à un (page, emplacement) donné à un instant `maintenant` donné :
  actif + page/emplacement couverts + dans la fenêtre de dates. Utile pour
  un contrôle ponctuel (tests, futurs usages serveur) — l'API publique
  n'utilise PAS cette fonction pour décider quoi renvoyer au navigateur (voir
  visibilitesEnvoyables plus bas : les dates doivent être réévaluées côté
  client, pas figées au moment de la requête serveur).
*/
export function estEligible(visibilite: Visibilite, criteres: CriteresEligibilite, maintenant: Date = new Date()): boolean {
  if (!visibilite.actif) return false;
  if (!couvre(visibilite, criteres)) return false;
  const dateDebut = visibilite.dateDebut ? new Date(visibilite.dateDebut) : undefined;
  const dateFin = visibilite.dateFin ? new Date(visibilite.dateFin) : undefined;
  return estDansPeriode(dateDebut, dateFin, maintenant);
}

export function visibilitesEligibles(
  liste: Visibilite[],
  criteres: CriteresEligibilite,
  maintenant: Date = new Date(),
): Visibilite[] {
  return liste.filter((visibilite) => estEligible(visibilite, criteres, maintenant));
}

/*
  Ce que l'API publique (`GET /api/visibilites.php?page=...&emplacement=...`,
  voir public/api/visibilites.php) renvoie au navigateur pour un
  (page, emplacement) donné : actif + page/emplacement couverts, SANS
  filtrer sur les dates — les dates sont volontairement réévaluées côté
  client à chaque chargement de page (voir src/lib/visibilite-ui.ts), pour
  qu'une campagne démarre/s'arrête à l'heure dite. Une visibilité
  `actif: false` ou hors scope (page/emplacement) n'est en revanche jamais
  envoyée : ce sont des leviers manuels, pas des dates.

  Miroir exact de la logique implémentée en PHP dans
  public/api/visibilites.php — conservée ici pour que
  scripts/visibilites-lib.test.mjs documente et verrouille le comportement
  attendu, même si ce n'est plus cette fonction TS qui s'exécute au moment
  de la requête réelle (c'est le PHP, en l'absence de build Astro qui
  connaîtrait ces données).
*/
export function visibilitesEnvoyables(liste: Visibilite[], criteres: CriteresEligibilite): Visibilite[] {
  return liste.filter((visibilite) => visibilite.actif && couvre(visibilite, criteres));
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
  l'affichage et le tirage côté client. C'est exactement la forme (et la
  whitelist de champs) renvoyée par `GET /api/visibilites.php` — voir
  public/api/visibilites.php, qui construit ce même objet côté PHP. Ne
  jamais y ajouter `nomInterne`, `typeAnnonceur` ou `exposantId` : ce sont
  des données réservées à l'usage interne LabEvents (voir Admin), sans
  utilité pour le rendu public.
*/
export interface VisibiliteResume {
  id: string;
  annonceur: string;
  visuel: string;
  visuelMobile?: string;
  alt: string;
  lien?: string;
  poids: number;
  dateDebut?: string;
  dateFin?: string;
}

const CHAMPS_RESUME_PUBLIC = ['id', 'annonceur', 'visuel', 'visuelMobile', 'alt', 'lien', 'poids', 'dateDebut', 'dateFin'] as const;

/*
  `visuelMobile` est optionnel dès la saisie Admin (voir docs/VISIBILITE.md
  §4/§5bis) : si absent, le rendu public retombe sur `visuel` (desktop) pour
  toutes les largeurs — c'est le contrôleur client (src/lib/visibilite-ui.ts)
  qui applique ce repli via <picture>/<source>, jamais ce module ni l'API, qui
  transmettent tels quels les deux champs (visuelMobile potentiellement
  absent).
*/
export function visibiliteResume(visibilite: Visibilite): VisibiliteResume {
  return {
    id: visibilite.id,
    annonceur: visibilite.annonceur,
    visuel: visibilite.visuel,
    visuelMobile: visibilite.visuelMobile,
    alt: visibilite.alt,
    lien: visibilite.lien,
    poids: visibilite.poids,
    dateDebut: visibilite.dateDebut,
    dateFin: visibilite.dateFin,
  };
}

/** Vrai si l'objet ne porte strictement que les champs publics attendus (utilisé par les tests). */
export function estResumePublicValide(objet: Record<string, unknown>): boolean {
  return Object.keys(objet).every((cle) => (CHAMPS_RESUME_PUBLIC as readonly string[]).includes(cle));
}

/** Même règle que `estDansPeriode`, appliquée à un VisibiliteResume (dates en ISO côté client). */
export function estDansPeriodeResume(resume: Pick<VisibiliteResume, 'dateDebut' | 'dateFin'>, maintenant: Date): boolean {
  const dateDebut = resume.dateDebut ? new Date(resume.dateDebut) : undefined;
  const dateFin = resume.dateFin ? new Date(resume.dateFin) : undefined;
  return estDansPeriode(dateDebut, dateFin, maintenant);
}

// ---------------------------------------------------------------------------
// Sûreté des URL (audit sécurité, constat n°1)
//
// `lien`, `visuel` et `visuelMobile` finissent dans le DOM du site public :
// `lien` en `href` d'une balise <a>, les deux autres en `src` d'une <img>
// (voir visibilite-ui.ts). Jusqu'ici, la validation serveur n'exigeait
// qu'une chaîne non vide : un `lien` en `javascript:` s'exécutait donc dans
// l'origine du site, pour tout visiteur cliquant le bandeau, sur les quatre
// pages équipées.
//
// La règle ci-dessous est le MIROIR de estUrlVisibiliteSure() dans
// public/api/_visibilites-lib.php - même convention que le reste de ce
// module (PHP ne peut pas importer du TypeScript, la duplication est
// assumée). Toute évolution doit être répercutée aux deux endroits.
//
// Elle est appliquée DEUX fois, volontairement :
//   1. à l'écriture (PHP) - refuse d'enregistrer une valeur dangereuse ;
//   2. à la lecture (client, visibilite-ui.ts) - parce que la validation
//      d'écriture ne réexamine PAS les enregistrements déjà présents dans
//      visibilites.json. Une campagne saisie avant ce correctif resterait
//      servie telle quelle : seul le contrôle côté client protège le
//      visiteur dans ce cas.
// ---------------------------------------------------------------------------

/**
 * Vrai si `valeur` est une URL sûre à poser dans un `href`/`src` :
 * `http://`, `https://`, ou un chemin interne au site (`/...`).
 *
 * Refuse notamment `javascript:`, `data:`, `vbscript:`, `file:`, ainsi que
 * les URL protocol-relative (`//exemple.com`) - ces dernières ressemblent à
 * un chemin interne mais désignent en réalité un domaine tiers.
 *
 * Les navigateurs ignorent espaces et caractères de contrôle à l'intérieur
 * d'un schéma (un « javascript: » coupé par une tabulation est tout de même
 * interprété comme tel) : ils sont donc retirés AVANT examen, jamais après.
 */
export function estUrlVisibiliteSure(valeur: string | undefined | null): boolean {
  if (typeof valeur !== 'string') return false;
  const nettoyee = valeur.replace(/[\u0000-\u0020]/g, '');
  if (nettoyee === '') return false;
  if (nettoyee.startsWith('//')) return false; // protocol-relative : domaine tiers déguisé
  if (nettoyee.startsWith('/')) return true; // chemin interne au site
  return /^https?:\/\//i.test(nettoyee);
}
