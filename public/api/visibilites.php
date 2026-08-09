<?php

declare(strict_types=1);

/*
 * Endpoint public de lecture — Admin-2B (voir docs/VISIBILITE.md).
 *
 * GET /api/visibilites.php?page=<accueil|offres|exposants|programme>&emplacement=<principal>
 *
 * Aucune authentification (délibérément public — c'est ce que consomme le
 * site vitrine, voir src/lib/visibilite-ui.ts). GET uniquement. Renvoie
 * strictement la liste des campagnes actives couvrant ce (page, emplacement),
 * réduites aux champs whitelistés (voir resumePublicVisibilite() dans
 * _visibilites-lib.php) — jamais nomInterne/typeAnnonceur/exposantId.
 *
 * Ne filtre PAS sur les dates (dateDebut/dateFin) : c'est le navigateur qui
 * réévalue la fenêtre de dates à chaque chargement, avec l'heure réelle du
 * visiteur (voir docs/VISIBILITE.md §7 et src/lib/visibilite-ui.ts).
 *
 * Fail-safe : toute erreur interne renvoie une liste vide avec un statut 200
 * — jamais d'erreur visible côté public, jamais de page bloquée (voir
 * cadrage Admin-2B §12 « fallback », la publicité est non critique).
 */

header('Content-Type: application/json; charset=utf-8');
// Jamais de cache : une activation/désactivation doit être visible sans délai.
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/_visibilites-lib.php';

function repondreVide(): void
{
    echo json_encode(['visibilites' => []]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['erreur' => 'Méthode non autorisée.']);
    exit;
}

$page = (string) ($_GET['page'] ?? '');
$emplacement = (string) ($_GET['emplacement'] ?? 'principal');

// Page/emplacement absents ou invalides : réponse vide plutôt qu'une erreur
// — un appelant mal formé ne doit jamais planter, et on ne renvoie jamais
// "toutes les pages" par défaut (voir cadrage Admin-2B §4, whitelist stricte
// des champs ET du périmètre demandé).
if (!in_array($page, VISIBILITES_PAGES, true) || !in_array($emplacement, VISIBILITES_EMPLACEMENTS, true)) {
    repondreVide();
}

try {
    $toutes = chargerVisibilites();
    $envoyables = visibilitesEnvoyablesPhp($toutes, $page, $emplacement);
    $resumes = array_map('resumePublicVisibilite', $envoyables);
    echo json_encode(['visibilites' => array_values($resumes)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $exception) {
    error_log('[visibilites.php public] ' . $exception->getMessage());
    repondreVide();
}
