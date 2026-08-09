# Procédure opérationnelle — offres exposants 2026

Objectif : qu'une personne LabEvents puisse reproduire l'opération complète,
de la confirmation d'un exposant à la publication de ses offres sur le
site, **sans connaître le code**. Chaque étape indique qui la fait et avec
quel outil.

Documents liés :
- `docs/OFFRES_EXPOSANTS.md` — structure du Google Form et du Google Sheet.
- `docs/OFFRES.md` — fonctionnement du catalogue publié (`/offres`).
- `docs/email-exposants-offres.md` — modèle d'email à envoyer aux exposants.
- `data/templates/offres-import.csv` — modèle du CSV normalisé.

**Date limite de déclaration exposant : 12 octobre 2026.**

---

## A. Exposant confirmé

Un exposant recruteur devient éligible à ce parcours dès que sa
participation est **confirmée** (contrat signé ou accord explicite) et sa
**formule commerciale connue** (`standard`, `silver`, `gold`).

## B. Création ou récupération de son identifiant exposant

L'`exposantId` (format `EXP26-XXX`, voir `docs/OFFRES_EXPOSANTS.md` section
5 et `docs/EXPOSANTS_IMPORT.md` section 3) provient de la fiche de
l'exposant dans la collection `exposants` — attribuée une seule fois par
`scripts/import-exposants.mjs`, jamais réattribuée, jamais inventée à la
volée au moment de la collecte des offres. Si l'exposant n'a pas encore de
fiche `exposants` (même `publie: non`), la créer d'abord (voir
`docs/EXPOSANTS_IMPORT.md`) : c'est elle qui fait foi pour l'identifiant.

## C. Génération du lien Google Forms personnalisé

Suivre `docs/OFFRES_EXPOSANTS.md`, section 3, « Procédure pour créer un
lien prérempli » : préremplir Entreprise + Identifiant exposant, copier le
lien généré.

## D. Envoi de l'email à l'exposant

Utiliser le modèle `docs/email-exposants-offres.md`, avec le lien
personnalisé de l'étape C. Rappeler la date limite du 12 octobre 2026.

## E. Réception des réponses dans Google Sheets

Les réponses arrivent automatiquement dans l'onglet de réponses du
formulaire. Chaque ligne = une réponse d'exposant, avec jusqu'à 10 blocs
d'offres en colonnes.

## F. Contrôle LabEvents

Pour chaque nouvelle réponse :

1. Vérifier que l'identifiant exposant et le nom d'entreprise déclarés
   correspondent à un exposant confirmé connu.
2. Vérifier que chaque offre déclarée est cohérente (intitulé compréhensible,
   type de contrat plausible, pas de doublon manifeste avec une déclaration
   précédente du même exposant).
3. Mettre à jour la colonne « Statut de traitement » :
   - `à compléter` si des informations manquent ou sont incohérentes (ne
     jamais inventer une donnée manquante) ;
   - `validée` une fois le contrôle passé.
4. Reporter la « Formule exposant » (`standard`/`silver`/`gold`) depuis le
   suivi commercial — jamais depuis une déclaration de l'exposant.

## G. Normalisation des offres

Pour chaque ligne de réponse au statut `validée`, transformer les blocs
« Offre 1 » à « Offre 10 » en **une ligne par offre** dans un fichier de
travail (tableur intermédiaire ou onglet dédié), en ignorant les blocs dont
l'intitulé est vide. Reporter les colonnes selon
`data/templates/offres-import.csv`. Ne reporter **aucune donnée de contact
RH** dans ce fichier de travail s'il doit être exporté en CSV (voir
`docs/OFFRES_EXPOSANTS.md`, section 9).

## H. Export CSV

Exporter le tableau normalisé de l'étape G au format `.csv` (UTF-8),
par exemple `exports/offres-2026-10-01.csv`. Ce fichier contient des
informations réelles sur des exposants confirmés : **ne jamais le committer
dans le dépôt Git** (voir section « Sécurité » ci-dessous et `.gitignore`).

## I. Import Astro — vérification (dry-run)

Depuis la racine du projet, avec Node.js installé :

```bash
npm run offres:import -- exports/offres-2026-10-01.csv --dry-run
```

Ce mode n'écrit **aucun fichier**. Il affiche :
- le nombre de lignes lues, d'offres valides, ignorées, en erreur ;
- les références automatiquement assignées (voir `docs/OFFRES_EXPOSANTS.md`
  sur les identifiants) ;
- les avertissements (quotas Gold à surveiller, colonnes inconnues…) ;
- les erreurs bloquantes (quota dépassé, référence invalide, entreprise
  absente…) — **si une seule erreur bloquante existe, rien ne sera écrit au
  prochain import réel.**

Corriger le fichier normalisé (étape G) tant que des erreurs bloquantes
apparaissent, puis relancer le dry-run.

## J. Import Astro — écriture réelle

Une fois le dry-run sans erreur bloquante :

```bash
npm run offres:import -- exports/offres-2026-10-01.csv
```

Les fichiers sont écrits dans `src/content/offres/`. L'import est **tout ou
rien** : si une erreur bloquante subsiste, aucun fichier n'est modifié.
Réimporter le même CSV une deuxième fois est sans risque : les offres déjà
identiques restent inchangées (voir mécanisme d'idempotence dans
`scripts/lib/offres-import-core.mjs`).

Pour vérifier l'état de la collection à tout moment (doublons, quotas), sans
CSV :

```bash
npm run offres:check
```

## K. `npm run build`

```bash
npm run build
```

Le build doit réussir sans erreur. Il échoue si un fichier généré ne
respecte pas le schéma `offres` (`src/content.config.ts`) — signe d'une
anomalie à signaler.

## L. Contrôle visuel

```bash
npm run dev
```

Puis ouvrir `http://localhost:4321/offres` : vérifier que les nouvelles
offres au statut `publiee` apparaissent, que les filtres fonctionnent, et
qu'aucune offre à un autre statut n'est visible.

## M. Commit / PR / déploiement

1. `git status` — vérifier qu'aucun fichier sensible (export CSV, données de
   contact) n'est sur le point d'être ajouté.
2. `git add src/content/offres/` (uniquement les fichiers d'offres générés).
3. `git commit` avec un message explicite (ex. « offres : import batch du
   1er octobre 2026 »).
4. Ouvrir une Pull Request vers `main` (voir CLAUDE.md, section 11) — le
   contrôle automatique de build doit passer avant fusion.
5. Après fusion, le déploiement en préproduction est automatique (voir
   CLAUDE.md, section 4). Le passage en production reste manuel.

---

## Sécurité et confidentialité — rappels

- Ne jamais committer un export Google Forms/Sheets brut, une adresse email
  personnelle, un numéro de téléphone RH, un secret ou un identifiant Google.
- Le dossier `exports/` (ou tout dossier utilisé pour les fichiers CSV
  réels) doit rester hors du dépôt — voir `.gitignore`.
- Seuls les fichiers `.md` générés dans `src/content/offres/` (qui ne
  contiennent aucune donnée de contact RH, par construction du schéma) sont
  destinés à être committés.
