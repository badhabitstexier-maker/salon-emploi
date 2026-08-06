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
exposantId: pacific-industrie
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
dateCloture: 2026-12-31
---
```

Champs facultatifs : `datePrisePoste`, `niveauFormation` (liste),
`sansExperience` (booléen, `false` par défaut), `missions` (liste),
`competencesPrerequis` (liste), `miseEnAvant` (booléen, `false` par défaut).

`nombrePostes` vaut `1` par défaut si absent. `accepteCandidaturesEnLigne`
vaut `true` par défaut si absent.

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

## 6. La règle `dateCloture: 2026-12-31`

`dateCloture` correspond à la **durée de conservation des données** pour
l'édition 2026, pas à la date de fin du salon. Elle sert de repère pour la
suppression manuelle des fiches après le 31 décembre 2026. **Ne jamais
utiliser le 31 octobre 2026** (fin du salon) comme valeur de ce champ.

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

## 15. Articulation future avec le Lot 3

Le Lot 3 décrira l'import automatisé des offres depuis le Google Forms
exposant et Google Sheets (validation LabEvents → génération des fichiers
`src/content/offres/`). La structure de champs définie dans ce document
(section 3) est conçue pour correspondre directement aux colonnes
attendues d'un futur export CSV/Sheets, sans changement de schéma prévu à
ce stade.
