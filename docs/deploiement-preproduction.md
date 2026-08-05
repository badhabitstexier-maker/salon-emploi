# Déploiement — Salon de l'Emploi & de la Formation 2026

> Document mis à jour le 06/08/2026.
> Ce document remplace la version précédente qui décrivait un workflow manuel via FileZilla.
> Le déploiement est désormais automatisé via GitHub Actions.

---

## 1. Vue d'ensemble

| Environnement | URL | Déploiement | Déclencheur |
|---|---|---|---|
| Préproduction | `https://preprod.salonemploinc.com` | Automatique | Chaque fusion sur `main` |
| Production | `https://www.salonemploi.nc` | Manuel | Déclenchement depuis l'onglet Actions |

---

## 2. Stack technique

- **Framework** : Astro (sortie statique), Node.js 22 minimum.
- **Hébergement** : OVH mutualisé, transfert FTP.
- **Formulaires** : Web3Forms (clé dans les secrets GitHub, jamais dans le code).
- **Versionnnement** : GitHub, travail par branches et Pull Requests.
- **CI/CD** : GitHub Actions (trois workflows dans `.github/workflows/`).

---

## 3. Workflows GitHub Actions

### 3.1 Contrôle de build sur PR (`pr-check.yml`)

- **Déclencheur** : automatique sur chaque Pull Request vers `main`.
- **Ce qu'il fait** : vérifie que `npm run build` réussit sur la branche.
- **Effet** : bloque la fusion si le build échoue (protection de branche active sur `main`).
- **Ne déploie rien** : c'est un contrôle uniquement, jamais un déploiement.

### 3.2 Déploiement préprod (`deploy-preprod.yml`)

- **Déclencheur** : automatique à chaque push/fusion sur `main`.
- **Ce qu'il fait** : checkout → `npm ci` → `npm run build` → transfert FTP vers `/salon-emploi-preprod`.
- **Durée** : environ 2 minutes.
- **Environnement GitHub** : `preprod` (secrets FTP + `PUBLIC_SITE_URL` + `PUBLIC_NOINDEX=true` + clé Web3Forms).
- **Résultat** : site accessible sur `https://preprod.salonemploinc.com`.

### 3.3 Déploiement production (`deploy-production.yml`)

- **Déclencheur** : manuel uniquement, depuis l'onglet Actions de GitHub.
- **Ce qu'il fait** : même chose que la préprod, mais avec les secrets de production.
- **Environnement GitHub** : `production` (à configurer quand `salonemploi.nc` sera prêt).
- **Note** : ne pas déclencher avant que l'environnement `production` soit configuré sur GitHub.

---

## 4. Variables d'environnement

Les variables vivent **exclusivement** dans les environnements GitHub (Settings → Environments). Jamais dans le code, un commit ou un fichier de documentation.

| Variable | Préprod | Production |
|---|---|---|
| `PUBLIC_SITE_URL` | `https://preprod.salonemploinc.com` | `https://www.salonemploi.nc` |
| `PUBLIC_NOINDEX` | `true` | absent (ou `false`) |
| `PUBLIC_WEB3FORMS_ACCESS_KEY` | clé Web3Forms | même clé |
| `FTP_HOST` | serveur FTP OVH | même serveur |
| `FTP_USERNAME` | identifiant FTP | identifiant FTP prod |
| `FTP_PASSWORD` | mot de passe FTP | mot de passe FTP prod |
| `FTP_REMOTE_DIR` | `/salon-emploi-preprod` | dossier racine prod |

**Comportement selon l'environnement :**

| | Préprod | Production |
|---|---|---|
| Meta robots | `noindex, nofollow` | absent |
| `robots.txt` | `Disallow: /` | `Allow: /` + `Sitemap:` |
| Sitemap | désactivé | généré |
| Canoniques / OG | domaine préprod | domaine prod |
| Redirections Web3Forms | domaine préprod | domaine prod |

---

## 5. Workflow de développement

```
1. Partir de main à jour
   git switch main && git pull origin main

2. Créer une branche dédiée
   git switch -c feat/ma-modification

3. Développer et committer

4. Pousser la branche
   git push origin feat/ma-modification

5. Ouvrir une Pull Request sur GitHub
   → le build-check se déclenche automatiquement

6. Si le build est vert → fusionner la PR

7. La préprod se met à jour automatiquement (~2 minutes)

8. Vérifier sur https://preprod.salonemploinc.com
   Rechargement sans cache : Cmd + Maj + R

9. Si un problème est détecté : nouvelle branche de correctif,
   même cycle — pas de manipulation FTP

10. Après chaque fusion, mettre le dépôt local à jour
    git switch main && git pull origin main
```

---

## 6. Recette minimale après déploiement

Vérifier sur `https://preprod.salonemploinc.com` :

- Page d'accueil et logo.
- Favicon.
- Navigation desktop et mobile (menu ouvert + fermé).
- Pages : Le salon, Village, Exposants, Programme, Préparer ma visite, Exposer.
- Liens internes et ancres.
- Images.
- Formulaires (soumission + réception Web3Forms).
- Absence d'erreurs 404.
- Absence de débordement horizontal.
- Affichage à 1440 px, 1024 px et 390 px.

---

## 7. Passage en production

À faire uniquement quand `salonemploi.nc` est configuré sur OVH et prêt.

1. Créer l'environnement `production` sur GitHub (Settings → Environments).
2. Y ajouter les 7 secrets avec les valeurs de production.
3. Vérifier que `main` est validé sur la préprod.
4. Aller dans l'onglet **Actions** → workflow **"Déployer en production (manuel)"** → **Run workflow**.
5. Vérifier sur `https://www.salonemploi.nc`.

---

## 8. Règles absolues

- Ne jamais ajouter `.env`, `dist/` ou `node_modules/` à Git.
- Ne jamais inscrire une clé ou un mot de passe dans le code ou la documentation.
- Ne jamais pousser directement sur `main` (protection de branche active).
- Ne jamais transférer des fichiers manuellement via FileZilla — le workflow s'en charge.
- Ne jamais fusionner une PR dont le build-check est rouge.
- Ne jamais déclencher le workflow de production sans avoir validé la préprod.
