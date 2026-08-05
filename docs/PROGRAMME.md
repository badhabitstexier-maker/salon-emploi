# Gérer le programme

Ce document explique comment ajouter, modifier, publier ou masquer un
élément du programme sur le site du Salon de l'Emploi & de la Formation
2026. Aucune compétence en programmation n'est nécessaire.

> Rappel (CLAUDE.md, section 2) : ne jamais inventer de conférence,
> d'atelier, de démonstration, d'intervenant, de salle ou d'horaire. Une
> entrée avec `publie: false` reste invisible sur le site — elle peut être
> préparée à l'avance sans risque.

## 1. Où créer une entrée

Chaque élément du programme est un fichier `.md` (Markdown) dans :

```
src/content/programme/
```

Un fichier = une entrée (une conférence, un atelier, une démonstration…).
Nommez le fichier en minuscules, sans accents ni espaces, avec des tirets —
ce nom devient l'adresse de la fiche (`/programme/nom-du-fichier`). Exemples :

```
src/content/programme/decouverte-metiers-maintenance.md
src/content/programme/rencontre-organismes-formation.md
```

## 2. Format du fichier

Le fichier commence et se termine par trois tirets (`---`) : c'est le
frontmatter, qui contient tous les champs. Rien n'est écrit après le second
`---`.

```markdown
---
titre: "Exemple non publié"
date: "2026-10-30"
heure_debut: "09:30"
heure_fin: "10:15"
univers: hall
type: conference
lieu: "Scène centrale"
accroche: "Une phrase courte qui donne envie de découvrir la fiche."
description: |
  Un paragraphe de présentation détaillée.

  On peut écrire plusieurs paragraphes en les séparant par une ligne vide,
  comme ici : ils s'afficheront comme des paragraphes distincts sur la fiche.
publics:
  - Demandeurs d'emploi
  - Lycéens
intervenants:
  - nom: "Exemple Intervenant"
    fonction: "Exemple de fonction"
    organisme: "Exemple d'organisme"
organisateur: "Exemple d'organisateur"
exposant_lie: nom-du-fichier-exposant
inscription_requise: false
lien_inscription: ""
capacite_limitee: false
mise_en_avant: false
publie: false
ordre: 10
date_mise_a_jour: 2026-08-05
---
```

## 3. Signification de chaque champ

| Champ | Obligatoire | Description |
|---|---|---|
| `titre` | oui | Titre affiché de l'élément de programme. |
| `slug` | non | Force l'adresse de la fiche si le nom du fichier ne convient pas (accents, renommage). Sinon, l'adresse vient automatiquement du nom du fichier. |
| `date` | oui | Journée concernée — voir les valeurs autorisées en section 4. |
| `heure_debut` | oui | Heure de début — voir le format en section 5. |
| `heure_fin` | non | Heure de fin — même format que `heure_debut`. |
| `univers` | oui | `hall`, `village` ou `transversal` — voir section 4. |
| `type` | oui | Voir les valeurs autorisées en section 4. |
| `lieu` | non | Emplacement au sein du salon, uniquement si un nom d'espace a été confirmé. |
| `accroche` | oui | Une phrase courte, affichée sur la carte de la liste. |
| `description` | oui | Contenu détaillé, affiché sur la fiche individuelle. |
| `publics` | non | Liste de publics concernés (voir section 6). |
| `intervenants` | non | Liste d'intervenants (voir section 7). |
| `organisateur` | non | Structure ou personne à l'origine de l'animation, si pertinent. |
| `exposant_lie` | non | Nom du fichier (identifiant) d'un exposant publié, pour lier l'animation à sa fiche (voir section 9). |
| `inscription_requise` | non (par défaut `false`) | Voir section 8. |
| `lien_inscription` | non | Voir section 8. |
| `capacite_limitee` | non (par défaut `false`) | Si `true`, une mention « Capacité limitée » est affichée. |
| `mise_en_avant` | non (par défaut `false`) | Si `true`, l'entrée reçoit un traitement visuel distinct (« Temps fort »), sans changer sa place dans l'ordre chronologique. |
| `publie` | non (par défaut `false`) | Si `false`, l'entrée n'apparaît nulle part sur le site public (voir section 6). |
| `ordre` | non | Nombre utilisé pour départager deux entrées à la même heure (voir section 10). |
| `date_mise_a_jour` | non | Date au format `AAAA-MM-JJ`, affichée en bas de la fiche. |

## 4. Valeurs autorisées

### `date`

- `"2026-10-30"` → vendredi 30 octobre 2026
- `"2026-10-31"` → samedi 31 octobre 2026

