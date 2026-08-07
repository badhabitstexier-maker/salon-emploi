import { test } from '@playwright/test';
import { verifierAucunDebordementHorizontal } from './support/helpers';

/*
  Contrôle de régression responsive (mission Lot 4B, section 21) sur les
  pages critiques, en desktop et mobile (deux projets Playwright).
*/
const PAGES_CRITIQUES = ['/', '/exposants', '/programme', '/offres', '/ma-selection', '/candidater'];

for (const chemin of PAGES_CRITIQUES) {
  test(`aucun débordement horizontal significatif sur ${chemin}`, async ({ page }) => {
    await page.goto(chemin);
    await verifierAucunDebordementHorizontal(page);
  });
}
