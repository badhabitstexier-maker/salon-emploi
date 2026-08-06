/*
  Contrôleur client de la sélection d'offres — le seul module qui touche au
  DOM et à `window.location` / `history`. La logique pure (lecture, ajout,
  retrait, reconstruction d'URL) vit dans ./candidature-selection.ts.

  Aucun localStorage, sessionStorage, cookie ni IndexedDB : tout l'état vient
  de `window.location.search` et n'est réécrit qu'avec `history.replaceState`.
  Appelé une fois par page via `initSelectionUI()` (voir /offres, /offres/[slug],
  /ma-selection et /candidater).
*/
import {
  MAX_SELECTION,
  lireSelection,
  filtrerReferencesConnues,
  ajouterReference,
  retirerReference,
  appliquerSelectionAlUrl,
  hrefVersCandidater,
} from './candidature-selection';

/** Événement émis à chaque écriture de la sélection dans l'URL (voir /candidater). */
export const EVENEMENT_SELECTION_CHANGEE = 'offres:selection-changee';

interface OffreResume {
  reference: string;
  intitule: string;
  exposantNom: string;
  href: string;
}

interface OptionsSelectionUI {
  /** id du <script type="application/json"> contenant un OffreResume[]. */
  offresDisponiblesId?: string;
}

function lireOffresDisponibles(id: string): OffreResume[] {
  const element = document.getElementById(id);
  if (!element?.textContent) return [];
  try {
    const donnees = JSON.parse(element.textContent);
    return Array.isArray(donnees) ? donnees : [];
  } catch {
    return [];
  }
}

export function initSelectionUI(options: OptionsSelectionUI = {}): void {
  const idDonnees = options.offresDisponiblesId ?? 'offres-disponibles-donnees';
  const offresDisponibles = lireOffresDisponibles(idDonnees);
  const parReference = new Map(offresDisponibles.map((offre) => [offre.reference, offre]));
  const referencesConnues = new Set(parReference.keys());

  function annoncer(message: string): void {
    const zone = document.getElementById('annonce-selection');
    if (zone) zone.textContent = message;
  }

  function selectionActuelle(): string[] {
    const params = new URLSearchParams(window.location.search);
    const { connues } = filtrerReferencesConnues(lireSelection(params), referencesConnues);
    return connues;
  }

  function remplirListe(conteneur: HTMLElement, selection: string[]): void {
    const modele = document.getElementById('modele-ligne-selection') as HTMLTemplateElement | null;
    conteneur.replaceChildren();
    if (!modele) return;
    for (const reference of selection) {
      const offre = parReference.get(reference);
      if (!offre) continue;
      const fragment = modele.content.cloneNode(true) as DocumentFragment;
      const ligne = fragment.querySelector<HTMLElement>('[data-ligne-selection]');
      ligne?.querySelector('[data-champ="reference"]')?.replaceChildren(offre.reference);
      ligne?.querySelector('[data-champ="intitule"]')?.replaceChildren(offre.intitule);
      ligne?.querySelector('[data-champ="exposant"]')?.replaceChildren(offre.exposantNom);
      const lien = ligne?.querySelector<HTMLAnchorElement>('[data-champ="lien"]');
      if (lien) lien.href = offre.href;
      const boutonRetirer = ligne?.querySelector<HTMLButtonElement>('[data-action="retirer"]');
      if (boutonRetirer) {
        boutonRetirer.setAttribute('aria-label', `Retirer « ${offre.intitule} » de ma sélection`);
        boutonRetirer.addEventListener('click', () => {
          ecrireSelection(retirerReference(selectionActuelle(), reference));
          annoncer(`« ${offre.intitule} » retirée de votre sélection.`);
        });
      }
      conteneur.appendChild(fragment);
    }
  }

  function rendre(selection: string[]): void {
    document.querySelectorAll<HTMLButtonElement>('[data-offre-toggle]').forEach((bouton) => {
      const reference = bouton.dataset.offreToggle;
      if (!reference) return;
      const estSelectionnee = selection.includes(reference);
      bouton.setAttribute('aria-pressed', String(estSelectionnee));
      bouton.textContent = estSelectionnee ? 'Retirer de ma sélection' : 'Ajouter à ma sélection';
    });

    document.querySelectorAll('[data-compteur-selection]').forEach((element) => {
      element.textContent = `${selection.length}/${MAX_SELECTION}`;
    });
    // Variante « nombre seul » — pour les libellés du type "X offre(s) sélectionnée(s) sur 5" (/candidater).
    document.querySelectorAll('[data-compteur-nombre]').forEach((element) => {
      element.textContent = String(selection.length);
    });

    document.querySelectorAll<HTMLElement>('[data-liste-selection]').forEach((liste) => {
      remplirListe(liste, selection);
    });

    document.querySelectorAll<HTMLElement>('[data-selection-presente]').forEach((element) => {
      element.classList.toggle('hidden', selection.length === 0);
    });
    document.querySelectorAll<HTMLElement>('[data-selection-vide]').forEach((element) => {
      element.classList.toggle('hidden', selection.length > 0);
    });

    // Réserve de l'espace en bas de page pour ne pas masquer le contenu
    // sous le tiroir de sélection fixe (voir #tiroir-selection).
    document.body.classList.toggle('has-selection-drawer', selection.length > 0 && document.getElementById('tiroir-selection') !== null);

    document.querySelectorAll<HTMLAnchorElement>('a[data-preserve-selection]').forEach((lien) => {
      const cheminBase = lien.dataset.hrefBase ?? lien.getAttribute('href') ?? '';
      const url = appliquerSelectionAlUrl(new URL(cheminBase, window.location.href), selection);
      lien.href = `${url.pathname}${url.search}`;
    });

    // CTA de candidature (tiroir, /ma-selection) — activés au Lot 2, pointent
    // vers /candidater avec la sélection courante ; `data-cta-candidater-orientation`
    // ajoute en plus `orientation=1` (parcours « Déposer mon profil »).
    document.querySelectorAll<HTMLAnchorElement>('a[data-cta-candidater]').forEach((lien) => {
      const orientation = lien.hasAttribute('data-cta-candidater-orientation');
      lien.href = hrefVersCandidater(selection, orientation);
    });
  }

  function ecrireSelection(selection: string[]): void {
    const url = appliquerSelectionAlUrl(new URL(window.location.href), selection);
    window.history.replaceState(window.history.state, '', url);
    rendre(selection);
    document.dispatchEvent(new CustomEvent(EVENEMENT_SELECTION_CHANGEE, { detail: { selection } }));
  }

  document.addEventListener('click', (evenement) => {
    const cible = evenement.target instanceof Element ? evenement.target.closest<HTMLButtonElement>('[data-offre-toggle]') : null;
    if (!cible) return;
    const reference = cible.dataset.offreToggle;
    if (!reference) return;

    const actuelle = selectionActuelle();
    if (actuelle.includes(reference)) {
      ecrireSelection(retirerReference(actuelle, reference));
      annoncer('Offre retirée de votre sélection.');
      return;
    }

    const resultat = ajouterReference(actuelle, reference);
    if (resultat.limiteAtteinte) {
      annoncer('Vous pouvez sélectionner jusqu’à cinq offres. Retirez une offre pour en ajouter une nouvelle.');
      return;
    }
    ecrireSelection(resultat.selection);
    annoncer('Offre ajoutée à votre sélection.');
  });

  // Nettoyage initial (doublons, références inconnues) sans jamais perdre une sélection valide.
  ecrireSelection(selectionActuelle());
}
