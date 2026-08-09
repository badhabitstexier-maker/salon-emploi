/*
  Contrôleur client des VisibilitySlot présents sur une page — le seul
  module qui touche au DOM. La logique pure (fenêtre de dates, tirage
  pondéré) vit dans ./visibilites.ts (même séparation que
  candidature-selection.ts / selection-ui.ts pour la sélection d'offres).

  Deux évaluations sont faites ici, une seule fois par emplacement, au
  chargement de la page — jamais de minuteur, jamais de second tirage
  ensuite (voir docs/VISIBILITE.md, section « rotation ») :
    1. la fenêtre de dates (dateDebut/dateFin) de chaque candidat envoyé
       par le build, avec l'heure réelle du visiteur — voir
       docs/VISIBILITE.md section 7 : c'est ce qui permet à une campagne de
       démarrer ou s'arrêter à l'heure dite sans nouveau déploiement ;
    2. le tirage pondéré parmi les candidats qui passent cette fenêtre.

  Découverte par balayage du DOM (pas d'id fixe unique) : chaque
  VisibilitySlot.astro pose son propre <script type="application/json"
  data-visibility-json data-section="..."> ; ce module les traite tous, ce
  qui reste correct même si une page venait à porter plusieurs emplacements
  (Admin-2B).
*/
import { selectionnerPonderee, estDansPeriodeResume, type VisibiliteResume } from './visibilites';

function lireCandidats(script: HTMLScriptElement): VisibiliteResume[] {
  if (!script.textContent) return [];
  try {
    const donnees = JSON.parse(script.textContent);
    return Array.isArray(donnees) ? donnees : [];
  } catch {
    return [];
  }
}

function remplir(visuel: HTMLElement, choisie: VisibiliteResume): void {
  const lien = document.createElement(choisie.lien ? 'a' : 'div');
  if (choisie.lien) {
    (lien as HTMLAnchorElement).href = choisie.lien;
  }
  lien.className = 'block h-full w-full';

  const img = document.createElement('img');
  img.src = choisie.visuel;
  img.alt = choisie.alt;
  img.loading = 'lazy';
  img.className = 'h-full w-full object-cover';
  lien.appendChild(img);

  visuel.replaceChildren(lien);
}

/** Traite tous les VisibilitySlot présents sur la page courante. */
export function initAllVisibilitySlots(): void {
  const maintenant = new Date();
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-visibility-json]');

  for (const script of scripts) {
    const sectionId = script.dataset.section;
    if (!sectionId) continue;
    const section = document.getElementById(sectionId);
    if (!section || section.dataset.rempli) continue; // déjà traité — idempotent

    const dansLaPeriode = lireCandidats(script).filter((candidat) => estDansPeriodeResume(candidat, maintenant));
    const choisie = selectionnerPonderee(dansLaPeriode);

    section.dataset.rempli = '1';
    if (!choisie) continue; // reste entièrement masqué — aucun espace vide (voir VisibilitySlot.astro)

    const visuel = section.querySelector<HTMLElement>('[data-visibility-visual]');
    if (!visuel) continue;

    remplir(visuel, choisie);
    section.classList.remove('hidden');
    section.dataset.annonceur = choisie.annonceur;
  }
}