Écrivez toujours la valeur entre guillemets (`date: "2026-10-30"`). Sans les
guillemets, le format YAML interprète la valeur comme une date technique
plutôt que comme le texte attendu par le site, et le build échoue.

### `univers`

- `hall` → Hall Emploi & Formation
- `village` → Village Maintenance & Industrie
- `transversal` → commun aux deux univers

### `type`

- `conference`
- `atelier`
- `demonstration`
- `rencontre`
- `information`
- `autre`

Toute autre valeur (pour `date`, `univers` ou `type`) fait échouer le build
(`npm run build`) — c'est volontaire, pour éviter les fautes de frappe
silencieuses.

## 5. Format des heures

`heure_debut` et `heure_fin` doivent être écrites au format 24h `HH:MM`,
entre guillemets, par exemple `"09:30"` ou `"14:00"`. Un autre format fait
échouer le build.

## 6. Publier ou masquer une entrée

- `publie: false` → l'entrée n'apparaît ni dans la liste, ni dans le
  compteur, ni dans les filtres, et son adresse individuelle n'est même pas
  générée par le site (page introuvable, pas seulement cachée).
- `publie: true` → l'entrée devient visible publiquement dès le prochain
  build.

Utilisez `publie: false` pour préparer une entrée à l'avance, tant que le
contenu (horaire, intervenant, salle…) n'est pas confirmé.

## 7. Ajouter plusieurs publics

Le champ `publics` est une liste facultative. Ajoutez une ligne par public :

```yaml
publics:
  - Demandeurs d'emploi
  - Lycéens
  - Entreprises
```

Si le champ est absent ou vide, aucune mention de public n'apparaît — pas de
valeur par défaut inventée. Le filtre « Public » de la page `/programme`
n'apparaît que si au moins une entrée publiée renseigne ce champ.

## 8. Ajouter un ou plusieurs intervenants

Le champ `intervenants` est une liste facultative d'objets. Chaque
intervenant a un `nom` (obligatoire dans le bloc) et, s'ils sont connus, une
`fonction` et un `organisme` :

```yaml
intervenants:
  - nom: "Prénom Nom"
    fonction: "Intitulé du poste"
    organisme: "Nom de la structure"
  - nom: "Prénom Nom 2"
```

N'ajoutez un intervenant que si son identité et sa participation sont
confirmées — jamais de nom inventé ou approximatif.

## 9. Indiquer qu'une inscription est requise

- `inscription_requise: true` + `lien_inscription` renseigné → un bouton
  d'inscription externe s'affiche sur la fiche.
- `inscription_requise: true` sans `lien_inscription` → la fiche affiche
  seulement « Modalités d'inscription bientôt disponibles ».
- `inscription_requise: false` (valeur par défaut) → aucune mention
  d'inscription.

Aucun système d'inscription interne n'existe sur le site : `lien_inscription`
pointe toujours vers un site ou formulaire externe. Ne pas utiliser
Web3Forms pour les inscriptions au programme sans validation spécifique
(voir CLAUDE.md, section 4).

## 10. Lier une animation à un exposant

Si l'animation est portée par un exposant déjà publié
(`src/content/exposants/`), renseignez `exposant_lie` avec le nom de son
fichier (sans l'extension `.md`), par exemple :

```yaml
exposant_lie: adecal-technopole
```

Si l'exposant correspondant n'est pas publié (ou n'existe pas), le lien
n'est simplement pas affiché sur la fiche — aucun lien mort n'est généré.

## 11. Ordre d'affichage

Le tri du programme suit cette priorité :

1. la `date` (30 octobre avant 31 octobre) ;
2. à égalité, `heure_debut` (les entrées les plus tôt en premier) ;
3. à égalité, la valeur `ordre` la plus basse passe en premier ;
4. si `ordre` n'est pas renseigné, ou à égalité, le tri se fait par ordre
   alphabétique du `titre`.

`mise_en_avant: true` change uniquement l'apparence de la carte (mention
« Temps fort ») — cela ne modifie jamais l'ordre chronologique.

## 12. Vérifier le programme en local

```bash
npm run dev
```

Puis ouvrir :

- `http://localhost:4321/programme` pour voir l'entrée dans la liste et les
  filtres (si `publie: true`) ;
- `http://localhost:4321/programme/<nom-du-fichier>` pour voir la fiche
  individuelle.

Une entrée avec `publie: false` reste invisible sur ces deux pages : c'est
le comportement attendu, pas une erreur.

## 13. Lancer le build de vérification

Depuis la racine du projet :

```bash
npm run build
```

Le build échoue si un champ obligatoire manque, si `date`, `univers` ou
`type` contient une valeur non autorisée, ou si les heures ne respectent pas
le format `HH:MM`. Le message d'erreur indique le fichier et le champ en
cause.
