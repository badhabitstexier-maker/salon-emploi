# Import automatisé des exposants (Lot 4A)

Ce document décrit le **pipeline d'import** des exposants
(`scripts/import-exposants.mjs`), qui alimente la collection Astro
`exposants` (`src/content/exposants/`) à partir d'un fichier CSV normalisé.
Il complète `docs/EXPOSANTS.md` (édition manuelle fiche par fiche, toujours
possible) sans le remplacer.

> Rappel (CLAUDE.md, section 2 et 3) : ne jamais inventer d'exposant, ne
> jamais publier une entreprise ou une institution avant confirmation
> explicite de Philippe. `publie: non` dans le CSV garde la fiche invisible
> sur le site — elle peut être préparée à l'avance sans risque.

> Règle métier (Lot Admin-1B, précisée par le Lot Admin-1C) : **la formule
> appartient à l'exposant et n'est jamais déduite de ses offres.** Le champ
> `formule` (`standard` / `silver` / `gold`) est renseigné une fois pour
> l'exposant dans ce CSV. Le champ `formule` présent séparément sur chaque
> offre (`docs/OFFRES.md`) reste une **duplication contrôlée**, conservée
> pour ne pas rompre l'affichage public des badges — voir `docs/OFFRES.md`
> section 5 pour l'architecture retenue. `npm run offres:import` et `npm run
> offres:check` vérifient désormais automatiquement que la `formule` de
> chaque offre réelle correspond à celle de son exposant, quand le
> référentiel `exposants` est disponible (voir section 3bis ci-dessous) —
> une divergence est une erreur bloquante à l'import.

## 1. Finalité

LabEvents prépare un CSV (export Google Sheets, tableur de suivi
commercial…), lance une **vérification à blanc** (`--dry-run`), corrige les
éventuelles erreurs, puis lance l'**import réel**. Le pipeline garantit :

- une validation complète avant toute écriture (tout ou rien) ;
- la détection des doublons, des dépassements de capacité et des
  incohérences de stand ;
- l'**idempotence** : réimporter le même CSV ne crée ni doublon ni nouvelle
  identité exposant ;
- un rapport lisible (créés / mis à jour / inchangés / ignorés /
  avertissements / erreurs).

## 2. Structure du CSV

Fichier modèle : `data/templates/exposants-import.csv` (exposants
entièrement fictifs — aucune entreprise réelle).

| Colonne | Obligatoire | Description |
|---|---|---|
| `exposantId` | non | Identifiant métier stable (voir section 3). Laisser vide pour une attribution automatique. |
| `slug` | oui | Détermine l'adresse de la fiche et le nom du fichier (`src/content/exposants/<slug>.md`). Minuscules, chiffres, tirets uniquement. |
| `nom` | oui | Nom affiché. |
| `formule` | oui | Formule commerciale de l'exposant : `standard`, `silver` ou `gold` (même convention que `formule` sur les offres, voir `docs/OFFRES.md`). **La formule appartient à l'exposant et n'est jamais déduite de ses offres.** |
| `univers` | oui | Hall : `emploi` (Hall Emploi) ou `formation` (Hall Formation) — voir section 6. |
| `type_structure` | oui | `entreprise`, `organisme-formation`, `institution`, `accompagnement`, `association`, `autre`. |
| `secteurs` | oui (peut être vide) | Liste de secteurs, séparés par `\|`. |
| `accroche` | oui | Phrase courte affichée sur la carte de la liste. |
| `description` | oui | Contenu détaillé de la fiche individuelle. |
| `logo` | non | Chemin public du logo (voir section 8). |
| `site_web` | non | URL publique, doit commencer par `http://` ou `https://`. |
| `numero_stand` | non | Numéro de stand (voir section 7). |
| `email_public` | non | Adresse email **publique** uniquement — jamais un contact RH interne. |
| `telephone_public` | non | Téléphone **public** uniquement. |
| `mise_en_avant` | non (défaut `non`) | `oui`/`non`. |
| `publie` | non (défaut `non`) | `oui`/`non` — voir rappel ci-dessus. |
| `ordre` | non | Nombre, départage le tri à égalité de mise en avant. |
| `date_mise_a_jour` | non | Format `AAAA-MM-JJ`. |
| `metiers`, `formations`, `opportunites`, `mots_cles` | non | Listes séparées par `\|`, affichées seulement si renseignées. |

Les valeurs booléennes acceptent `oui`/`non` (ou `true`/`false`,
`vrai`/`faux`, `1`/`0`).

