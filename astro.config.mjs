import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';

/*
  Offres fictives de démonstration (intitulé commençant par `TEST —`, voir
  docs/OFFRES.md et src/lib/offres.ts::estOffreTest) : exclues du sitemap
  pour ne jamais être proposées à l'indexation comme de vraies offres
  d'emploi. Lu directement sur le disque (frontmatter des fichiers Markdown)
  car astro.config.mjs s'exécute hors du pipeline Astro : `astro:content`
  n'y est pas disponible.
*/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dossierOffres = path.join(__dirname, 'src/content/offres');
let slugsOffresTest = [];
try {
  slugsOffresTest = readdirSync(dossierOffres)
    .filter((fichier) => fichier.endsWith('.md'))
    .filter((fichier) => {
      const contenu = readFileSync(path.join(dossierOffres, fichier), 'utf8');
      const m = /^intitule:\s*"(.*)"\s*$/m.exec(contenu);
      return m ? m[1].startsWith('TEST —') : false;
    })
    .map((fichier) => fichier.replace(/\.md$/, ''));
} catch {
  // Dossier absent ou vide (collection non encore alimentée) : rien à exclure.
}

/*
  Fiches exposants de démonstration (`demo: true`, voir src/content.config.ts
  et docs/EXPOSANTS.md) : exclues du sitemap pour ne jamais présenter ces
  entreprises fictives à Google comme de vrais exposants. La distinction
  TEST/RÉEL est portée par le champ `demo` du modèle de données, pas par une
  liste de slugs codée en dur — ce bloc ne fait que lire ce champ sur
  disque, au même titre que slugsOffresTest ci-dessus.
*/
const dossierExposants = path.join(__dirname, 'src/content/exposants');
let slugsExposantsDemo = [];
try {
  slugsExposantsDemo = readdirSync(dossierExposants)
    .filter((fichier) => fichier.endsWith('.md'))
    .filter((fichier) => /^demo:\s*true\s*$/m.test(readFileSync(path.join(dossierExposants, fichier), 'utf8')))
    .map((fichier) => {
      // Le champ `slug` en frontmatter force l'adresse de la fiche (voir
      // src/lib/exposants.ts::exposantSlug) — sinon c'est le nom de fichier.
      const contenu = readFileSync(path.join(dossierExposants, fichier), 'utf8');
      const slugForce = /^slug:\s*"?([^"\n]+?)"?\s*$/m.exec(contenu);
      return slugForce ? slugForce[1] : fichier.replace(/\.md$/, '');
    });
} catch {
  // Dossier absent ou vide (collection non encore alimentée) : rien à exclure.
}

/*
  `astro.config.mjs` s'exécute avant que Vite ne charge `.env` : il faut donc
  lire les variables manuellement ici (cf. doc Astro sur les variables
  d'environnement dans le fichier de config). Préfixe vide = on charge toutes
  les variables, pas seulement celles préfixées `VITE_`.
*/
const { PUBLIC_SITE_URL, PUBLIC_NOINDEX } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

// Aucun domaine en dur : hors variable définie, seul un repli local est prévu.
const site = PUBLIC_SITE_URL || 'http://localhost:4321';
const noindex = PUBLIC_NOINDEX === 'true';

export default defineConfig({
  site,
  output: 'static',
  // /village (Village Maintenance & Industrie) retiré du salon en août 2026 :
  // redirection plutôt que 404 pour d'éventuels liens déjà partagés/indexés.
  redirects: {
    '/village': '/le-salon',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    /*
      Sitemap désactivé quand PUBLIC_NOINDEX=true : plus simple et plus sûr
      que de le laisser généré-mais-non-indexé (voir docs/deploiement-preproduction.md).
      `filter` exclut en plus les fiches offres TEST (voir slugsOffresTest
      ci-dessus), même quand le sitemap est actif.
    */
    ...(noindex
      ? []
      : [
          sitemap({
            /*
              Exclusions du sitemap :
              - fiches offres TEST (slugsOffresTest ci-dessus) ;
              - fiches exposants de démonstration (slugsExposantsDemo ci-dessus) ;
              - /admin (jamais indexé, voir robotsTxt ci-dessous) ;
              - /merci (page de confirmation post-formulaire, marquée noindex
                dans src/pages/merci.astro : aucune valeur en indexation).
            */
            filter: (page) =>
              !slugsOffresTest.some((slug) => page.includes(`/offres/${slug}`)) &&
              !slugsExposantsDemo.some((slug) => page.includes(`/exposants/${slug}`)) &&
              !page.includes('/admin') &&
              !page.includes('/merci'),
          }),
        ]),
    robotsTxt({
      sitemap: !noindex,
      /*
        /admin (Lot Admin-0, voir docs/ADMIN.md) : jamais indexé, quel que
        soit l'environnement — la vraie protection reste l'authentification
        serveur .htaccess (public/admin/.htaccess), pas cette directive.
      */
      policy: noindex
        ? [{ userAgent: '*', disallow: '/' }]
        : [{ userAgent: '*', allow: '/', disallow: '/admin/' }],
    }),
  ],
});
