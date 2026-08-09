# Gérer les offres et la sélection candidat

Ce document explique le fonctionnement du **Lot 1** du dispositif « Offres et
candidatures » : le catalogue public des offres (`/offres`), les fiches
détaillées, et la sélection de 0 à 5 offres par les visiteurs. Aucune
compétence en programmation n'est nécessaire pour ajouter une offre.

> Rappel (CLAUDE.md, section 2) : ne jamais inventer d'offre, ne jamais
> attribuer une offre fictive à une entreprise réelle. Une fiche avec un
> `status` différent de `publiee` reste invisible sur le site — elle peut
> être préparée à l'avance sans risque.

## 1. Objectif de la collection

La collection Astro `offres` (`src/content/offres/`) stocke les postes
déclarés par les exposants, après validation par LabEvents. Dans ce lot,
l'ajout se fait **manuellement**, fichier par fichier. Le Lot 3 décrira
l'import automatisé depuis Google Sheets.

## 2. Structure des fichiers

Chaque offre est un fichier `.md` dans :

```
src/content/offres/
```

Un fichier = une offre. Nommez le fichier en minuscules, sans accents ni
espaces, de préférence à partir de la référence (ex. `sef26-001.md` pour la
référence `SEF26-001`). Ce nom de fichier devient l'adresse de la fiche
(`/offres/nom-du-fichier`).

Contrairement aux collections `exposants` et `programme`, il n'y a **pas de
champ `slug`** : le nom de fichier fait toujours foi. La `reference` (ex.
`SEF26-001`) est un identifiant métier séparé, utilisé pour la sélection par
URL — elle peut différer du nom de fichier.

## 3. Champs obligatoires

```markdown
---
reference: SEF26-001
status: publiee
intitule: Technicien de maintenance industrielle
exposantId: EXP26-001
exposantNom: Pacific Industrie
formule: standard
secteur: Maintenance industrielle
typeContrat:
  - CDI
lieu: Nouméa
nombrePostes: 2
niveauExperience: Débutant accepté
descriptionCourte: >
  Une description synthétique de l'offre.
accepteCandidaturesEnLigne: true
datePublication: 2026-09-15
---
```

Champs facultatifs : `datePrisePoste`, `niveauFormation` (liste),
`sansExperience` (booléen, `false` par défaut), `missions` (liste),
`competencesPrerequis` (liste), `dateCloture` (voir section 6),
`miseEnAvant` (booléen, `false` par défaut).

`nombrePostes` vaut `1` par défaut si absent. `accepteCandidaturesEnLigne`
vaut `true` par défaut si absent.

## 3bis. `exposantId` — clé de rattachement avec la collection `exposants`

`exposantId` est la **clé pivot** entre une offre et son exposant (voir
`docs/EXPOSANTS_IMPORT.md` section 3bis, Lot Admin-1C) — jamais le nom
d'entreprise, jamais le slug.

- **Offre réelle** : `exposantId` est obligatoire et doit être exactement
  l'`exposantId` `EXP26-XXX` de l'exposant correspondant dans la collection
  `exposants` — jamais un texte libre inventé. Un identifiant mal formé ou
  ne correspondant à aucun exposant connu est une erreur bloquante à
  l'import (`npm run offres:import` / `npm run offres:check`, voir
  `docs/EXPOSANTS_IMPORT.md` section 3bis).
- **Offre TEST** (préfixe `TEST —` sur `intitule`, voir section 12 de
  CLAUDE.md et `estOffreTest()` dans `src/lib/offres.ts`) : ne représente
  aucun exposant réel. Convention retenue : `exposantId: TEST-EXPOSANT-NC`
  — un identifiant dédié, jamais un vrai `EXP26-XXX`, pour qu'une offre de
  démonstration ne puisse jamais être confondue avec un vrai rattachement.

## 4. Valeurs de statut (`status`)

| Valeur | Sens |
|---|---|
| `recue` | Déclarée par l'exposant, pas encore traitée |
| `a-completer` | Informations manquantes, en attente de l'exposant |
| `validee` | Validée par LabEvents, pas encore publiée |
| `publiee` | **Visible publiquement sur `/offres`** |
| `retiree` | Retirée par l'exposant ou LabEvents |
| `cloturee` | Poste pourvu ou période de candidature terminée |

