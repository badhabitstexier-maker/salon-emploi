<?php

declare(strict_types=1);

/*
 * API Admin du module Visibilité — Admin-2B (voir docs/VISIBILITE.md).
 *
 * Protégée par Basic Auth Apache (voir public/admin-api/.htaccess, même
 * .htpasswd que /admin — si cette requête atteint ce script, Apache a déjà
 * validé des identifiants LabEvents valides). Ce script ne revérifie donc
 * pas l'authentification lui-même : il ajoute une protection CSRF distincte
 * (Basic Auth seul ne protège pas contre une requête forgée, voir cadrage
 * Admin-2B §6) et valide strictement toute donnée reçue (§7).
 *
 *   GET    /admin-api/visibilites.php            -> liste complète + jeton CSRF
 *   POST   /admin-api/visibilites.php             -> création
 *   PUT    /admin-api/visibilites.php?id=vis-xxx  -> modification (partielle, fusionnée puis validée en entier)
 *   DELETE /admin-api/visibilites.php?id=vis-xxx  -> suppression
 *
 * Activer/désactiver une campagne est un cas particulier de PUT (seul le
 * champ `actif` change) — pas d'endpoint séparé, pour ne pas dupliquer la
 * logique de fusion/validation.
 *
 * Chaque poignée de méthode calcule un résultat ['statut' => int, 'corps' =>
 * array] SANS jamais appeler exit() pendant qu'un verrou d'écriture
 * (avecVerrouVisibilites, voir _visibilites-lib.php) est tenu — la réponse
 * n'est envoyée qu'une fois revenu hors du verrou, pour que le `finally` qui
 * le libère s'exécute toujours normalement.
 */

require __DIR__ . '/../api/_visibilites-lib.php';

