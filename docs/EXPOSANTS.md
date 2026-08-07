# Gérer les exposants

Ce document explique comment ajouter, modifier, publier ou masquer une fiche
exposant sur le site du Salon de l'Emploi & de la Formation 2026. Aucune
compétence en programmation n'est nécessaire.

> Rappel (CLAUDE.md, section 2 et 3) : ne jamais inventer d'exposant, ne
> jamais publier une entreprise ou une institution avant confirmation
> explicite de Philippe. Une fiche avec `publie: false` reste invisible sur
> le site — elle peut être préparée à l'avance sans risque.

## 1. Où créer une fiche

Chaque exposant est un fichier `.md` (Markdown) dans :

```
src/content/exposants/
```

Un fichier = un exposant. Nommez le fichier en minuscules, sans accents ni
espaces, avec des tirets — ce nom devient l'adresse de la fiche
(`/exposants/nom-du-fichier`). Exemples :

```
src/content/exposants/adecal-technopole.md
src/content/exposants/afpa-nouvelle-caledonie.md
```

## 2. Format du fichier

Le fichier commence et se termine par trois tirets (`---`) : c'est le
frontmatter, qui contient tous les champs. Rien n'est écrit après le second
`---`.

```markdown
---
exposantId: "EXP26-001"
nom: "Exemple non publié"
univers: emploi
type_structure: entreprise
secteurs:
  - Industrie
  - Maintenance
accroche: "Une phrase courte qui donne envie de découvrir la fiche."
description: |
  Un paragraphe de présentation détaillée.

  On peut écrire plusieurs paragraphes en les séparant par une ligne vide,
  comme ici : ils s'afficheront comme des paragraphes distincts sur la fiche.
logo: /images/exposants/exemple.svg
site_web: "https://exemple.nc"
numero_stand: "A12"
email_public: "contact@exemple.nc"
telephone_public: "+687 00.00.00"
mise_en_avant: false
publie: false
ordre: 10
date_mise_a_jour: 2026-08-05
---
```

## 3. Signification de chaque champ

| Champ | Obligatoire | Description |
|---|---|---|
| `exposantId` | oui | Identifiant métier stable, format `EXP26-XXX` (voir `docs/EXPOSANTS_IMPORT.md`, section 3). Ne jamais réutiliser un identifiant déjà attribué à un autre exposant. Pour une fiche créée à la main, choisir le prochain numéro disponible (voir `npm run exposants:check`). |
| `nom` | oui | Nom affiché de l'exposant. |
| `slug` | non | Force l'adresse de la fiche si le nom du fichier ne convient pas (accents, renommage). Sinon, l'adresse vient automatiquement du nom du fichier. |
| `univers` | oui | `emploi` ou `formation` (voir section 4). |
| `type_structure` | oui | Voir les valeurs autorisées en section 4. |
| `secteurs` | oui (peut être une liste vide) | Liste de secteurs ou domaines d'activité. |
| `accroche` | oui | Une phrase courte, affichée sur la carte de la liste. |
| `description` | oui | Contenu détaillé, affiché sur la fiche individuelle. |
| `logo` | non | Chemin de l'image du logo (voir section 5). |
| `site_web` | non | Adresse du site internet public de l'exposant. |
| `numero_stand` | non | Numéro de stand (voir section 7). |
| `email_public` | non | Adresse email destinée au grand public — jamais une adresse interne. |
| `telephone_public` | non | Numéro de téléphone destiné au grand public. |
| `mise_en_avant` | non (par défaut `false`) | Si `true`, l'exposant apparaît en premier dans la liste. |
| `publie` | non (par défaut `false`) | Si `false`, la fiche n'apparaît nulle part sur le site public (voir section 6). |
| `ordre` | non | Nombre utilisé pour trier les exposants entre eux (voir section 9). |
| `date_mise_a_jour` | non | Date au format `AAAA-MM-JJ`, affichée en bas de la fiche. |
| `metiers` | non | Liste de métiers présentés — n'est affichée que si elle est renseignée. |
| `formations` | non | Liste de formations proposées — idem. |
| `opportunites` | non | Liste d'opportunités (emplois, stages…) — idem. |
| `mots_cles` | non | Mots-clés utilisés uniquement pour améliorer la recherche interne du site — jamais affichés. |

## 4. Valeurs autorisées

### `univers`

- `emploi` → Hall Emploi
- `formation` → Hall Formation

### `type_structure`

- `entreprise`
- `organisme-formation`
- `institution`
- `accompagnement`
- `association`
- `autre`

Toute autre valeur fait échouer le build (`npm run build`) — c'est volontaire,
pour éviter les fautes de frappe silencieuses.

## 5. Ajouter un logo

1. Déposez le fichier image (SVG ou PNG de préférence, fond transparent) dans
   `public/images/exposants/`.
2. Renseignez le champ `logo` avec le chemin public correspondant, par
   exemple `/images/exposants/adecal-technopole.svg`.

Si `logo` n'est pas renseigné, un emplacement graphique neutre s'affiche
automatiquement à la place — jamais de logo inventé, jamais d'initiales
présentées comme une identité officielle.

## 6. Publier ou masquer une fiche

- `publie: false` → la fiche n'apparaît ni dans la liste, ni dans le
  compteur, ni dans les filtres, et son adresse individuelle n'est même pas
  générée par le site (page introuvable, pas seulement cachée).
- `publie: true` → la fiche devient visible publiquement dès le prochain
  build.

Utilisez `publie: false` pour préparer une fiche à l'avance, tant que
Philippe n'a pas confirmé nommément l'exposant.

## 7. Définir le numéro de stand

Renseignez `numero_stand` avec le numéro tel qu'il doit être affiché (texte
libre, ex. `"A12"`, `"V-03"`). Si le champ est absent, aucune mention de
stand n'apparaît sur la carte ni sur la fiche — pas de valeur par défaut
inventée.

## 8. Ajouter plusieurs secteurs

Le champ `secteurs` est une liste. Ajoutez une ligne par secteur :

```yaml
secteurs:
  - Industrie
  - Maintenance
  - Métallurgie
```

Ces valeurs alimentent aussi le filtre « Secteur » de la page `/exposants`.

## 9. Ordre d'affichage

Le tri de la liste suit cette priorité :

1. les fiches avec `mise_en_avant: true` passent en premier ;
2. à égalité, la valeur `ordre` la plus basse passe en premier (un exposant
   avec `ordre: 1` passe avant `ordre: 5`) ;
3. si `ordre` n'est pas renseigné, ou à égalité, le tri se fait par ordre
   alphabétique du nom.

`ordre` est donc facultatif : sans lui, le tri alphabétique suffit.

## 10. Lancer le build de vérification

Depuis la racine du projet :

```bash
npm run build
```

Le build échoue si un champ obligatoire manque, si `univers` ou
`type_structure` contient une valeur non autorisée, ou si `date_mise_a_jour`
n'est pas une date valide. Le message d'erreur indique le fichier et le champ
en cause.

## 11. Vérifier la fiche en local

```bash
npm run dev
```

Puis ouvrir :

- `http://localhost:4321/exposants` pour voir la fiche dans la liste (si
  `publie: true`) ;
- `http://localhost:4321/exposants/<nom-du-fichier>` pour voir la fiche
  individuelle.

Une fiche avec `publie: false` reste invisible sur ces deux pages : c'est le
comportement attendu, pas une erreur.
