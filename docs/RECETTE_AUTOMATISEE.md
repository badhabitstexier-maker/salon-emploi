# Recette automatisée — Lot 4B

> Documente l'ensemble de la recette qualité mise en place au Lot 4B :
> Playwright (E2E), tests unitaires, contrôles de contenu, SEO/accessibilité,
> et intégration CI. Complète (sans les remplacer) `docs/EXPOSANTS_IMPORT.md`,
> `docs/PROGRAMME_IMPORT.md`, `docs/OFFRES.md` et `docs/WORKFLOW_CONTENUS_2026.md`,
> qui restent la référence pour les imports de contenu.

---

## 1. Vue d'ensemble

Le site est un build **statique** Astro. Pour recetter à la fois le
comportement « collections vides » (état actuel du dépôt) et le parcours
complet avec du contenu, la recette produit **trois builds distincts** avant
de lancer le moindre test Playwright (voir `tests/e2e/global-setup.ts`) :

| Build | Contenu | Port local | Usage |
|---|---|---|---|
| `empty` | Aucune fixture — état réel du dépôt | 4322 | Tests « collection vide » |
| `fixtures` | Fixtures de `tests/fixtures/` injectées | 4323 | Majorité des specs (catalogue, détail, sélection…) |
| `tally` | Fixtures + `PUBLIC_TALLY_CANDIDATURE_URL` fictive | 4324 | Tests de l'iframe Tally (sans réseau réel) |

Chaque build est servi par un petit serveur de fichiers statiques maison
(`tests/e2e/support/static-server.ts`, sans dépendance supplémentaire) —
plus fidèle qu'`astro dev` au comportement réel du site déployé.

Les trois builds et leurs serveurs sont créés une seule fois en
`globalSetup`, partagés par tous les tests, puis détruits en fin de run
(dossier `.e2e-dist/` entièrement supprimé). Rien n'est jamais committé.

---

## 2. Installation

```bash
npm ci
npx playwright install --with-deps chromium
```

Playwright n'installe et n'utilise que **Chromium** (pas Firefox/WebKit) —
objectif : recette rapide et fiable, pas une couverture multi-navigateurs.

---

## 3. Desktop et mobile

Deux projets Playwright (`playwright.config.ts`), tous deux sur Chromium :

- **desktop** — viewport `1440×900`.
- **mobile** — viewport `375×812`, `isMobile: true`.

La plupart des specs tournent sur les deux projets. Certains contrôles
indépendants du viewport (SEO, JSON-LD, liens internes, accessibilité,
fallback Tally) ne s'exécutent qu'une fois, sur `desktop`, via
`test.skip(testInfo.project.name !== 'desktop', …)` — pour ne pas doubler
inutilement le temps de recette.

---

## 4. Fixtures E2E

**Emplacement : `tests/fixtures/{exposants,programme,offres}/`.**

Contenu, uniquement fictif :

- 2 exposants publiés (Hall Emploi / Hall Formation) + 1 non publié
  (`publie: false`, pour vérifier qu'il n'apparaît jamais).
- 3 activités de programme publiées (une par créneau/jour de test) + 1 non
  publiée.
- 3 offres publiées (dont une sans candidature en ligne) + 1 au statut
  différent de `publiee` (pour vérifier qu'elle n'apparaît jamais).

Aucune entreprise, aucun intervenant, aucune donnée personnelle réels.

**Cycle de vie, entièrement automatique (`tests/e2e/global-setup.ts`) :**

1. Le setup **refuse de démarrer** si `src/content/{exposants,programme,offres}/`
   contient déjà de vraies fiches `.md` — sécurité pour ne jamais risquer de
   mélanger fixtures et contenu publié.
2. Build `empty` (état actuel, sans fixture).
3. Copie des fixtures dans `src/content/*`.
4. Build `fixtures` puis build `tally`.
5. **Retrait immédiat** des fixtures de `src/content/*`, y compris si un
   build a échoué (`finally`) — jamais laissées en place plus longtemps que
   le temps strictement nécessaire aux deux builds.

Après un `npm run test:e2e` (réussi ou en échec), `git status` doit rester
propre sur `src/content/`. C'est vérifié dans le cadre de ce Lot (voir § 13).

