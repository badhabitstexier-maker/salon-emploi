<?php

declare(strict_types=1);

/*
 * Bibliothèque partagée du module Visibilité (Admin-2B, voir docs/VISIBILITE.md).
 *
 * Utilisée par :
 *   - public/api/visibilites.php        (lecture publique, whitelistée)
 *   - public/admin-api/visibilites.php  (CRUD complet, protégé)
 *
 * Miroir volontaire de la logique et des constantes de src/lib/visibilites.ts
 * (PAGES_VISIBILITE, EMPLACEMENTS_VISIBILITE, TYPES_ANNONCEUR,
 * FORMATS_VISIBILITE, statut, éligibilité) — PHP ne peut pas importer du
 * TypeScript, donc cette duplication est assumée. Toute évolution d'une
 * règle métier doit être répercutée aux deux endroits, jamais un seul.
 *
 * Ne contient AUCUN secret. Se protège uniquement contre un accès direct par
 * URL (elle ne fait rien de dangereux si elle l'était, mais n'a aucune
 * raison d'être appelée autrement qu'en `require`).
 */

if (basename(__FILE__) === basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''))) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['erreur' => 'Accès direct non autorisé.']);
    exit;
}

// ---------------------------------------------------------------------------
// Emplacement des données — PRÉPRODUCTION UNIQUEMENT (voir docs/VISIBILITE.md,
// section « Admin-2B — préproduction / production »). Hors webroot, hors Git.
// Ne JAMAIS réutiliser ce chemin pour la production : la production aura son
// propre dossier de données, distinct, à définir explicitement dans un lot
// dédié (voir CLAUDE.md, cadrage Admin-2B point 8/13).
//
// `VISIBILITES_DATA_DIR_TEST` (variable d'environnement, JAMAIS une entrée
// HTTP) permet aux tests fonctionnels (scripts/visibilites-api.test.mjs) de
// pointer vers un dossier temporaire au lieu du chemin OVH réel — voir ce
// script. Absente en production/préproduction réelle : le chemin ci-dessous
// s'applique alors sans modification.
// ---------------------------------------------------------------------------
const VISIBILITES_DATA_DIR_DEFAUT = '/home/salonez/salon-emploi-data-preprod';

function visibilitesDataDir(): string
{
    $repertoireTest = getenv('VISIBILITES_DATA_DIR_TEST');
    return ($repertoireTest !== false && $repertoireTest !== '') ? $repertoireTest : VISIBILITES_DATA_DIR_DEFAUT;
}

function visibilitesDataFile(): string
{
    return visibilitesDataDir() . '/visibilites.json';
}

function visibilitesBackupFile(): string
{
    return visibilitesDataDir() . '/visibilites.json.bak';
}

function visibilitesLockFile(): string
{
    return visibilitesDataDir() . '/visibilites.lock';
}

// Valeurs autorisées — miroir de src/lib/visibilites.ts.
const VISIBILITES_PAGES = ['accueil', 'offres', 'exposants', 'programme'];
const VISIBILITES_EMPLACEMENTS = ['principal'];
const VISIBILITES_TYPES_ANNONCEUR = ['exposant', 'sponsor', 'partenaire', 'institution', 'annonceur_externe', 'autre'];
const VISIBILITES_FORMATS = ['bandeau_horizontal'];
const VISIBILITES_EXPOSANT_ID_REGEX = '/^EXP26-\d{3,}$/';

/** Champs jamais renvoyés au public — voir resumePublicVisibilite(). Liste positive utilisée ailleurs, celle-ci sert de garde-fou de test. */
const VISIBILITES_CHAMPS_INTERNES = ['nomInterne', 'typeAnnonceur', 'exposantId'];

// ---------------------------------------------------------------------------
// Lecture / écriture du fichier de données
// ---------------------------------------------------------------------------

