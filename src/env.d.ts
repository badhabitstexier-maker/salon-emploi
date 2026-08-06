/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_WEB3FORMS_ACCESS_KEY: string;
  /** URL absolue du site pour l'environnement courant (ex. https://preprod.salonemploic.com). */
  readonly PUBLIC_SITE_URL: string;
  /** "true" pour empêcher l'indexation (préproduction) ; absent ou "false" en production. */
  readonly PUBLIC_NOINDEX: string;
  /**
   * URL du formulaire Tally de candidature (ex. https://tally.so/r/XXXXXXXX).
   * Non secrète mais absente par défaut : /candidater affiche un état
   * d'attente propre tant qu'elle n'est pas configurée (voir docs/CANDIDATURES_TALLY.md).
   */
  readonly PUBLIC_TALLY_CANDIDATURE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
