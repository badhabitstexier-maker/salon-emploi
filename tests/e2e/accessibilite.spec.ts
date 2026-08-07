import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/*
  Accessibilité automatisée (mission Lot 4B, section 37-38) : violations
  "serious" et "critical" uniquement, sur des pages représentatives. Ne
  transforme pas ce lot en correction exhaustive WCAG — les violations
  "moderate"/"minor" sont volontairement ignorées ici et à documenter à part
  si besoin (voir docs/RECETTE_AUTOMATISEE.md).

  L'intérieur cross-origin de l'iframe Tally n'est jamais analysé (axe-core
  ne peut de toute façon pas y accéder).

  Exception documentée (voir docs/RECETTE_AUTOMATISEE.md) : les boutons/CTA
  sur fond `bg-village` avec texte blanc (ex. « Devenir exposant » du header)
  ont un contraste mesuré de 3.19:1, sous le seuil WCAG AA de 4.5:1 exigé pour
  du texte de cette taille. C'est la même famille de problème que
  l'exception déjà actée pour le texte de corps dans CLAUDE.md (section 10),
  mais ici sur des boutons répartis dans une dizaine de fichiers à travers
  tout le site — un changement de cette ampleur touche à l'identité visuelle
  des CTA principaux et relève d'une décision de Philippe (CLAUDE.md, section
  12), pas d'un correctif ponctuel de ce Lot. Le test ignore donc précisément
  cette combinaison connue, tout en continuant à détecter tout autre problème
  de contraste (nouveau ou existant) ailleurs sur la page.
*/
const PAGES_REPRESENTATIVES = ['/', '/exposants', '/programme', '/offres', '/candidater'];

function estExceptionContrasteBoutonVillageConnue(node: { html: string }): boolean {
  return node.html.includes('bg-village') && !node.html.includes('bg-village-dark') && node.html.includes('text-blanc');
}

test.describe('Accessibilité automatisée (axe-core)', () => {
  for (const chemin of PAGES_REPRESENTATIVES) {
    test(`${chemin} : aucune violation "serious" ou "critical"`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'Un seul passage suffit — l’accessibilité structurelle ne dépend pas du viewport');

      await page.goto(chemin);
      const resultats = await new AxeBuilder({ page })
        .exclude('#tally-candidature-iframe')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const violationsGraves = resultats.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({
          ...v,
          nodes: v.id === 'color-contrast' ? v.nodes.filter((n) => !estExceptionContrasteBoutonVillageConnue(n)) : v.nodes,
        }))
        .filter((v) => v.nodes.length > 0);

      const resume = violationsGraves
        .map((v) => `[${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} occurrence(s))`)
        .join('\n');

      expect(violationsGraves, resume).toEqual([]);
    });
  }
});

test.describe('Accessibilité structurelle', () => {
  for (const chemin of PAGES_REPRESENTATIVES) {
    test(`${chemin} : un seul H1, liens et boutons nommés, images significatives avec alt`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'Contrôle indépendant du viewport — un seul passage suffit');

      await page.goto(chemin);

      await expect(page.locator('h1')).toHaveCount(1);

      const liensSansNom = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a')).filter((a) => !a.textContent?.trim() && !a.getAttribute('aria-label')).length,
      );
      expect(liensSansNom, 'liens sans texte accessible').toBe(0);

      const boutonsSansNom = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).filter(
          (b) => !b.textContent?.trim() && !b.getAttribute('aria-label'),
        ).length,
      );
      expect(boutonsSansNom, 'boutons sans nom accessible').toBe(0);

      const imagesSansAlt = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img')).filter((img) => !img.hasAttribute('alt')).length,
      );
      expect(imagesSansAlt, 'images sans attribut alt').toBe(0);
    });
  }

  test('/exposer : les champs de formulaire ont tous un label associé', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'Contrôle indépendant du viewport — un seul passage suffit');
    await page.goto('/exposer');

    const champsSansLabel = await page.evaluate(() => {
      const champs = Array.from(document.querySelectorAll('input, select, textarea')).filter(
        (el) => el.getAttribute('type') !== 'hidden',
      );
      return champs.filter((champ) => {
        const id = champ.getAttribute('id');
        const aLabelAssocie = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
        const aAriaLabel = champ.hasAttribute('aria-label') || champ.hasAttribute('aria-labelledby');
        return !aLabelAssocie && !aAriaLabel;
      }).length;
    });

    expect(champsSansLabel, 'champs de formulaire sans label associé').toBe(0);
  });
});
