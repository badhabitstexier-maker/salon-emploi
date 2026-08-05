import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';

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
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    /*
      Sitemap désactivé quand PUBLIC_NOINDEX=true : plus simple et plus sûr
      que de le laisser généré-mais-non-indexé (voir docs/deploiement-preproduction.md).
    */
    ...(noindex ? [] : [sitemap()]),
    robotsTxt({
      sitemap: !noindex,
      policy: noindex
        ? [{ userAgent: '*', disallow: '/' }]
        : [{ userAgent: '*', allow: '/' }],
    }),
  ],
});
