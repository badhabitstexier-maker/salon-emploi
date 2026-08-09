# Workflow des contenus 2026 — vue d'ensemble

Ce document résume les **trois pipelines d'import** de contenu du site (Lot
3 et Lot 4A) et l'ordre opérationnel commun. Il ne remplace pas la
documentation détaillée de chaque pipeline, qu'il renvoie systématiquement.

## Les trois pipelines

| Contenu | CSV → collection | Commande d'import | Documentation détaillée |
|---|---|---|---|
| Offres exposants | CSV → validation → Astro `offres` | `npm run offres:import` | `docs/WORKFLOW_OFFRES_2026.md`, `docs/OFFRES.md` |
| Exposants | CSV → validation → Astro `exposants` | `npm run exposants:import` | `docs/EXPOSANTS_IMPORT.md`, `docs/EXPOSANTS.md` |
| Programme | CSV → validation → Astro `programme` | `npm run programme:import` | `docs/PROGRAMME_IMPORT.md`, `docs/PROGRAMME.md` |

Les trois pipelines partagent la même ergonomie : parsing CSV sans
dépendance externe (`scripts/lib/csv.mjs`), validation puis dry-run avant
toute écriture, comportement tout ou rien en cas d'erreur bloquante,
idempotence sur un réimport identique, rapport CLI lisible (créés / mis à
jour / inchangés / ignorés / avertissements / erreurs).

## Ordre opérationnel commun

1. **Préparer le fichier** CSV à partir du modèle correspondant
   (`data/templates/*.csv`), avec des données réelles confirmées (jamais de
   contenu inventé — voir CLAUDE.md, section 8).
2. **Dry-run** : `npm run <contenu>:import -- fichier.csv --dry-run`.
   Aucun fichier n'est écrit.
3. **Corriger les erreurs** signalées, jusqu'à ce que le dry-run n'affiche
   plus d'erreur bloquante.
4. **Import réel** : `npm run <contenu>:import -- fichier.csv`.
5. **Build** : `npm run build` — doit réussir sans nouvelle erreur.
6. **Contrôle manuel en préproduction** après fusion et déploiement (voir
   CLAUDE.md, section 4, workflow de déploiement).

## Contrôles complémentaires (sans CSV)

```bash
npm run offres:check
npm run exposants:check
npm run programme:check
```

Vérifient l'état actuel de chaque collection (doublons, quotas/capacités,
conflits) sans nécessiter de fichier CSV.

## Contrôle des textes obsolètes

```bash
npm run content:check
```

Recherche, dans les sources qui alimentent réellement le site public
(`src/pages/`, `src/components/`, `src/layouts/`, `src/content/`), les
mentions obsolètes de l'édition actuelle : « Village Maintenance »,
« Village Maintenance & Industrie », « Maison des Artisans », « Maison de
l'Artisanat », « 40 emplacements », « 270 000 habitants ». Les valeurs de
référence actuelles sont **37 emplacements commercialisés**, **260 000
habitants**, **30 & 31 octobre 2026**, **9h–17h**, **Salle d'exposition de
Nouville — Nouméa**. Voir `scripts/check-public-content.mjs`.

## Commande groupée

```bash
npm run content:test
```

Enchaîne `offres:test`, `exposants:test`, `programme:test` puis
`content:check`. Ne remplace pas `npm run build`, à lancer séparément.

## Identifiants métier stables

Trois identifiants distincts, tous attribués automatiquement par leur
pipeline si laissés vides dans le CSV, et rapprochés d'une entrée existante
par correspondance naturelle (référence+intitulé pour les offres, slug pour
exposants et programme) pour garantir l'idempotence :

- `reference` (offres) — `SEF26-XXX`.
- `exposantId` (exposants) — `EXP26-XXX`. Introduit en Lot 4A. Depuis le Lot
  Admin-1C, c'est aussi le format obligatoire du champ `exposantId` sur
  chaque offre réelle (collection `offres`) : le rattachement offre ↔
  exposant est désormais vérifié automatiquement à l'import (voir
  `docs/EXPOSANTS_IMPORT.md` section 3bis et `docs/OFFRES.md` section 3bis).
- `programmeId` (programme) — `PROG26-XXX`. Introduit en Lot 4A.

## Halls et capacités (2026)

Hall Emploi : 21 stands. Hall Formation : 16 stands. Total : 37
emplacements commercialisés (CLAUDE.md, section 2, confirmé par Philippe le
06/08/2026). Le Village Maintenance & Industrie reste suspendu tant que le
partenariat AMD n'est pas confirmé — ne pas le réintroduire (voir
`npm run content:check`).

## Actions manuelles restantes

- `public/images/hall-formation.webp` : image actuellement absente
  (avertissement de build connu, volontairement non corrigé dans ce lot).
  À fournir ou valider par Philippe.
- Table officielle numéro de stand → hall : absente du dépôt. Le contrôle
  automatisé se limite aux capacités par hall, à l'unicité par hall et à
  l'exclusion des emplacements 22/23/24 (voir `docs/EXPOSANTS_IMPORT.md`,
  section 7). Un contrôle manuel reste nécessaire au-delà.

## Hors périmètre (couvert séparément par le Lot 4B)

Ces trois pipelines ne couvrent ni la recette E2E (Playwright), ni l'audit
SEO/accessibilité/performance automatisé, ni le JSON-LD, ni la CI : ce
périmètre est traité par le dispositif QA (Lots 4B-1 à 4B-4, **terminé**),
documenté dans CLAUDE.md section 13 plutôt que dans ce document consacré
aux trois pipelines d'import de contenu.
