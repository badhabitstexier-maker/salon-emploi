import { test, expect } from '@playwright/test';

/*
  Lot Admin-0 (voir docs/ADMIN.md) : contrôle du socle uniquement — la page
  /admin se construit, est marquée noindex, et n'est reliée depuis aucune
  page publique. La vraie protection d'accès (.htaccess/.htpasswd côté OVH)
  n'existe pas en environnement Playwright (serveur `astro preview`, pas
  Apache) : elle se vérifie manuellement après déploiement en préproduction,
  pas ici (voir docs/ADMIN.md, procédure de test).
*/

test.describe('Admin — socle (Lot Admin-0)', () => {
  test('/admin se charge et est marqué noindex,nofollow', async ({ page }) => {
    const reponse = await page.goto('/admin');
    expect(reponse?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();

    const meta = page.locator('meta[name="robots"]');
    await expect(meta).toHaveAttribute('content', /noindex/);
    await expect(meta).toHaveAttribute('content', /nofollow/);
  });

  test('aucune page publique ne lie vers /admin', async ({ page }) => {
    const pagesPubliques = ['/', '/le-salon', '/exposants', '/offres', '/programme', '/preparer-ma-visite', '/exposer'];

    for (const chemin of pagesPubliques) {
      await page.goto(chemin);
      const lienAdmin = page.locator('a[href^="/admin"]');
      await expect(lienAdmin, `un lien vers /admin a été trouvé sur ${chemin}`).toHaveCount(0);
    }
  });
});
