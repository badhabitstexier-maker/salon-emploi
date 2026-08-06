# CLAUDE.md — Site du Salon de l'Emploi & de la Formation 2026

> Constitution du projet pour Claude Code. À lire au début de **chaque** session.
> Objectif de ce fichier : garder le cap, éviter le sur-engineering, tenir le périmètre V1.
> v3 — intègre les corrections ChatGPT + arbitrages Philippe du 04/08/2026 + workflow CI/CD du 06/08/2026.

---

## 1. Projet en une phrase

Site vitrine événementiel pour le **Salon de l'Emploi & de la Formation 2026**, organisé par **LabEvents** à Nouméa (Nouvelle-Calédonie). Deux fonctions, dans cet ordre de priorité :

1. **V1 — commercialiser les stands** auprès des entreprises, organismes de formation et partenaires.
2. **V2 — informer le public** (exposants, programme, infos pratiques).

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
  - ⚠️ Le **Village Maintenance & Industrie** est **suspendu** tant que le partenariat AMD n'est pas confirmé. Ne pas le mentionner sur le site ni dans les documents tant que Philippe n'a pas donné son feu vert explicite. Quand l'AMD sera confirmée, les deux halls fusionneront avec le Village dans une configuration à trois univers.
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

**Fournisseur de formulaire retenu (04/08/2026) : Web3Forms.** Choisi pour son quota gratuit plus généreux, l'absence de branding sur les emails, et une meilleure adéquation à un usage en pic ponctuel (période de commercialisation des stands) plutôt qu'un flux régulier. Le Lot 2 peut démarrer.

---

## 4. Stack technique (validée)

- **Astro** (dernière version stable), sortie **statique** (`output: 'static'`).
- **Tailwind CSS v4** pour le style, via le plugin officiel `@tailwindcss/vite` (méthode actuelle recommandée — `@astrojs/tailwind` est dépréciée pour Tailwind v4, ne pas la réintroduire). Configuration **CSS-first** : les tokens vivent dans `src/styles/global.css` via la directive `@theme`, pas dans un fichier `tailwind.config.js`.
- **React en îlots** UNIQUEMENT pour les briques réellement interactives (filtre exposants, filtre programme). Le reste reste statique. Ne pas transformer le site en SPA.
- **Formulaires (V1)** : **Web3Forms** (retenu le 04/08/2026 — voir section 3bis). **Pas de Supabase, pas de base de données en V1.**
- **Contenus dynamiques** (exposants, programme) : **Astro Content Collections** (fichiers de données), pas de base.
- **CMS d'édition** : aucun au départ (édition à la main des fichiers de contenu). Keystatic sera ajouté plus tard, dans un lot dédié (Lot 7).
- **Node** : 20 LTS ou 22.
- **Hébergement cible** : OVH, en fichiers statiques (dépôt du dossier `dist/`).
- **Domaine — cohérence www/apex** : décider si `www.salonemploi.nc` ou `salonemploi.nc` (sans www) est la version canonique, et configurer une redirection 301 systématique de l'autre vers celle-ci. Sans ça, Google peut indexer les deux versions séparément et diluer le référencement. Choix par défaut proposé : `www.salonemploi.nc` (cohérent avec le prompt Lot 0 déjà rédigé) — à confirmer par Philippe lors de la configuration DNS/hébergement, pas bloquant pour le Lot 0 en local.
- **Environnement de prévisualisation** : chaque lot doit produire une version consultable sans toucher au serveur de production.

