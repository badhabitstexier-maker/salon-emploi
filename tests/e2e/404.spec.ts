import { test, expect } from '@playwright/test';

test.describe('Page 404', () => {
  test('une URL inexistante renvoie un statut 404, sans redirection silencieuse @smoke', async ({ page }) => {
    const response = await page.goto('/cette-page-nexiste-pas-e2e');
    expect(response?.status()).toBe(404);
    // Pas de redirection déguisée vers l'accueil ou une autre route existante.
    await expect(page).toHaveURL(/\/cette-page-nexiste-pas-e2e\/?$/);
  });
});
