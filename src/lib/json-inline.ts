/*
  Sérialisation sûre d'une valeur destinée à un bloc <script> inline
  (`<script type="application/json">` ou `application/ld+json`, écrits en
  Astro avec la directive `set:html`).

  POURQUOI CE MODULE EXISTE — `JSON.stringify()` seul ne suffit PAS dans ce
  contexte. Le contenu d'un élément <script> est du texte brut au sens HTML :
  l'analyseur du navigateur n'y cherche qu'une chose, la séquence `</script`,
  qui ferme la balise immédiatement. Or `JSON.stringify()` n'échappe pas
  `<` — une donnée contenant `</script>` referme donc le bloc et tout ce qui
  suit devient du DOM exécuté.

  Ce n'est pas théorique ici : les champs sérialisés dans ces blocs
  (`intitule`, `exposantNom`, `descriptionCourte`, `lieu`) proviennent du
  formulaire de collecte rempli par les exposants, via le pipeline d'import
  (voir CLAUDE.md section 10) — donc d'une source tierce non maîtrisée.

  RÈGLE : ne jamais écrire `set:html={JSON.stringify(x)}` dans une balise
  <script>. Toujours `set:html={jsonInline(x)}`.

  Ce qui est échappé, et pourquoi uniquement cela :
    - `<` -> `\u003c` : neutralise `</script` ainsi que `<!--` (les deux
              seules séquences qui changent l'état de l'analyseur HTML dans
              un bloc script). Échapper `>` seul serait inutile : `-->` ne
              compte que si un `<!--` l'a précédé, ce que cet échappement
              rend impossible.
    - U+2028 / U+2029 : séparateurs de ligne Unicode, valides dans une
              chaîne JSON mais historiquement source de ruptures de parsing
              selon les moteurs. Échappement défensif, sans coût.

  Le résultat reste du JSON strictement valide : `\uXXXX` est la forme
  d'échappement standard du format, `JSON.parse()` le relit à l'identique.
  Aucun appelant côté client n'a donc à être adapté.
*/

/** Sérialise `valeur` en JSON sûr à insérer dans un bloc <script> inline. */
export function jsonInline(valeur: unknown): string {
  return JSON.stringify(valeur)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
