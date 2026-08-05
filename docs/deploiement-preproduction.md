# Déploiement en préproduction

Ce document explique comment builder et transférer le site vers
l'environnement temporaire de préproduction. Le site sera republié plus tard
sur son domaine définitif : rien de spécifique à la préproduction n'est codé
en dur dans le projet, tout passe par des variables d'environnement.

## 1. Adresse de préproduction

```
https://preprod.salonemploic.com
```

## 2. Variables à définir localement

Copier `.env.example` vers `.env` (jamais commité — voir `.gitignore`) et
renseigner :

```
PUBLIC_SITE_URL=https://preprod.salonemploic.com
PUBLIC_NOINDEX=true
PUBLIC_WEB3FORMS_ACCESS_KEY=<clé réelle, fournie séparément>
```

- `PUBLIC_SITE_URL` pilote la propriété `site` d'Astro, les URL canoniques,
  les métadonnées Open Graph, le sitemap et les redirections des formulaires
  Web3Forms (voir `astro.config.mjs` et `src/pages/exposer.astro`).
- `PUBLIC_NOINDEX=true` ajoute une balise `<meta name="robots" content="noindex, nofollow">`
  sur toutes les pages, bascule `robots.txt` sur `Disallow: /` et désactive
  la génération du sitemap (inutile sur un site non indexable). Le site reste
  entièrement fonctionnel pour un visiteur qui a le lien direct.
- En production, `PUBLIC_SITE_URL` sera positionnée sur le domaine définitif
  et `PUBLIC_NOINDEX` sera omise (ou mise à `false`) pour retrouver le
  comportement normal : sitemap actif, robots.txt ouvert, pas de balise
  noindex.
- Sans `PUBLIC_SITE_URL` définie, le site se replie sur `http://localhost:4321`
  (développement local uniquement — ne jamais builder une préproduction ou une
  production sans avoir positionné la variable).

## 3. Commande de build

```
npm install
npm run build
```

Le build est statique (`output: 'static'`) : aucun serveur Node n'est requis
en ligne.

## 4. Dossier à transférer

Seul le contenu du dossier `dist/` généré par le build doit être transféré,
et uniquement son contenu (pas le dossier `dist/` lui-même) :

```
dist/*  →  salon-emploi-preprod/
```

sur l'hébergement OVH, dans le dossier `salon-emploi-preprod`.

Ne jamais transférer `node_modules/`, `.env`, ni le reste du dépôt.

## 5. Contrôles avant transfert

Après le build, vérifier dans `dist/` :

- `dist/index.html` (et les autres pages) : les URL canoniques et Open Graph
  utilisent bien `https://preprod.salonemploic.com`, et contiennent
  `<meta name="robots" content="noindex, nofollow">` ;
- `dist/robots.txt` : contient `User-agent: *` / `Disallow: /` et aucune ligne
  `Sitemap:` ;
- `dist/sitemap-index.xml` : absent (désactivé tant que `PUBLIC_NOINDEX=true`) ;
- aucune URL du domaine définitif nulle part dans `dist/`.

## 6. Bascule vers la production définitive

Le jour de la mise en ligne définitive, il suffira de rebuilder avec :

```
PUBLIC_SITE_URL=<domaine définitif>
PUBLIC_NOINDEX=false
```

(ou la variable simplement absente) — aucune modification de code n'est
nécessaire.
