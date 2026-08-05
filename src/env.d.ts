/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_WEB3FORMS_ACCESS_KEY: string;
  /** URL absolue du site pour l'environnement courant (ex. https://preprod.salonemploic.com). */
  readonly PUBLIC_SITE_URL: string;
  /** "true" pour empêcher l'indexation (préproduction) ; absent ou "false" en production. */
  readonly PUBLIC_NOINDEX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
