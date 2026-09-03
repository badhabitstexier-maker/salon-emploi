# Sécurité — audit du 3 septembre 2026 et état des constats

> État des lieux de la sécurité du site, écrit pour qu'une session ultérieure sache ce qui a été
> examiné, ce qui a été corrigé, et surtout **ce qui reste ouvert et pourquoi**. Voir aussi
> CLAUDE.md (sections 9, 12, 13, 16) et `docs/VISIBILITE.md` (architecture du seul backend du site).
>
> Ce document n'est pas un journal : il décrit l'état réel. Git conserve l'historique des lots.

---

## 1. Périmètre réellement audité

Le site est statique (Astro, sortie `static`). La surface exécutée côté serveur se limite à
**trois fichiers PHP** et **trois `.htaccess`**, tous liés au module Visibilité :

| Fichier | Rôle |
|---|---|
| `public/api/visibilites.php` | lecture publique, **sans authentification** (voulu) |
| `public/admin-api/visibilites.php` | CRUD, Basic Auth + CSRF |
| `public/api/_visibilites-lib.php` | lecture/écriture JSON, verrou fichier, validation |
| `public/.htaccess` | redirection 301 `www` → apex |
| `public/admin/.htaccess`, `public/admin-api/.htaccess` | Basic Auth, dossiers **frères** (pas d'héritage) |

S'y ajoutent les 4 workflows GitHub Actions (secrets FTP, injection de configuration) et la chaîne
d'import des contenus, qui ingère des données **fournies par des tiers** (formulaire exposants).

L'audit a comporté deux passes : revue de code (session Claude Code) et vérification externe boîte
noire sur la production (commandes `curl` exécutées par Philippe).

---

## 2. Constats corrigés

| # | Constat | Gravité | Correctif |
|---|---|---|---|
| 2 | `set:html={JSON.stringify(...)}` dans les blocs `<script>` : `JSON.stringify` n'échappe pas `<`, une donnée contenant `</script>` refermait la balise et le reste devenait du DOM exécuté. **8 points d'injection, 23 pages** affectées par une seule offre, dont `/admin/offres`. Vecteur d'entrée : le formulaire rempli par les exposants. | Élevé | PR #59 — helper `jsonInline()` (`src/lib/json-inline.ts`) |
| 1 | `lien`, `visuel`, `visuelMobile` d'une campagne Visibilité n'étaient validés que sur leur non-vacuité. Un `lien: "javascript:…"` s'exécutait dans l'origine du site pour tout visiteur cliquant le bandeau. | Élevé | PR #60 — `estUrlVisibiliteSure()`, en PHP **et** côté client |
| 4 | Actions GitHub référencées par tag mutable, alors que `deploy-production.yml` leur passe les identifiants FTP de production. | Moyen | PR #61 — 12 références épinglées par SHA |
| 5 | Doute sur `$_SERVER['HTTPS']` derrière la terminaison TLS d'OVH (aurait rendu l'Admin inutilisable en écriture). | Faible | Écarté par recette : le CRUD Visibilité fonctionne en ligne. |

### Deux principes issus de ces correctifs, à ne pas défaire

1. **Jamais `JSON.stringify()` dans un `set:html`** — toujours `jsonInline()`. Un garde-fou de
   source dans `scripts/json-inline.test.mjs` refuse toute réintroduction du motif : il est là
   parce que les données actuelles ne contiennent aucun `<`, donc un test de sortie seul ne
   détecterait pas la régression.
2. **La validation d'URL est appliquée deux fois, et ce n'est pas redondant** — à l'écriture (PHP)
   et à la lecture (client). La validation d'écriture ne rejoue **jamais** les enregistrements déjà
   présents dans `visibilites.json` : une campagne saisie avant le correctif serait servie telle
   quelle par l'API publique. Retirer le contrôle client rouvrirait la faille pour ces données-là.

---

## 3. Constats ouverts

### n°3 — Aucun en-tête de sécurité HTTP · **moyen, seul chantier restant**

Vérifié dans le dépôt (aucune directive) **et** sur la production (`curl -sI` ne renvoie aucune de
ces lignes) : ni `Content-Security-Policy`, ni `X-Frame-Options`, ni `Referrer-Policy`, ni
`Strict-Transport-Security`, ni `Permissions-Policy`. OVH n'en ajoute aucun.

Conséquences : le site est encadrable en iframe (clickjacking sur les formulaires `/exposer`), et
rien ne limiterait l'impact d'une future faille d'injection.

**Ce chantier n'est pas un ajout de trois lignes.** Un CSP mal calibré casse le site en production :
il doit couvrir Web3Forms (`api.web3forms.com`), l'iframe Tally sur `/candidater`, les polices
auto-hébergées et les scripts Astro. Démarche recommandée, en deux temps :

