# Admin LabEvents — Salon de l'Emploi & de la Formation 2026

> Espace interne réservé à LabEvents, distinct du site public. Voir CLAUDE.md,
> section 14, pour le cadrage général du chantier Admin (architecture à
> l'étude, décision du 08/08/2026) et l'échange d'architecture qui a précédé
> ce document pour le détail des arbitrages (source de données, lecture
> seule, distinction avec le dispositif de visibilité publicitaire, etc.).
>
> Ce document couvre le **Lot Admin-0 — socle technique et protection
> d'accès** (`/admin`, Basic Auth Apache). Les lots métier suivants
> (tableau de bord Admin-1, visibilité Admin-2/Admin-2B) sont documentés
> séparément — voir en particulier **docs/VISIBILITE.md section 15** pour
> `/admin-api`, un second point d'entrée protégé introduit par Admin-2B
> (CRUD Visibilité), avec sa propre protection Basic Auth explicite
> (`public/admin-api/.htaccess`) car `/admin-api` est un dossier frère de
> `/admin`, pas un sous-dossier — il n'hérite donc pas de la protection
> décrite ci-dessous en section 4.

---

## 1. Architecture retenue pour la V1

- **Même projet Astro, même dépôt Git, même build** que le site public.
- Le site public reste **entièrement statique** (`output: 'static'`,
  `astro.config.mjs`) — ce lot n'introduit aucun SSR, aucun backend, aucune
  base de données, aucun appel à l'API Google Sheets.
- L'Admin vit sous `/admin` (`src/pages/admin/`), avec son propre layout
  (`src/layouts/AdminLayout.astro`), volontairement distinct de
  `BaseLayout.astro` : pas de `Header`/`Footer` publics, pas de navigation
  vers le site vitrine.
- L'Admin est **strictement en lecture seule** dans cette architecture V1
  (aucune donnée candidat/CV n'y figurera jamais, conformément au périmètre
  validé).
- **Protection d'accès : authentification HTTP Basic côté serveur Apache**
  (`.htaccess` + `.htpasswd`), sur l'hébergement OVH mutualisé déjà utilisé
  pour le site public. C'est la **seule vraie barrière** — voir section 4.

## 2. Ce que fait ce lot (Admin-0)

- Une route `/admin` minimale (`src/pages/admin/index.astro`), qui ne
  contient aucune donnée sensible ni fonctionnalité métier — juste de quoi
  vérifier que le socle fonctionne.
- Le fichier `public/admin/.htaccess`, copié tel quel dans `dist/admin/`
  par le build Astro (tout le contenu de `public/` est recopié à
  l'identique dans `dist/`), donc déployé par le pipeline FTP existant
  sans aucune modification des workflows GitHub Actions.
- `/admin` exclu du sitemap (`astro.config.mjs`) et un `Disallow: /admin/`
  explicite dans `robots.txt`, **indépendamment** du réglage
  `PUBLIC_NOINDEX` (qui gère l'indexation du reste du site selon
  préprod/production).
- La page `/admin` porte elle-même une balise
  `<meta name="robots" content="noindex, nofollow">` forcée, quel que soit
  l'environnement.
- Aucun lien vers `/admin` nulle part sur le site public (vérifié par les
  tests E2E, voir section 6).

## 3. Ce que ce lot ne fait pas

Conformément au périmètre validé, aucun des éléments suivants n'est
développé ici : tableau de bord, liste/fiche exposants, liste/fiche
offres, module de visibilité publicitaire, galerie, ajout du champ
`formule` au schéma `exposants`, intégration Google Sheets, CRUD,
programme, candidatures. Ces sujets suivront dans des lots séparés, une
fois le socle sécurisé validé en conditions réelles (voir section 5).

## 4. Protection `.htaccess` / `.htpasswd`

### 4.1 Ce qui est commité

`public/admin/.htaccess` — ne contient **aucun secret**, uniquement les
directives Apache :

```apache
AuthType Basic
AuthName "Acces reserve LabEvents"
AuthUserFile /home/salonez/.htpasswd-salonemploi-preprod
Require valid-user
```

Chemin confirmé pour la **préproduction** (compte OVH `salonez`, racine du
site `/home/salonez/salon-emploi-preprod`). Ce chemin est propre à cet
environnement — à vérifier/adapter séparément le jour où la production
sera mise en place (voir 4.3 et 4.4).

### 4.2 Ce qui n'est JAMAIS commité

Le fichier `.htpasswd` réel (identifiants + hash des mots de passe) ne
doit **jamais** se trouver dans ce dépôt, dans un commit, dans une
Pull Request, ni dans aucune variable `PUBLIC_*`. Il est créé et modifié
**exclusivement sur l'hébergement OVH**, hors du cycle Git.

### 4.3 Où placer le `.htpasswd` — point d'attention important

Le déploiement FTP existant (`deploy-preprod.yml`, `deploy-production.yml`,
action `SamKirkland/FTP-Deploy-Action`) synchronise le contenu de `dist/`
vers `${FTP_REMOTE_DIR}` à chaque fusion sur `main`. Pour éviter tout
risque qu'un futur déploiement supprime ou écrase le `.htpasswd` (il ne
fait pas partie du build Astro, donc rien ne garantit le comportement de
l'outil de synchronisation vis-à-vis d'un fichier « en trop » sur le
serveur), **le `.htpasswd` doit être placé en dehors de l'arborescence
`${FTP_REMOTE_DIR}`**.

**Confirmé pour la préproduction** : racine du compte OVH
`/home/salonez`, racine du site préprod `/home/salonez/salon-emploi-preprod`
(= `${FTP_REMOTE_DIR}` pour cet environnement), `.htpasswd` déposé à
`/home/salonez/.htpasswd-salonemploi-preprod` — un niveau au-dessus de la
racine du site, donc bien en dehors de ce que le déploiement FTP
synchronise.

### 4.4 Actions manuelles réalisées côté OVH (préproduction)

Réalisées par Philippe, hors du dépôt :

1. ✅ Chemin absolu du compte confirmé : `/home/salonez`.
2. ✅ `.htpasswd` créé et transféré : `/home/salonez/.htpasswd-salonemploi-preprod`
   (54 octets, permissions 644).
3. ✅ `AuthUserFile` mis à jour dans `public/admin/.htaccess` avec ce chemin.
4. ⬜ **Reste à vérifier avant test réel** : HTTPS actif sur
   `https://preprod.salonemploinc.com/admin` — l'authentification HTTP
   Basic transmet les identifiants encodés (pas chiffrés) à chaque
   requête ; sans HTTPS ce serait une fuite en clair.

**Production** : ce chemin (`/home/salonez/...`) est propre à
l'environnement de préproduction. Le jour où la production sera mise en
place, vérifier si elle partage le même compte d'hébergement ou un compte
distinct avant de réutiliser un chemin identique ou non pour son propre
`.htpasswd`.

### 4.5 Changer un mot de passe

Modifier directement le fichier `.htpasswd` sur le serveur OVH (ajout,
suppression ou régénération d'une ligne utilisateur avec un nouveau hash).
Aucune action côté dépôt Git, aucun redéploiement nécessaire — le
changement est appliqué par Apache dès la modification du fichier sur le
serveur.

## 5. Procédure de test (préproduction uniquement)

Ce lot **ne touche pas la production**. Une fois déployé en préproduction
(fusion sur `main` → `deploy-preprod.yml` automatique) et le `.htpasswd`
mis en place côté OVH (section 4.4) :

1. `https://preprod.salonemploinc.com/admin` sans identifiants →
   le navigateur doit demander une authentification (boîte de dialogue
   HTTP Basic), ou la requête doit répondre `401`.
2. Identifiants incorrects → accès refusé.
3. Identifiants corrects → `/admin` s'affiche (page minimale de ce lot).
4. Le reste du site (`/`, `/exposants`, `/offres`, etc.) reste
   **totalement inchangé** et accessible sans authentification.

Ce test est **manuel**, car l'environnement Playwright (Lot 4B, `astro
preview`) ne fait pas tourner Apache — il ne peut donc pas vérifier une
protection `.htaccess` qui n'existe que sur le vrai hébergement. Les
tests automatisés de ce lot (section 6) vérifient uniquement ce qui est
vérifiable sans serveur Apache : construction de la page, balises
`noindex`, exclusion sitemap/robots, absence de lien public.

## 6. Tests automatisés ajoutés (suite Playwright, Lot 4B)

- `e2e/admin-acces.spec.ts` : `/admin` se charge (HTTP 200 en environnement
  de test, sans authentification puisqu'`astro preview` n'a pas de
  protection Apache), porte bien `noindex, nofollow`, et aucune des pages
  publiques principales ne contient de lien `href="/admin"`.
- `e2e/seo-sitemap-robots.spec.ts` : étendu pour vérifier que `/admin` est
  absent du sitemap et que `robots.txt` contient `Disallow: /admin/`.

Aucune simulation d'Apache/Basic Auth dans Playwright — non pertinent
(l'environnement de test ne reproduit pas le serveur réel), conformément
à la consigne de ne pas ajouter de test qui n'apporte rien.

## 7. Distinction préproduction / production

Identique au reste du site (voir `docs/deploiement-preproduction.md`) :
fusion sur `main` → préprod automatique ; passage en production
strictement manuel (`deploy-production.yml`, déclenchement depuis l'onglet
Actions). **La protection `.htaccess`/`.htpasswd` doit être mise en place
et validée séparément sur chaque environnement** (deux hébergements/
répertoires distincts, `FTP_REMOTE_DIR` différent pour préprod et
production) — valider d'abord en préproduction avant d'envisager la
production.

## 8. Limitations connues de cette V1

- Authentification HTTP Basic : un seul niveau d'identifiants partagés
  possible par entrée `.htpasswd`, pas de session applicative, pas de
  distinction fine de droits par utilisateur au-delà de plusieurs entrées
  dans le même fichier. Suffisant pour un accès interne restreint à
  quelques personnes LabEvents, pas conçu pour un usage plus large.
- Le `.htaccess` protège l'accès aux **fichiers déployés** ; il ne protège
  pas le code source du dépôt (déjà privé par ailleurs) ni les données
  avant leur import dans les Content Collections.
- Le `noindex`/`robots.txt` ne sont **pas** des mesures de sécurité — ce
  sont des conventions pour les robots respectueux (moteurs de recherche
  légitimes). La seule vraie barrière est l'authentification serveur
  décrite en section 4.
