import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';

export default defineConfig({
  site: 'https://www.salonemploi.nc',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap(), robotsTxt()],
});
