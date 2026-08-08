import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Attache des collecteurs d'erreurs JS (console.error + erreurs non
 * interceptées) sur la page. À appeler avant `page.goto(...)`.
 *
 * Allowlist volontairement minimale (mission Lot 4B, section 24) : seules les
 * erreurs réseau vers des domaines tiers explicitement hors périmètre de test
 * (tally.so non mocké dans certains specs statiques) sont ignorées — jamais
 * une erreur applicative du site lui-même.
 */
export function collecterErreursConsole(page: Page): { erreurs: string[] } {
  const etat = { erreurs: [] as string[] };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      etat.erreurs.push(`console.error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    etat.erreurs.push(`pageerror: ${error.message}`);
  });

  return etat;
}

/** Ignore les erreurs réseau vers des domaines tiers explicitement hors périmètre de test. */
const DOMAINES_TIERS_IGNORES = ['tally.so'];

export function erreursApplicatives(erreurs: string[]): string[] {
  return erreurs.filter((erreur) => !DOMAINES_TIERS_IGNORES.some((domaine) => erreur.includes(domaine)));
}

/** Vérifie l'absence de débordement horizontal significatif (mission Lot 4B, section 21). */
export async function verifierAucunDebordementHorizontal(page: Page, toleranceEnPx = 2): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `document.documentElement.scrollWidth (${scrollWidth}) dépasse clientWidth (${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth + toleranceEnPx);
}
