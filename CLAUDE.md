# CLAUDE.md — Site du Salon de l'Emploi & de la Formation 2026

> Constitution du projet pour Claude Code. À lire au début de **chaque** session.
> Objectif de ce fichier : garder le cap, éviter le sur-engineering, refléter l'état réel du projet.
> v4 — 08/08/2026. Mise à jour de fond après clôture du chantier Offres (pipeline d'import,
> sécurisation/diversification des offres TEST) et avant l'ouverture du chantier Administration.
> Corrige plusieurs décalages entre la v3 et l'état réel du dépôt (arborescence, stack, statut QA) —
> voir la section 7 pour le détail lot par lot.

---

## 1. Projet en une phrase

Site vitrine événementiel pour le **Salon de l'Emploi & de la Formation 2026**, organisé par **LabEvents** à Nouméa (Nouvelle-Calédonie). Deux fonctions, dans cet ordre de priorité :

1. **V1 — commercialiser les stands** auprès des entreprises, organismes de formation et partenaires.
2. **V2 — informer le public** (exposants, programme, infos pratiques, offres d'emploi).

Le site doit être **réutilisable pour les éditions futures**.

---

## 2. Faits fixes de l'événement (ne jamais inventer, ne jamais modifier sans instruction)

- **Dates** : 30 et 31 octobre 2026.
- **Lieu** : Salle d'exposition de Nouville, Nouméa.
- **Entrée** : libre et gratuite.
- **Fréquentation cible** : ~3 000 visiteurs sur les deux jours.
- **Deux univers (configuration provisoire au 06/08/2026)** :
  - **Hall Emploi** — entreprises qui recrutent, organismes de formation, acteurs de l'accompagnement.
  - **Hall Formation** — organismes de formation, orientation, découverte des parcours.
  - ⚠️ Le **Village Maintenance & Industrie** est **suspendu** tant que le partenariat AMD n'est pas confirmé. Ne pas le mentionner sur le site ni dans les documents tant que Philippe n'a pas donné son feu vert explicite. La route `/village` existe uniquement comme **redirection technique** vers `/le-salon` (liens déjà partagés/indexés) — ce n'est plus une page de contenu. Quand l'AMD sera confirmée, les deux halls fusionneront avec le Village dans une configuration à trois univers.
- **Emplacements commercialisés : 37** (configuration provisoire incluant les espaces potentiellement liés à l'AMD). À réviser si l'AMD confirme sa participation et revendique une partie des emplacements.

---

## 3. Logos et preuve sociale — clause de prudence (IMPORTANT)

**Aucun logo de partenaire, sponsor ou entreprise ne doit apparaître sur le site tant que le partenariat n'est pas confirmé nommément par Philippe.**

- Les logos vus dans le mockup de design (ENGIE, ADECAL, Afpa, Aircalin) sont **illustratifs uniquement** — aucun n'est confirmé à ce stade. Ne pas les reproduire dans le code.
- Reproduire une marque déposée sans accord d'usage est un risque, indépendamment du statut du partenariat.
- En attendant une liste confirmée : soit masquer la section "Ils seront présents" en V1, soit utiliser des placeholders neutres (silhouettes grises, texte "Logo partenaire à venir").
- Dès que Philippe fournit une liste confirmée avec logos fournis, l'intégrer dans un lot dédié.

---

## 3bis. Domaine

**Nom de domaine validé (04/08/2026) : `salonemploi.nc`.** URL canonique : `https://www.salonemploi.nc` (voir note technique section 4 sur la cohérence www/apex). Le site n'est plus hébergé en sous-domaine de nounou.nc — ce nom de domaine est définitif dès la V1.

**Fournisseurs de formulaires retenus :**
- **Web3Forms** (04/08/2026) — contact commercial exposant/visiteur sur `/exposer`. Choisi pour son quota gratuit plus généreux, l'absence de branding sur les emails, et une meilleure adéquation à un usage en pic ponctuel (période de commercialisation des stands) plutôt qu'un flux régulier.
- **Tally** — formulaire de candidature sur `/candidater` (visiteur qui postule à sa sélection d'offres). Voir `docs/CANDIDATURES_TALLY.md` pour le fonctionnement complet et la règle de conservation des données candidat (jusqu'au 31 décembre 2026).

Les deux coexistent : Web3Forms pour la prise de contact commerciale, Tally pour la candidature aux offres. Aucun des deux n'implique de base de données côté site.

---

## 4. Stack technique (état réel au 08/08/2026)

- **Astro 7**, sortie **statique** (`output: 'static'`).
- **Tailwind CSS v4** pour le style, via le plugin officiel `@tailwindcss/vite` (`@astrojs/tailwind` est dépréciée pour Tailwind v4, ne pas la réintroduire). Configuration **CSS-first** : les tokens vivent dans `src/styles/global.css` via la directive `@theme`, pas dans un fichier `tailwind.config.js`.
- **Pas de React.** La décision initiale (« React en îlots ») n'a pas été retenue à l'usage : `package.json` ne déclare aucune dépendance React. Les briques interactives (filtre exposants, filtre programme, filtre offres, sélection d'offres) sont implémentées en **Astro + JavaScript vanilla** (`<script>` par composant, ex. `src/lib/selection-ui.ts`, `src/components/OffreFilters.astro`). Ne pas introduire React sans décision explicite — ce serait une dépendance nouvelle et non alignée sur l'existant.
- **Formulaires** : Web3Forms (contact commercial) + Tally (candidature) — voir section 3bis. **Pas de Supabase, pas de base de données côté site public.**
- **Contenus dynamiques** : **Astro Content Collections**, définies dans `src/content.config.ts` — trois collections actives : `offres`, `exposants`, `programme`. Chacune a son propre pipeline d'import CSV → Markdown (voir section 11 pour `offres` ; `docs/EXPOSANTS_IMPORT.md` et `docs/PROGRAMME_IMPORT.md` pour les deux autres). `exposants` et `programme` ont leur schéma et leur pipeline prêts mais **sont vides à ce jour** (aucune donnée réelle importée) — seule `offres` contient du contenu (5 offres TEST, voir section 12).
- **CMS d'édition** : aucun aujourd'hui (édition à la main des fichiers de contenu, ou import CSV). Keystatic reste une **piste évoquée, pas une décision ferme** — voir section 15.
- **Node** : 20 LTS ou 22 (les workflows CI utilisent Node 22 — Node 20 posait un problème avec Astro 7, voir historique).
- **Hébergement** : OVH, en fichiers statiques (transfert FTP de `dist/`), automatisé par CI (voir ci-dessous). Préproduction en ligne : `https://preprod.salonemploinc.com`.
- **Environnement de prévisualisation** : chaque lot produit une version consultable en préprod sans toucher à la production.

**Workflow de déploiement (en place et vérifié en fonctionnement) :**
1. Développement sur une branche dédiée, PR ouverte vers `main`.
2. Contrôle automatique (`.github/workflows/pr-check.yml`) : `npm run build` doit réussir sur la PR — fusion bloquée sinon (protection de branche sur `main`).
3. Fusion une fois le contrôle vert, sans attendre de recette visuelle préalable.
4. La fusion sur `main` déclenche **automatiquement** `.github/workflows/deploy-preprod.yml` (build + FTP vers OVH). Délai observé entre fusion et site à jour : de l'ordre de la minute.
5. Recette visuelle **après** la fusion, sur `https://preprod.salonemploinc.com`.
6. Problème détecté : nouvelle branche de correctif, même cycle.
7. Après chaque fusion, mettre le dépôt local à jour (`git switch main && git pull origin main`).
8. Passage en production **strictement manuel** : déclenchement de `.github/workflows/deploy-production.yml` depuis l'onglet Actions.

⚠️ **Piège vérifié en pratique (08/08/2026)** : une Pull Request peut être fusionnée par Philippe **avant** qu'une session Claude Code n'ait fini de pousser tous ses commits sur la branche (fusion en squash notamment). Un commit poussé après la fusion n'est **pas** automatiquement inclus dans `main`, même s'il atterrit sur une branche du même nom (GitHub la recrée si elle avait été supprimée après fusion). **Avant d'affirmer qu'un commit est en production/préproduction, toujours vérifier directement sur le dépôt distant** (`git fetch origin main`, comparer les SHA, ou interroger l'état de la PR) plutôt que de supposer qu'un `git push` réussi suffit.

Les secrets (clé Web3Forms, `PUBLIC_TALLY_CANDIDATURE_URL`, identifiants FTP, `PUBLIC_SITE_URL`, `PUBLIC_NOINDEX`) vivent exclusivement dans les environnements GitHub `preprod` et `production` (Settings → Environments) — jamais dans le code, un commit, ou un fichier de documentation.

- **Versionnement** : Git, un commit propre après chaque lot ; PR systématique (voir section 16).

### Ce qu'on NE fait PAS (garde-fous anti-usine-à-gaz)
- Pas de base de données pour le **site public** V1/V2.
- Pas de Next.js, pas de rendu côté serveur pour le site public.
- Pas de dépendances lourdes non justifiées (ex. React tant qu'aucune brique ne le justifie réellement).
- On ne code pas au-delà du lot en cours.
- ~~Pas de back-office custom en V1~~ — clause assouplie le 08/08/2026, voir section 14 : un module d'administration LabEvents peut désormais être **étudié** (architecture d'abord, pas de code avant validation).

---

## 5. Charte graphique (design tokens)

Valeurs de départ **à confirmer par Philippe** — définies comme tokens dans `src/styles/global.css` (directive `@theme`, Tailwind v4), jamais en valeurs arbitraires dans les composants.

| Rôle | Token | Valeur de départ (à confirmer) |
|---|---|---|
| Structure / marine | `marine` | `#10233F` |
| Fond clair / blanc | `blanc` | `#FFFFFF` |
| Fond secondaire | `brume` | `#F5F7FA` |
| CTA / accent | `orange` | `#F26A2A` |
| Univers Village | `village` | `#2FA36B` (alt. jaune-vert `#7AB648`) |
| Texte principal | `encre` | `#1A2233` |

Principes visuels : **mobile-first**, grands titres, interface claire et aérée, photos de personnes et de gestes professionnels concrets. **Distinction visuelle nette** entre Hall Emploi-Formation (marine/orange) et Village Maintenance & Industrie (accent `village`, actuellement inutilisé tant que le Village est suspendu).

**Typographie** : Barlow Condensed, **auto-hébergée** (`public/fonts/`, pas de CDN tiers), sur les titres au minimum.

Le mockup de direction artistique fourni par Philippe (aperçu des 7 pages initiales) sert de **référence d'inspiration**, pas de gabarit pixel pour pixel. Il ne remplace pas les tokens ci-dessus.

**Référence graphique principale : `public/references/preview-pages-site.png`.** Pour la page d'accueil, la vignette « 1. ACCUEIL » reste la référence prioritaire (densité visuelle, composition, rapport texte/image, hiérarchie, blocs colorés, caractère événementiel — pas une reproduction pixel par pixel).

---

## 6. Arborescence & structure des fichiers (état réel au 08/08/2026)

La V1 a été cadrée à 7 pages commerciales ; le site en compte aujourd'hui davantage, avec l'ajout du dispositif « Offres et candidatures » (voir section 11). Liste réelle des routes, à partir de `src/pages/` :

**Pages commerciales / vitrine (périmètre V1 initial) :**
- `/` — Accueil (`index.astro`)
- `/le-salon` — Le salon (`le-salon.astro`)
- `/exposants` — Liste des exposants avec filtres (`exposants.astro`) + `/exposants/[slug]` — fiche exposant
- `/programme` — Programme avec filtres (`programme.astro`) + `/programme/[slug]` — fiche activité
- `/preparer-ma-visite` — Préparer ma visite (`preparer-ma-visite.astro`)
- `/exposer` — Exposer / Contact commercial (`exposer.astro`)
- `/village` — **redirection technique** vers `/le-salon` (pas une page de contenu, voir section 2)

**Dispositif Offres et candidatures (ajouté après la V1 initiale, voir section 11) :**
- `/offres` — Catalogue des offres avec filtres et sélection (`offres/index.astro`)
- `/offres/[slug]` — Fiche offre détaillée
- `/ma-selection` — Récapitulatif de la sélection (0 à 5 offres, portée par l'URL)
- `/candidater` — Formulaire de candidature (embed Tally)

**Pages hors arborescence commerciale (pied de page uniquement) :**
- `/mentions-legales`
- `/confidentialite`
- `/merci` — page de confirmation générique (formulaires Web3Forms)

Structure réelle du code :
```
src/
  layouts/      → BaseLayout.astro (nav + footer + <head> SEO via Seo.astro)
  components/   → composants réutilisables : Header, Footer, Seo, Visuel,
                  ExposantCard/ProgrammeCard/OffreCard, OffreFilters,
                  OffreSelection, SelectionDrawer, TallyCandidatureEmbed
  content.config.ts → schémas des 3 Content Collections (offres, exposants, programme)
  content/      → offres/ (5 fiches TEST), exposants/ (vide), programme/ (vide)
  lib/          → logique pure : offres.ts, exposants.ts, programme.ts,
                  candidature-selection.ts, selection-ui.ts
  pages/        → toutes les routes listées ci-dessus
  styles/       → global.css (tokens Tailwind v4)
scripts/        → pipelines d'import CSV (offres, exposants, programme) + tests unitaires
data/templates/ → modèles CSV pour chaque pipeline
docs/           → documentation détaillée par sujet (voir sections 11 et 13)
public/         → images, polices, favicon, logos, dossier exposant PDF
```

---

## 7. Priorité V1 (l'ordre des lots) — statut réel au 08/08/2026

Un lot n'est considéré **terminé** que si tous ses critères sont cochés et que le dépôt le confirme. Ne pas déclarer un lot fini sur la base d'une intention ou d'un commit poussé — vérifier sur `main` distant (voir avertissement section 4).

### Lots V1 « vitrine » (Lot 0 à 6) — **terminés**
Fondations, Accueil, Exposer/Contact, Le salon (Village suspendu conformément à la section 2), Exposants, Programme, Préparer ma visite. Les 7 pages initiales existent, contiennent du contenu réel, le build passe, la CI est en place. Les collections `exposants` et `programme` ont leur pipeline d'import prêt (`docs/EXPOSANTS_IMPORT.md`, `docs/PROGRAMME_IMPORT.md`) mais **restent vides de données réelles** à ce jour.

### Lot 7 — CMS d'édition (Keystatic)
**Non commencé, non engagé.** Voir section 15 — reformulé en piste éventuelle plutôt qu'en décision ferme.

### Dispositif « Offres et candidatures » — numérotation propre, ajoutée après la V1 initiale
Documentée en détail dans `docs/OFFRES.md`, `docs/CANDIDATURES_TALLY.md`, `docs/WORKFLOW_OFFRES_2026.md`, `docs/OFFRES_EXPOSANTS.md`, `docs/WORKFLOW_CONTENUS_2026.md`.

- **Lot 1 — Catalogue des offres et sélection** : **terminé**. `/offres`, `/offres/[slug]`, sélection 0-5 par paramètres d'URL (`offre1`..`offre5`), `/ma-selection`.
- **Lot 2 — Candidature (Tally)** : **terminé**. `/candidater`, embed Tally, dispatch de la sélection.
- **Lot 3 — Import automatisé des offres** : **terminé**. Pipeline CSV → collection `offres` (voir section 11).
- **Lot 4A — Import exposants et programme** : **terminé** côté pipeline (`scripts/import-exposants.mjs`, `scripts/import-programme.mjs`) ; collections toujours vides de données réelles.
- **Lot 4B — QA (E2E, accessibilité, SEO automatisé, CI)** : **non commencé**. Voir section 13 — ne pas le déclarer fait sans vérification.

### Offres TEST (démonstration)
5 offres fictives (`SEF26-001` à `SEF26-005`) publiées sur `/offres` à des fins de démonstration visuelle du catalogue, avec sécurisation SEO/UI dédiée. Voir section 12 — ne pas les compter comme un « Lot » à part, ni comme de vraies données exposant.

---

## 8. Contenus — règle d'intégration

**À partir du Lot 1**, les contenus validés fournis par Philippe (ou préparés via ChatGPT) doivent être **intégrés directement**, pas laissés en placeholder par défaut. Un placeholder `{{À COMPLÉTER : …}}` n'est utilisé que lorsqu'une donnée factuelle manque réellement — jamais comme choix par défaut de prudence.

Cette règle s'applique aussi aux imports CSV (offres, exposants, programme) : ne jamais inventer une donnée absente du fichier source pour « compléter » un import.

---

## 9. SEO (important : événement daté)

- Chaque page : `<title>` et meta description uniques et pertinents.
- Mots-clés cibles : « salon emploi formation Nouméa », « salon Nouville octobre 2026 », « emploi formation Nouvelle-Calédonie ».
- Données structurées **schema.org/Event** sur l'accueil (nom, dates, lieu, gratuité) et **schema.org/JobPosting** sur chaque fiche offre réelle (`/offres/[slug]`) — **sauf** les offres TEST, volontairement exclues (voir section 12).
- `sitemap` + `robots.txt` générés (`astro.config.mjs`) ; le sitemap exclut aussi les fiches offres TEST.
- Balises Open Graph pour le partage réseaux sociaux.
- Images optimisées (`astro:assets` / composant `Visuel.astro`), attribut `alt` systématique.

---

## 10. Conventions de code

- Composants nommés en PascalCase, un fichier par composant.
- Couleurs et espacements via tokens Tailwind, **jamais** de hex en dur dans le markup.
- Accessibilité : structure sémantique (`header`, `main`, `nav`, `footer`), contrastes suffisants, navigation clavier.
- Responsive systématique, pensé mobile d'abord.
- Textes en **français**.
- **Contraste sur fond `village` (vert)** : le corps de texte doit être en `encre`/`marine`, jamais en blanc — le blanc sur `village` tombe sous le seuil d'accessibilité (testé à 3,2:1, sous le minimum WCAG AA de 4,5:1). Le blanc reste acceptable uniquement pour de grands titres à fort corps.

---

## 11. Pipeline Offres 2026 — source de vérité

Le fonctionnement ci-dessous est **validé et en fonctionnement**. `scripts/import-offres.mjs` et `scripts/lib/offres-import-core.mjs` sont la **source de vérité** du pipeline d'import des offres : **ne jamais créer un second mécanisme parallèle** pour importer ou publier des offres. Toute évolution du format passe par ces fichiers et par le schéma `offres` de `src/content.config.ts`.

**Chaîne opérationnelle complète :**
1. **Collecte exposants** via un Google Form (structure décrite dans `docs/OFFRES_EXPOSANTS.md`).
2. **Centralisation** des réponses dans un Google Sheet.
3. **Normalisation** : un Apps Script (ou une procédure équivalente) transforme les réponses du formulaire en **une ligne par offre** dans l'onglet `OFFRES` du Sheet (jamais plusieurs offres par ligne).
4. **Pilotage LabEvents** dans l'onglet `OFFRES` : validation, correction, statut de traitement — c'est l'interface de travail humaine, pas une donnée destinée telle quelle au site.
5. **Génération de `EXPORT_SITE`** : un onglet dérivé de `OFFRES` (formules Google Sheets), qui produit exactement les colonnes attendues par l'import, dans l'ordre attendu (voir `data/templates/offres-import.csv`).
6. **Export CSV** depuis `EXPORT_SITE`.
7. **Contrôle obligatoire avant toute écriture** :
   ```bash
   npm run offres:import -- <fichier.csv> --dry-run
   ```
   Ne jamais sauter cette étape sur un CSV qui touche des données réelles ou qui vient d'être régénéré/modifié.
8. **Import réel uniquement après validation du dry-run** (0 erreur bloquante) :
   ```bash
   npm run offres:import -- <fichier.csv>
   ```
9. **Contrôle de la collection sans CSV** : `npm run offres:check` (doublons, quotas).
10. **Build** : `npm run build` doit réussir avant toute PR.

**Identifiants :**
- Référence **publique**, celle du site : `SEF26-NNN`, attribuée automatiquement par le pipeline (jamais saisie à la main dans le Sheet en amont).
- Identifiant **interne** de suivi côté Sheet (ex. `EXP26-xxx-xx`) : reste dans Google Sheets, n'est **jamais** la référence publique du site.
- **Après le premier import réel d'une offre**, reporter la référence `SEF26-NNN` attribuée dans le Sheet (colonne dédiée), pour que les réimports suivants la retrouvent de façon fiable plutôt que de recréer une offre en double. Sans ce report, deux offres du même exposant ayant un intitulé identique peuvent être mal rapprochées lors d'un réimport (voir `scripts/lib/offres-import-core.mjs`, fonction `rapprocherReferencesExistantes`).

### Workflow de statuts (`status`)

Six valeurs, définies dans `src/content.config.ts` et `scripts/lib/offres-import-core.mjs` : `recue`, `a-completer`, `validee`, `publiee`, `retiree`, `cloturee`.

**Seul `publiee` rend une offre visible sur `/offres` et `/offres/[slug]`.** Les autres statuts existent pour suivre le circuit de validation interne, sans impact sur le site public.

### Quotas par formule

Le nombre d'offres actives (statuts `recue`/`a-completer`/`validee`/`publiee`) par exposant dépend de sa formule commerciale : `standard` (5), `silver` (10), `gold` (illimité, avec avertissement au-delà de 10). Contrôlé automatiquement par `verifierQuotas()` à l'import.

### Données internes — jamais publiées ni committées

Ces données peuvent être conservées dans le Google Sheet LabEvents mais **ne doivent jamais apparaître dans les contenus publics du dépôt** (fichiers `src/content/offres/*.md`) :
- Rémunération.
- Coordonnées du contact recrutement (nom, email, téléphone).
- Temps de travail — tant que le schéma public (`src/content.config.ts`) ne prévoit pas ce champ. L'ajouter serait une évolution de schéma à traiter dans un lot dédié, pas une extension silencieuse.
- Toute autre note interne LabEvents (statut de traitement, historique, etc.).

Le pipeline d'import tolère certaines de ces colonnes si elles apparaissent dans un export Sheets (`COLONNES_INTERNES_IGNOREES` dans `scripts/lib/offres-import-core.mjs`) mais ne les écrit jamais dans les fichiers générés.

---

## 12. Offres de démonstration (« TEST »)

Règle implémentée et vérifiée en production (08/08/2026) : toute offre dont l'**intitulé commence exactement par `TEST —`** (voir `estOffreTest()` dans `src/lib/offres.ts`) est traitée comme une offre fictive de démonstration :

- Reste **visible normalement** dans le catalogue `/offres` et accessible par son URL — l'objectif est de démontrer le fonctionnement du catalogue, pas de la cacher.
- **Aucun bouton de candidature ni d'ajout à la sélection** (`accepteCandidaturesEnLigne: false` sur ces fiches, et bouton masqué sur les cartes du catalogue).
- Message dédié sur la fiche détail : « Offre fictive de démonstration — présentée uniquement pour illustrer le fonctionnement du catalogue. »
- `<meta name="robots" content="noindex, nofollow">` forcé sur la fiche, indépendamment du réglage global de préproduction.
- **Aucun JSON-LD `JobPosting`** généré pour ces fiches.
- **Exclues du sitemap** (`astro.config.mjs`, filtre basé sur le frontmatter des fichiers Markdown).

**Ne jamais généraliser cette règle aux offres réelles.** Le seul déclencheur est le préfixe exact `TEST —` dans `intitule` ; une vraie offre exposant ne doit jamais commencer ainsi.

État actuel : 5 offres (`SEF26-001` à `SEF26-005`), exposant fictif `Entreprise Test NC`, métiers diversifiés (maintenance, commerce/relation client, administratif, informatique, production).

---

## 13. QA / Lot 4B — état réel (à ne pas survendre)

**Non implémenté à ce jour.** Vérifié dans le dépôt le 08/08/2026 :
- Aucune dépendance Playwright dans `package.json`.
- Aucun script `npm run qa`.
- Aucun audit accessibilité/SEO/performance automatisé.
- `docs/WORKFLOW_CONTENUS_2026.md` confirme explicitement : « Ces trois pipelines ne couvrent ni la recette E2E (Playwright), ni l'audit SEO/accessibilité/performance automatisé, ni le JSON-LD, ni la CI [...] — traité séparément dans le Lot 4B ».

Ce qui existe réellement comme filet de sécurité aujourd'hui :
- `npm run build` (bloquant en CI via `pr-check.yml`).
- `npm run content:check` (recherche de mentions obsolètes dans les sources publiques).
- `npm run offres:test` / `exposants:test` / `programme:test` (tests unitaires Node natifs sur la logique pure des pipelines d'import).
- `npm run offres:check` / `exposants:check` / `programme:check` (contrôle des collections sans CSV).

**Ne jamais déclarer le Lot 4B « fusionné » ou « terminé » sans vérification directe sur `main`** (voir avertissement section 4 sur les fusions en squash).

---

## 14. Administration LabEvents — chantier à l'étude (décision du 08/08/2026)

La clause précédente « Pas de back-office custom en V1 » était trop absolue et bloque à tort ce chantier. Nouvelle décision, plus précise :

- Un **module d'administration réservé à LabEvents** peut désormais être **étudié**, dans un lot dédié.
- **Aucun développement avant qu'une proposition d'architecture n'ait été produite et validée**, portant notamment sur :
  - l'authentification (qui y accède, comment) ;
  - la source des données (le module ne doit pas partir du principe qu'il faut remplacer Google Sheets tout de suite) ;
  - les conséquences du caractère **statique** du site Astro actuel (un module d'administration implique très probablement une brique différente du site public statique — à documenter, pas à trancher par défaut).
- **Ne pas décider par avance** qu'une base de données, un CMS ou du SSR est nécessaire : ce choix doit ressortir de l'étude d'architecture, pas être posé en prérequis.
- **Première cible envisagée** (à confirmer lors de l'étude) : tableau de bord, consultation des exposants, consultation des offres, recherche/filtres, statuts et indicateurs, fiches détail, éventuellement une assistance aux opérations de publication/import déjà existantes (section 11) — **jamais un second pipeline parallèle**.
- **Hors périmètre pour cette première étape** : gestion des candidatures, CVthèque, comptes exposants, remplacement immédiat du Google Sheet, nouvelle base de données sans justification explicite dans l'étude d'architecture.
- Le pipeline Google Forms / Google Sheets / import CSV existant (section 11) reste la référence tant qu'une décision explicite n'en dispose pas autrement.

---

## 15. CMS / Keystatic — piste éventuelle, pas un engagement

La version précédente de ce document présentait Keystatic comme un choix acté pour un « Lot 7 ». Au 08/08/2026, ce n'est **plus une décision ferme** : aucun travail n'a commencé, et le chantier Administration (section 14) pourrait couvrir tout ou partie du besoin d'édition sans passer par un CMS dédié. Keystatic reste une **piste à évaluer**, pas un engagement technique — ne pas l'intégrer ni la présupposer sans nouvelle décision explicite, et ne pas la présenter comme acquise dans un futur compte rendu.

---

## 16. Méthode de travail (discipline quota)

- **Une tâche par session**, cadrée petit — un lot à la fois.
- `git commit` propre à la fin de chaque lot, message explicite.
- `/clear` entre deux lots, `/compact` si la session s'allonge.
- **Sonnet par défaut.** Opus réservé à l'architecture initiale ou aux blocages difficiles réels et identifiés. Haiku possible pour les tâches répétitives (reformatage de données).
- **Pull Request automatique** : à la fin de chaque lot, après le commit et le push, ouvrir systématiquement une Pull Request vers `main` sans attendre que Philippe le demande. Ne pas fusionner soi-même — la fusion reste une décision de Philippe.
- **Avant de proposer une nouvelle architecture ou un nouveau mécanisme, inspecter le pipeline et les documents existants** (`docs/`, `scripts/`, `src/content.config.ts`) — ne pas partir d'une page blanche sur un sujet déjà traité.
- **Ne jamais reconstruire un mécanisme déjà présent** (ex. un second pipeline d'import, une seconde logique de statut) : réutiliser ou étendre l'existant, ou signaler explicitement pourquoi ce n'est pas possible.
- **Signaler toute contradiction entre une nouvelle demande et l'état réel du dépôt avant de coder** — ne pas la résoudre silencieusement en supposant une intention.
- **Pour toute opération de contenu sensible (import, publication, suppression), commencer par un dry-run lorsqu'un mécanisme de dry-run existe** (`--dry-run` sur les trois pipelines d'import) — ne jamais écrire directement sur la première tentative.
- À la fin de chaque session : compte rendu court avec (a) les critères de validation cochés/non cochés du lot, (b) les `{{À COMPLÉTER}}` restants, (c) le lien/commande de prévisualisation, (d) **le lien de la Pull Request ouverte**, (e) la prochaine étape suggérée. Ne confirmer qu'un commit est en ligne (préprod/prod) qu'après vérification directe sur le dépôt distant (voir section 4).

---

## 17. Rôles (qui fait quoi)

- **ChatGPT** (ne voit pas le dépôt) : contenus rédactionnels définitifs, hiérarchie éditoriale, préparation des données exposants/programme, relecture de captures, rédaction des corrections à transmettre.
- **Claude Code** (voit le dépôt) : architecture, code, tests, build, Git, déploiement, **et sa propre revue dans la session** (ne pas faire transiter le code vers ChatGPT pour audit).
- **Philippe** : seul décideur. Valide contenus, palette, fournisseurs de formulaires, architecture du futur module d'administration, et surtout **toute mention de partenariat ou logo** avant publication.
