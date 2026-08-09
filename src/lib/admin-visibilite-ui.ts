/*
  Contrôleur client de l'Admin Visibilité (Admin-2B, voir docs/VISIBILITE.md).
  Seul module qui parle à /admin-api/visibilites.php — partagé entre
  src/pages/admin/visibilite/index.astro (liste + actions) et
  src/pages/admin/visibilite/formulaire.astro (création/modification).

  Le cookie de session PHP est géré automatiquement par le navigateur
  (fetch en same-origin envoie les cookies par défaut) : il n'y a donc rien
  à faire ici pour la session elle-même. Le jeton CSRF, en revanche, doit
  être lu depuis la réponse JSON et renvoyé explicitement dans l'en-tête
  X-CSRF-Token de toute requête d'écriture (voir cadrage Admin-2B §6 — Basic
  Auth seul ne protège pas contre une requête forgée).
*/
import type { Visibilite } from './visibilites';

export interface SessionAdmin {
  csrfToken: string;
}

export interface ResultatEcriture {
  ok: boolean;
  statut: number;
  visibilite?: Visibilite;
  erreurs?: string[];
  messageErreur?: string;
}

const ENDPOINT = '/admin-api/visibilites.php';

async function requeteJson(url: string, init: RequestInit = {}): Promise<{ statut: number; corps: any }> {
  const reponse = await fetch(url, { ...init, credentials: 'same-origin' });
  let corps: any = {};
  try {
    corps = await reponse.json();
  } catch {
    corps = {};
  }
  return { statut: reponse.status, corps };
}

/** Premier appel de la page : récupère la liste complète ET le jeton CSRF de session. Null si l'API est injoignable. */
export async function chargerListeEtSession(): Promise<{ visibilites: Visibilite[]; session: SessionAdmin } | null> {
  try {
    const { statut, corps } = await requeteJson(ENDPOINT);
    if (statut !== 200 || typeof corps.csrfToken !== 'string') return null;
    return { visibilites: Array.isArray(corps.visibilites) ? corps.visibilites : [], session: { csrfToken: corps.csrfToken } };
  } catch {
    return null;
  }
}

function enTetesEcriture(session: SessionAdmin): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken };
}

function interpreterReponseEcriture(statut: number, corps: any, session: SessionAdmin): ResultatEcriture {
  if (typeof corps.csrfToken === 'string') {
    session.csrfToken = corps.csrfToken; // toujours renvoyé, même en erreur — la session reste utilisable sans recharger
  }
  if (statut >= 200 && statut < 300) {
    return { ok: true, statut, visibilite: corps.visibilite };
  }
  return {
    ok: false,
    statut,
    erreurs: Array.isArray(corps.details) ? corps.details : undefined,
    messageErreur: typeof corps.erreur === 'string' ? corps.erreur : 'Erreur inattendue.',
  };
}

export async function creerVisibilite(session: SessionAdmin, donnees: Record<string, unknown>): Promise<ResultatEcriture> {
  try {
    const { statut, corps } = await requeteJson(ENDPOINT, {
      method: 'POST',
      headers: enTetesEcriture(session),
      body: JSON.stringify(donnees),
    });
    return interpreterReponseEcriture(statut, corps, session);
  } catch {
    return { ok: false, statut: 0, messageErreur: 'Réseau indisponible — la campagne n\'a pas été créée.' };
  }
}

export async function modifierVisibilite(
  session: SessionAdmin,
  id: string,
  donnees: Record<string, unknown>,
): Promise<ResultatEcriture> {
  try {
    const { statut, corps } = await requeteJson(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: enTetesEcriture(session),
      body: JSON.stringify(donnees),
    });
    return interpreterReponseEcriture(statut, corps, session);
  } catch {
    return { ok: false, statut: 0, messageErreur: 'Réseau indisponible — la modification n\'a pas été appliquée.' };
  }
}

/** Activer/désactiver n'est qu'un PUT partiel (seul `actif` change) — voir docs/VISIBILITE.md. */
export function basculerActif(session: SessionAdmin, id: string, actif: boolean): Promise<ResultatEcriture> {
  return modifierVisibilite(session, id, { actif });
}

export async function supprimerVisibilite(session: SessionAdmin, id: string): Promise<ResultatEcriture> {
  try {
    const { statut, corps } = await requeteJson(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': session.csrfToken },
    });
    return interpreterReponseEcriture(statut, corps, session);
  } catch {
    return { ok: false, statut: 0, messageErreur: 'Réseau indisponible — la suppression n\'a pas été appliquée.' };
  }
}

/** Une seule visibilité, retrouvée dans la liste complète (pas d'endpoint GET par id — volume attendu trop faible pour le justifier). */
export async function chargerUneVisibilite(id: string): Promise<{ visibilite: Visibilite | null; session: SessionAdmin } | null> {
  const resultat = await chargerListeEtSession();
  if (!resultat) return null;
  return { visibilite: resultat.visibilites.find((v) => v.id === id) ?? null, session: resultat.session };
}
