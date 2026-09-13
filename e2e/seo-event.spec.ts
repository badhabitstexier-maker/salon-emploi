import { test, expect } from '@playwright/test';

/*
  Sans dates exactes validées, publier un Event imposerait des startDate et
  endDate fictifs. Le schéma sera réactivé depuis la configuration centrale.
*/

test.describe('JSON-LD Event — accueil', () => {
  test("l'accueil ne publie pas d'Event tant que les dates exactes sont inconnues", async ({ page }) => {
    await page.goto('/');

    const scriptsLdJson = page.locator('script[type="application/ld+json"]');
    await expect(scriptsLdJson).toHaveCount(0);
  });
});
