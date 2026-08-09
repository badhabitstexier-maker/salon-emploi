/*
  Contrôleur client des VisibilitySlot présents sur une page — le seul
  module qui touche au DOM. La logique pure (tirage pondéré) vit dans
  ./visibilites.ts (même séparation que candidature-selection.ts /
  selection-ui.ts pour la sélection d'offres).

  Le tirage est effectué UNE SEULE FOIS par emplacement, au chargement de la
  page — jamais de minuteur, jamais de second tirage : voir
  docs/VISIBILITE.md, section « rotation ». La rotation perçue par LabEvents
  vient du fait que chaque visite (et chaque nouveau build) peut tirer un
  annonceur différent parmi les éligibles, pas d'un changement pendant la
  consultation.

  Découverte par balayage du DOM (pas d'id fixe unique) : chaque
  VisibilitySlot.astro pose son propre <script type="application/json"
  data-visibility-json data-conteneur="..."> ; ce module les traite tous,
  ce qui reste correct même si une page venait à porter plusieurs
  emplacements (Admin-2B).
*/
import { selectionnerPonderee, type VisibiliteResume } from './visibilites';

function lireCandidats(script: HTMLScriptElement): VisibiliteResume[] {
  if (!script.textContent) return [];
  try {
    const donnees = JSON.parse(script.textContent);
    return Array.isArray(donnees) ? donnees : [];
  } catch {
    return [];
  }
}

function remplir(conteneur: HTMLElement, choisie: VisibiliteResume): void {
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

  conteneur.replaceChildren(lien);
  conteneur.classList.remove('hidden');
  conteneur.dataset.annonceur = choisie.annonceur;
}

/** Traite tous les VisibilitySlot présents sur la page courante. */
export function initAllVisibilitySlots(): void {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-visibility-json]');
  for (const script of scripts) {
    const conteneurId = script.dataset.conteneur;
    if (!conteneurId) continue;
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur || conteneur.dataset.annonceur) continue; // déjà rempli — idempotent

    const choisie = selectionnerPonderee(lireCandidats(script));
    if (choisie) remplir(conteneur, choisie);
  }
}