1. les en-têtes sans risque (`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, HSTS)
   dans `public/.htaccess`, via `<IfModule mod_headers.c>` ;
2. le CSP seul, d'abord en `Content-Security-Policy-Report-Only`, pour observer sans rien casser,
   et recette en préproduction avant tout passage en production.

### n°6 — Un visuel de campagne peut pointer vers un domaine tiers · faible

La whitelist du constat n°1 contrôle le **schéma**, pas le **domaine** : `https://exemple-tiers.tld/x.png`
reste accepté en `visuel`. Chaque visiteur affichant ce bandeau révèle alors son IP à ce tiers.
Périmètre volontairement exclu du lot #60, pas un oubli. Correctif possible si besoin : restreindre
`visuel`/`visuelMobile` aux chemins internes (`/...`), ce qui est déjà la pratique réelle
(procédure de dépôt d'un visuel, `docs/VISIBILITE.md`).

### n°7 — Clé Web3Forms exposée côté client · faible, inhérent au fournisseur

`PUBLIC_WEB3FORMS_ACCESS_KEY` est nécessairement dans le bundle : c'est le fonctionnement de
Web3Forms. Seule barrière anti-spam : le honeypot `botcheck` sur les deux formulaires de
`/exposer`. À connaître, rien à corriger dans le dépôt.

### n°8 — `nanoid < 3.3.18` (GHSA-2v37-7h3g-55p8) · faible

Dépendance **transitive de build uniquement** (`@tailwindcss/vite` → `vite` → `postcss` → `nanoid`).
Aucun code du projet n'appelle nanoid, elle n'atteint jamais le bundle client. Risque réel
négligeable ; `npm audit fix` quand l'occasion se présente.

---

## 4. Ce qui a été vérifié sain — ne pas re-auditer sans raison

**Code** : whitelist stricte des champs publics de l'API Visibilité (`nomInterne`, `typeAnnonceur`,
`exposantId` ne peuvent pas fuiter) · CSRF par jeton de session comparé avec `hash_equals`, cookie
`Secure` + `HttpOnly` + `SameSite=Strict` · identifiants générés serveur (`random_bytes`), jamais
fournis par le client, `?id=` filtré par regex stricte · aucun chemin fourni par l'utilisateur ne
touche le système de fichiers (pas de traversée de chemin) · écriture atomique sous `flock` avec
sauvegarde `.bak` · fail-safe de l'API publique (liste vide en 200) · échappement des attributs HTML
par Astro (`"` → `&quot;`, testé) · aucun secret dans l'historique Git.

**Dispositif GitHub, mis en place le 3 septembre 2026** : alertes Dependabot activées (elles ont
immédiatement remonté le constat n°8), alertes malware, mises à jour de sécurité et regroupement des
mises à jour activés. Protection de branche sur `main` : **`build-check` ET `qa-e2e` sont tous deux
requis** — l'action manuelle longtemps en attente (CLAUDE.md section 9) a été faite ; force-push et
suppression de `main` interdits. Le dépôt est **public** : aucune obscurité ne protège le code, ce
qui est tenable ici puisque aucun secret n'y est commité (vérifié), mais impose que
l'authentification et la validation serveur restent les seuls remparts — les affaiblir n'est jamais
compensé par la discrétion.

**Production, vérifié le 3 septembre 2026 par `curl`** :

| Contrôle | Résultat |
|---|---|
| `GET /admin/` | **401** |
| `GET /admin-api/visibilites.php` | **401** (dossier frère : protection bien répétée) |
| `GET /visibilites.json` | **404** (données hors webroot) |
| `GET /api/_visibilites-lib.php` | **403** (accès direct refusé) |
| `GET /api/visibilites.php` sans paramètre | `{"visibilites":[]}` (ne renvoie jamais tout par défaut) |
| `https://www.salonemploi.nc/offres` | **301 → `https://salonemploi.nc/offres`** |

⚠️ La sortie de l'API publique était `{"visibilites":[]}` **parce qu'aucune campagne n'est saisie en
production** — cela ne prouve pas la whitelist, qui n'a rien eu à filtrer. Elle est attestée par le
code et par `npm run visibilites:api-test`. À revérifier à la première campagne réelle.

---

## 5. Comment refaire ces contrôles

Vérification externe (lecture seule, sans risque, **vise la production**) :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://salonemploi.nc/admin/                 # attendu 401
curl -s -o /dev/null -w "%{http_code}\n" https://salonemploi.nc/admin-api/visibilites.php  # attendu 401
curl -s -o /dev/null -w "%{http_code}\n" https://salonemploi.nc/visibilites.json       # attendu 404
curl -s "https://salonemploi.nc/api/visibilites.php"                                   # attendu {"visibilites":[]}
curl -sI https://salonemploi.nc/ | grep -iE "content-security|x-frame|referrer-policy" # constat n°3
```

Tests automatisés couvrant ces règles : `npm run content:test` (dont `json-inline:test` et
`visibilites:test`), `npm run visibilites:api-test` (nécessite `php`), `npm run qa` (E2E, dont les
scénarios de sûreté des URL du module Visibilité).

Relever le SHA d'une action GitHub avant de la mettre à jour — jamais recopier une valeur vue
ailleurs :

```bash
gh api repos/<depot>/commits/<tag> -q .sha
```