**Piège connu et corrigé** : Astro conserve un cache du content layer dans
`node_modules/.astro/data-store.json`, qui **survit** à la suppression des
fichiers sources. Sans précaution, un build « vide » lancé après un build
« avec fixtures » réutiliserait les entrées mises en cache. Chaque build de
la recette utilise donc `astro build --force`, qui vide ce cache avant de
reconstruire.

---

## 5. Commandes npm

| Commande | Rôle |
|---|---|
| `npm run test:e2e` | Recette E2E complète (desktop + mobile) |
| `npm run test:e2e:desktop` | E2E desktop uniquement |
| `npm run test:e2e:mobile` | E2E mobile uniquement |
| `npm run test:e2e:smoke` | Sous-ensemble critique (@smoke), desktop uniquement — utilisé en CI |
| `npm run unit:test` | Tests unitaires purs (`tests/unit/`, ex. logique de sélection d'offres) |
| `npm run offres:test` / `exposants:test` / `programme:test` | Tests des pipelines d'import (Lot 4A, inchangés) |
| `npm run content:check` | Contrôle des mentions/valeurs obsolètes dans les sources publiques (Lot 4A, inchangé) |
| `npm run content:test` | Enchaîne les trois tests de pipeline + `content:check` |
| `npm run qa` | **Recette globale** — voir § 6 |

---

## 6. `npm run qa`

Enchaîne, dans l'ordre :

1. `content:test` (pipelines offres/exposants/programme + `content:check`)
2. `unit:test` (logique pure de sélection d'offres)
3. `build` (build de contrôle, config identique à la CI)
4. `test:e2e` (recette E2E complète, desktop + mobile — Playwright relance
   ses propres builds internes via `globalSetup`, indépendants de l'étape 3)

C'est la commande à lancer **avant toute fusion vers `main`** si on veut la
recette complète (voir § 9). Elle n'inclut pas de scan d'accessibilité
exhaustif ni de vérification multi-navigateurs : ce n'est pas l'objectif de
ce Lot (voir § 8).

---

## 7. Ce qui est couvert

- **Parcours principaux** : Accueil, Le salon, Préparer ma visite, Exposer,
  Exposants (catalogue + détail + filtres + état vide), Programme (idem),
  Offres (idem + JSON-LD JobPosting), Ma sélection, Candidater, Mentions
  légales, Confidentialité, page 404, `/village` (redirection).
- **En-tête / pied de page** : navigation desktop, menu mobile (ouverture,
  liens, fermeture), liens internes du footer.
- **Sélection d'offres** (`tests/e2e/selection-candidater.spec.ts` +
  `tests/unit/candidature-selection.test.mjs`) : ajout, retrait, restauration
  depuis l'URL, référence inconnue ignorée silencieusement, plafond de 5
  (couvert en test unitaire — impossible à déclencher via l'UI avec
  seulement 3 fixtures d'offres), absence de `localStorage`/`sessionStorage`.
- **Candidater / Tally** : page de base, orientation (`orientation=1`),
  fallback propre sans variable configurée, construction de l'iframe avec
  variable configurée (réseau tally.so **systématiquement intercepté**, voir
  § 8) — jamais de soumission réelle.
- **Formulaires Web3Forms** (`/exposer`) : présence, jamais de soumission
  réelle (requête réseau interceptée et vérifiée absente).
- **Collections vides** : exposants, programme, offres — aucun crash, état
  vide propre, aucun lien de détail fantôme.
- **Liens internes et ressources locales** (`link-integrity.spec.ts`) :
  crawl des pages publiques (avec fixtures), vérification HTTP de tous les
  liens internes et images locales. Ne crawle jamais de domaine externe.
- **Erreurs console/JS** (`support/helpers.ts`) : `console.error` et
  `pageerror` collectés sur les pages principales, allowlist minimale
  (uniquement `tally.so`, non mocké dans certains specs statiques).
- **SEO technique** (`seo.spec.ts`) : title, meta description, canonical,
  Open Graph, `lang="fr"`, favicon, absence de `noindex` sur un build de
  type production, sitemap et robots.txt.
- **JSON-LD** : `Event` (accueil) et `JobPosting` (fiche offre, avec
  `validThrough` uniquement si `dateCloture` est renseignée — jamais
  inventé) — vérifiés dans `home.spec.ts` et `offres.spec.ts`.
- **Accessibilité** (`accessibilite.spec.ts`) : scan axe-core (violations
  `serious`/`critical` uniquement) sur 5 pages représentatives, plus
  contrôles structurels (H1 unique, liens/boutons nommés, `alt` sur les
  images, labels de formulaire). Aucune exception n'est masquée dans ce
  test — voir § 8.1 pour le correctif de contraste appliqué avant fusion.
- **Responsive** (`responsive.spec.ts`) : absence de débordement horizontal
  significatif sur les pages critiques, desktop et mobile.

---

## 8. Limites assumées

- **Tally** : les tests ne dépendent jamais du réseau réel de tally.so et ne
  soumettent jamais de candidature. Le test du fallback (variable absente)
  vérifie l'état d'attente propre. Le test de l'iframe (variable configurée)
  intercepte systématiquement `https://tally.so/**` via `page.route()` — le
  contenu interne (cross-origin) du formulaire Tally n'est jamais testé.
- **Accessibilité** : couverture volontairement raisonnable (5 pages
  représentatives, violations `serious`/`critical` uniquement, tags WCAG
  2A/2AA) — pas une correction exhaustive WCAG.

### 8.1. Correctif de contraste CTA `bg-village` (appliqué avant fusion)

La recette avait détecté que les boutons/CTA sur fond `bg-village` avec
texte blanc (« Devenir exposant » du header, et une quinzaine d'autres CTA à
travers le site) avaient un contraste mesuré de **3.19:1**, sous le seuil
WCAG AA de 4.5:1 pour du texte de cette taille — le même problème que celui
déjà documenté dans `CLAUDE.md` (section 10) pour le texte de corps sur fond
`village`.

Une première version avait exclu cette combinaison connue du test
d'accessibilité plutôt que de la corriger, en la présentant comme une
décision de palette relevant de Philippe. Sur validation de Philippe, le
correctif le plus léger possible a finalement été appliqué : le texte de ces
CTA passe de `text-blanc` à **`text-marine`** (couleur déjà présente dans la
charte, déjà utilisée dans le même contexte par `OffreCard.astro`), sans
toucher au fond `bg-village` lui-même ni créer de nouvelle couleur.

| | Avant | Après |
|---|---|---|
| Contraste | 3.19:1 (`#ffffff` sur `#2fa36b`) | 4.93:1 (`#10233f` sur `#2fa36b`) |
| Seuil WCAG AA (texte normal) | ❌ non conforme (< 4.5:1) | ✅ conforme |

18 occurrences corrigées dans 8 fichiers : `src/components/Header.astro`,
`src/pages/index.astro`, `src/pages/le-salon.astro`, `src/pages/exposants.astro`,
`src/pages/programme.astro`, `src/pages/offres/index.astro`,
`src/pages/preparer-ma-visite.astro`, `src/pages/exposer.astro`. Les badges
sur fond `bg-village-dark` (déjà conformes, contraste ≈ 8.17:1) n'ont pas été
touchés. L'exception dans `tests/e2e/accessibilite.spec.ts` a été supprimée
— le test d'accessibilité ne masque plus aucune violation de contraste
connue.
- **Performance** : audit léger uniquement (pas de Lighthouse). Aucune image
  manifestement excessive ni script tiers global inutile constaté lors de
  l'audit du Lot 4B.
- **Page 404** : le dépôt ne définit pas de `src/pages/404.astro` — Astro ne
  génère donc pas de page 404 personnalisée. Le test (`404.spec.ts`) vérifie
  seulement qu'une URL inexistante renvoie un statut HTTP 404 (via le
  serveur de test), sans redirection déguisée vers une page existante. Sur
  l'hébergement OVH réel, le comportement exact dépendra de la configuration
  du serveur web — non vérifiable dans ce Lot.
  **ACTION MANUELLE PHILIPPE (optionnelle)** : décider si une page 404
  personnalisée (dans la charte graphique) est souhaitée pour une prochaine
  session.
- **`public/images/hall-formation.webp` manquante** (point connu, cf.
  `CLAUDE.md`) : ce n'est **pas** un bug — `src/components/Visuel.astro`
  détecte l'absence du fichier au build et affiche délibérément un panneau
  de repli cohérent avec la charte (aplat + trame + texte « Visuel à venir »),
  jamais une image cassée. Confirmé par la recette (`link-integrity.spec.ts`
  ne signale aucune ressource manquante, car aucun `<img>` n'est généré tant
  que le fichier est absent). **ACTION MANUELLE PHILIPPE** : fournir le
  visuel définitif du Hall Formation quand il sera prêt ; aucune action
  technique nécessaire d'ici là.
- **`og:image` (`/og-image.jpg`)** : référencée par `src/components/Seo.astro`
  sur toutes les pages, mais le fichier n'existe pas dans `public/`
  actuellement — le partage sur les réseaux sociaux affichera une image
  cassée. Non corrigé dans ce Lot (fabriquer une image hors charte est
  explicitement exclu). **ACTION MANUELLE PHILIPPE** : fournir une image
  Open Graph (1200×630 recommandé) dans la charte graphique.

---

## 9. Procédure avant fusion (PR → `main`)

1. `npm run qa` en local — doit passer intégralement.
2. Vérifier `git status` : aucune fixture, aucun fichier temporaire, aucun
   `.e2e-dist/` ou rapport Playwright ne doit apparaître (tout est dans
   `.gitignore`, voir § 11).
3. Pousser la branche, laisser le contrôle CI `build-check` (voir § 10)
   passer sur la Pull Request.

## 10. Procédure avant mise en production

Le déploiement production reste **strictement manuel**
(`.github/workflows/deploy-production.yml`, déclenché depuis l'onglet
Actions — voir `CLAUDE.md`, section 4). Avant de le déclencher :

1. `main` doit être vert sur `build-check`.
2. La recette visuelle sur la préproduction
   (`https://preprod.salonemploinc.com`) doit être faite.
3. `npm run qa` en local sur `main` à jour est recommandé si des lots de
   contenu ont été fusionnés depuis la dernière recette.

---

## 11. CI (`build-check`)

Le contrôle obligatoire `.github/workflows/pr-check.yml` (job **`build-check`
— nom volontairement inchangé**, la protection de branche `main` le
référence par ce nom) enchaîne désormais :

1. `npm ci`
2. `npm run content:test` (pipelines + `content:check`)
3. `npm run build` (build de contrôle, comme avant le Lot 4B)
4. `npx playwright install --with-deps chromium`
5. `npm run test:e2e:smoke` (sous-ensemble `@smoke`, desktop uniquement —
   accueil, catalogues exposants/programme/offres, mécanique de sélection,
   page 404)

La recette E2E complète (desktop + mobile, SEO, JSON-LD, accessibilité,
liens internes…) n'est **pas** exécutée en CI — elle resterait fiable mais
ralentirait sensiblement chaque Pull Request. Elle est à lancer en local via
`npm run qa` avant une fusion importante, ou ponctuellement en CI si un
besoin s'en fait sentir plus tard.

Le workflow de déploiement préproduction (`deploy-preprod.yml`) n'a **pas**
été modifié et reste indépendant de `build-check`.

---

## 12. Rapports Playwright

Rapport HTML standard, généré en local (`playwright-report/`, jamais
committé). Pour le consulter après un run :

```bash
npx playwright show-report
```

`playwright-report/` et `test-results/` sont dans `.gitignore`. Aucun
artefact n'est publié en CI dans ce Lot (pour ne pas complexifier le
workflow) — à ajouter plus tard si un besoin réel apparaît.

---

## 13. Nettoyage et sécurité

- Les fixtures ne restent jamais dans `src/content/*` au-delà du temps de
  build (voir § 4) — vérifié par une inspection de `git status` avant
  chaque commit de ce Lot.
- `.e2e-dist/` (builds de test) est entièrement supprimé en fin de run
  (`globalSetup` retourne une fonction de teardown qui s'en charge).
- Aucun `localStorage`/`sessionStorage` n'est utilisé par la mécanique de
  sélection (vérifié explicitement dans
  `tests/e2e/selection-candidater.spec.ts`).
- Un contrôle simple du dépôt (recherche des motifs `SECRET`, `TOKEN`,
  `PASSWORD`, `API_KEY`, `PRIVATE`, sans jamais afficher de valeur) a été
  effectué dans le cadre de l'audit du Lot 4B — aucun `.env` réel, export
  Tally/Google Forms, CV ou donnée candidat n'est présent dans le dépôt.
