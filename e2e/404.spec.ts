import { test, expect } from '@playwright/test';

/*
  Lot 4B-4 : une URL interne inexistante ne doit jamais répondre en 200
  (page fantôme indexable). Contrôle uniquement le comportement HTTP
  technique — la création d'une page 404 personnalisée reste une dette
  distincte, volontairement hors périmètre de ce lot (voir CLAUDE.md).
*/

test.describe('Comportement 404', () => {
  test('une route inexistante répond en 404, pas en 200', async ({ request }) => {
    const reponse = await request.get('/__e2e-page-inexistante__');
    expect(reponse.status()).toBe(404);
  });

  test('une route imbriquée inexistante répond aussi en 404', async ({ request }) => {
    const reponse = await request.get('/offres/__e2e-offre-inexistante__');
    expect(reponse.status()).toBe(404);
  });
});
