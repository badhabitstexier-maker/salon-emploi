import { test, expect } from '@playwright/test';

/*
  Lot 4B-3 : le JSON-LD schema.org/Event n'est généré que sur l'accueil
  (src/pages/index.astro, const eventSchema) — pas de duplication sur
  d'autres pages dans l'architecture actuelle, donc pas de test ailleurs.
*/

test.describe('JSON-LD Event — accueil', () => {
  test("l'accueil produit un Event JSON-LD valide avec nom, dates, lieu et URL", async ({ page, baseURL }) => {
    await page.goto('/');

    const scriptsLdJson = page.locator('script[type="application/ld+json"]');
    await expect(scriptsLdJson).toHaveCount(1);

    const contenu = await scriptsLdJson.first().textContent();
    expect(contenu).toBeTruthy();
    const donnees = JSON.parse(contenu as string);

    expect(donnees['@context']).toBe('https://schema.org');
    expect(donnees['@type']).toBe('Event');
    expect(typeof donnees.name).toBe('string');
    expect((donnees.name as string).length).toBeGreaterThan(0);
    expect(donnees.startDate).toBe('2026-10-30');
    expect(donnees.endDate).toBe('2026-10-31');

    const location = donnees.location as Record<string, unknown>;
    expect(location?.['@type']).toBe('Place');
    expect(typeof location?.name).toBe('string');

    expect(donnees.url).toBe(new URL('/', baseURL ?? undefined).toString());
  });
});
