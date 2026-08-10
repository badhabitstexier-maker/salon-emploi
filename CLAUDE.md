# CLAUDE.md — Site du Salon de l'Emploi & de la Formation 2026

> Constitution du projet pour Claude Code. À lire au début de **chaque** session.
> Objectif de ce fichier : décrire l'état RÉEL du dépôt et les règles opérationnelles à suivre —
> pas l'historique du développement. Une nouvelle session doit pouvoir travailler à partir de ce
> seul document, sans connaître les échanges précédents. Git conserve déjà l'historique ; ce
> fichier ne le duplique pas.
>
> **CLAUDE.md v5 — état de référence au 9 août 2026.** Reconstruit à partir d'un audit direct du
> dépôt (code, `main` distant, PR GitHub), pas des comptes rendus de conversation antérieurs.
> Commit de référence : `e8bacaf` (PR #46 fusionnée, module Visibilité CRUD). Remplace
> intégralement la v4.2 — ne pas s'y référer comme source concurrente.
>
> **Amendements du 10 août 2026** (préparation production, sections 4/9/12/16) : domaine canonique
> de production changé de `www.salonemploi.nc` à `salonemploi.nc` ; séparation préprod/production du
> module Visibilité faite explicitement au build (placeholders + variables GitHub par environnement),
> plus par un chemin unique en dur.
>
> **Amendements du 10 août 2026 (audit post-mise en production, sections 4/8/12/16)** : production
> **ouverte** (premier déploiement effectué), config serveur Visibilité production en place et
> distincte de la préprod, Admin production fonctionnel, redirection 301 `www` → apex assurée en
> dépôt par `public/.htaccess`. Correctifs SEO du même audit : page `/merci` passée en `noindex` et
> exclue du sitemap.
>
> **Amendements du 10 août 2026 (Lot « exposants-statuts », sections 7/15)** : fiches exposants
> publiques différenciées par statut commercial (`formule`, déjà existant, réutilisé comme statut
> public — voir `docs/EXPOSANTS.md` section 12). Annuaire `/exposants` désormais en trois
> catégories (Partenaires premium → Exposants partenaires → Exposants, alphabétique dans chaque
> catégorie). Nouveaux champs facultatifs et réservés par statut sur la collection `exposants`
> (`lien_recrutement`, `reseaux_sociaux`, `image_couverture`, `galerie`, `presentation longue` via
> `description` désormais optionnel) et champ `demo` (fiche de démonstration : noindex, exclue du
> sitemap). Six fiches de démonstration ajoutées (`src/content/exposants/demo-*.md`, entièrement
> fictives) avec 13 offres TEST associées (`SEF26-006` à `SEF26-018`) — voir section 15.
>
> **Amendement du 10 août 2026 (suite, sections 15)** : sur ces 13 offres TEST, 6 (une par
> exposant démo) restent visibles dans le catalogue public `/offres` ; les 7 autres restent
> publiées et accessibles par URL directe et depuis la fiche de leur exposant démo, mais
> n'apparaissent plus dans le catalogue.
>
> **Amendement du 10 août 2026 (correction de conception, sections 15)** : le champ `demo` sur la
> collection `offres` ne pilote plus la visibilité catalogue — deux champs désormais
> indépendants, chacun une seule responsabilité (voir `docs/OFFRES.md` section 4bis) : `demo`
> (SEO — `noindex` + hors sitemap, **toutes** les 18 offres TEST, historiques comme démo,
> `demo: true`) et `afficherCatalogue` (défaut `true`, visibilité dans `/offres` uniquement — `true`
> pour les 6 offres représentatives + les 5 historiques, `false` pour les 7 offres démo
> secondaires). Une offre réelle future reste indexable et visible dans le catalogue par défaut,
> sans action explicite.

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
- **Deux univers (configuration provisoire)** :
  - **Hall Emploi** — entreprises qui recrutent, organismes de formation, acteurs de l'accompagnement.
  - **Hall Formation** — organismes de formation, orientation, découverte des parcours.
  - ⚠️ Le **Village Maintenance & Industrie** est **suspendu** tant que le partenariat AMD n'est pas confirmé. Ne pas le mentionner sur le site ni dans les documents tant que Philippe n'a pas donné son feu vert explicite. La route `/village` n'est **pas une page de contenu** : c'est une redirection technique déclarée dans `astro.config.mjs` (`redirects: { '/village': '/le-salon' }`), pour les liens déjà partagés/indexés. Quand l'AMD sera confirmée, les deux halls fusionneront avec le Village dans une configuration à trois univers.
- **Emplacements commercialisés : 37** (configuration provisoire incluant les espaces potentiellement liés à l'AMD). À réviser si l'AMD confirme sa participation et revendique une partie des emplacements.

---

## 3. Logos et preuve sociale — clause de prudence (IMPORTANT)

**Aucun logo de partenaire, sponsor ou entreprise ne doit apparaître sur le site tant que le partenariat n'est pas confirmé nommément par Philippe.**

- État réel du code (`src/pages/index.astro`) : la section « Ils seront présents » est **désactivée** — aucun logo, aucun placeholder « logo à venir » affiché. Ne pas la réactiver sans une liste confirmée et les logos fournis par Philippe.
- Reproduire une marque déposée sans accord d'usage est un risque, indépendamment du statut du partenariat.
- Dès que Philippe fournit une liste confirmée avec logos fournis, l'intégrer dans un lot dédié (réactivation de la section, remplissage du tableau d'exposants mis en avant dans `index.astro`).

---

## 4. Domaine et fournisseurs de formulaires

**Nom de domaine : `salonemploi.nc`.** URL canonique de production : `https://salonemploi.nc` **sans** `www.` (décision LabEvents du 10/08/2026, remplace `https://www.salonemploi.nc`). La redirection 301 `www.salonemploi.nc` → `https://salonemploi.nc` (chemin + query string conservés) est désormais réalisée **dans le dépôt**, via `public/.htaccess` (copié tel quel dans `dist/.htaccess` au build, puis transféré par le pipeline FTP) : la règle ne s'active que si `HTTP_HOST` vaut explicitement `www.salonemploi.nc`, donc sans effet sur `salonemploi.nc`, `preprod.salonemploinc.com` ni aucun autre site du compte OVH. Reste une **action manuelle OVH/DNS** : que `www.salonemploi.nc` existe en DNS et pointe vers le même dossier OVH (`salonemploi-prod`) pour que cette règle s'applique (voir `docs/deploiement-preproduction.md` section 7bis). Aucun domaine n'est codé en dur dans le dépôt : `astro.config.mjs` lit `PUBLIC_SITE_URL` (variable d'environnement) avec un repli sur `http://localhost:4321` en son absence.