// -----------------------------------------------------------------------
// Session + CSRF (voir cadrage Admin-2B §6). Cookie de session strict —
// SameSite=Strict, Secure (la préprod est en HTTPS, voir docs/ADMIN.md),
// HttpOnly (le jeton CSRF est transmis dans le corps de réponse, jamais lu
// depuis le cookie par le JavaScript client).
// -----------------------------------------------------------------------
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/admin-api/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (empty($_SESSION['visibilites_csrf_token']) || !is_string($_SESSION['visibilites_csrf_token'])) {
    $_SESSION['visibilites_csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['visibilites_csrf_token'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

/** @return array{statut: int, corps: array} */
function erreurApi(int $statut, string $message, array $details = []): array
{
    $corps = ['erreur' => $message];
    if ($details !== []) {
        $corps['details'] = $details;
    }
    return ['statut' => $statut, 'corps' => $corps];
}

/** @return array{statut: int, corps: array} */
function succesApi(array $corps): array
{
    return ['statut' => 200, 'corps' => $corps];
}

/**
 * Vérifie le jeton CSRF (en-tête X-CSRF-Token, comparé au jeton de session
 * via hash_equals — résistant au timing attack) ET l'en-tête Origin (repli
 * sur Referer si Origin absent) : les deux protections sont distinctes et
 * cumulatives (voir cadrage Admin-2B §6 — Basic Auth ne suffit pas). Renvoie
 * un résultat d'erreur si l'un des deux contrôles échoue, null sinon.
 */
function verifierCsrfEtOrigine(string $jetonAttendu): ?array
{
    $jetonRecu = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($jetonRecu) || $jetonRecu === '' || !hash_equals($jetonAttendu, $jetonRecu)) {
        return erreurApi(403, 'Jeton CSRF manquant ou invalide.');
    }

    $origineAttendue = (($_SERVER['HTTPS'] ?? '') !== '' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
    $origineRecue = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origineRecue === null) {
        // Repli sur Referer si le navigateur n'envoie pas Origin (rare pour
        // un fetch same-origin, mais certains agents l'omettent).
        $referer = $_SERVER['HTTP_REFERER'] ?? '';
        $origineRecue = $referer !== '' ? (parse_url($referer, PHP_URL_SCHEME) . '://' . parse_url($referer, PHP_URL_HOST)) : '';
    }
    if ($origineRecue !== $origineAttendue) {
        return erreurApi(403, 'Origine de la requête refusée.');
    }

    return null;
}

/** Corps JSON reçu — taille bornée (200 Ko) pour éviter tout abus, jamais de confiance dans le contenu. */
function lireCorpsJson(): array
{
    $brut = file_get_contents('php://input', false, null, 0, 200 * 1024);
    if ($brut === false || trim((string) $brut) === '') {
        return [];
    }
    $donnees = json_decode($brut, true);
    return is_array($donnees) ? $donnees : [];
}

function traiterCreation(array $entree): array
{
    return avecVerrouVisibilites(function () use ($entree): array {
        $toutes = chargerVisibilites();
        $resultat = validerVisibilite($entree);
        if ($resultat['erreurs'] !== []) {
            return erreurApi(422, 'Données invalides.', $resultat['erreurs']);
        }
        $nouvelle = $resultat['valeurs'];
        $nouvelle['id'] = genererIdVisibilite($toutes);
        $toutes[] = $nouvelle;
        sauvegarderVisibilites($toutes);
        return succesApi(['visibilite' => $nouvelle]);
    });
}

function traiterModification(string $id, array $entree): array
{
    return avecVerrouVisibilites(function () use ($id, $entree): array {
        $toutes = chargerVisibilites();
        $index = null;
        foreach ($toutes as $i => $visibilite) {
            if (($visibilite['id'] ?? null) === $id) {
                $index = $i;
                break;
            }
        }
        if ($index === null) {
            return erreurApi(404, 'Campagne introuvable.');
        }

        // Fusion partielle puis validation de l'enregistrement COMPLET
        // (jamais seulement du diff) — couvre aussi bien « modifier la
        // fiche » que « activer/désactiver » (seul `actif` change alors).
        $fusion = array_merge($toutes[$index], $entree);
        $resultat = validerVisibilite($fusion);
        if ($resultat['erreurs'] !== []) {
            return erreurApi(422, 'Données invalides.', $resultat['erreurs']);
        }
        $misAJour = $resultat['valeurs'];
        $misAJour['id'] = $id;
        $toutes[$index] = $misAJour;
        sauvegarderVisibilites($toutes);
        return succesApi(['visibilite' => $misAJour]);
    });
}

function traiterSuppression(string $id): array
{
    return avecVerrouVisibilites(function () use ($id): array {
        $toutes = chargerVisibilites();
        $restantes = array_values(array_filter($toutes, static fn (array $v): bool => ($v['id'] ?? null) !== $id));
        if (count($restantes) === count($toutes)) {
            return erreurApi(404, 'Campagne introuvable.');
        }
        sauvegarderVisibilites($restantes);
        return succesApi(['supprime' => true, 'id' => $id]);
    });
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($methode === 'GET') {
        $resultat = succesApi(['visibilites' => chargerVisibilites()]);
    } elseif ($methode === 'POST') {
        $erreur = verifierCsrfEtOrigine($csrfToken);
        $resultat = $erreur ?? traiterCreation(lireCorpsJson());
    } elseif ($methode === 'PUT') {
        $id = (string) ($_GET['id'] ?? '');
        if (!preg_match('/^vis-[0-9a-f]{12}$/', $id)) {
            $resultat = erreurApi(400, 'Identifiant de campagne invalide ou manquant.');
        } else {
            $erreur = verifierCsrfEtOrigine($csrfToken);
            $resultat = $erreur ?? traiterModification($id, lireCorpsJson());
        }
    } elseif ($methode === 'DELETE') {
        $id = (string) ($_GET['id'] ?? '');
        if (!preg_match('/^vis-[0-9a-f]{12}$/', $id)) {
            $resultat = erreurApi(400, 'Identifiant de campagne invalide ou manquant.');
        } else {
            $erreur = verifierCsrfEtOrigine($csrfToken);
            $resultat = $erreur ?? traiterSuppression($id);
        }
    } else {
        header('Allow: GET, POST, PUT, DELETE');
        $resultat = erreurApi(405, 'Méthode non autorisée.');
    }
} catch (Throwable $exception) {
    error_log('[admin-api/visibilites.php] ' . $exception->getMessage());
    $resultat = erreurApi(500, 'Erreur interne — modification non appliquée.');
}

http_response_code($resultat['statut']);
$corps = $resultat['corps'];
// Le jeton CSRF est renvoyé à CHAQUE réponse (succès ou erreur) : une page
// Admin restée ouverte peut ainsi retenter une écriture sans recharger.
$corps['csrfToken'] = $csrfToken;
echo json_encode($corps, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
