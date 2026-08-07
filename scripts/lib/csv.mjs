/*
  Parseur CSV minimal (RFC 4180) : champs entre guillemets, guillemets
  échappés par doublement (""), séparateur virgule, fins de ligne \n ou \r\n.
  Aucune dépendance externe — le projet n'utilise pas encore de librairie CSV
  (voir CLAUDE.md, section « pas de dépendance lourde non justifiée »).
*/

/** Découpe un texte CSV en tableau de lignes (chaque ligne = tableau de champs). */
export function parseCsv(texte) {
  const lignes = [];
  let ligne = [];
  let champ = '';
  let dansGuillemets = false;
  let i = 0;
  const n = texte.length;

  const finirChamp = () => {
    ligne.push(champ);
    champ = '';
  };
  const finirLigne = () => {
    finirChamp();
    lignes.push(ligne);
    ligne = [];
  };

  while (i < n) {
    const c = texte[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i += 2;
          continue;
        }
        dansGuillemets = false;
        i += 1;
        continue;
      }
      champ += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      finirChamp();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      finirLigne();
      i += 1;
      continue;
    }
    champ += c;
    i += 1;
  }

  // Dernière ligne sans retour final.
  if (champ !== '' || ligne.length > 0) {
    finirLigne();
  }

  return lignes.filter((l) => !(l.length === 1 && l[0] === ''));
}

/** Parse un CSV avec en-tête et retourne un tableau d'objets { colonne: valeur }. */
export function parseCsvObjets(texte) {
  const lignes = parseCsv(texte);
  if (lignes.length === 0) return { entetes: [], lignes: [] };
  const [entetes, ...reste] = lignes;
  const objets = reste.map((valeurs) => {
    const objet = {};
    entetes.forEach((cle, index) => {
      objet[cle.trim()] = (valeurs[index] ?? '').trim();
    });
    return objet;
  });
  return { entetes: entetes.map((e) => e.trim()), lignes: objets };
}
