import { test, expect } from '@playwright/test';
import { FIXTURE_REFERENCE, FIXTURE_INTITULE, FIXTURE_LIEU, FIXTURE_TYPE_CONTRAT } from '../scripts/e2e-fixtures.mjs';

/*
  Lot 4B-3 : vérifie le contrat JSON-LD JobPosting réellement produit par
  src/pages/offres/[slug].astro sur une offre publiée non-TEST. Réutilise la
  fixture technique du Lot 4B-2 (scripts/e2e-fixtures.mjs) plutôt que de
  créer une nouvelle fausse offre dans src/content/offres — la fixture
  accepte les candidatures en ligne et n'est pas une offre TEST, donc son
  intitulé ne commence pas par "TEST —".

  Ce test constate le schéma existant (title, description, identifier,
  datePosted, employmentType, hiringOrganization, jobLocation) — voir le
  literal jobPostingSchema dans [slug].astro — sans en exiger de propriétés
  supplémentaires non produites par l'implémentation actuelle.
*/

test.describe('JSON-LD JobPosting — offre publiée non-TEST (fixture E2E)', () => {
  test('la fiche produit un JobPosting JSON-LD valide et cohérent avec l’offre affichée', async ({ page }) => {
    await page.goto('/offres');
    await page
      .locator('[data-offre-card]', { hasText: FIXTURE_INTITULE })
      .getByRole('link', { name: "Voir l'offre" })
      .click();
    await expect(page.locator(`[data-offre-toggle="${FIXTURE_REFERENCE}"]`)).toBeVisible();

    // Pas de noindex sur une offre non-TEST : le JSON-LD est donc attendu.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    const scriptsLdJson = page.locator('script[type="application/ld+json"]');
    await expect(scriptsLdJson).toHaveCount(1);

    const contenu = await scriptsLdJson.first().textContent();
    expect(contenu).toBeTruthy();

    let donnees: Record<string, unknown>;
    expect(() => {
      donnees = JSON.parse(contenu as string);
    }).not.toThrow();
    donnees = JSON.parse(contenu as string);

    expect(donnees['@context']).toBe('https://schema.org');
    expect(donnees['@type']).toBe('JobPosting');
    expect(donnees.title).toBe(FIXTURE_INTITULE);
    expect(typeof donnees.description).toBe('string');
    expect((donnees.description as string).length).toBeGreaterThan(0);
    expect(donnees.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(donnees.employmentType).toEqual([FIXTURE_TYPE_CONTRAT]);

    const identifier = donnees.identifier as Record<string, unknown>;
    expect(identifier?.['@type']).toBe('PropertyValue');
    expect(identifier?.value).toBe(FIXTURE_REFERENCE);

    const hiringOrganization = donnees.hiringOrganization as Record<string, unknown>;
    expect(hiringOrganization?.['@type']).toBe('Organization');
    expect(typeof hiringOrganization?.name).toBe('string');

    const jobLocation = donnees.jobLocation as Record<string, unknown>;
    expect(jobLocation?.['@type']).toBe('Place');
    const address = jobLocation?.address as Record<string, unknown>;
    expect(address?.['@type']).toBe('PostalAddress');
    expect(address?.addressLocality).toBe(FIXTURE_LIEU);
  });
});