**Seul le statut `publiee` rend une offre visible sur le site.** Tous les
autres statuts existent pour suivre le circuit de validation en interne, sans
impact sur le site public.

## 5. Valeurs de formule (`formule`)

`standard`, `silver`, `gold` — reflètent la formule commerciale de
l'exposant (voir `/exposer`). Sur le site, `silver` affiche le badge discret
« Exposant partenaire » et `gold` « Partenaire premium ». **Ces badges ne
modifient jamais le tri des offres** (voir section 9) : ils sont purement
informatifs.

**Architecture retenue (Lot Admin-1C) — duplication contrôlée.** `formule`
appartient métier à l'**exposant** (`src/content.config.ts`, collection
`exposants` — voir `docs/EXPOSANTS_IMPORT.md`), mais reste aussi présente
sur chaque offre : la supprimer romprait l'affichage public des badges
Silver/Gold (`OffreCard.astro`, `/offres/[slug].astro`), qui lisent
aujourd'hui `offre.data.formule` sans jointure avec la collection
`exposants`, et romprait le calcul des quotas commerciaux (voir section 15)
tant que `exposants` n'est pas alimentée avec des données réelles. Plutôt
que de supprimer le champ (migration jugée trop risquée tant que ces deux
usages n'ont pas été réécrits pour joindre `exposants`), la duplication est
conservée et **vérifiée automatiquement** : `npm run offres:import` et `npm
run offres:check` comparent la `formule` de chaque offre réelle à celle de
son exposant (via `exposantId`, voir section 3bis) quand le référentiel
`exposants` est disponible, et lèvent une erreur bloquante en cas de
divergence. Dans l'Admin, une offre déjà publiée dont la formule diverge de
celle de son exposant porte un badge interne « Formule incohérente »
(`src/lib/admin.ts`, `formuleIncoherente`).

## 6. Le champ facultatif `dateCloture`

`dateCloture` est une date **facultative** de fin de validité de l'offre /
fin de période de candidature (ex. « ce poste n'accepte plus de
candidatures après le 20 octobre »). Elle ne concerne que l'offre — **ne
jamais** l'utiliser pour représenter autre chose.

Si aucune date limite n'est connue pour une offre, **laisser le champ
absent** : ne jamais inventer une date par défaut. Quand elle est
renseignée, elle alimente le champ `validThrough` des données structurées
`JobPosting` (schema.org) de la fiche offre ; sans `dateCloture`,
`validThrough` n'est simplement pas généré.

> Ce champ est indépendant de la **durée de conservation des données
> candidat** (fixée au 31 décembre 2026), qui concerne les données
> personnelles collectées via le formulaire Tally de candidature — voir
> `docs/CANDIDATURES_TALLY.md`. Les fiches offres ne portent aucune donnée
> personnelle et ne sont donc pas concernées par cette règle de
> conservation.

## 7. Procédure manuelle pour ajouter une offre

1. Créer le fichier dans `src/content/offres/` (voir section 2).
2. Remplir les champs obligatoires (section 3).
3. Laisser `status: recue` (ou un autre statut non `publiee`) tant que
   l'offre n'est pas validée.
4. Une fois validée par LabEvents, passer `status: publiee`.
5. Lancer `npm run build` pour vérifier l'absence d'erreur.

## 8. Critères de publication

Une offre n'apparaît sur `/offres` et sur sa fiche `/offres/[slug]` que si
`status: publiee`. Aucune autre condition (formule, date de publication...)
ne masque une offre publiée.

## 9. Fonctionnement des paramètres URL

La sélection de 0 à 5 offres est représentée **exclusivement** par les
paramètres `offre1` à `offre5` dans l'URL, ex. :

```
/offres?offre1=SEF26-001&offre2=SEF26-014
```

- Une URL copiée puis ouverte dans un autre onglet reproduit la même
  sélection.
- `src/lib/candidature-selection.ts` contient la logique pure (lecture,
  ajout, retrait, reconstruction d'URL) — aucune dépendance au DOM.
- `src/lib/selection-ui.ts` est le seul module qui touche au DOM : il lit
  `window.location.search`, met à jour l'affichage (cartes, tiroir de
  sélection, page `/ma-selection`) et réécrit l'URL avec
  `history.replaceState` (jamais de rechargement de page).
- Le paramètre `orientation=1` est réservé à la future candidature sans
  offre (`/candidater?orientation=1`, Lot 2).
- **Les filtres du catalogue (`/offres`) ne modifient jamais l'URL** : ils
  n'affichent/masquent que des cartes déjà présentes dans la page (comme les
  filtres `/exposants` et `/programme` existants). Cela garantit
  mécaniquement qu'un changement de filtre ne peut jamais effacer
  `offre1`..`offre5`.

