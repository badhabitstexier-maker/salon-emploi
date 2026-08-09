# Visibilité publicitaire — Lot Admin-2 / Admin-2B

> Documentation du module de visibilité publicitaire (bandeaux). Écrite pour qu'une personne qui ne
> lit pas le code puisse comprendre comment programmer une campagne et ce que le site fait avec.
> Voir aussi CLAUDE.md (section 14, chantier Admin) et docs/ADMIN.md (socle technique de `/admin`).
>
> **Mise à jour Admin-2B** : les sections 1, 2, 6 à 9 et 12 (principes métier, rotation, dates,
> absence de tracking) restent inchangées — Admin-2B ne touche à aucune règle de sélection
> publicitaire. Les sections 3, 4, 10, 11 et 13 ont en revanche changé en profondeur : la source des
> données n'est plus une Content Collection Astro éditée à la main, mais un CRUD complet piloté
> depuis `/admin/visibilite`, avec une API PHP dédiée. Voir la section 15 pour l'architecture
> technique complète de ce lot.

---

## 1. Objectif et principe métier

Ce module permet à **LabEvents** de diffuser des bandeaux publicitaires (sponsors, partenaires,
institutions, exposants mis en avant, annonceurs extérieurs…) sur quelques pages du site public,
sans back-office et sans base de données — le site reste statique (Astro, `output: 'static'`).

**Principe fondamental — à ne jamais casser dans une évolution future** : la *visibilité
publicitaire* est totalement indépendante des *droits de fiche exposant* (la formule commerciale
standard/silver/gold, qui détermine certains contenus contractuels de la fiche exposant — voir
`src/content.config.ts`, collection `exposants`).

Concrètement :

- Le moteur de sélection ne lit **jamais** `exposant.data.formule`. La collection `visibilites`
  (voir section 3) ne porte même pas de champ `formule` — uniquement un `exposantId` optionnel qui
  sert à retrouver l'exposant pour l'affichage Admin, rien de plus.
- Le **poids de diffusion** (`poids`) est saisi à la main par LabEvents, campagne par campagne. Il
  n'est **jamais** dérivé d'une formule commerciale, et rien n'empêche techniquement de diffuser un
  exposant Standard, un exposant Silver, un exposant Gold, un sponsor, une institution ou un
  annonceur extérieur sans aucune fiche exposant — tous sont traités à égalité par le moteur.
