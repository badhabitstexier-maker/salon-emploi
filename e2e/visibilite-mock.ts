import type { Page } from '@playwright/test';

/*
  Simulation de l'API Visibilité pour les tests E2E (Admin-2B, voir
  docs/VISIBILITE.md). Depuis Admin-2B, les campagnes ne vivent plus dans
  une Content Collection Astro (donc plus de fixture Markdown créée avant
  `astro build`, voir scripts/e2e-fixtures.mjs) mais dans un fichier JSON
  géré par une API PHP côté serveur — que Playwright (`astro preview`, sans
  Apache/PHP) ne peut pas exécuter. `page.route()` intercepte les appels
  fetch() du navigateur vers ces deux endpoints et répond avec des données
  canon, ce qui permet de tester fidèlement le comportement CLIENT (rendu,
  filtrage par date, tirage pondéré, gestion des erreurs réseau, CSRF
  envoyé, etc.) sans dépendre d'un vrai serveur PHP.

  Le VRAI code PHP (validation, CSRF réel, écriture atomique, whitelist) est
  testé séparément et fidèlement dans scripts/visibilites-api.test.mjs, qui
  fait tourner `php -S` — pas ici.
*/

export interface VisibiliteMock {
  id: string;
  nomInterne: string;
  annonceur: string;
  typeAnnonceur: string;
  exposantId?: string;
  format: string;
  visuel: string;
  alt: string;
  lien?: string;
  pages: string[];
  emplacement: string;
  dateDebut?: string;
  dateFin?: string;
  poids: number;
  actif: boolean;
}

const CSRF_TOKEN_TEST = 'jeton-csrf-e2e-fixe';

function resumePublic(v: VisibiliteMock) {
  return {
    id: v.id,
    annonceur: v.annonceur,
    visuel: v.visuel,
    alt: v.alt,
    lien: v.lien,
    poids: v.poids,
    dateDebut: v.dateDebut,
    dateFin: v.dateFin,
  };
}

/** Simule GET /api/visibilites.php (lecture publique, non authentifiée). */
export async function mockApiPublique(page: Page, visibilites: VisibiliteMock[]): Promise<void> {
  await page.route('**/api/visibilites.php*', async (route) => {
    const url = new URL(route.request().url());
    const pageParam = url.searchParams.get('page') ?? '';
    const emplacement = url.searchParams.get('emplacement') ?? 'principal';
    const envoyables = visibilites.filter(
      (v) => v.actif && v.emplacement === emplacement && v.pages.includes(pageParam),
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ visibilites: envoyables.map(resumePublic) }),
    });
  });
}

/** Simule une API publique injoignable (panne réseau, timeout, 500…) — vérifie le fallback (cadrage Admin-2B §12). */
export async function mockApiPubliqueIndisponible(page: Page): Promise<void> {
  await page.route('**/api/visibilites.php*', (route) => route.abort('failed'));
}

/**
 * Simule l'API Admin (/admin-api/visibilites.php) avec un état en mémoire
 * (le tableau `visibilitesInitiales`, muté en place par les requêtes
 * interceptées). `Content-Type: text/plain` volontaire sur le corps
 * factice : évite toute dépendance à une vraie session PHP, seul le jeton
 * CSRF (en-tête X-CSRF-Token) est vérifié — exactement ce que le
 * contrôleur client envoie (voir src/lib/admin-visibilite-ui.ts).
 */
export async function mockApiAdmin(page: Page, visibilitesInitiales: VisibiliteMock[] = []): Promise<VisibiliteMock[]> {
  const etat = visibilitesInitiales;
  let compteurId = 1;

  await page.route('**/admin-api/visibilites.php*', async (route) => {
    const requete = route.request();
    const methode = requete.method();
    const url = new URL(requete.url());
    const id = url.searchParams.get('id');

    if (methode === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visibilites: etat, csrfToken: CSRF_TOKEN_TEST }),
      });
      return;
    }

    const enTeteCsrf = requete.headers()['x-csrf-token'];
    if (enTeteCsrf !== CSRF_TOKEN_TEST) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ erreur: 'Jeton CSRF manquant ou invalide.', csrfToken: CSRF_TOKEN_TEST }),
      });
      return;
    }

    if (methode === 'POST') {
      const corps = requete.postDataJSON() as Partial<VisibiliteMock>;
      // Déclencheur volontaire pour tester le rendu des erreurs serveur
      // côté formulaire (voir e2e/visibilite.spec.ts) — un vrai 422 PHP est
      // déjà testé fidèlement par scripts/visibilites-api.test.mjs.
      if (corps.annonceur === 'DECLENCHER_ERREUR_422') {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ erreur: 'Données invalides.', details: ['annonceur est obligatoire.'], csrfToken: CSRF_TOKEN_TEST }),
        });
        return;
      }
      const nouvelle: VisibiliteMock = {
        id: `vis-e2e-${compteurId++}`,
        nomInterne: corps.nomInterne ?? '',
        annonceur: corps.annonceur ?? '',
        typeAnnonceur: corps.typeAnnonceur ?? 'autre',
        exposantId: corps.exposantId,
        format: corps.format ?? 'bandeau_horizontal',
        visuel: corps.visuel ?? '',
        alt: corps.alt ?? '',
        lien: corps.lien,
        pages: corps.pages ?? [],
        emplacement: corps.emplacement ?? 'principal',
        dateDebut: corps.dateDebut,
        dateFin: corps.dateFin,
        poids: corps.poids ?? 1,
        actif: corps.actif ?? true,
      };
      etat.push(nouvelle);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visibilite: nouvelle, csrfToken: CSRF_TOKEN_TEST }),
      });
      return;
    }

    if (methode === 'PUT' && id) {
      const index = etat.findIndex((v) => v.id === id);
      if (index === -1) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ erreur: 'Campagne introuvable.', csrfToken: CSRF_TOKEN_TEST }) });
        return;
      }
      const corps = requete.postDataJSON() as Partial<VisibiliteMock>;
      etat[index] = { ...etat[index], ...corps };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visibilite: etat[index], csrfToken: CSRF_TOKEN_TEST }),
      });
      return;
    }

    if (methode === 'DELETE' && id) {
      const index = etat.findIndex((v) => v.id === id);
      if (index === -1) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ erreur: 'Campagne introuvable.', csrfToken: CSRF_TOKEN_TEST }) });
        return;
      }
      etat.splice(index, 1);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ supprime: true, id, csrfToken: CSRF_TOKEN_TEST }) });
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ erreur: 'Méthode non autorisée.', csrfToken: CSRF_TOKEN_TEST }) });
  });

  return etat;
}
