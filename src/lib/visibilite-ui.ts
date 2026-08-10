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
import { selectionnerPonderee, estDansPeriodeResume, type VisibiliteResume, type PageVisibilite, type EmplacementVisibilite } from './visibilites';

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

function remplir(visuel: HTMLElement, choisie: VisibiliteResume): void {
  const lien = document.createElement(choisie.lien ? 'a' : 'div');
  if (choisie.lien) {
    (lien as HTMLAnchorElement).href = choisie.lien;
  }
  lien.className = 'block w-full';

  const picture = document.createElement('picture');

  // visuelMobile est optionnel : absent -> pas de <source> dédiée, l'<img>
  // (desktop) sert alors de visuel unique sur toutes les largeurs, comme
  // avant l'introduction du visuel mobile.
  if (choisie.visuelMobile) {
    const source = document.createElement('source');
    source.media = SEUIL_DESKTOP;
    source.srcset = choisie.visuel;
    picture.appendChild(source);
  }

  const img = document.createElement('img');
  img.src = choisie.visuelMobile || choisie.visuel;
  img.alt = choisie.alt;
  img.loading = 'lazy';
  // Ratio naturel du visuel, aucun crop : largeur fluide (100% du slot),
  // hauteur automatique (voir docs/VISIBILITE.md §5bis).
  img.className = 'block h-auto w-full';
  picture.appendChild(img);
  lien.appendChild(picture);

  visuel.replaceChildren(lien);
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

  remplir(visuel, choisie);
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
