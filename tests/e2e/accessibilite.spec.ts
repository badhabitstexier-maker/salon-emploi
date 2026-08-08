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

  Ancienne exception « CTA bg-village en texte blanc » (contraste 3.19:1)
  supprimée : les CTA concernés utilisent désormais `text-marine` sur
  `bg-village` (contraste ≈ 4.93:1, conforme AA) — voir CLAUDE.md section 10
  et docs/RECETTE_AUTOMATISEE.md. Aucune violation de contraste connue ne
  reste donc masquée ici.
*/
const PAGES_REPRESENTATIVES = ['/', '/exposants', '/programme', '/offres', '/candidater'];

test.describe('Accessibilité automatisée (axe-core)', () => {
  for (const chemin of PAGES_REPRESENTATIVES) {
    test(`${chemin} : aucune violation "serious" ou "critical"`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'Un seul passage suffit — l’accessibilité structurelle ne dépend pas du viewport');

      await page.goto(chemin);
      const resultats = await new AxeBuilder({ page })
        .exclude('#tally-candidature-iframe')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const violationsGraves = resultats.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

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