/** Lit visibilites.json. Ne lève jamais d'exception : fichier absent/corrompu -> liste vide (fail-safe, voir cadrage §12). */
function chargerVisibilites(): array
{
    $fichier = visibilitesDataFile();
    if (!is_file($fichier)) {
        return [];
    }
    $contenu = @file_get_contents($fichier);
    if ($contenu === false || trim($contenu) === '') {
        return [];
    }
    $donnees = json_decode($contenu, true);
    if (!is_array($donnees)) {
        return [];
    }
    return array_values($donnees);
}

/** Exécute `$fonction` sous verrou exclusif (flock) — sérialise les écritures concurrentes (deux onglets Admin, etc.). */
function avecVerrouVisibilites(callable $fonction)
{
    $dossier = visibilitesDataDir();
    if (!is_dir($dossier)) {
        throw new RuntimeException('Dossier de données introuvable : ' . $dossier);
    }
    $handle = fopen(visibilitesLockFile(), 'c');
    if ($handle === false) {
        throw new RuntimeException('Impossible d\'ouvrir le fichier de verrouillage.');
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Impossible d\'obtenir le verrou d\'écriture.');
        }
        return $fonction();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/**
 * Écrit visibilites.json de façon atomique : fichier temporaire dans le même
 * dossier puis rename() (atomique sur un même système de fichiers POSIX,
 * donc jamais de JSON partiellement écrit lisible par un lecteur concurrent).
 * Une sauvegarde simple de la version précédente est faite avant écrasement
 * (visibilites.json.bak) — pas un système de versioning, juste un filet de
 * sécurité minimal (voir cadrage Admin-2B §9).
 *
 * DOIT être appelée à l'intérieur de avecVerrouVisibilites().
 */
function sauvegarderVisibilites(array $visibilites): void
{
    $fichier = visibilitesDataFile();
    if (is_file($fichier)) {
        @copy($fichier, visibilitesBackupFile());
    }

    $json = json_encode(array_values($visibilites), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException('Échec de l\'encodage JSON des données.');
    }

    $fichierTemporaire = $fichier . '.tmp-' . bin2hex(random_bytes(6));
    $ecrit = file_put_contents($fichierTemporaire, $json, LOCK_EX);
    if ($ecrit === false) {
        throw new RuntimeException('Échec de l\'écriture du fichier temporaire.');
    }

    if (!rename($fichierTemporaire, $fichier)) {
        @unlink($fichierTemporaire);
        throw new RuntimeException('Échec du remplacement atomique du fichier de données.');
    }
}

// ---------------------------------------------------------------------------
// Identifiants
// ---------------------------------------------------------------------------

/** Génère un identifiant, jamais fourni par le client (voir §8 sécurité — pas de chemin/id livré par l'utilisateur). */
function genererIdVisibilite(array $visibilitesExistantes): string
{
    do {
        $id = 'vis-' . bin2hex(random_bytes(6));
        $dejaUtilise = false;
        foreach ($visibilitesExistantes as $visibilite) {
            if (($visibilite['id'] ?? null) === $id) {
                $dejaUtilise = true;
                break;
            }
        }
    } while ($dejaUtilise);

    return $id;
}

// ---------------------------------------------------------------------------
// Validation métier (serveur — jamais uniquement côté navigateur)
// ---------------------------------------------------------------------------

/**
 * Valide un enregistrement COMPLET (jamais un simple diff, y compris pour
 * une mise à jour partielle : voir admin-api/visibilites.php, qui fusionne
 * d'abord la modification avec l'enregistrement existant puis valide le
 * résultat entier — évite qu'une modification partielle laisse un
 * enregistrement invalide en base).
 *
 * Retourne ['erreurs' => string[], 'valeurs' => array|null]. `valeurs` est
 * un tableau normalisé (types coercés, champs superflus retirés) — utilisé
 * uniquement si `erreurs` est vide.
 */
