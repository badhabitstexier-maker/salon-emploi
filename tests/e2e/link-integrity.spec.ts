import { test, expect, type Page } from '@playwright/test';

/*
  Contrôle des liens internes cassés et des ressources locales manquantes
  (mission Lot 4B, sections 25 et 26). Ne crawle jamais Internet : seuls les
  liens/ressources internes (même origine que la page) sont vérifiés — les
  liens externes (réseaux sociaux, sites exposants, Tally, Web3Forms…) sont
  volontairement ignorés.
*/

const PAGES_PUBLIQUES = [
  '/',
  '/le-salon',
  '/exposants',
  '/exposants/fixture-entreprise-e2e',
  '/exposants/fixture-organisme-e2e',
  '/offres',
  '/offres/fixture-offre-standard-e2e',
  '/offres/fixture-offre-gold-e2e',
  '/offres/fixture-offre-sur-place-e2e',
  '/programme',
  '/programme/fixture-atelier-e2e',
  '/programme/fixture-conference-e2e',
  '/programme/fixture-rencontre-e2e',
  '/preparer-ma-visite',
  '/exposer',
  '/ma-selection',
  '/candidater',
  '/confidentialite',
  '/mentions-legales',
  '/merci',
];

async function collecterLiensEtImagesInternes(page: Page, chemin: string) {
  await page.goto(chemin);
  return page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/') && !href.startsWith('//'));
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[src]'))
      .map((img) => img.getAttribute('src') ?? '')
      .filter((src) => src.startsWith('/') && !src.startsWith('//'));
    return { hrefs, imgs };
  });
}

test('aucun lien interne cassé ni image locale manquante sur les pages publiques (avec fixtures)', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Contrôle indépendant du viewport — un seul passage suffit');

  const liensATester = new Set<string>();
  const imagesATester = new Set<string>();

  for (const chemin of PAGES_PUBLIQUES) {
    const { hrefs, imgs } = await collecterLiensEtImagesInternes(page, chemin);
    for (const href of hrefs) liensATester.add(href.split('#')[0] || '/');
    for (const src of imgs) imagesATester.add(src);
  }

  const liensCasses: string[] = [];
  for (const lien of liensATester) {
    if (!lien) continue;
    const reponse = await request.get(lien);
    if (reponse.status() >= 400) liensCasses.push(`${lien} → ${reponse.status()}`);
  }
  expect(liensCasses, `Liens internes cassés :\n${liensCasses.join('\n')}`).toEqual([]);

  const imagesCassees: string[] = [];
  for (const image of imagesATester) {
    const reponse = await request.get(image);
    if (reponse.status() >= 400) imagesCassees.push(`${image} → ${reponse.status()}`);
  }
  expect(imagesCassees, `Images locales manquantes :\n${imagesCassees.join('\n')}`).toEqual([]);
});
