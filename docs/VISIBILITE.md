# Visibilité publicitaire — Lot Admin-2

> Documentation du module de visibilité publicitaire (bandeaux). Écrite pour qu'une personne qui ne
> lit pas le code puisse comprendre comment programmer une campagne et ce que le site fait avec.
> Voir aussi CLAUDE.md (section 14, chantier Admin) et docs/ADMIN.md (socle technique de `/admin`).

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

Une **Content Collection Astro** dédiée : `visibilites`, définie dans `src/content.config.ts`,
alimentée par des fichiers Markdown (frontmatter uniquement) dans `src/content/visibilites/` — un
fichier = une campagne. Édition **à la main**, comme `exposants` et `programme` avant leur pipeline
d'import : pas de CSV, pas de script d'import dédié. Le volume de campagnes attendu (quelques
unités à la fois) ne justifie pas un pipeline supplémentaire — si ce volume change significativement
un jour, le réévaluer plutôt que de forcer l'existant.

Il n'y a **aucune édition depuis `/admin/visibilite`** : cette page est strictement en lecture seule
(voir section 8). Programmer une campagne se fait en éditant un fichier du dépôt.

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

```markdown
---
nomInterne: "Sponsor principal 2026"
annonceur: "Nom du sponsor"
typeAnnonceur: "sponsor"
format: "bandeau_horizontal"
visuel: "/visibilites/sponsor-principal.png"
alt: "Bandeau du sponsor principal du salon"
lien: "https://exemple.nc"
pages:
  - "accueil"
  - "offres"
emplacement: "principal"
poids: 3
actif: true
---
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

Page de lecture seule (`src/pages/admin/visibilite/index.astro`), accessible depuis la navigation
Admin (« Visibilité »). Aucun formulaire d'édition, de suppression, de création, d'upload ni de
statistiques de clics — conformément au périmètre V1.

Affiche, pour chaque campagne : aperçu du visuel, annonceur (+ nom interne), type, format,
pages/emplacement, période, poids, statut calculé. Un lien vers la fiche Admin de l'exposant apparaît
quand `exposantId` est renseigné et correspond à un exposant connu.

Filtres disponibles : statut, type d'annonceur, page. (Pas de filtre format tant qu'un seul format
existe — à ajouter si un second format est introduit.)

Le tableau de bord (`/admin/dashboard`) affiche un résumé léger : nombre de campagnes actives et, si
non nul, nombre à venir, avec un lien vers `/admin/visibilite`.

**Nuance sur le moment de calcul** : `/admin/visibilite` et `/admin/dashboard` sont eux-mêmes des
pages statiques — leur statut affiché (Actif / À venir / Expiré / Désactivé) est donc calculé avec
l'heure du **dernier build**, avec exactement la même fonction (`statutVisibilite()`,
`src/lib/visibilites.ts`) que celle qui définit la fenêtre de dates réévaluée en temps réel côté
public (section 7). Le site public, lui, réévalue cette même fenêtre à chaque chargement de page
côté navigateur : il est donc plus réactif que la vue Admin sur ce point précis. En pratique, avec
le déploiement automatique à chaque fusion (voir CLAUDE.md, section 4), l'écart entre les deux reste
généralement de l'ordre de la minute à quelques heures.

`/admin/visibilite` hérite du `noindex, nofollow` et de l'exclusion sitemap/robots.txt de tout
l'espace `/admin` (voir docs/ADMIN.md) — rien de spécifique à ajouter ici.

## 11. Procédure pour ajouter ou modifier une campagne

1. Préparer le visuel (voir recommandations ci-dessous) et le déposer dans `public/` (ex.
   `public/visibilites/mon-annonceur.png`).
2. Créer un fichier `src/content/visibilites/<slug-libre>.md` avec les champs de la section 4
   (s'inspirer de l'exemple).
3. `npm run build` doit réussir.
4. Vérifier sur `/admin/visibilite` (en local ou en préprod) que la campagne apparaît avec le bon
   statut, la bonne période et le bon poids.
5. Vérifier visuellement sur la ou les pages concernées.
6. Pour retirer une campagne sans supprimer le fichier (garder une trace) : passer `actif: false`.
   Pour la retirer définitivement : supprimer le fichier.

**Recommandation visuelle** : bandeau large, ratio approximatif 6:1 à 8:1 (le conteneur public
utilise `aspect-[6/1]` en mobile, `aspect-[8/1]` à partir de `sm:`), pour éviter un rognage excessif
via `object-cover`.

## 12. Absence de tracking

Aucun compteur d'impression, aucun compteur de clic, aucun analytics publicitaire spécifique, aucun
cookie, aucun identifiant visiteur. Le tirage et l'affichage sont purement côté client, sans aucun
appel réseau ni écriture d'aucune sorte.

## 13. Limites V1 (assumées, pas des oublis)

- La fenêtre de dates (`dateDebut`/`dateFin`) est réévaluée en temps réel côté public (voir section
  7) ; le statut affiché sur `/admin/visibilite` reflète, lui, l'heure du dernier build (voir section
  10) — écart généralement de l'ordre de la minute à quelques heures avec le déploiement continu.
- Le levier manuel `actif` (contrairement aux dates) nécessite bien une édition de fichier suivie
  d'un build/déploiement pour prendre effet.
- Un seul format (bandeau horizontal), un seul emplacement par page (`principal`).
- Pas de champ `priorite` (voir section 9).
- Aucune édition depuis l'Admin — uniquement en éditant les fichiers du dépôt.
- Aucune vérification automatique de la conformité entre un engagement commercial Silver/Gold et la
  programmation réelle (voir section 1) — pilotage humain LabEvents.
- Aucun tracking (voir section 12).

## 14. Recommandations pour Admin-2B (non demandées dans ce lot, pistes seulement)

- Un second format (ex. bandeau de logos partenaires en bas de page) si un vrai besoin apparaît à
  l'usage.
- Un signal Admin (pas un blocage) quand un exposant Silver/Gold n'a aucune campagne programmée,
  pour aider LabEvents à suivre la conformité aux engagements commerciaux.
- Édition légère depuis l'Admin si le volume de campagnes rend l'édition manuelle de fichiers
  pénible — à réévaluer avec la contrainte « site statique, pas de backend » toujours en vigueur.