**Workflow de déploiement (décision du 06/08/2026 — méthode alignée sur l'écosystème nounou) :**
1. Développement sur une branche dédiée, PR ouverte vers `main`.
2. Un contrôle automatique (`.github/workflows/pr-check.yml`) vérifie que `npm run build` réussit sur la PR — la fusion est bloquée si le build échoue (protection de branche activée sur `main`).
3. **Fusion directe une fois le contrôle vert**, sans attendre de recette visuelle préalable sur la préproduction.
4. La fusion sur `main` déclenche **automatiquement** le déploiement sur la préprod (`.github/workflows/deploy-preprod.yml`) — build + transfert FTP vers `/salon-emploi-preprod`, sans action manuelle.
5. La recette visuelle se fait **après** la fusion, directement sur `https://preprod.salonemploinc.com`.
6. Si un problème est détecté : nouvelle branche de correctif, même cycle (PR → contrôle → fusion → déploiement auto).
7. Après chaque fusion, mettre le dépôt local à jour (`git switch main && git pull origin main`) pour rester synchrone — cette synchronisation n'a aucun effet sur ce qui est déployé.
8. Le passage en production reste **strictement manuel** : déclenchement du workflow `.github/workflows/deploy-production.yml` depuis l'onglet Actions, uniquement quand `main` est validé sur la préprod.

Les secrets (clé Web3Forms, identifiants FTP, `PUBLIC_SITE_URL`, `PUBLIC_NOINDEX`) vivent exclusivement dans les environnements GitHub `preprod` et `production` (Settings → Environments) — jamais dans le code, un commit, ou un fichier de documentation.
- **Versionnement** : Git, un commit propre après chaque lot.

### Ce qu'on NE fait PAS (garde-fous anti-usine-à-gaz)
- Pas de back-office custom en V1.
- Pas de base de données en V1.
- Pas de Next.js, pas de rendu côté serveur.
- Pas de dépendances lourdes non justifiées.
- On ne code pas au-delà du lot en cours.

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

Principes visuels : **mobile-first**, grands titres, interface claire et aérée, photos de personnes et de gestes professionnels concrets. **Distinction visuelle nette** entre Hall Emploi-Formation (marine/orange) et Village Maintenance & Industrie (accent `village`).

**Typographie (décision du 04/08/2026)** : intégrer une police condensée sans serif (type Barlow Condensed), **auto-hébergée** (pas de CDN tiers), pour coller au caractère événementiel identifié sur la planche de référence. Remplace la pile système actuelle sur les titres au minimum.

Le mockup de direction artistique fourni par Philippe (aperçu des 7 pages) sert de **référence d'inspiration** pour la hiérarchie visuelle et la densité d'information — pas de gabarit à reproduire pixel pour pixel. Il ne remplace pas les tokens ci-dessus, qu'il faut respecter.

**Référence graphique principale : `public/references/preview-pages-site.png`.**
Pour la page d'accueil, la vignette « 1. ACCUEIL » de ce fichier constitue la **référence prioritaire**. Le rendu ne doit pas être reproduit pixel par pixel, mais doit reprendre :
- la densité visuelle ;
- la composition ;
- le rapport texte/image ;
- la hiérarchie ;
- les blocs colorés ;
- le caractère événementiel.

Le fichier doit être présent dans le dépôt à ce chemin avant qu'une session Claude Code ne s'y réfère.

---

## 6. Arborescence & structure des fichiers

**Décision validée (04/08/2026) : on reste sur 7 pages pour la V1.** Pas de page Contact séparée, pas de page Actualités — ces ajouts sont écartés pour tenir le délai.

Pages (7 au total) :
- `/` — Accueil
- `/le-salon` — Le salon
- `/village` — Village Maintenance & Industrie
- `/exposants` — Exposants (liste + filtres + fiches)
- `/programme` — Programme (par jour + filtres)
- `/preparer-ma-visite` — Préparer ma visite
- `/exposer` — Exposer / Contact (page commerciale unique — inclut la prise de contact visiteur ET exposant)

Pages hors arborescence commerciale (accessibles uniquement en pied de page, ne comptent pas dans les 7) :
- Mentions légales
- Politique de confidentialité / gestion des données des formulaires

Structure cible :
```
src/
  layouts/      → Layout global (nav + footer + <head> SEO)
  components/   → composants réutilisables (Hero, Cta, Card, Nav, Footer…)
  pages/        → les 7 routes + mentions-legales + confidentialite
  content/      → Content Collections (exposants/, programme/) — schémas définis, données ajoutées plus tard
  styles/       → styles globaux si nécessaire
public/         → images, favicon, dossier exposant PDF
```

---

## 7. Priorité V1 (l'ordre des lots) — avec critères de validation

Un lot n'est considéré **terminé** que si tous ses critères sont cochés. Sans ça, ne pas déclarer le lot fini dans le compte rendu de session.

### Lot 0 — Fondations
Contenu : projet Astro + Tailwind + tokens charte + Layout global (nav + footer) + 7 routes navigables (placeholders acceptés ici) + base SEO + config build statique.

Critères de validation :
- [ ] Les 7 routes s'ouvrent sans erreur.
- [ ] La navigation mobile fonctionne (menu burger ou équivalent).
- [ ] Le build produit correctement `dist/` sans erreur.
- [ ] Aucun lien interne cassé.
- [ ] Titre et meta description présents sur chaque page.
- [ ] Aucun débordement horizontal sur mobile (375px de large).

### Lot 1 — Accueil
Contenu réel attendu à partir de ce lot (voir section 8 sur les contenus).
Contenu : hero, deux univers, chiffres clés, double CTA (« Devenir exposant » / « Préparer ma visite »), section partenaires **masquée ou en placeholder neutre** (cf. section 3).

Critères de validation :
- [ ] Contenu réel intégré (pas de `{{À COMPLÉTER}}` sauf donnée factuelle manquante confirmée).
- [ ] Les deux CTA sont fonctionnels et pointent vers les bonnes ancres/pages.
- [ ] Responsive vérifié mobile + desktop.
- [ ] Aucun logo de partenaire non confirmé affiché.

### Lot 2 — Exposer/Contact (débloque la commercialisation)
Pré-requis : fournisseur de formulaire choisi et validé (section 4).
Contenu : bénéfices exposants, formules, dossier PDF téléchargeable, formulaire fonctionnel (visiteur + exposant), page de confirmation.

Critères de validation :
- [ ] Le formulaire envoie effectivement un email et affiche une confirmation.
- [ ] Le dossier exposant PDF est téléchargeable (ou placeholder si non fourni — à signaler explicitement).
- [ ] Aucune information tarifaire non confirmée n'est publiée en dur.

### Lot 3 — Le salon + Village
Contenu réel, distinction visuelle nette entre les deux univers.

Critères de validation :
- [ ] Contenu réel intégré.
- [ ] Contrôle mobile complet sur les deux pages.
- [ ] Mention AMD conforme à la clause de la section 2.

**→ MISE EN LIGNE V1 possible à ce stade.**

### Lot 4 — Exposants (Content Collection + filtres)
### Lot 5 — Programme (Content Collection + filtres)
### Lot 6 — Préparer ma visite
### Lot 7 (plus tard) — intégration du CMS d'édition (Keystatic)

---

## 8. Contenus — règle d'intégration

**À partir du Lot 1**, les contenus validés fournis par Philippe (ou préparés via ChatGPT) doivent être **intégrés directement**, pas laissés en placeholder par défaut. Un placeholder `{{À COMPLÉTER : …}}` n'est utilisé que lorsqu'une donnée factuelle manque réellement (tarif, logo, exposant, programme, lien, information pratique non confirmée) — jamais comme choix par défaut de prudence.

Exception : le **Lot 0** reste volontairement en placeholders génériques, puisqu'il ne sert qu'à valider l'architecture, pas le rendu.

---

## 9. SEO (important : événement daté)

- Chaque page : `<title>` et meta description uniques et pertinents.
- Mots-clés cibles : « salon emploi formation Nouméa », « salon Nouville octobre 2026 », « emploi formation Nouvelle-Calédonie ».
- Données structurées **schema.org/Event** sur l'accueil (nom, dates, lieu, gratuité).
- `sitemap` + `robots.txt` générés.
- Balises Open Graph pour le partage réseaux sociaux.
- Images optimisées (`astro:assets`), attribut `alt` systématique.

---

## 10. Conventions de code

- Composants nommés en PascalCase, un fichier par composant.
- Couleurs et espacements via tokens Tailwind, **jamais** de hex en dur dans le markup.
- Accessibilité : structure sémantique (`header`, `main`, `nav`, `footer`), contrastes suffisants, navigation clavier.
- Responsive systématique, pensé mobile d'abord.
- Textes en **français**.
- **Contraste sur fond `village` (vert)** : le corps de texte doit être en `encre`/`marine`, jamais en blanc — le blanc sur `village` tombe sous le seuil d'accessibilité (testé à 3,2:1, sous le minimum WCAG AA de 4,5:1). Le blanc reste acceptable uniquement pour de grands titres à fort corps. Écart assumé par rapport à la planche de référence, documenté ici pour ne pas être réintroduit par erreur dans un futur lot.

---

## 11. Méthode de travail (discipline quota)

- **Une tâche par session**, cadrée petit — un lot à la fois.
- `git commit` propre à la fin de chaque lot, message explicite.
- `/clear` entre deux lots, `/compact` si la session s'allonge.
- **Sonnet par défaut.** Opus réservé à l'architecture initiale ou aux blocages difficiles réels et identifiés (vérifier `/usage` avant une session Opus sur Pro, le pool est partagé). Haiku possible pour les tâches répétitives (reformatage de données).
- **Pull Request automatique (décision du 04/08/2026) : à la fin de chaque lot, après le commit et le push, ouvrir systématiquement une Pull Request vers `main` sans attendre que Philippe le demande.** Ne pas fusionner soi-même — la fusion reste une décision de Philippe après relecture — mais l'ouverture de la PR ne doit plus dépendre d'une demande explicite.
- À la fin de chaque session : compte rendu court avec (a) les critères de validation cochés/non cochés du lot, (b) les `{{À COMPLÉTER}}` restants, (c) le lien/commande de prévisualisation, (d) **le lien de la Pull Request ouverte**, (e) la prochaine étape suggérée.

---

## 12. Rôles (qui fait quoi)

- **ChatGPT** (ne voit pas le dépôt) : contenus rédactionnels définitifs, hiérarchie éditoriale, préparation des données exposants/programme, relecture de captures, rédaction des corrections à transmettre.
- **Claude Code** (voit le dépôt) : architecture, code, tests, build, Git, déploiement, **et sa propre revue dans la session** (ne pas faire transiter le code vers ChatGPT pour audit).
- **Philippe** : seul décideur. Valide contenus, palette, fournisseur de formulaire, et surtout **toute mention de partenariat ou logo** avant publication.
