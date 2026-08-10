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
| `formule` | oui | **Statut commercial de l'exposant** : `standard`, `silver` ou `gold` (voir section 12). Détermine à la fois le libellé public affiché, la catégorie de l'annuaire et les champs enrichis autorisés. |
| `secteurs` | oui (peut être une liste vide) | Liste de secteurs ou domaines d'activité. |
| `accroche` | oui | Présentation courte, affichée sur la carte et en tête de fiche. Longueur maximale selon le statut : 300 caractères (`standard`), 500 caractères (`silver`, `gold`) — voir section 12. |
| `description` | non | Présentation longue, affichée sur la fiche individuelle. **Réservée au statut Partenaire premium** (`formule: gold`) — le build échoue si elle est renseignée pour un autre statut. |
| `logo` | non | Chemin de l'image du logo (voir section 5). |
| `site_web` | non | Adresse du site internet public de l'exposant. |
| `numero_stand` | non | Numéro de stand (voir section 7). |
| `email_public` | non | Adresse email destinée au grand public — jamais une adresse interne. |
| `telephone_public` | non | Numéro de téléphone destiné au grand public. |
| `mise_en_avant` | non (par défaut `false`) | Champ conservé pour un usage éditorial futur (ex. mise en avant hors annuaire) — n'influence plus le classement de l'annuaire public `/exposants` depuis le Lot « exposants-statuts » (voir section 9). |
| `publie` | non (par défaut `false`) | Si `false`, la fiche n'apparaît nulle part sur le site public (voir section 6). |
| `ordre` | non | Nombre utilisé pour trier les exposants entre eux (voir section 9). |
| `date_mise_a_jour` | non | Date au format `AAAA-MM-JJ`, affichée en bas de la fiche. |
| `metiers` | non | Liste de métiers présentés — n'est affichée que si elle est renseignée. |
| `formations` | non | Liste de formations proposées — idem. |
| `opportunites` | non | Liste d'opportunités (emplois, stages…) — idem. |
| `mots_cles` | non | Mots-clés utilisés uniquement pour améliorer la recherche interne du site — jamais affichés. |
| `lien_recrutement` | non | Lien externe vers une page de recrutement. **Réservé aux statuts Exposant partenaire et Partenaire premium** (`formule: silver` ou `gold`) — voir section 12. |
| `reseaux_sociaux` | non | Liste de réseaux sociaux (`plateforme` + `url`, voir section 12). **Réservée aux statuts Exposant partenaire et Partenaire premium.** |
| `image_couverture` | non | Grande image de couverture affichée en tête de fiche. **Réservée au statut Partenaire premium** (`formule: gold`). |
| `galerie` | non | Liste d'images (`src` + `alt`, texte alternatif obligatoire). **Réservée au statut Partenaire premium.** |
| `demo` | non (par défaut `false`) | `true` pour une fiche de démonstration (voir section 13) : `noindex`, exclue du sitemap, mention « Fiche de démonstration » affichée. Ne jamais mettre `true` sur un exposant réel. |

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

L'annuaire public `/exposants` affiche trois catégories distinctes, dans cet
ordre fixe :

1. **Partenaires premium** (`formule: gold`)
2. **Exposants partenaires** (`formule: silver`)
3. **Exposants** (`formule: standard`)

À l'intérieur de chaque catégorie, le tri est **strictement alphabétique**
sur le nom (`nom`) — `mise_en_avant` et `ordre` n'interviennent pas dans cet
ordre : aucune priorité commerciale supplémentaire à l'intérieur d'une
catégorie. Une catégorie sans exposant publié n'apparaît pas.

Voir `src/lib/exposants.ts::regrouperParFormule`.

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

## 12. Statuts commerciaux (`formule`)

Le champ `formule` (partagé avec `offres.formule`, voir `docs/OFFRES.md`) EST
le statut commercial public de l'exposant. Trois valeurs, trois libellés
publics (`src/lib/exposants.ts::formulePubliqueLabels`) :

| `formule` | Libellé public | Quota d'offres indicatif |
|---|---|---|
| `standard` | Exposant | 5 offres maximum |
| `silver` | Exposant partenaire | 10 offres maximum |
| `gold` | Partenaire premium | Sans plafond prédéfini, sous validation LabEvents |

Le quota est purement indicatif (alerte interne dans l'Admin, jamais de
blocage) — voir `CAPACITE_OFFRES_PAR_FORMULE` dans `src/lib/exposants.ts`.

### Contenu autorisé par statut

