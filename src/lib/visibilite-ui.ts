/*
  Contrôleur client des VisibilitySlot présents sur une page — le seul
  module qui touche au DOM et au réseau. La logique pure (fenêtre de dates,
  tirage pondéré) vit dans ./visibilites.ts (même séparation que
  candidature-selection.ts / selection-ui.ts pour la sélection d'offres).

  CHANGEMENT Admin-2B (voir docs/VISIBILITE.md) : jusqu'ici, les candidats
  d'un emplacement étaient embarqués au build dans un <script
  type="application/json"> par page. Depuis Admin-2B, il n'y a plus de
  build qui connaisse ces données (elles vivent uniquement dans
  visibilites.json, sur le serveur, gérées par l'API PHP) : ce module va les
  chercher lui-même, à chaque chargement de page, via
  `GET /api/visibilites.php?page=...&emplacement=...`.

  Deux évaluations sont faites ici, une seule fois par emplacement, au
  chargement de la page — jamais de minuteur, jamais de second tirage
  ensuite (voir docs/VISIBILITE.md, section « rotation ») :
    1. la fenêtre de dates (dateDebut/dateFin) de chaque candidat reçu de
       l'API, avec l'heure réelle du visiteur ;
    2. le tirage pondéré parmi les candidats qui passent cette fenêtre.

  Fallback réseau strict (cadrage Admin-2B §12) : si l'appel réseau échoue,
  renvoie un statut d'erreur, ou un JSON inattendu, l'emplacement reste
  simplement masqué (`hidden`) — jamais d'erreur visible, jamais de blocage
  du reste de la page. C'est exactement le même comportement que « aucune
  campagne éligible », qui existait déjà avant Admin-2B.
*/
import {
  selectionnerPonderee,
  estDansPeriodeResume,
  estUrlVisibiliteSure,
  type VisibiliteResume,
  type PageVisibilite,
  type EmplacementVisibilite,
} from './visibilites';

async function chargerCandidats(page: string, emplacement: string): Promise<VisibiliteResume[]> {
  try {
    const url = `/api/visibilites.php?page=${encodeURIComponent(page)}&emplacement=${encodeURIComponent(emplacement)}`;
    const reponse = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!reponse.ok) return [];
    const donnees = await reponse.json();
    return Array.isArray(donnees?.visibilites) ? donnees.visibilites : [];
  } catch {
    // Réseau indisponible, API en panne, JSON invalide… : jamais d'erreur
    // visible, la section appelante reste masquée (voir remplir()/appelant).
    return [];
  }
}

/*
  Seuil mobile/desktop du bandeau (voir docs/VISIBILITE.md §4/§5bis) : en
  dessous de 640px, le visuel mobile (s'il existe) est chargé ; à partir de
  640px, toujours le visuel desktop. Repli natif géré par le navigateur via
  <picture>/<source> — aucune logique JS de correspondance de largeur à
  maintenir ici, et aucun flash/rechargement au redimensionnement.
*/
const SEUIL_DESKTOP = '(min-width: 640px)';

/** Renvoie false si la campagne n'est pas rendable (visuel inutilisable) : l'emplacement reste alors masqué. */
function remplir(visuel: HTMLElement, choisie: VisibiliteResume): boolean {
  /*
    Second contrôle de sûreté des URL, après celui fait à l'écriture par
    l'API PHP (audit sécurité, constat n°1). Il n'est pas redondant : la
    validation d'écriture ne rejoue jamais les enregistrements déjà
    présents dans visibilites.json, donc une campagne saisie avant ce
    correctif serait servie telle quelle. Un lien refusé n'est pas une
    erreur visible - le bandeau s'affiche simplement sans être cliquable,
    conformément au principe fail-safe du module.
  */
  const lienSur = estUrlVisibiliteSure(choisie.lien) ? choisie.lien : undefined;
  const lien = document.createElement(lienSur ? 'a' : 'div');
  if (lienSur) {
    (lien as HTMLAnchorElement).href = lienSur;
  }
  lien.className = 'block w-full';

  const picture = document.createElement('picture');

  // visuelMobile est optionnel : absent -> pas de <source> dédiée, l'<img>
  // (desktop) sert alors de visuel unique sur toutes les largeurs, comme
  // avant l'introduction du visuel mobile.
  // Même règle pour les visuels, posés en `src` : un schéma exécutable n'y
  // est pas exploitable, mais une valeur non conforme n'a rien à y faire.
  const visuelDesktop = estUrlVisibiliteSure(choisie.visuel) ? choisie.visuel : undefined;
  const visuelMobile = estUrlVisibiliteSure(choisie.visuelMobile) ? choisie.visuelMobile : undefined;

  if (visuelMobile && visuelDesktop) {
    const source = document.createElement('source');
    source.media = SEUIL_DESKTOP;
    source.srcset = visuelDesktop;
    picture.appendChild(source);
  }

  // Aucun visuel exploitable : rien à afficher. On ne pose pas une <img>
  // vide (image cassée visible par le visiteur), l'emplacement reste
  // masqué - même comportement que « aucune campagne éligible ».
  if (!visuelDesktop && !visuelMobile) return false;

  const img = document.createElement('img');
  img.src = visuelMobile || visuelDesktop!;
  img.alt = choisie.alt;
  img.loading = 'lazy';
  // Ratio naturel du visuel, aucun crop : largeur fluide (100% du slot),
  // hauteur automatique (voir docs/VISIBILITE.md §5bis).
  img.className = 'block h-auto w-full';
  picture.appendChild(img);
  lien.appendChild(picture);

  visuel.replaceChildren(lien);
  return true;
}

/** Traite un seul emplacement (une <section data-visibility-page>). Idempotent. */
async function initVisibilitySlot(section: HTMLElement): Promise<void> {
  if (section.dataset.rempli) return;
  const page = section.dataset.visibilityPage as PageVisibilite | undefined;
  const emplacement = (section.dataset.visibilityEmplacement as EmplacementVisibilite | undefined) ?? 'principal';
  if (!page) return;

  section.dataset.rempli = '1'; // marqué avant l'attente réseau : jamais deux appels concurrents sur le même slot

  const maintenant = new Date();
  const candidats = await chargerCandidats(page, emplacement);
  const dansLaPeriode = candidats.filter((candidat) => estDansPeriodeResume(candidat, maintenant));
  const choisie = selectionnerPonderee(dansLaPeriode);

  if (!choisie) return; // reste entièrement masqué — aucun espace vide (voir VisibilitySlot.astro)

  const visuel = section.querySelector<HTMLElement>('[data-visibility-visual]');
  if (!visuel) return;

  if (!remplir(visuel, choisie)) return; // visuel inutilisable : reste masqué
  section.classList.remove('hidden');
  section.dataset.annonceur = choisie.annonceur;
}

/** Traite tous les VisibilitySlot présents sur la page courante. */
export function initAllVisibilitySlots(): void {
  const sections = document.querySelectorAll<HTMLElement>('[data-visibility-page]');
  for (const section of sections) {
    void initVisibilitySlot(section);
  }
}