## 10. Limite de cinq offres

`MAX_SELECTION = 5` dans `candidature-selection.ts`. Toute tentative
d'ajouter une sixième offre est refusée : la sélection existante est
conservée telle quelle, et un message est annoncé via une région
`aria-live` (`#annonce-selection`) : « Vous pouvez sélectionner jusqu'à cinq
offres. Retirez une offre pour en ajouter une nouvelle. »

## 11. Gestion des références invalides

Au chargement de chaque page concernée, `initSelectionUI()` :

1. lit `offre1`..`offre5` ;
2. ignore les valeurs vides ;
3. déduplique en conservant la première occurrence ;
4. ignore les références qui ne correspondent à aucune offre publiée
   (`filtrerReferencesConnues`) ;
5. réécrit l'URL avec uniquement les références valides et dédupliquées.

Cette réécriture ne supprime jamais une référence valide — seules les
valeurs invalides, vides ou dupliquées sont retirées.

## 12. Absence volontaire de `localStorage`

Conformément à la mission du Lot 1, ce lot **n'utilise ni `localStorage`, ni
`sessionStorage`, ni cookie, ni `IndexedDB`, ni session serveur**. L'état de
la sélection existe uniquement dans l'URL du navigateur. Une conséquence
directe : sans JavaScript, la sélection ne peut pas être modifiée (les
boutons « Ajouter à ma sélection » nécessitent le script
`selection-ui.ts`) — c'est un choix assumé, cohérent avec l'usage de
`history.replaceState` demandé par la mission.

## 13. Fonctionnement avec zéro offre

`/offres` affiche un état vide dédié (section « Les offres des exposants
seront publiées progressivement... ») sans grille vide ni erreur si aucune
offre n'a `status: publiee`. `/offres/[slug]` ne génère alors aucune page
(`getStaticPaths` retourne un tableau vide). `/ma-selection` reste
fonctionnelle et affiche son état vide.

## 14. Articulation future avec le Lot 2

Le Lot 2 ajoutera la page `/candidater`, le formulaire Tally et le dispatch
des candidatures. Dans ce lot, les CTA « Candidater à ma sélection » et
« Candidater sans offre » sont volontairement **désactivés** (`<button
disabled>`, mention « Bientôt disponible ») plutôt que de pointer vers une
route inexistante — voir la description de la PR pour le détail de ce choix.
La logique de construction d'URL (`hrefAvecSelection`) est déjà prête et
sera réutilisée telle quelle pour activer ces CTA au Lot 2.

## 15. Import automatisé (Lot 3)

Le Lot 3 a ajouté l'import automatisé des offres depuis le Google Forms
exposant et Google Sheets (validation LabEvents → génération des fichiers
`src/content/offres/`). Le schéma décrit dans ce document (section 3) n'a
pas changé — l'import génère exactement le même format de fichier que
l'ajout manuel.

Voir :
- `docs/OFFRES_EXPOSANTS.md` — structure du Google Form et du Google Sheet.
- `docs/WORKFLOW_OFFRES_2026.md` — procédure complète, de la confirmation
  d'un exposant à la publication de ses offres.
- `npm run offres:import -- <fichier.csv> --dry-run` — vérifier un import
  avant de l'appliquer.
- `npm run offres:check` — contrôler la collection existante (doublons,
  quotas), sans CSV.

L'ajout manuel fichier par fichier (sections 1 à 8 de ce document) reste
possible et n'est pas remplacé par l'import : les deux méthodes produisent
le même format de fichier et peuvent coexister.
