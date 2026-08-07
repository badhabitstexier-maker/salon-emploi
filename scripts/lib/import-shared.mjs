/*
  Petits utilitaires génériques partagés par les pipelines d'import Lot 4A
  (exposants, programme). Le pipeline Offres (Lot 3, scripts/lib/offres-import-core.mjs)
  contient des fonctions équivalentes mais n'est volontairement pas modifié
  ici (voir mission Lot 4A, section 2 : « ne pas modifier le pipeline Offres
  dans ce Lot »). Factoriser après coup, une fois les trois pipelines
  stabilisés, plutôt que de risquer une régression sur un pipeline déjà
  validé.
*/

/** Découpe une cellule CSV en liste, séparateur `|`, valeurs vides ignorées. */
export function listeDepuisCellule(valeur) {
  return (valeur ?? '')
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** Interprète une cellule oui/non ; retourne `defaut` si vide, `undefined` si invalide. */
export function boolDepuisCellule(valeur, defaut) {
  const v = (valeur ?? '').trim().toLowerCase();
  if (v === '') return defaut;
  if (['oui', 'true', 'vrai', '1', 'yes'].includes(v)) return true;
  if (['non', 'false', 'faux', '0', 'no'].includes(v)) return false;
  return undefined;
}

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Assigne un identifiant séquentiel `PREFIXE-NNN` aux entrées qui n'en ont
 * pas, en partant du plus grand numéro déjà vu (existants + lot). Ne
 * réattribue jamais un numéro déjà utilisé. Modifie les entrées en place
 * (mute `champId`) et retourne le journal des attributions.
 */
export function assignerIdentifiantsManquants(entites, identifiantsExistants, { prefixe, champId }) {
  const regexId = new RegExp(`^${prefixe}-(\\d+)$`);
  const utilises = new Set(identifiantsExistants);
  for (const entite of entites) {
    if (entite[champId]) utilises.add(entite[champId]);
  }

  let max = 0;
  for (const id of utilises) {
    const m = regexId.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }

  const journal = [];
  for (const entite of entites) {
    if (!entite[champId]) {
      max += 1;
      const nouveau = `${prefixe}-${String(max).padStart(3, '0')}`;
      entite[champId] = nouveau;
      utilises.add(nouveau);
      journal.push({ ligne: entite.__numeroLigne, id: nouveau });
    }
  }
  return journal;
}
