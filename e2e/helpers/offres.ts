import type { Page } from '@playwright/test';

/** Toutes les cartes du catalogue (visibles ou masquées par les filtres). */
export function offreCards(page: Page) {
  return page.locator('[data-offre-card]');
}

/** Cartes actuellement visibles (non masquées par un filtre — voir OffreFilters.astro). */
export function offreCardsVisibles(page: Page) {
  return page.locator('[data-offre-card]:visible');
}

export interface OffreCardData {
  reference: string;
  secteur: string;
  lieu: string;
  typesContrat: string[];
  estTest: boolean;
}

/** Lit les attributs `data-*` de chaque carte (source de vérité pour calculer des résultats attendus). */
export async function offreCardsData(page: Page): Promise<OffreCardData[]> {
  return offreCards(page).evaluateAll((elements) =>
    elements.map((element) => ({
      reference: element.getAttribute('data-reference') ?? '',
      secteur: element.getAttribute('data-secteur') ?? '',
      lieu: element.getAttribute('data-lieu') ?? '',
      typesContrat: (element.getAttribute('data-types-contrat') ?? '').split('|').filter(Boolean),
      estTest: (element.querySelector('h3')?.textContent ?? '').includes('TEST —'),
    })),
  );
}