function validerVisibilite(array $entree): array
{
    $erreurs = [];
    $valeurs = [];

    $nomInterne = trim((string) ($entree['nomInterne'] ?? ''));
    if ($nomInterne === '') {
        $erreurs[] = 'nomInterne est obligatoire.';
    }
    $valeurs['nomInterne'] = $nomInterne;

    $annonceur = trim((string) ($entree['annonceur'] ?? ''));
    if ($annonceur === '') {
        $erreurs[] = 'annonceur est obligatoire.';
    }
    $valeurs['annonceur'] = $annonceur;

    $typeAnnonceur = (string) ($entree['typeAnnonceur'] ?? '');
    if (!in_array($typeAnnonceur, VISIBILITES_TYPES_ANNONCEUR, true)) {
        $erreurs[] = 'typeAnnonceur invalide (valeurs autorisées : ' . implode(', ', VISIBILITES_TYPES_ANNONCEUR) . ').';
    }
    $valeurs['typeAnnonceur'] = $typeAnnonceur;

    $exposantId = $entree['exposantId'] ?? null;
    if ($exposantId !== null && $exposantId !== '') {
        $exposantId = (string) $exposantId;
        if (!preg_match(VISIBILITES_EXPOSANT_ID_REGEX, $exposantId)) {
            $erreurs[] = 'exposantId doit être au format EXP26-XXX.';
        }
        $valeurs['exposantId'] = $exposantId;
    } else {
        $valeurs['exposantId'] = null;
    }

    $format = (string) ($entree['format'] ?? '');
    if (!in_array($format, VISIBILITES_FORMATS, true)) {
        $erreurs[] = 'format invalide (valeurs autorisées : ' . implode(', ', VISIBILITES_FORMATS) . ').';
    }
    $valeurs['format'] = $format;

    $visuel = trim((string) ($entree['visuel'] ?? ''));
    if ($visuel === '') {
        $erreurs[] = 'visuel est obligatoire (chemin ou URL d\'une image déjà présente sur le serveur).';
    }
    $valeurs['visuel'] = $visuel;

    // visuelMobile est optionnel (voir docs/VISIBILITE.md §4/§5bis) : si
    // absent, le rendu public retombe sur `visuel` (desktop) sur toutes les
    // largeurs — ce repli est appliqué côté client (VisibilitySlot), jamais
    // ici : on se contente de normaliser une chaîne vide en null, comme pour
    // `lien`.
    $visuelMobile = $entree['visuelMobile'] ?? null;
    if ($visuelMobile !== null && trim((string) $visuelMobile) !== '') {
        $valeurs['visuelMobile'] = trim((string) $visuelMobile);
    } else {
        $valeurs['visuelMobile'] = null;
    }

    $alt = trim((string) ($entree['alt'] ?? ''));
    if ($alt === '') {
        $erreurs[] = 'alt est obligatoire (texte alternatif, accessibilité).';
    }
    $valeurs['alt'] = $alt;

    $lien = $entree['lien'] ?? null;
    if ($lien !== null && trim((string) $lien) !== '') {
        $valeurs['lien'] = trim((string) $lien);
    } else {
        $valeurs['lien'] = null;
    }

    $pages = $entree['pages'] ?? [];
    if (!is_array($pages) || count($pages) === 0) {
        $erreurs[] = 'pages doit contenir au moins une page.';
        $pages = [];
    }
    $pagesValidees = [];
    foreach ($pages as $page) {
        $page = (string) $page;
        if (!in_array($page, VISIBILITES_PAGES, true)) {
            $erreurs[] = "page invalide : « $page » (valeurs autorisées : " . implode(', ', VISIBILITES_PAGES) . ').';
            continue;
        }
        if (!in_array($page, $pagesValidees, true)) {
            $pagesValidees[] = $page;
        }
    }
    $valeurs['pages'] = $pagesValidees;

    $emplacement = (string) ($entree['emplacement'] ?? 'principal');
    if (!in_array($emplacement, VISIBILITES_EMPLACEMENTS, true)) {
        $erreurs[] = 'emplacement invalide (valeurs autorisées : ' . implode(', ', VISIBILITES_EMPLACEMENTS) . ').';
    }
    $valeurs['emplacement'] = $emplacement;

    [$dateDebutErreur, $dateDebutIso] = validerDateOptionnelle($entree['dateDebut'] ?? null, 'dateDebut');
    if ($dateDebutErreur !== null) {
        $erreurs[] = $dateDebutErreur;
    }
    $valeurs['dateDebut'] = $dateDebutIso;

    [$dateFinErreur, $dateFinIso] = validerDateOptionnelle($entree['dateFin'] ?? null, 'dateFin');
    if ($dateFinErreur !== null) {
        $erreurs[] = $dateFinErreur;
    }
    $valeurs['dateFin'] = $dateFinIso;

    if ($dateDebutIso !== null && $dateFinIso !== null && $dateFinIso < $dateDebutIso) {
        $erreurs[] = 'dateFin doit être postérieure ou égale à dateDebut.';
    }

    $poidsBrut = $entree['poids'] ?? 1;
    if (!is_numeric($poidsBrut) || (int) $poidsBrut != $poidsBrut || (int) $poidsBrut <= 0) {
        $erreurs[] = 'poids doit être un entier strictement positif.';
        $valeurs['poids'] = null;
    } else {
        $valeurs['poids'] = (int) $poidsBrut;
    }

    $actifBrut = $entree['actif'] ?? true;
    $valeurs['actif'] = filter_var($actifBrut, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;

    return ['erreurs' => $erreurs, 'valeurs' => $erreurs === [] ? $valeurs : null];
}

/** @return array{0: string|null, 1: string|null} [message d'erreur ou null, date en ISO 8601 ou null] */
function validerDateOptionnelle($valeur, string $champ): array
{
    if ($valeur === null || $valeur === '') {
        return [null, null];
    }
    $timestamp = strtotime((string) $valeur);
    if ($timestamp === false) {
        return ["$champ n'est pas une date valide.", null];
    }
    return [null, gmdate('Y-m-d\TH:i:s.000\Z', $timestamp)];
}

// ---------------------------------------------------------------------------
// Contrat public — whitelist stricte (voir docs/VISIBILITE.md, cadrage §7)
// ---------------------------------------------------------------------------

/** Réduit une visibilité complète aux seuls champs publics — jamais nomInterne/typeAnnonceur/exposantId. */
function resumePublicVisibilite(array $visibilite): array
{
    return [
        'id' => $visibilite['id'] ?? null,
        'annonceur' => $visibilite['annonceur'] ?? null,
        'visuel' => $visibilite['visuel'] ?? null,
        'visuelMobile' => $visibilite['visuelMobile'] ?? null,
        'alt' => $visibilite['alt'] ?? null,
        'lien' => $visibilite['lien'] ?? null,
        'poids' => $visibilite['poids'] ?? null,
        'dateDebut' => $visibilite['dateDebut'] ?? null,
        'dateFin' => $visibilite['dateFin'] ?? null,
    ];
}

/**
 * Miroir de `visibilitesEnvoyables()` (src/lib/visibilites.ts) : actif +
 * page/emplacement couverts, SANS filtrer sur les dates (réévaluées côté
 * client, voir docs/VISIBILITE.md §7).
 */
function visibilitesEnvoyablesPhp(array $visibilites, string $page, string $emplacement): array
{
    return array_values(array_filter($visibilites, static function (array $visibilite) use ($page, $emplacement): bool {
        if (($visibilite['actif'] ?? false) !== true) {
            return false;
        }
        if (($visibilite['emplacement'] ?? null) !== $emplacement) {
            return false;
        }
        $pages = $visibilite['pages'] ?? [];
        return is_array($pages) && in_array($page, $pages, true);
    }));
}