**Fournisseurs de formulaires :**
- **Web3Forms** — contact commercial exposant/visiteur sur `/exposer`.
- **Tally** — formulaire de candidature sur `/candidater` (visiteur qui postule à sa sélection d'offres). Voir `docs/CANDIDATURES_TALLY.md` pour le fonctionnement complet et la règle de conservation des données candidat (jusqu'au 31 décembre 2026).

Les deux coexistent : Web3Forms pour la prise de contact commerciale, Tally pour la candidature aux offres. **Ni l'un ni l'autre n'implique de base de données côté site.** La configuration effective (clé Web3Forms, URL Tally) vit exclusivement dans les secrets/variables des environnements GitHub `preprod`/`production` — non vérifiable depuis le dépôt, à contrôler manuellement si un doute survient sur le comportement réel des formulaires.

---

## 5. Stack technique

- **Astro 7**, sortie **statique** (`output: 'static'`).
- **Tailwind CSS v4** via `@tailwindcss/vite` (`@astrojs/tailwind` est dépréciée pour Tailwind v4, ne pas la réintroduire). Configuration **CSS-first** : les tokens vivent dans `src/styles/global.css` via la directive `@theme`, pas dans un `tailwind.config.js`.
- **Pas de React.** `package.json` ne déclare aucune dépendance React. Les briques interactives (filtres, sélection d'offres, module Visibilité) sont en **Astro + JavaScript vanilla** (`<script>` par composant). Ne pas introduire React sans décision explicite.
- **Formulaires** : Web3Forms + Tally (voir section 4). **Pas de base de données pour le site public.**
- **PHP**, strictement scopé au module Visibilité (voir section 12) — pas une bascule générale du site vers un backend dynamique. Le reste du site (pages vitrine, offres, exposants, programme) reste 100 % statique.
- **Node** : 22 en CI (workflows GitHub Actions).
- **Hébergement** : OVH, fichiers statiques (transfert FTP de `dist/`), automatisé par CI. `dist/` contient aussi les fichiers PHP et `.htaccess` de `public/` (le build Astro copie `public/` tel quel).

### Ce qu'on NE fait PAS (garde-fous anti-usine-à-gaz)
- Pas de base de données pour le **site public**.
- Pas de Next.js, pas de rendu côté serveur pour le site public.
- Pas de dépendances lourdes non justifiées (ex. React tant qu'aucune brique ne le justifie réellement).
- On ne code pas au-delà du lot en cours.
- Pas de backend général pour le site public. Le seul backend existant (PHP, module Visibilité) est strictement scopé à ce module. Toute extension de PHP à un autre besoin Admin (ex. édition des exposants/programme) exige une étude d'architecture et un audit technique préalables, comme cela a été fait pour Visibilité — pas une extension silencieuse.

---

## 6. Charte graphique (design tokens)

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

**Contraste sur fond `village` (vert)** : le corps de texte doit être en `encre`/`marine`, jamais en blanc — le blanc sur `village` tombe sous le seuil d'accessibilité (testé à 3,2:1, sous le minimum WCAG AA de 4,5:1). Le blanc reste acceptable uniquement pour de grands titres à fort corps.

**Référence graphique** : `public/references/preview-pages-site.png` (mockup de direction artistique) — référence d'inspiration, pas un gabarit pixel pour pixel.

---

## 7. Arborescence — routes réellement présentes

Routes trouvées dans `src/pages/` au commit `e8bacaf` (chaque ligne est un fichier de route réel, pas une estimation) :

**Pages publiques :**
- `/` — `src/pages/index.astro`
- `/le-salon` — `src/pages/le-salon.astro`
- `/exposants` — `src/pages/exposants.astro` (liste + filtres)
- `/exposants/[slug]` — `src/pages/exposants/[slug].astro` (fiche exposant)
- `/programme` — `src/pages/programme.astro` (liste + filtres)
- `/programme/[slug]` — `src/pages/programme/[slug].astro` (fiche activité)
- `/preparer-ma-visite` — `src/pages/preparer-ma-visite.astro`
- `/exposer` — `src/pages/exposer.astro` (contact commercial, Web3Forms)
- `/offres` — `src/pages/offres/index.astro` (catalogue + filtres + sélection)
- `/offres/[slug]` — `src/pages/offres/[slug].astro` (fiche offre)
- `/ma-selection` — `src/pages/ma-selection.astro`
- `/candidater` — `src/pages/candidater.astro` (embed Tally)
- `/merci` — `src/pages/merci.astro` (confirmation générique Web3Forms)
- `/mentions-legales` — `src/pages/mentions-legales.astro`
- `/confidentialite` — `src/pages/confidentialite.astro`
- `/village` — redirection technique (pas un fichier de page, voir section 2)

**Pages Admin (voir section 11) :**
- `/admin` — `src/pages/admin/index.astro`
- `/admin/dashboard` — `src/pages/admin/dashboard.astro`
- `/admin/exposants` — `src/pages/admin/exposants/index.astro`
- `/admin/exposants/[id]` — `src/pages/admin/exposants/[id].astro`
- `/admin/offres` — `src/pages/admin/offres/index.astro`
- `/admin/offres/[reference]` — `src/pages/admin/offres/[reference].astro`
- `/admin/visibilite` — `src/pages/admin/visibilite/index.astro`
- `/admin/visibilite/formulaire` — `src/pages/admin/visibilite/formulaire.astro`

**Endpoints hors Astro (PHP, servis directement par Apache/OVH, pas générés au build) :**
- `GET /api/visibilites.php` — lecture publique, sans authentification.
- `GET/POST/PUT/DELETE /admin-api/visibilites.php` — écriture, protégée (voir section 11).

`/exposants/[slug]`, `/programme/[slug]`, `/offres/[slug]` et `/admin/offres/[reference]` génèrent une page par entrée de collection (0 page tant que la collection est vide, 5 pages actuellement pour `/offres/[slug]`).

Structure du code :
```
src/
  layouts/      → BaseLayout.astro, AdminLayout.astro (nav + footer + <head> SEO via Seo.astro)
  components/   → composants réutilisables : Header, Footer, Seo, Visuel,
                  ExposantCard/ProgrammeCard/OffreCard, OffreFilters,
                  OffreSelection, SelectionDrawer, TallyCandidatureEmbed,
                  VisibilitySlot
  content.config.ts → schémas des 3 Content Collections (offres, exposants, programme)
  content/      → offres/ (5 fiches TEST), exposants/ (vide), programme/ (vide)
  lib/          → logique pure : offres.ts, exposants.ts, programme.ts, admin.ts,
                  candidature-selection.ts, selection-ui.ts, visibilites.ts,
                  visibilite-ui.ts, admin-visibilite-ui.ts
  pages/        → toutes les routes listées ci-dessus
  styles/       → global.css (tokens Tailwind v4)
scripts/        → pipelines d'import CSV (offres, exposants, programme) + tests unitaires
data/templates/ → modèles CSV pour chaque pipeline
docs/           → documentation détaillée par sujet
public/         → images, polices, favicon, dossier exposant PDF, admin-api/, api/ (PHP)
e2e/            → suite Playwright (voir section 13)
```

---

## 8. Environnements

- **Local** : `npm run dev` (Astro dev server). Aucune donnée réelle requise pour développer — les collections vides et l'API Visibilité indisponible sont gérées sans crash (build réussit avec des avertissements, fail-safe sur le module Visibilité).
- **Préproduction** : `https://preprod.salonemploinc.com`. Déployée automatiquement à chaque fusion sur `main` (`.github/workflows/deploy-preprod.yml`). Environnement de recette : `PUBLIC_NOINDEX=true` (jamais indexé), `.htpasswd` et dossier de données Visibilité propres à la préprod, chemins OVH renseignés dans l'environnement GitHub `preprod`.
- **Production** : **ouverte** (premier déploiement effectué). Domaine canonique `https://salonemploi.nc`, dossier OVH `salonemploi-prod`. Déploiement strictement manuel (`.github/workflows/deploy-production.yml`, `workflow_dispatch` uniquement) — chaque déclenchement reconstruit `main` avec les variables/secrets de l'environnement GitHub `production` (sans `PUBLIC_NOINDEX`, donc indexable ; sans `PUBLIC_TALLY_CANDIDATURE_URL`, voir section 4). La configuration serveur Visibilité **production** (`.htpasswd` production, dossier de données production, variables GitHub `production`) est désormais en place et distincte de la préprod (voir section 12).

---

## 9. Workflow Git / PR / déploiement

1. Développement sur une branche dédiée, PR ouverte vers `main`.
2. Contrôle automatique bloquant : `pr-check.yml` (`npm run build` doit réussir) et `qa.yml` (suite Playwright, voir section 13) — fusion bloquée sinon (protection de branche sur `main`). Le check `qa-e2e` bloque via son propre statut mais ne devient "required" au sens de la protection de branche que si un humain l'ajoute dans Settings → Branches — action manuelle, pas automatisable depuis le code.
3. Fusion une fois les contrôles verts.
4. La fusion sur `main` déclenche **automatiquement** `deploy-preprod.yml` (build + FTP vers OVH). Délai observé : de l'ordre de la minute.
5. Recette visuelle **après** la fusion, sur la préproduction.
6. Problème détecté : nouvelle branche de correctif, même cycle.
7. Après chaque fusion, mettre le dépôt local à jour (`git switch main && git pull origin main`).
8. Passage en production **strictement manuel** : déclenchement de `deploy-production.yml` depuis l'onglet Actions.

⚠️ **Piège vérifié en pratique** : une Pull Request peut être fusionnée avant qu'une session Claude Code n'ait fini de pousser tous ses commits sur la branche (fusion en squash notamment). Un commit poussé après la fusion n'est **pas** automatiquement inclus dans `main`. **Avant d'affirmer qu'un commit est en production/préproduction, toujours vérifier directement sur le dépôt distant** (`git fetch origin main`, comparer les SHA) plutôt que de supposer qu'un `git push` réussi suffit.

Les secrets (clé Web3Forms, identifiants FTP) et variables (`PUBLIC_SITE_URL`, `PUBLIC_NOINDEX`, `PUBLIC_TALLY_CANDIDATURE_URL`, `VISIBILITES_AUTH_USER_FILE`, `VISIBILITES_DATA_DIR`) vivent exclusivement dans les environnements GitHub `preprod` et `production` — jamais dans le code, un commit, ou un fichier de documentation. `VISIBILITES_AUTH_USER_FILE`/`VISIBILITES_DATA_DIR` sont des chemins serveur (variables, pas des secrets) injectés dans `dist/` par chaque workflow de déploiement, en remplacement de placeholders commités — voir section 12 et `docs/VISIBILITE.md` section 15.9. `PUBLIC_TALLY_CANDIDATURE_URL` n'est volontairement pas encore câblée dans `deploy-production.yml` (voir `docs/CANDIDATURES_TALLY.md` section 7) : en attente de validation de la recette en préproduction par Philippe.

---

## 10. Sources de vérité — ne jamais les confondre

| Donnée | Source de vérité amont | Où elle atterrit dans le dépôt |
|---|---|---|
| Offres | Google Forms → Google Sheet (onglets `OFFRES` puis `EXPORT_SITE`) | CSV → `scripts/import-offres.mjs` → `src/content/offres/*.md` |
| Exposants | Pipeline équivalent (voir `docs/EXPOSANTS_IMPORT.md`) | CSV → `scripts/import-exposants.mjs` → `src/content/exposants/*.md` |
| Programme | Pipeline équivalent (voir `docs/PROGRAMME_IMPORT.md`) | CSV → `scripts/import-programme.mjs` → `src/content/programme/*.md` |
| Candidatures | Tally (formulaire externe) | Ne transite jamais par le dépôt — Tally gère la collecte et la conservation (voir `docs/CANDIDATURES_TALLY.md`) |
| Campagnes Visibilité | Saisies directement via `/admin/visibilite` | `visibilites.json`, hors dépôt Git, sur le serveur OVH — **jamais committé, jamais dans `src/content`** |

**Ne jamais créer un second mécanisme parallèle** pour l'une de ces chaînes. Toute évolution du format passe par les scripts et schémas existants (`src/content.config.ts` pour les collections, `src/lib/visibilites.ts` pour Visibilité).

---

## 11. Pipeline Offres — fonctionnement opérationnel

`scripts/import-offres.mjs` et `scripts/lib/offres-import-core.mjs` sont la **source de vérité** du pipeline d'import des offres.

**Chaîne opérationnelle :**
1. Collecte exposants via Google Form (voir `docs/OFFRES_EXPOSANTS.md`).
2. Centralisation dans un Google Sheet.
3. Normalisation (Apps Script) : une ligne par offre dans l'onglet `OFFRES`.
4. Pilotage LabEvents dans `OFFRES` (validation, correction, statut).
5. Génération de `EXPORT_SITE` (onglet dérivé, colonnes attendues par l'import — voir `data/templates/offres-import.csv`).
6. Export CSV depuis `EXPORT_SITE`.
7. **Contrôle obligatoire avant toute écriture réelle** :
   ```bash
   npm run offres:import -- <fichier.csv> --dry-run
   ```
8. Import réel uniquement après dry-run à 0 erreur bloquante :
   ```bash
   npm run offres:import -- <fichier.csv>
   ```
9. `npm run offres:check` — contrôle de la collection sans CSV (doublons, quotas).
10. `npm run build` doit réussir avant toute PR.

**Identifiants :** référence publique `SEF26-NNN` (attribuée automatiquement par le pipeline, jamais saisie à la main). Identifiant interne Sheet (`EXP26-xxx-xx`) reste côté Sheet. Après le premier import réel d'une offre, reporter `SEF26-NNN` dans le Sheet pour que les réimports la retrouvent de façon fiable.

**Statuts** (`src/content.config.ts`, `scripts/lib/offres-import-core.mjs`) : `recue`, `a-completer`, `validee`, `publiee`, `retiree`, `cloturee`. **Seul `publiee` rend une offre visible sur `/offres` et `/offres/[slug]`.**

**Quotas par formule** (`standard`/`silver`/`gold`) : 5 / 10 / illimité (alerte au-delà de 10 pour `gold`). Contrôlé par `verifierQuotas()` à l'import.

**Données internes — jamais publiées ni committées** : rémunération, coordonnées du contact recrutement, temps de travail, notes internes LabEvents. Le pipeline tolère certaines colonnes internes en entrée (`COLONNES_INTERNES_IGNOREES`) mais ne les écrit jamais dans les fichiers générés.

**Offres TEST (données techniques de recette, pas du contenu événementiel réel) :** toute offre dont l'**intitulé commence exactement par `TEST —`** (`estOffreTest()` dans `src/lib/offres.ts`) est une offre fictive de démonstration :
- Visible normalement dans `/offres` et par son URL (démontre le fonctionnement du catalogue).
- Aucun bouton de candidature ni d'ajout à la sélection.
- Message dédié sur la fiche : « Offre fictive de démonstration ».
- `noindex, nofollow` forcé. Aucun JSON-LD `JobPosting`. Exclues du sitemap.
- **État actuel : 5 offres (`SEF26-001` à `SEF26-005`), exposant fictif `Entreprise Test NC`. Zéro offre réelle publiée à ce jour.** Ne jamais présenter ces 5 offres comme du contenu événementiel réel dans un compte rendu ou une communication.

Le même principe (dry-run avant écriture réelle) s'applique aux pipelines Exposants (`npm run exposants:import -- --dry-run`) et Programme (`npm run programme:import -- --dry-run`).

---

## 12. Module Visibilité (bandeaux publicitaires) — état ACTUEL

C'est un module fonctionnel, pas un chantier en cours. Fonctionnement réel au commit `e8bacaf` :

- **CRUD complet** depuis `/admin/visibilite` (création, modification, activation/désactivation, suppression) et `/admin/visibilite/formulaire` — aucune autre partie de `/admin` n'a d'opération d'écriture (voir section 13).
- **API Admin PHP** : `public/admin-api/visibilites.php` — `GET` (liste + jeton CSRF), `POST` (création), `PUT ?id=` (modification), `DELETE ?id=`. Protégée par Basic Auth Apache (même `.htpasswd` que `/admin`) **et** par une protection CSRF/Origin distincte (Basic Auth seul ne suffit pas contre une requête forgée).
- **API publique PHP** : `public/api/visibilites.php` — `GET` uniquement, sans authentification (c'est voulu : consommée par le navigateur du visiteur). Ne renvoie que des champs whitelistés (jamais `nomInterne`, `typeAnnonceur`, `exposantId`).
- **Bibliothèque PHP partagée** : `public/api/_visibilites-lib.php` — chargement/écriture du JSON, verrouillage fichier, validation, calcul de statut, résumé public.
- **Données** : `visibilites.json`, **hors dépôt Git, hors webroot** sur le serveur OVH. Sauvegarde automatique (`.bak`) à chaque écriture, verrou fichier contre les écritures concurrentes.
- **4 emplacements réellement intégrés** (composant `VisibilitySlot`, vérifié par grep dans le code, pas une intention) : **accueil** (`index.astro`), **offres** (`offres/index.astro`), **exposants** (`exposants.astro`), **programme** (`programme.astro`).
- **Affichage dynamique sans rebuild Astro** : la section est toujours rendue dans le HTML statique mais masquée par défaut (`hidden`) ; c'est `src/lib/visibilite-ui.ts` (client) qui interroge l'API publique au chargement et révèle la section si un candidat est éligible.
- **Tirage pondéré au chargement** : un seul tirage par chargement de page, basé sur le champ `poids` de chaque campagne. **Le bandeau reste stable pendant toute la consultation — pas de carrousel, pas de rotation automatique dans le temps.** Les dates de début/fin sont réévaluées à chaque chargement côté client (une campagne peut démarrer ou expirer sans nouveau build).
- **Pas d'analytics impressions/clics en V1** — aucune trace de tracking dans le code à ce jour.
- **Fail-safe** : toute erreur de l'API publique renvoie une liste vide avec statut 200 — jamais d'erreur visible, jamais de page bloquée pour le visiteur.
- Le module ne remplace ni ne concurrence le pipeline Offres/Exposants/Programme (section 10) — c'est une chaîne de données entièrement distincte.

**Distinction préprod / production — séparation faite AU BUILD (décision du 10/08/2026), jamais par détection runtime Apache** : `public/admin/.htaccess`, `public/admin-api/.htaccess` et `public/api/_visibilites-lib.php` ne portent plus de chemin OVH en dur dans le dépôt, seulement des placeholders (`__VISIBILITES_AUTH_USER_FILE__`, `__VISIBILITES_DATA_DIR__`). Chaque workflow de déploiement (`deploy-preprod.yml`, `deploy-production.yml`) les substitue dans `dist/`, juste avant le transfert FTP, avec les variables GitHub `VISIBILITES_AUTH_USER_FILE`/`VISIBILITES_DATA_DIR` de son propre environnement — voir `docs/VISIBILITE.md` section 15.9 pour l'architecture complète.
- **PRÉPRODUCTION** : opérationnelle — `.htpasswd` et dossier de données (`/home/salonez/salon-emploi-data-preprod/`) déjà créés côté OVH, chemins renseignés dans les variables de l'environnement GitHub `preprod`.
- **PRODUCTION** : **opérationnelle** — `.htpasswd` production et dossier de données production distincts créés côté OVH, chemins renseignés dans les variables `VISIBILITES_AUTH_USER_FILE`/`VISIBILITES_DATA_DIR` de l'environnement GitHub `production` (valeurs distinctes de la préprod, jamais réutilisées). La protection Basic Auth de `/admin` fonctionne en production, le module Admin production est fonctionnel. Les campagnes saisies en préprod **ne sont pas migrées automatiquement** vers la production (chaînes de données séparées) : `visibilites.json` production démarre absent/vide, ce que l'API publique gère sans erreur (fail-safe, liste vide en statut 200). Toute migration de campagne serait une opération manuelle explicite (dépôt du visuel + saisie via `/admin/visibilite` en production), hors du périmètre de tout déploiement automatique.

Voir `docs/VISIBILITE.md` pour l'architecture technique complète (chemins exacts, procédure de dépôt d'un visuel, sécurité détaillée).

---

## 13. Administration LabEvents

**Aucune ambiguïté sur ce qui est éditable :**

| Section | Comportement |
|---|---|
| `/admin/dashboard` | **Lecture seule** — indicateurs calculés depuis les Content Collections et l'API Visibilité |
| `/admin/exposants` et `/admin/exposants/[id]` | **Lecture seule** |
| `/admin/offres` et `/admin/offres/[reference]` | **Lecture seule** |
| `/admin/visibilite` et `/admin/visibilite/formulaire` | **CRUD réel** (seule partie de `/admin` avec des opérations d'écriture — voir section 12) |

Le dashboard et les vues exposants/offres exposent des indicateurs utiles (badges d'anomalie : exposant introuvable, formule incohérente ; exclusion des offres TEST des KPI, signalées séparément) mais **aucune action de modification** — toute correction de contenu passe par les pipelines d'import (section 11) ou par une nouvelle décision d'architecture si un besoin d'édition apparaît sur ces sections.

**Sécurité** : `/admin` et `/admin-api` protégés par deux fichiers `.htaccess` distincts (dossiers frères, pas d'héritage), même `AuthUserFile` OVH. Le fichier `.htpasswd` réel **n'est jamais committé** — il vit exclusivement sur le serveur OVH. Toute évolution du module Admin nécessitant de l'écriture doit reproduire le principe suivi pour Visibilité : étude d'architecture, audit technique réel sur l'hébergement, backend strictement scopé — jamais une bascule générale.

**Hors périmètre Admin, sauf nouvelle décision explicite** : gestion des candidatures, CVthèque, comptes exposants, remplacement du Google Sheet, édition des exposants/programme.

---

## 14. QA

**Commandes réelles :**
- `npm run build` — build Astro, bloquant en CI (`pr-check.yml`).
- `npm run content:test` — enchaîne `offres:test`, `exposants:test`, `programme:test`, `visibilites:test` (tests unitaires Node natifs sur la logique pure) puis `content:check` (recherche de mentions obsolètes dans les sources publiques).
- `npm run visibilites:api-test` — tests Node natifs sur `public/api/_visibilites-lib.php` et les deux endpoints PHP (nécessite `php` en local ou en CI).
- `npm run qa` (= `npm run qa:e2e` = `playwright test`) — suite E2E complète, deux projets (`chromium-desktop`, `chromium-mobile`), serveur de prévisualisation démarré automatiquement (`webServer` dans `playwright.config.ts`).

**Couverture `e2e/`** : smoke tests, parcours Offres (catalogue, filtres, fiche détail, sélection), accessibilité (axe-core, 0 violation `critical`/`serious` bloquante), navigation clavier, SEO (balises, JSON-LD `Event`/`JobPosting`, règles offres TEST, sitemap/robots), liens internes (découverte automatique des routes), comportement 404, Admin (accès, dashboard/exposants/offres lecture seule), Visibilité (site public dynamique + CRUD Admin, mocké via `e2e/visibilite-mock.ts`).

**CI (`qa.yml`)** : bloquant depuis les Lots QA — installe ses propres navigateurs Playwright, indépendant de tout environnement local. Distinct de `pr-check.yml` (build-check), qui reste bloquant séparément.

**Limite connue** : dans certains environnements d'exécution restreints (sandbox sans navigateurs Playwright complets), `npm run qa` peut échouer au lancement du navigateur (`browserType.launch`) sans que cela reflète un défaut du site — vérifier toujours le comportement réel via le check CI GitHub Actions, pas uniquement en local dans un environnement non standard.

**Dette connue** : page 404 personnalisée absente (le comportement HTTP 404 est correct et testé, mais la page affichée est le fallback générique d'Astro).

---

## 15. Contenus réels présents (état factuel)

- **Offres** : 18 fiches, **toutes TEST, toutes `demo: true`** (`SEF26-001` à `SEF26-018` — voir `docs/OFFRES.md` section 4bis). Les 5 premières (`SEF26-001` à `SEF26-005`) sont rattachées à l'exposant fictif historique `Entreprise Test NC` (non présent dans la collection `exposants`, anomalie Admin attendue). Les 13 suivantes (`SEF26-006` à `SEF26-018`) sont rattachées aux 6 exposants de démonstration ci-dessous. **Catalogue public `/offres` (champ `afficherCatalogue`) : 11 offres visibles (les 5 historiques + 1 offre représentative par exposant démo) ; 7 offres démo secondaires accessibles uniquement par URL directe ou depuis la fiche exposant.** Les 18 sont `noindex` et exclues du sitemap. **0 offre réelle.**
- **Exposants** : **6** fiches, **toutes de démonstration** (`demo: true`, préfixe de fichier `demo-*.md` — voir `docs/EXPOSANTS.md` section 13) : 1 Partenaire premium, 2 Exposants partenaires, 3 Exposants. Entièrement fictives (noms, logos, coordonnées), à retirer sans changement de code une fois les exposants réels intégrés. Pipeline d'import prêt (`docs/EXPOSANTS_IMPORT.md`), jamais alimenté avec de vraies données. **0 exposant réel.**
- **Programme** : **0** entrée. Pipeline d'import prêt (`docs/PROGRAMME_IMPORT.md`), jamais alimenté.
- **Campagnes Visibilité** : contenu réel du `visibilites.json` serveur **non déterminable depuis Git** (par construction — voir section 12). Ne jamais affirmer un nombre de campagnes actives sans avoir consulté `/admin/visibilite` en direct.

---

## 16. Ce qui reste à faire (production ouverte — suivi post-mise en production)

La production est ouverte depuis le premier déploiement. Les points ci-dessous ne sont plus des bloqueurs d'ouverture mais des chantiers de fiabilisation et de contenu, dans l'ordre d'importance :

1. ~~**Configuration production du module Visibilité**~~ — **FAIT** : `.htpasswd` production, dossier de données production et variables GitHub `production` en place, distincts de la préprod (voir section 12).
2. **Import des exposants réels** — la collection `exposants` est vide ; `/exposants` n'a aucun contenu à montrer en l'état.
3. **Alimentation du programme réel** — la collection `programme` est vide ; `/programme` n'a aucun contenu à montrer en l'état.
4. **Remplacement progressif des offres TEST par des offres réelles** — via le pipeline habituel (section 11). Décision confirmée : les 5 offres TEST **restent publiées** en production comme démonstration pour les exposants, clairement identifiées (`TEST —`, message « Offre fictive de démonstration », noindex, exclues du sitemap).
5. **Câblage Tally production** — volontairement non fait tant que la recette Tally n'est pas validée : `PUBLIC_TALLY_CANDIDATURE_URL` absente de l'environnement `production`, donc `/candidater` affiche proprement « Le formulaire de candidature sera prochainement disponible » (pas d'iframe morte). Ne pas câbler sans feu vert de Philippe.
6. **Image Open Graph `public/og-image.jpg`** — référencée par `src/components/Seo.astro` (`og:image` de toutes les pages publiques) mais **absente du dépôt** : l'aperçu au partage sur les réseaux sociaux est cassé (404). Sans impact sur l'indexation Google. À fournir : une image `1200×630` (JPG) déposée dans `public/og-image.jpg` — décision de contenu/graphisme (Philippe/ChatGPT).
7. **Résolution ou validation du warning `public/images/hall-formation.webp`** — le build signale cette image manquante (repli automatique géré par `Visuel.astro`, donc pas bloquant, mais à trancher : fournir l'image ou confirmer que le repli est le comportement voulu).
8. **Vérification manuelle OVH/Apache/DNS** — non vérifiable depuis une session Claude Code : que `www.salonemploi.nc` existe en DNS et pointe vers `salonemploi-prod` (pour que la règle 301 de `public/.htaccess` s'applique), et que la protection `.htpasswd` production est bien active.
9. **Soumission à Google Search Console** — déclarer `https://salonemploi.nc` et soumettre le sitemap (`https://salonemploi.nc/sitemap-index.xml`) pour accélérer l'indexation (action manuelle hors dépôt).
10. **Recette visuelle** — après chaque fusion sur la préprod (`https://preprod.salonemploinc.com`), et recette complète avant chaque déclenchement manuel de `deploy-production.yml`.

---

## 17. Règles de développement pour les prochaines sessions

- **Une tâche par session**, cadrée petit — un lot à la fois.
- `git commit` propre à la fin de chaque lot, message explicite.
- **Pull Request systématique** : à la fin de chaque lot, après commit et push, ouvrir une PR vers `main` sans attendre que Philippe le demande. **Ne jamais fusionner soi-même** — la fusion reste une décision de Philippe.
- **Avant de proposer une nouvelle architecture ou un nouveau mécanisme, inspecter l'existant** (`docs/`, `scripts/`, `src/content.config.ts`, `src/lib/`) — ne pas partir d'une page blanche sur un sujet déjà traité.
- **Ne jamais reconstruire un mécanisme déjà présent** (un second pipeline d'import, une seconde logique de statut, un second module Visibilité) : réutiliser ou étendre l'existant, ou signaler explicitement pourquoi ce n'est pas possible.
- **Signaler toute contradiction entre une nouvelle demande et l'état réel du dépôt avant de coder** — ne pas la résoudre silencieusement en supposant une intention.
- **Dry-run avant toute opération de contenu sensible** (import, publication, suppression) lorsqu'un mécanisme de dry-run existe (`--dry-run` sur les trois pipelines d'import) — ne jamais écrire directement sur la première tentative.
- **Ne jamais publier une donnée fictive comme réelle** — en particulier, ne jamais présenter les offres TEST comme du contenu événementiel réel.
- **Ne jamais exposer de secret côté client** — les clés/URL de formulaires tiers et identifiants FTP restent dans les environnements GitHub, jamais dans le code, un commit, ou une réponse en clair destinée à être committée.
- **Distinguer systématiquement source de vérité amont et données publiques** (section 10) — ne jamais écrire directement dans `src/content/` en contournant un pipeline d'import quand ce pipeline existe.
- **Avant d'affirmer qu'un commit est en ligne (préprod/prod), vérifier directement sur le dépôt distant** (section 9) — ne jamais se fier à un `git push` réussi seul.
- **Sonnet par défaut.** Opus réservé à l'architecture initiale ou aux blocages difficiles réels et identifiés.
- **CMS d'édition (Keystatic)** : reste une piste d'évolution éventuelle, **pas une feuille de route engagée**. Ne pas l'intégrer ni la présupposer sans nouvelle décision explicite de Philippe.
- À la fin de chaque session : compte rendu court avec (a) les critères de validation cochés/non cochés du lot, (b) les `{{À COMPLÉTER}}` restants, (c) le lien/commande de prévisualisation, (d) le lien de la Pull Request ouverte, (e) la prochaine étape suggérée.

---

## 18. Rôles (qui fait quoi)

- **ChatGPT** (ne voit pas le dépôt) : contenus rédactionnels définitifs, hiérarchie éditoriale, préparation des données exposants/programme, relecture de captures, rédaction des corrections à transmettre.
- **Claude Code** (voit le dépôt) : architecture, code, tests, build, Git, déploiement, et sa propre revue dans la session (ne pas faire transiter le code vers ChatGPT pour audit).
- **Philippe** : seul décideur. Valide contenus, palette, fournisseurs de formulaires, architecture du module d'administration, et surtout **toute mention de partenariat ou logo** avant publication.