- Les engagements commerciaux Silver/Gold (visibilité promise dans l'offre commerciale) sont un
  sujet de **pilotage LabEvents** : c'est à LabEvents de créer les entrées `visibilites`
  correspondantes. Le site ne vérifie pas la conformité entre l'engagement commercial et la
  programmation réelle (ce n'est pas demandé dans ce lot).

## 2. Distinction avec `mise_en_avant`

`mise_en_avant` (champ des collections `exposants` et `programme`) est une **décision éditoriale**
de mise en avant sur les pages `/exposants` et `/programme` (tri, badge). C'est un concept
totalement indépendant de la visibilité publicitaire :

- Une visibilité publicitaire ne modifie jamais `mise_en_avant`.
- `mise_en_avant` n'est jamais utilisé pour décider d'une visibilité publicitaire.

## 3. Source des données

**Depuis Admin-2B**, la source de vérité n'est plus une Content Collection Astro mais un fichier
JSON hébergé sur le serveur de préproduction, hors dépôt Git et hors webroot :

```
/home/salonez/salon-emploi-data-preprod/visibilites.json
```

Ce fichier est géré exclusivement par une API PHP dédiée (`public/admin-api/visibilites.php` pour
le CRUD protégé, `public/api/visibilites.php` pour la lecture publique), jamais édité à la main.
Voir la **section 15** pour l'architecture technique complète (chemins, sécurité, sauvegarde,
procédure de création/modification, migration préprod → production).

**`/admin/visibilite` permet désormais un CRUD complet** (créer, modifier, activer/désactiver,
supprimer, consulter) — ce n'est plus une page en lecture seule (voir section 10).

> Historique (Lot Admin-2, jusqu'au 08/08/2026) : les campagnes vivaient dans une Content Collection
> Astro (`src/content.config.ts`, collection `visibilites`), alimentée par des fichiers Markdown
> dans `src/content/visibilites/`, édités à la main. Cette approche a été remplacée par Admin-2B car
> elle imposait un commit + déploiement pour chaque campagne — voir CLAUDE.md section 14 pour
> l'arbitrage. La collection Astro `visibilites` n'existe plus dans `src/content.config.ts`.

## 4. Champs d'une visibilité

| Champ | Type | Obligatoire | Rôle |
|---|---|---|---|
| `nomInterne` | texte | oui | Nom repère pour LabEvents (jamais affiché publiquement). |
| `annonceur` | texte | oui | Nom affiché (attribut `data-annonceur` côté client, pas de texte visible sur le bandeau — voir section 6). |
| `typeAnnonceur` | `exposant \| sponsor \| partenaire \| institution \| annonceur_externe \| autre` | oui | Catégorie, pour le tri/filtre Admin uniquement. |
| `exposantId` | texte (`EXP26-XXX`) | non | Si l'annonceur est aussi exposant, permet un lien vers sa fiche Admin. Jamais utilisé pour l'éligibilité ni le poids. |
| `format` | `bandeau_horizontal` | oui | Un seul format en V1 (voir section 5). |
| `visuel` | chemin `public/` | oui | Image du bandeau. |
| `alt` | texte | oui | Texte alternatif — obligatoire et pertinent (accessibilité). |
| `lien` | URL | non | Si absent, le bandeau n'est pas cliquable. |
| `pages` | liste parmi `accueil, offres, exposants, programme` | oui (≥ 1) | Pages où la campagne peut apparaître. |
| `emplacement` | `principal` (seule valeur possible en V1) | non (défaut `principal`) | Zone dans la page — un seul emplacement par page en V1. |
| `dateDebut` | date | non | Voir section 7. |
| `dateFin` | date | non | Voir section 7. |
| `poids` | entier positif | non (défaut `1`) | Poids de diffusion — voir section 6. |
| `actif` | booléen | non (défaut `true`) | Coupe-circuit manuel, indépendant des dates. |

Le statut affiché dans l'Admin (Actif / À venir / Expiré / Désactivé) est **calculé**, jamais
stocké — voir `statutVisibilite()` dans `src/lib/visibilites.ts`.

### Exemple minimal

Illustration de la forme d'un enregistrement dans `visibilites.json` (voir section 15) — en
pratique, ces champs se renseignent via le formulaire `/admin/visibilite/formulaire`, jamais en
éditant ce fichier à la main :

```json
{
  "id": "vis-3f2a1c9d0e7b",
  "nomInterne": "Sponsor principal 2026",
  "annonceur": "Nom du sponsor",
  "typeAnnonceur": "sponsor",
  "format": "bandeau_horizontal",
  "visuel": "/visibilites/sponsor-principal.png",
  "alt": "Bandeau du sponsor principal du salon",
  "lien": "https://exemple.nc",
  "pages": ["accueil", "offres"],
  "emplacement": "principal",
  "poids": 3,
  "actif": true
}
```

## 5. Format — V1

Un seul format : le **bandeau horizontal**. Il affiche un visuel, un texte alternatif obligatoire,
un lien optionnel et porte le nom interne de l'annonceur (à usage Admin). Volontairement pas de
second format (carte partenaire, bandeau de logos…) en V1 — l'audit d'intégration n'a pas montré de
besoin distinct à ce stade ; voir section 11 pour une piste Admin-2B.

Volontairement **pas de carrousel automatique** : la sélection se fait une fois au chargement de la
page et reste fixe pendant la consultation (voir section 6).

## 6. Pages et emplacements intégrés

Un seul emplacement par page (`principal`), sur 4 pages, choisies après audit du site existant pour
ne jamais interférer avec un formulaire, la navigation ou la lecture d'une fiche :

- **Accueil** (`/`) — juste après le hero (bloc d'ouverture plein écran), avant toute autre section
  de contenu et bien avant « Le salon en chiffres ».
- **Catalogue des offres** (`/offres`) — juste avant le bloc de fin de page.
- **Catalogue des exposants** (`/exposants`) — juste avant le bloc de fin de page.
- **Programme** (`/programme`) — juste avant le bloc de fin de page.

Volontairement exclus : les fiches détail (offre, exposant — priorité à la conversion/candidature),
`/exposer` (formulaire de contact commercial) et `/preparer-ma-visite` (pas d'intégration naturelle
identifiée).

L'intégration passe par un unique composant, `<VisibilitySlot page="..." emplacement="..." />`
(`src/components/VisibilitySlot.astro`) : aucune règle publicitaire n'est écrite en dur dans une
page, tout passe par ce composant et le moteur centralisé de `src/lib/visibilites.ts`.

## 7. Programmation par dates

Une visibilité peut être :

- **Permanente** — ni `dateDebut` ni `dateFin`.
- **À partir d'une date** — `dateDebut` seul.
- **Jusqu'à une date** — `dateFin` seul.
- **Entre deux dates** — les deux.

Logique déterministe, sans aucun appel réseau ni service externe (`estDansPeriode()`,
`src/lib/visibilites.ts`).

**Évaluée en temps réel, sans rebuild.** Même si le site est statique, la fenêtre de dates d'une
campagne bascule à l'heure exacte, sans attendre un nouveau build/déploiement :

- Au **build**, le site envoie au navigateur toute campagne active et scopée sur la page/l'emplacement
  consultés, **quelles que soient ses dates** (`visibilitesEnvoyables()`).
- Au **chargement de chaque page**, le navigateur du visiteur réévalue lui-même la fenêtre de dates
  avec l'heure réelle du moment (`estDansPeriodeResume()`, appelée par
  `src/lib/visibilite-ui.ts::initAllVisibilitySlots()`), puis effectue le tirage pondéré (section 8)
  uniquement parmi les campagnes actuellement dans leur fenêtre.

Résultat : une campagne programmée pour démarrer à 9h ou s'arrêter à 18h le fait à l'heure dite pour
tout visiteur qui charge (ou recharge) une page après cette heure — aucun déploiement à déclencher.
Seul le levier manuel `actif` (section 4) nécessite une édition de fichier suivie d'un build/déploiement
pour prendre effet : il n'est pas une date, donc pas réévalué en continu.

## 8. Rotation et sélection

- Le **poids** (`poids`, entier positif) exprime une intensité de diffusion relative entre
  campagnes éligibles simultanément sur un même (page, emplacement). Un poids 6 a environ 6 fois
  plus de chances d'être tiré qu'un poids 1 — c'est une valeur libre, sans rapport avec une formule
  commerciale.
- Le tirage est **pondéré et aléatoire**, mais effectué **une seule fois par chargement de page**,
  côté navigateur (`src/lib/visibilite-ui.ts`, fonction `initAllVisibilitySlots()`) — jamais de
  minuteur, jamais de second tirage pendant la consultation d'une page. C'est ce mécanisme qui donne
  l'effet de « rotation » perçu par LabEvents : chaque nouvelle visite (et chaque nouveau chargement
  de page) peut tirer un annonceur différent parmi les éligibles du moment, sans jamais changer sous
  les yeux d'un même visiteur.
- Une campagne est éligible au tirage si elle est **active**, couvre la page/l'emplacement consultés
  (filtré au build, voir section 7) et se trouve, **au moment du chargement**, dans sa fenêtre de
  dates (filtré côté client, voir section 7).
- **Une seule campagne éligible** → elle s'affiche systématiquement (pas de tirage à faire).
- **Aucune campagne éligible** (y compris quand une campagne est envoyée par le build mais hors de sa
  fenêtre de dates au moment du chargement) → rien ne s'affiche et **aucun espace vide** n'est
  laissé : la section entière reste masquée (`hidden`) tant qu'aucun tirage n'a abouti — pas
  seulement le visuel.

Le payload JSON envoyé au navigateur pour chaque emplacement (`VisibiliteResume`, voir
`src/lib/visibilites.ts`) est volontairement réduit au strict nécessaire à l'affichage et au tirage :
`id`, `annonceur`, `visuel`, `alt`, `lien`, `poids`, `dateDebut`/`dateFin`. Les champs réservés à
l'usage interne LabEvents (`nomInterne`, `typeAnnonceur`, `exposantId`) ne sont **jamais** envoyés au
public.

La logique pure (fenêtre de dates, éligibilité, tirage pondéré) est testée par
`scripts/visibilites-lib.test.mjs` (`npm run visibilites:test`), indépendamment de tout rendu HTML.

## 9. Priorité

Pas de champ `priorite` en V1 : après audit, il n'apportait rien de plus que `poids` pour le volume
de campagnes attendu, et aurait introduit un second concept de pondération à comprendre pour
LabEvents. Si un jour deux niveaux distincts sont nécessaires (ex. un groupe de campagnes toujours
prioritaire, poids pour départager à l'intérieur du groupe), ce sera une évolution de schéma
explicite, pas une extension silencieuse.

## 10. `/admin/visibilite`

**Depuis Admin-2B, CRUD complet** (`src/pages/admin/visibilite/index.astro` pour la liste et les
actions, `src/pages/admin/visibilite/formulaire.astro` pour la création/modification), accessible
depuis la navigation Admin (« Visibilité »). Toujours pas d'upload d'image (voir section 15.5).

La liste n'est plus rendue au build : elle est entièrement construite côté client, au chargement de
la page, à partir de `GET /admin-api/visibilites.php` (voir section 15). Affiche, pour chaque
campagne : aperçu du visuel, annonceur (+ nom interne), type, format, pages/emplacement, période,
poids, statut calculé, et trois actions (**Modifier**, **Activer/Désactiver**, **Supprimer** — avec
confirmation). Un lien vers la fiche Admin de l'exposant apparaît quand `exposantId` est renseigné et
correspond à un exposant connu (l'exposant, lui, reste résolu au build : la collection `exposants`
n'est pas concernée par Admin-2B).

Filtres disponibles : statut, type d'annonceur, page — appliqués côté client sur les données reçues.

Le tableau de bord (`/admin/dashboard`) affiche un résumé léger (nombre de campagnes actives et, si
non nul, nombre à venir), lui aussi désormais calculé côté client via un appel à
`/admin-api/visibilites.php` au chargement — il n'y a plus de données à lire au build.

**Statut recalculé à chaque chargement, jamais figé.** Le statut (Actif / À venir / Expiré /
Désactivé) est calculé côté navigateur via `calculerStatut()` (`src/lib/visibilites.ts`) —
exactement la même fonction que celle qui régit la fenêtre de dates réévaluée côté public (section
7). Recharger `/admin/visibilite` après qu'une campagne a démarré ou expiré suffit à voir le bon
statut, sans redéploiement.

**Panne de l'API Admin** : la page affiche un message d'erreur explicite avec un bouton
« Réessayer » plutôt qu'une page vide ou un plantage silencieux — voir `e2e/visibilite.spec.ts`.
Contrairement au site public (section 15.4), une erreur visible est ici appropriée : c'est un outil
interne authentifié, pas une page consultée par un visiteur.

`/admin/visibilite` hérite du `noindex, nofollow` et de l'exclusion sitemap/robots.txt de tout
l'espace `/admin` (voir docs/ADMIN.md) — rien de spécifique à ajouter ici.

## 11. Procédure pour ajouter ou modifier une campagne

**Depuis Admin-2B**, tout se fait depuis `/admin/visibilite`, sans commit ni déploiement :

1. Préparer le visuel (voir recommandations ci-dessous) et le déposer sur le serveur (voir
   section 15.5 — pas d'upload depuis l'Admin dans cette version).
2. Sur `/admin/visibilite`, cliquer sur **+ Nouvelle visibilité** (ou **Modifier** sur une campagne
   existante) et renseigner les champs de la section 4.
3. **Enregistrer** — la campagne est immédiatement écrite dans `visibilites.json` sur le serveur et
   visible sur le site public au prochain chargement de page, sans build ni déploiement (voir
   section 15.4).
4. Vérifier sur `/admin/visibilite` que la campagne apparaît avec le bon statut, la bonne période et
   le bon poids.
5. Vérifier visuellement sur la ou les pages concernées.
6. Pour retirer une campagne sans la supprimer (garder une trace) : bouton **Désactiver**. Pour la
   retirer définitivement : bouton **Supprimer** (confirmation demandée, irréversible).

**Recommandation visuelle** : bandeau large, ratio approximatif 6:1 à 8:1 (le conteneur public
utilise `aspect-[6/1]` en mobile, `aspect-[8/1]` à partir de `sm:`), pour éviter un rognage excessif
via `object-cover`.

## 12. Absence de tracking

Aucun compteur d'impression, aucun compteur de clic, aucun analytics publicitaire spécifique, aucun
cookie, aucun identifiant visiteur. Le tirage et l'affichage sont purement côté client, sans aucun
appel réseau ni écriture d'aucune sorte.

## 13. Limites (assumées, pas des oublis)

- La fenêtre de dates (`dateDebut`/`dateFin`) est réévaluée en temps réel, sans rebuild, à la fois
  côté public (voir section 7) et sur `/admin/visibilite` (voir section 10) — les deux partagent la
  même fonction `calculerStatut()`/`estDansPeriode()`.
- **Depuis Admin-2B**, le levier manuel `actif`, la création, la modification et la suppression sont
  eux aussi appliqués sans rebuild ni déploiement (voir section 15.4) — il ne reste plus aucune
  opération de ce module qui nécessite un commit Git.
- Un seul format (bandeau horizontal), un seul emplacement par page (`principal`).
- Pas de champ `priorite` (voir section 9).
- Pas d'upload d'image depuis l'Admin (voir section 15.5) — champ chemin/URL uniquement.
- Aucune vérification automatique de la conformité entre un engagement commercial Silver/Gold et la
  programmation réelle (voir section 1) — pilotage humain LabEvents.
- Aucun tracking (voir section 12).
- Aucune vérification de l'existence réelle de l'exposant désigné par `exposantId` (seul le format
  `EXP26-XXX` est validé) — le référentiel exposants (Content Collection Astro) n'est pas accessible
  depuis le PHP serveur sans une architecture disproportionnée pour ce lot (voir section 15.7).
- Pas d'historique de versions au-delà d'une seule sauvegarde de la version précédente
  (`visibilites.json.bak`, voir section 15.3) — pas un système de versioning complet.

## 14. Historique — Admin-2 → Admin-2B

Jusqu'au 08/08/2026 (Lot Admin-2), `/admin/visibilite` était strictement en lecture seule et la
programmation d'une campagne nécessitait d'éditer un fichier Markdown puis de committer/déployer
(voir section 3). Ce fonctionnement s'est révélé trop lourd à l'usage pour LabEvents (un commit par
campagne, un délai de déploiement avant effet). Admin-2B (voir section 15) l'a remplacé par un CRUD
complet, sans rien changer aux règles métier de sélection publicitaire (sections 1, 2, 6 à 9, 12).

## 15. Admin-2B — architecture technique

> Chantier validé le 09/08/2026, après audit d'hébergement OVH (PHP confirmé disponible et
> fonctionnel sur le mutualisé `salonez`, test réel effectué avant codage — voir historique de
> l'échange de cadrage) et arbitrages explicites de Philippe sur l'architecture cible. Cette section
> est la référence technique du module ; les sections précédentes en donnent la vue fonctionnelle.

### 15.1 Vue d'ensemble

```
Navigateur LabEvents (authentifié Basic Auth sur /admin)
        │
        ├── GET/POST/PUT/DELETE  /admin-api/visibilites.php   (protégé, CSRF)
        │
        └── /admin/visibilite, /admin/visibilite/formulaire   (pages Astro statiques,
                                                                 JS client uniquement)

Navigateur visiteur (site public, non authentifié)
        │
        └── GET  /api/visibilites.php?page=...&emplacement=... (public, lecture seule)

                          │                    │
                          ▼                    ▼
        public/api/_visibilites-lib.php  (bibliothèque PHP partagée : lecture/écriture
                                            atomique, validation, whitelist)
                          │
                          ▼
        /home/salonez/salon-emploi-data-preprod/visibilites.json   (hors webroot, hors Git)
```

Le site public reste un site Astro **statique** (`output: 'static'`) : aucun SSR n'a été introduit.
Ce qui change avec Admin-2B, c'est que le composant `VisibilitySlot.astro` ne lit plus rien au build
— il rend une coquille masquée (`hidden`) sur chaque page concernée, et c'est le navigateur du
visiteur qui va chercher les campagnes éligibles à l'exécution, via `fetch()` (voir
`src/lib/visibilite-ui.ts`). C'est le seul endroit du site public qui dépend désormais d'un appel
réseau non-CDN vers l'hébergement OVH plutôt que du contenu déjà généré au build.

### 15.2 Fichiers du dépôt

| Fichier | Rôle |
|---|---|
| `public/api/_visibilites-lib.php` | Bibliothèque partagée : lecture/écriture atomique de `visibilites.json`, verrouillage (`flock`), validation métier serveur, whitelist du contrat public. Se protège contre un accès direct par URL (403). |
| `public/api/visibilites.php` | Endpoint public, `GET` uniquement, non authentifié. Consommé par `src/lib/visibilite-ui.ts`. |
| `public/admin-api/visibilites.php` | Endpoint Admin, CRUD complet (`GET`/`POST`/`PUT`/`DELETE`), protégé par Basic Auth Apache + CSRF applicatif. Consommé par `src/lib/admin-visibilite-ui.ts`. |
| `public/admin-api/.htaccess` | Basic Auth explicite pour `/admin-api` (voir section 15.6 — ne s'hérite pas de `public/admin/.htaccess`). |
| `src/lib/visibilites.ts` | Logique pure (statut, éligibilité, tirage pondéré) — miroir volontaire de la logique PHP, aucune dépendance à `astro:content` ni au réseau. |
| `src/lib/visibilite-ui.ts` | Contrôleur client du site public : `fetch()` vers l'API publique, filtrage par date, tirage, rendu DOM, fallback silencieux. |
| `src/lib/admin-visibilite-ui.ts` | Contrôleur client de l'Admin : `fetch()` vers l'API Admin, gestion du jeton CSRF, création/modification/activation/suppression. |
| `src/components/VisibilitySlot.astro` | Coquille HTML statique par (page, emplacement) — voir section 15.1. |
| `src/pages/admin/visibilite/index.astro` | Liste + actions (Modifier, Activer/Désactiver, Supprimer). |
| `src/pages/admin/visibilite/formulaire.astro` | Formulaire unique de création/modification (mode déterminé par `?id=` en URL). |

Tous ces fichiers PHP sont **versionnés dans le dépôt Git**, suivent le cycle normal
`branche → PR → pr-check.yml → merge → deploy-preprod.yml` (voir CLAUDE.md section 4) : `public/`
est recopié tel quel dans `dist/` par Astro, puis synchronisé par FTP — exactement le mécanisme déjà
utilisé pour `public/admin/.htaccess` depuis Admin-0 (voir docs/ADMIN.md §2). **Aucun transfert
manuel de code** n'est nécessaire pour ce module (contrairement au test diagnostic PHP ponctuel du
09/08/2026, qui était volontairement hors pipeline car strictement temporaire).

### 15.3 Données privées — emplacement, permissions, sauvegarde

| Élément | Chemin (préproduction) |
|---|---|
| Racine du compte OVH | `/home/salonez` |
| Racine du site préprod (webroot, `${FTP_REMOTE_DIR}`) | `/home/salonez/salon-emploi-preprod` |
| **Dossier de données** (hors webroot, hors Git) | `/home/salonez/salon-emploi-data-preprod/` |
| Fichier de données | `/home/salonez/salon-emploi-data-preprod/visibilites.json` |
| Sauvegarde de la version précédente | `/home/salonez/salon-emploi-data-preprod/visibilites.json.bak` |
| Fichier de verrouillage (écritures concurrentes) | `/home/salonez/salon-emploi-data-preprod/visibilites.lock` |

Ce dossier a été créé et sa capacité d'écriture par PHP confirmée par un test réel le 09/08/2026
(voir historique de cadrage) — PHP 8.0.30 confirmé sur cet hébergement.

**Permissions** : le dossier suit les permissions par défaut du compte FTP `salonez` (PHP s'exécute
sous cet utilisateur sur ce mutualisé OVH — mode CGI/FPM standard, pas de `www-data` séparé) ; aucune
permission spéciale au-delà de l'écriture par ce même compte n'est nécessaire. Rien à configurer
manuellement au-delà de la création du dossier.

**Écriture atomique** (`sauvegarderVisibilites()`, `public/api/_visibilites-lib.php`) : écrit dans un
fichier temporaire (`visibilites.json.tmp-XXXXXX`) puis `rename()` vers `visibilites.json` — `rename`
est atomique sur un même système de fichiers POSIX, donc un lecteur concurrent (l'API publique, un
autre onglet Admin) ne voit jamais un JSON partiellement écrit. **Verrouillage** (`flock`, fichier
`visibilites.lock`) : sérialise les écritures Admin concurrentes (deux onglets ouverts en même
temps). **Sauvegarde** : avant chaque écriture, la version actuelle est copiée vers
`visibilites.json.bak` — un filet de sécurité simple (une seule génération conservée), pas un
système de versioning complet (voir section 13).

**Restauration après une erreur d'écriture** : copier manuellement `visibilites.json.bak` par-dessus
`visibilites.json` via FileZilla (accès au dossier `/home/salonez/salon-emploi-data-preprod/`).
Aucune procédure automatisée au-delà de cette sauvegarde simple.

### 15.4 Fonctionnement public — sans rebuild

`GET /api/visibilites.php?page=<page>&emplacement=<emplacement>` renvoie, pour ce couple précis, les
campagnes **actives** dont `pages`/`emplacement` couvrent la demande — sans filtrer sur les dates
(réévaluées côté navigateur, voir section 7). Réponse **whitelistée** (voir section 15.7),
`Cache-Control: no-store` (une activation/désactivation doit être visible immédiatement, pas après
expiration d'un cache).

Le navigateur du visiteur (`src/lib/visibilite-ui.ts`) appelle cet endpoint au chargement de chaque
page, filtre localement par fenêtre de dates (`estDansPeriodeResume`), tire une campagne pondérée
(`selectionnerPonderee`) et révèle la section correspondante si un tirage a abouti. **Conséquence
directe** : une création, modification, activation, désactivation ou suppression depuis
`/admin/visibilite` est visible sur le site public dès le prochain chargement de page par un
visiteur — aucun build Astro, aucun déploiement FTP, aucun redémarrage de rien.

**Fallback (cadrage §12)** : si l'appel réseau échoue (API indisponible, timeout, réponse HTTP
inattendue, JSON invalide), `chargerCandidats()` renvoie une liste vide — l'emplacement reste
simplement masqué (`hidden`), exactement comme s'il n'y avait aucune campagne éligible. Aucune erreur
n'est affichée au visiteur, aucune autre partie de la page n'est affectée. Testé par
`e2e/visibilite.spec.ts` (route interceptée en échec réseau, page vérifiée fonctionnelle par
ailleurs).

### 15.5 Visuels

Option retenue (voir cadrage) : **pas d'upload depuis l'Admin**. Le champ `visuel` du formulaire est
un simple chemin/URL vers une image déjà présente sur le serveur. Procédure de dépôt d'un visuel :

1. Préparer l'image (voir recommandation de ratio, section 11).
2. La transférer via FileZilla dans `public/visibilites/` du dépôt (committée, déployée par le
   pipeline FTP habituel) **ou** directement sur le serveur préprod dans un dossier accessible par
   URL publique (hors du dossier de données privées, qui lui n'est jamais servi par URL) — à choisir
   selon que l'on veut garder une trace du visuel dans le dépôt Git ou non.
3. Renseigner le chemin/URL exact dans le champ **Visuel** du formulaire `/admin/visibilite`.

Un upload sécurisé (validation MIME réelle, ré-encodage, dossier d'upload dédié) reste une piste pour
un lot ultérieur si cette procédure s'avère trop contraignante à l'usage — pas engagé ici.

### 15.6 Sécurité

- **Basic Auth Apache**, réutilisée telle quelle (`AuthUserFile /home/salonez/.htpasswd-salonemploi-preprod`,
  même fichier que `/admin`) — seule vraie barrière d'accès à `/admin-api`, comme documenté pour
  `/admin` (docs/ADMIN.md §4, §8). **`/admin-api` est un dossier frère de `/admin`, pas un
  sous-dossier** : il ne hérite donc pas de `public/admin/.htaccess` — `public/admin-api/.htaccess`
  répète explicitement la même directive, sans rien changer au niveau racine de l'hébergement (donc
  sans effet sur d'autres sites du compte OVH).
- **CSRF applicatif**, distinct de Basic Auth (qui ne protège pas seul contre une requête forgée) :
  un `GET` sur `/admin-api/visibilites.php` crée/reprend une session PHP (cookie
  `SameSite=Strict; Secure; HttpOnly`) et renvoie un jeton aléatoire (`csrfToken`, stocké en
  session) ; toute écriture (`POST`/`PUT`/`DELETE`) doit renvoyer ce jeton dans l'en-tête
  `X-CSRF-Token`, comparé côté serveur via `hash_equals()` (résistant au timing attack).
- **Contrôle d'origine** sur les écritures : l'en-tête `Origin` (repli sur `Referer`) doit
  correspondre au domaine courant — refuse une requête forgée même si un jeton CSRF avait fuité.
- **Méthode HTTP stricte** : `GET` seul sur l'API publique (405 sinon) ; `GET`/`POST`/`PUT`/`DELETE`
  sur l'API Admin, tout autre verbe rejeté (405).
- **Validation serveur systématique** (jamais uniquement côté navigateur) — voir
  `validerVisibilite()` dans `public/api/_visibilites-lib.php` : tous les champs de la section 4,
  y compris le format `EXP26-XXX` de `exposantId` quand renseigné.
- **Pas de chemin fourni par le client** : l'identifiant d'une campagne (`vis-xxxxxxxxxxxx`) est
  toujours généré côté serveur (`genererIdVisibilite()`), jamais accepté depuis la requête, y
  compris à la création (un `id` envoyé par le client est ignoré).
- **Aucune exécution de contenu, aucun secret dans le code ou le JavaScript public** — les seuls
  identifiants sensibles (`.htpasswd`) restent exclusivement sur le serveur OVH, hors dépôt.
- Testé fidèlement contre le vrai code PHP par `scripts/visibilites-api.test.mjs` (CSRF absent/
  invalide, origine invalide, méthodes refusées, validations une par une) — voir section 15.8.

### 15.7 Contrat public — whitelist

`GET /api/visibilites.php` ne renvoie jamais que les 8 champs de `VisibiliteResume`
(`src/lib/visibilites.ts`) : `id`, `annonceur`, `visuel`, `alt`, `lien`, `poids`, `dateDebut`,
`dateFin`. `resumePublicVisibilite()` (`public/api/_visibilites-lib.php`) construit cet objet
explicitement, champ par champ — jamais par un simple filtre négatif sur l'enregistrement complet, ce
qui garantit qu'un futur champ interne ajouté au schéma ne fuite pas par oubli. Testé par
`scripts/visibilites-api.test.mjs` (« Contrat public ») : une campagne créée avec `nomInterne`,
`typeAnnonceur` et `exposantId` renseignés est vérifiée absente de ces trois champs dans la réponse
publique.

### 15.8 Tests

| Fichier | Ce qu'il couvre | Contre quoi |
|---|---|---|
| `scripts/visibilites-lib.test.mjs` (`npm run visibilites:test`) | Logique pure TypeScript (statut, éligibilité, tirage, whitelist) | Fonctions TS uniquement, aucun serveur |
| `scripts/visibilites-api.test.mjs` (`npm run visibilites:api-test`) | CRUD réel, validations serveur une par une, CSRF, origine, méthodes HTTP, whitelist publique, visibilité sans rebuild — contre le **vrai code PHP** | Serveur `php -S` réel (voir ci-dessous) |
| `e2e/visibilite.spec.ts` + `e2e/visibilite-mock.ts` | Rendu client (public et Admin), filtrage par date/statut, fallback réseau, formulaire, confirmation de suppression, tableau de bord | `astro preview` + API simulée par `page.route()` |

**Portée volontairement partagée entre deux outils, pour une raison technique précise** :
`astro preview` (utilisé par la suite Playwright) ne fait tourner ni Apache ni PHP — il ne peut donc
pas exécuter le vrai `public/admin-api/visibilites.php`. `scripts/visibilites-api.test.mjs` comble
ce trou en lançant un vrai serveur PHP (`php -S 127.0.0.1:<port> -t public`, voir Node
`child_process`), pointé vers un dossier de données temporaire via la variable d'environnement
`VISIBILITES_DATA_DIR_TEST` (jamais une entrée HTTP — voir `public/api/_visibilites-lib.php`), et
l'exerce par de vraies requêtes `fetch()`. C'est le test le plus proche du comportement réel sans
accès à l'hébergement OVH. Sa seule limite : `php -S` ne traite pas les fichiers `.htaccess`, donc la
protection Basic Auth Apache elle-même n'est testée par aucun outil automatisé — comme documenté pour
`/admin` (docs/ADMIN.md §5), c'est un test manuel, à faire une fois en conditions réelles.

CI (`.github/workflows/qa.yml`) : installe PHP 8.0 (`shivammathur/setup-php`, version alignée sur
celle confirmée sur l'hébergement OVH réel) puis lance `npm run visibilites:api-test` avant la suite
Playwright.

Régressions vérifiées sur ce lot : `npm run build`, `npm run content:check`, `npm run content:test`
(inclut les tests unitaires offres/exposants/programme/visibilites), `npm run visibilites:api-test`,
`npm run qa` (Playwright complet, desktop + mobile) — tous verts.

### 15.9 Préproduction / production

Ce lot est configuré **exclusivement pour la préproduction** — chemins `/home/salonez/salon-emploi-preprod`
et `/home/salonez/salon-emploi-data-preprod/`. Rien n'a été créé pour la production.

**Quand la production sera prête** (voir docs/deploiement-preproduction.md §7 pour le cadre général
préprod/production du site) :

1. Créer un dossier de données **distinct** sur l'hébergement de production (jamais
   `salon-emploi-data-preprod/` réutilisé — voir CLAUDE.md, cadrage Admin-2B point 8/13). Convention
   proposée, à confirmer : `/home/<compte-prod>/salon-emploi-data-production/`.
   `visibilites.json` y démarre **vide** : aucune campagne préprod n'est migrée automatiquement.
2. Mettre à jour `VISIBILITES_DATA_DIR_DEFAUT` dans `public/api/_visibilites-lib.php` — actuellement
   un chemin unique en dur pour la préproduction ; ce point devra être tranché explicitement (chemin
   en dur différent par environnement déployé séparément, ou lecture d'une variable d'environnement
   serveur si l'hébergement de production le permet) au moment de préparer ce lot, pas anticipé ici.
3. Créer `/home/<compte-prod>/salon-emploi-production/admin-api/.htaccess` avec l'`AuthUserFile` de
   production (distinct de celui de préprod, voir docs/ADMIN.md §4.4).
4. Recette complète en préproduction (ce lot) avant tout déploiement en production — comme pour
   n'importe quel autre lot du site (voir CLAUDE.md section 4).

**Aucune opération manuelle serveur supplémentaire n'est nécessaire pour la préproduction** au-delà
de la création du dossier `/home/salonez/salon-emploi-data-preprod/` (déjà faite et vérifiée le
09/08/2026) : le code PHP est déployé par le pipeline FTP existant comme n'importe quel fichier de
`public/`.