## 3. `exposantId` — identifiant métier stable

`exposantId` est **indépendant** du nom affiché et du `slug` : il reste
constant même si l'exposant change de nom ou que son slug est corrigé.
Convention : `EXP26-001`, `EXP26-002`, etc.

- Laissé **vide** dans le CSV : le pipeline tente d'abord de le retrouver en
  s'appuyant sur une fiche existante portant le même `slug` (réimport d'un
  CSV déjà traité) ; à défaut, il attribue le prochain numéro disponible.
- **Renseigné** : doit respecter le format `EXP26-XXX`, sinon rejeté.
- Un `exposantId` ne peut jamais être réattribué à un `slug` différent de
  celui déjà enregistré sous cet identifiant sans mise à jour explicite (le
  pipeline traite ce cas comme un **renommage** : l'ancien fichier est
  supprimé, le nouveau écrit sous le nouveau nom — voir section 10).

Cet identifiant est la **clé pivot** entre un exposant et ses offres
(`exposantId` dans la collection `offres`, voir `docs/OFFRES.md`) — c'est le
**seul** champ utilisé pour ce rattachement, à l'exclusion de tout autre
(nom d'entreprise, slug, correspondance approximative). Voir section 3bis
pour le contrôle automatisé mis en place au Lot Admin-1C.

## 3bis. Rattachement offres ↔ exposant (Lot Admin-1C)

Avant le Lot Admin-1C, `exposantId` sur une offre était un texte libre saisi
manuellement par l'exposant dans le Google Form (voir
`docs/OFFRES_EXPOSANTS.md` section 5, historique), sans validation contre la
collection `exposants` — c'était la cause des deux incohérences corrigées
par ce lot. Depuis :

- Le schéma Astro (`src/content.config.ts`, collection `offres`) impose le
  format `EXP26-XXX` à l'`exposantId` de toute offre réelle (une offre TEST,
  préfixe `TEST —` sur l'intitulé, en est exemptée — voir `docs/OFFRES.md`
  section 3bis).
- `npm run offres:import` et `npm run offres:check`
  (`scripts/import-offres.mjs`) lisent le référentiel `exposants` et
  vérifient, pour chaque offre réelle, que son `exposantId` correspond
  effectivement à un exposant de la collection. Une erreur bloquante est
  levée sinon (« Exposant « EXP26-XXX » inconnu du référentiel exposants »).
- **Comportement fail-closed** : `exposants` est le référentiel maître.
  Si la collection `exposants` est vide ou absente, **toute offre réelle du
  lot est refusée** (« Aucun référentiel exposant disponible. Importez
  d'abord les exposants avant d'importer des offres réelles. ») — il faut
  importer au moins l'exposant concerné avant de pouvoir importer ses
  offres. Les offres TEST restent toujours autorisées, quel que soit l'état
  du référentiel exposants : leur identifiant dédié `TEST-EXPOSANT-NC` n'y
  est jamais recherché.
- Le rattachement lui-même (`src/lib/admin.ts`, `offresRattachees`, utilisé
  par le tableau de bord et les fiches Admin) n'a **jamais** utilisé le nom
  d'entreprise — uniquement l'égalité stricte `exposantId`. Une offre réelle
  dont l'`exposantId` ne correspond à aucun exposant porte un badge
  « Exposant introuvable » dans l'Admin (liste et fiche offre), sans jamais
  bloquer le build.

## 4. Champ `hall` et `stand` — correspondance avec le schéma existant

Le schéma Astro (`src/content.config.ts`) et le catalogue public
(`/exposants`) utilisent déjà les champs `univers` (`emploi`/`formation`) et
`numero_stand` — le pipeline **réutilise ces champs existants** plutôt que
d'en introduire de nouveaux redondants. « Hall Emploi » = `univers: emploi`,
« Hall Formation » = `univers: formation`.

## 5. Séparation données publiques / données internes

Le CSV ne contient **que** des colonnes destinées à apparaître sur le site
public. Ne jamais y reporter :

- une adresse email ou un téléphone RH interne (utiliser `email_public` /
  `telephone_public` uniquement s'ils sont explicitement destinés au grand
  public) ;
- des notes commerciales internes, des informations contractuelles, un
  identifiant de suivi LabEvents autre que `exposantId`.