| Contenu | Standard | Exposant partenaire | Partenaire premium |
|---|:---:|:---:|:---:|
| Présentation courte (`accroche`) | ≤ 300 caractères | ≤ 500 caractères | ≤ 500 caractères |
| Présentation longue (`description`) | non | non | oui |
| Lien de recrutement (`lien_recrutement`) | non | oui | oui |
| Réseaux sociaux (`reseaux_sociaux`) | non | oui | oui |
| Image de couverture (`image_couverture`) | non | non | oui |
| Galerie (`galerie`) | non | non | oui |

Cette réservation est appliquée par le schéma (`src/content.config.ts`, via
`superRefine`) : le build **échoue** si un champ est renseigné pour un statut
qui n'y a pas droit — ce n'est pas seulement une règle d'affichage. Le
pipeline CSV (`scripts/lib/exposants-import-core.mjs`) applique la même règle
dès la validation de ligne, avec un message d'erreur explicite avant même
d'arriver au build.

Un champ autorisé mais non renseigné ne produit jamais de bloc vide sur la
fiche publique — voir `src/pages/exposants/[slug].astro`.

### Réseaux sociaux (`reseaux_sociaux`)

Liste d'objets `plateforme` + `url`. Plateformes autorisées : `facebook`,
`instagram`, `linkedin`, `tiktok`, `youtube`, `autre`.

```yaml
reseaux_sociaux:
  - plateforme: "facebook"
    url: "https://facebook.com/exemple"
  - plateforme: "linkedin"
    url: "https://linkedin.com/company/exemple"
```

Dans un CSV d'import, la colonne `reseaux_sociaux` utilise le format
`plateforme:url`, plusieurs entrées séparées par `|` (même convention que
`secteurs`, `metiers`, etc.) : `facebook:https://…|linkedin:https://…`.

### Galerie (`galerie`)

Liste d'objets `src` + `alt` — le texte alternatif est **obligatoire** (le
build échoue sans lui). Mêmes contraintes que `logo` sur le chemin (public,
extension `svg`/`png`/`jpg`/`jpeg`/`webp`).

```yaml
galerie:
  - src: /images/exposants/exemple-g1.webp
    alt: "Vue du stand pendant le salon"
  - src: /images/exposants/exemple-g2.webp
    alt: "Équipe sur le stand"
```

Dans un CSV, la colonne `galerie` utilise le format `src::alt`, plusieurs
entrées séparées par `|`.

## 13. Fiches de démonstration (`demo`)

Six fiches de démonstration (1 Partenaire premium, 2 Exposants partenaires, 3
Exposants) vivent dans `src/content/exposants/demo-*.md`, avec le champ
`demo: true`. Elles illustrent aux futurs exposants ce que chaque statut
propose. Elles restent **publiques et visibles dans l'annuaire** (comme un
exposant réel), mais :

- portent la mention « Fiche de démonstration » sur la carte et la fiche ;
- affichent un bandeau « Entreprise fictive… » sur la fiche individuelle ;
- sont en `noindex, nofollow` (jamais indexées) ;
- sont exclues du sitemap (`astro.config.mjs`, lecture du champ `demo` sur
  disque, même mécanisme que les offres TEST).

La distinction TEST/RÉEL est portée par ce champ du modèle de données —
**jamais** par une liste de slugs codée en dur. Pour retirer les fiches de
démonstration une fois les exposants réels intégrés, il suffit de supprimer
les fichiers `src/content/exposants/demo-*.md` (et leurs offres TEST
associées dans `src/content/offres/`, référence `SEF26-006` à `SEF26-018`) :
aucune modification de code n'est nécessaire.

Chaque exposant démo a 2 ou 3 offres TEST rattachées (`docs/OFFRES.md`
section 3bis), **toutes `demo: true`** et **toutes affichées sur sa fiche**,
quelle que soit leur visibilité dans le catalogue. Pour ne pas saturer le
catalogue public `/offres` d'offres fictives, une seule offre représentative
par exposant y reste visible (`afficherCatalogue: true`) ; les autres
portent `afficherCatalogue: false` (voir `docs/OFFRES.md` section 4bis —
champ distinct de `demo`, qui ne pilote que le SEO) — toujours accessibles
par URL directe ou depuis la fiche exposant, jamais par une liste codée en
dur.

Ces six exposants fictifs ne représentent aucune entreprise réelle
calédonienne : noms, logos, coordonnées et visuels sont entièrement inventés
(voir `public/images/exposants/demo-*.svg`, placeholders SVG neutres).
