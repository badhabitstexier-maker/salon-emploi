/*
  Logique pure et E/S de l'injection, au déploiement, de la configuration
  serveur du module Visibilité (AuthUserFile + dossier de données) — voir
  docs/VISIBILITE.md section 15.9.

  Remplace l'interpolation directe d'une expression `${{ vars.* }}` GitHub
  dans un script `sed` (fragile : un retour à la ligne parasite dans la
  valeur casse la commande sed avant même de s'exécuter, voir historique de
  ce fichier) par :
    - des valeurs lues depuis `process.env` (jamais collées telles quelles
      dans un script shell) ;
    - un nettoyage explicite de tout CR/LF parasite ;
    - une substitution littérale (pas de regex, pas de sed, aucun risque
      d'interprétation d'un caractère spécial présent dans la valeur) ;
    - une vérification qu'aucun placeholder ne subsiste nulle part dans le
      dossier de build avant de laisser le déploiement continuer.

  N'affiche jamais la valeur des chemins dans les messages d'erreur (ce ne
  sont pas des secrets, mais autant limiter les sorties inutiles — voir
  consigne de durcissement).
*/
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const PLACEHOLDER_AUTH_USER_FILE = '__VISIBILITES_AUTH_USER_FILE__';
export const PLACEHOLDER_DATA_DIR = '__VISIBILITES_DATA_DIR__';

const FICHIERS_AUTH_USER_FILE = ['admin/.htaccess', 'admin-api/.htaccess'];
const FICHIER_DATA_DIR = 'api/_visibilites-lib.php';

// Extensions binaires courantes du dépôt : ignorées lors du balayage final
// anti-résidu (lues en UTF-8, un fichier binaire produirait du bruit sans
// jamais contenir légitimement un placeholder texte).
const EXTENSIONS_BINAIRES = new Set([
  '.webp', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.otf',
]);

/** Supprime tout retour chariot (CR) et les espaces/retours à la ligne en bordure. */
export function nettoyerValeur(valeurBrute) {
  if (valeurBrute == null) return '';
  return valeurBrute.replace(/\r/g, '').trim();
}

/**
 * Nettoie puis valide une valeur de configuration : rejette une valeur vide
 * après nettoyage, ou qui contiendrait encore un CR/LF (ne devrait plus
 * arriver après nettoyerValeur, vérifié quand même par défense en profondeur).
 * Lève une Error explicite (sans jamais inclure la valeur elle-même) sinon.
 */
export function validerValeur(nom, valeurBrute) {
  const valeur = nettoyerValeur(valeurBrute);
  if (valeur === '') {
    throw new Error(`${nom} est absente ou vide (variable d'environnement GitHub non définie ou vide).`);
  }
  if (/[\r\n]/.test(valeur)) {
    throw new Error(`${nom} contient encore un retour à la ligne après nettoyage — valeur rejetée.`);
  }
  return valeur;
}

/** Remplacement littéral (pas de regex) de toutes les occurrences de `placeholder` par `valeur`. */
export function substituerPlaceholder(contenu, placeholder, valeur) {
  return contenu.split(placeholder).join(valeur);
}

/** Renvoie les placeholders Visibilité encore présents dans `contenu`, s'il y en a. */
export function trouverPlaceholdersResiduels(contenu) {
  return [PLACEHOLDER_AUTH_USER_FILE, PLACEHOLDER_DATA_DIR].filter((p) => contenu.includes(p));
}

async function listerFichiersRecursif(dossier) {
  const resultats = [];
  const entrees = await readdir(dossier, { withFileTypes: true });
  for (const entree of entrees) {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      resultats.push(...(await listerFichiersRecursif(chemin)));
    } else {
      resultats.push(chemin);
    }
  }
  return resultats;
}

/**
 * Injecte la configuration Visibilité dans `dossierDist` à partir de
 * `env.VISIBILITES_AUTH_USER_FILE` / `env.VISIBILITES_DATA_DIR`.
 *
 * Les deux valeurs sont validées AVANT toute écriture (échec rapide, aucune
 * substitution partielle si l'une des deux est invalide). Après
 * substitution, l'intégralité de `dossierDist` (hors fichiers binaires
 * connus) est balayée pour garantir qu'aucun placeholder ne subsiste.
 *
 * Lève une Error (message multi-lignes si plusieurs problèmes) en cas
 * d'échec ; ne renvoie rien en cas de succès.
 */
export async function injecterConfigurationVisibilite({ dossierDist, env }) {
  const authFile = validerValeur('VISIBILITES_AUTH_USER_FILE', env.VISIBILITES_AUTH_USER_FILE);
  const dataDir = validerValeur('VISIBILITES_DATA_DIR', env.VISIBILITES_DATA_DIR);

  for (const relatif of FICHIERS_AUTH_USER_FILE) {
    const chemin = path.join(dossierDist, relatif);
    const contenu = await readFile(chemin, 'utf8');
    await writeFile(chemin, substituerPlaceholder(contenu, PLACEHOLDER_AUTH_USER_FILE, authFile));
  }

  const cheminDataDir = path.join(dossierDist, FICHIER_DATA_DIR);
  const contenuDataDir = await readFile(cheminDataDir, 'utf8');
  await writeFile(cheminDataDir, substituerPlaceholder(contenuDataDir, PLACEHOLDER_DATA_DIR, dataDir));

  const tousLesFichiers = await listerFichiersRecursif(dossierDist);
  const residus = [];
  for (const fichier of tousLesFichiers) {
    if (EXTENSIONS_BINAIRES.has(path.extname(fichier).toLowerCase())) continue;
    const contenu = await readFile(fichier, 'utf8');
    const trouvés = trouverPlaceholdersResiduels(contenu);
    if (trouvés.length > 0) {
      residus.push(`${path.relative(dossierDist, fichier)} : ${trouvés.join(', ')} non substitué`);
    }
  }

  if (residus.length > 0) {
    throw new Error(residus.join('\n'));
  }
}