`formule` est une exception assumée à cette règle : c'est une information
commerciale/interne (LabEvents, `/admin`), mais elle vit dans le même CSV et
le même schéma que le reste de la fiche exposant, plutôt que dans un
mécanisme séparé. Elle ne doit **jamais** être affichée telle quelle
(`standard`/`silver`/`gold`) sur les pages publiques du site (voir CLAUDE.md,
règle « ne jamais afficher automatiquement Standard/Silver/Gold au public »).

## 6. Halls et capacités confirmées (2026)

Capacités confirmées par Philippe le 06/08/2026 (CLAUDE.md, section 2) :

| Hall | Capacité |
|---|---|
| Hall Emploi (`univers: emploi`) | 21 stands |
| Hall Formation (`univers: formation`) | 16 stands |
| **Total** | **37 emplacements commercialisés** |

Le pipeline recalcule ces totaux sur **l'état final** (fiches déjà
existantes + fiches du CSV) à chaque import, et bloque l'écriture si un
plafond est dépassé. Ne jamais réintroduire « Village Maintenance »,
« Village Maintenance & Industrie », « Maison des Artisans » ou « Maison de
l'Artisanat » dans `univers` ou ailleurs — voir `npm run content:check`
(section 27 de la mission Lot 4A, `docs/WORKFLOW_CONTENUS_2026.md`).

## 7. Numérotation des stands

Les emplacements **22, 23 et 24** du plan initial ne sont **pas**
commercialisés en 2026 : un `numero_stand` valant exactement `22`, `23` ou
`24` est rejeté par le pipeline.

Le pipeline vérifie aussi qu'un même `numero_stand` n'est pas attribué deux
fois dans le **même hall**.

**Limite connue** : le dépôt ne contient pas (encore) de table officielle
donnant, pour chaque hall, la liste des numéros de stand qui lui sont
réservés. Le pipeline ne vérifie donc **pas** qu'un numéro de stand est
cohérent avec le hall déclaré au-delà des règles ci-dessus (unicité par
hall, exclusion de 22/23/24) — un contrôle manuel reste nécessaire tant que
le plan de référence n'est pas fourni. Ne pas inventer cette correspondance.

## 8. Logos

Convention de chemin recommandée :

```
public/images/exposants/<slug>.<extension>
```

Formats acceptés : `svg`, `png`, `jpg`, `jpeg`, `webp`. Le pipeline :

- refuse un chemin `logo` qui ne commence pas par `/` (chemin public) ;
- refuse une extension non reconnue ;
- vérifie que le fichier existe réellement sous `public/` avant d'importer
  — un logo déclaré mais absent est une **erreur bloquante**.

Le pipeline **ne télécharge jamais** de logo depuis Internet et n'en
fabrique jamais. Si `logo` est vide, le site utilise son emplacement
graphique neutre habituel (comportement inchangé).

## 9. Dry-run et rapport

```bash
npm run exposants:import -- data/templates/exposants-import.csv --dry-run
```

N'écrit **aucun fichier**. Affiche : lignes lues, exposants valides,
ignorés (bloc vide), en erreur ; identifiants rapprochés ou attribués
automatiquement ; avertissements ; erreurs bloquantes ; et le plan de
fichiers (créé / mis à jour / inchangé / renommé).

## 10. Import réel, idempotence et renommage

```bash
npm run exposants:import -- data/templates/exposants-import.csv
```

Comportement **tout ou rien** : une seule erreur bloquante et rien n'est
écrit. Réimporter un CSV identique produit `0 créé, 0 mis à jour, N
inchangé(s)` — aucun fichier n'est réécrit inutilement.

Si le `slug` d'une fiche déjà connue (même `exposantId`) change dans le
CSV, le pipeline traite l'import comme un **renommage** : l'ancien fichier
est supprimé et le nouveau écrit, dans la même opération d'écriture (jamais
d'état intermédiaire avec les deux fichiers).

## 11. Contrôle sans CSV

```bash
npm run exposants:check
```

Vérifie la collection actuelle (doublons d'`exposantId`, dépassement de
capacité, collisions de stand) sans fichier CSV.

## 12. Tests automatisés

```bash
npm run exposants:test
```

Voir `scripts/import-exposants.test.mjs`.

## 13. Publication et build

`publie: non` garde la fiche invisible sur le site (liste, filtres, adresse
individuelle) — voir `docs/EXPOSANTS.md`, section 6, pour le détail du
comportement. Après import :

```bash
npm run build
```

## Action manuelle restante

`public/images/hall-formation.webp` : cette image est actuellement absente
(avertissement de build connu). **Ne pas la créer ni la remplacer dans ce
lot** — Philippe doit la fournir ou valider un remplacement séparément.
