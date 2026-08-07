# Import automatisé du programme (Lot 4A)

Ce document décrit le **pipeline d'import** du programme
(`scripts/import-programme.mjs`), qui alimente la collection Astro
`programme` (`src/content/programme/`) à partir d'un fichier CSV normalisé.
Il complète `docs/PROGRAMME.md` (édition manuelle fiche par fiche, toujours
possible) sans le remplacer.

> Rappel (CLAUDE.md, section 2) : ne jamais inventer de conférence,
> d'atelier, d'intervenant, de salle ou d'horaire. `publie: non` dans le CSV
> garde l'entrée invisible sur le site — elle peut être préparée à l'avance
> sans risque.

## 1. Finalité

Même principe que le pipeline Exposants (`docs/EXPOSANTS_IMPORT.md`) et le
pipeline Offres (`docs/WORKFLOW_OFFRES_2026.md`) : CSV → validation →
dry-run → import contrôlé, tout ou rien, idempotent.

## 2. Structure du CSV

Fichier modèle : `data/templates/programme-import.csv` (activités
entièrement fictives).

| Colonne | Obligatoire | Description |
|---|---|---|
| `programmeId` | non | Identifiant métier stable (voir section 3). Laisser vide pour une attribution automatique. |
| `slug` | oui | Détermine l'adresse de la fiche et le nom du fichier (`src/content/programme/<slug>.md`). |
| `titre` | oui | Titre affiché. |
| `date` | oui | `2026-10-30` ou `2026-10-31` uniquement — voir section 4. |
| `heure_debut` | oui | Format `HH:MM`. |
| `heure_fin` | non | Format `HH:MM`, strictement postérieure à `heure_debut`. |
| `univers` | oui | `emploi`, `formation` ou `transversal`. |
| `type` | oui | `conference`, `atelier`, `demonstration`, `rencontre`, `information`, `autre`. |
| `lieu` | non | Espace au sein du salon — utilisé pour la détection de conflits (section 5). |
| `accroche` | oui | Phrase courte affichée sur la carte de la liste. |
| `description` | oui | Contenu détaillé de la fiche individuelle. |
| `publics` | non | Liste séparée par `\|`. |
| `intervenants` | non | Voir format en section 6. |
| `organisateur` | non | Structure ou personne à l'origine de l'animation. |
| `exposant_lie` | non | `slug` d'une fiche exposant existante (voir `docs/PROGRAMME.md`, section 10). |
| `inscription_requise` | non (défaut `non`) | `oui`/`non`. |
| `lien_inscription` | non | URL externe. |
| `capacite_limitee` | non (défaut `non`) | `oui`/`non`. |
| `mise_en_avant` | non (défaut `non`) | `oui`/`non` — n'affecte que l'apparence, jamais le tri. |
| `publie` | non (défaut `non`) | `oui`/`non`. |
| `ordre` | non | Nombre, départage le tri à égalité d'heure. |
| `date_mise_a_jour` | non | Format `AAAA-MM-JJ`. |

## 3. `programmeId` — identifiant métier stable

Convention : `PROG26-001`, `PROG26-002`, etc. Une correction de titre ne
crée jamais une nouvelle activité : l'identifiant reste stable.

- Laissé **vide** : rapprochement par `slug` existant, sinon attribution du
  prochain numéro disponible (même mécanisme que `exposantId`, voir
  `docs/EXPOSANTS_IMPORT.md`, section 3).
- Renseigné : doit respecter `PROG26-XXX`.
- Un `slug` changé pour un `programmeId` déjà connu est traité comme un
  **renommage** (ancien fichier supprimé, nouveau écrit).

## 4. Dates et horaires

Dates autorisées : `2026-10-30` et `2026-10-31` — toute autre valeur est
rejetée (erreur bloquante). Horaires publics du salon : **09:00 → 17:00**.

Le pipeline détecte :

- une date hors événement (erreur) ;
- un format d'heure invalide (erreur) ;
- `heure_fin` inférieure ou égale à `heure_debut` (erreur) ;
- une activité **entièrement** hors horaires du salon, c'est-à-dire qui
  démarre à 17:00 ou après, ou se termine à 09:00 ou avant (erreur) ;
- un léger débordement (début avant 09:00, ou fin après 17:00, sans que
  l'activité soit entièrement hors horaires) : **avertissement uniquement**,
  jamais un rejet automatique — conformément à la mission Lot 4A, section
  18. Aucun seuil de tolérance numérique n'est appliqué au-delà de cette
  règle : ne pas en inventer un.

## 5. Conflits de programmation

Conflit détecté si, pour deux activités : **même `date`** ET **même
`lieu`** (non vide) ET créneaux `[heure_debut, heure_fin)` qui se
chevauchent. Deux créneaux strictement **contigus** (ex. `10:00–10:30` puis
`10:30–11:00`) ne sont **pas** un conflit. Deux activités au même horaire
mais dans des lieux différents ne sont **pas** un conflit.

Une activité sans `lieu` ou sans `heure_fin` ne peut pas être comparée : le
pipeline le signale en avertissement et l'exclut du contrôle de conflit
(jamais d'exclusion silencieuse).

Un conflit détecté est une **erreur bloquante** : le message indique les
deux activités concernées (titre + créneau).

## 6. Intervenants

Colonne `intervenants` : plusieurs intervenants séparés par `|`, chacun au
format `nom;fonction;organisme` (`fonction` et `organisme` facultatifs) :

```
Jeanne Dupont;Chargée de recrutement;Exemple Structure|Marc Martin
```

Un bloc sans `nom` est rejeté (erreur bloquante).

## 7. Tri

Le pipeline **n'invente pas** de logique de tri : le tri d'affichage public
reste assuré par `trierProgramme()` (`src/lib/programme.ts`), déjà en place
et non modifié dans ce lot — date croissante, puis heure de début, puis
`ordre`, puis titre. L'ordre des lignes dans le CSV n'a aucune influence sur
l'ordre final affiché.

## 8. Dry-run, import réel, contrôle, tests

Mêmes commandes que le pipeline Exposants (voir
`docs/EXPOSANTS_IMPORT.md`, sections 9 à 12), transposées :

```bash
npm run programme:import -- data/templates/programme-import.csv --dry-run
npm run programme:import -- data/templates/programme-import.csv
npm run programme:check
npm run programme:test
```

## 9. Publication et build

`publie: non` garde l'entrée invisible sur le site (liste, filtres, adresse
individuelle) — voir `docs/PROGRAMME.md`, section 6. Après import :

```bash
npm run build
```
