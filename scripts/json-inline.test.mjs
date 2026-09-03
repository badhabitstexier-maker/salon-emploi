/*
  Tests unitaires de src/lib/json-inline.ts (`npm run json-inline:test`,
  enchaîné par `npm run content:test`).

  Contexte : les blocs <script type="application/json"> et
  "application/ld+json" du site embarquent des champs d'offres et
  d'exposants issus du pipeline d'import — donc d'un formulaire rempli par
  des tiers (voir CLAUDE.md section 10). `JSON.stringify()` seul n'échappe
  pas `<`, si bien qu'un champ contenant `</script>` refermait le bloc et
  transformait la suite en DOM exécuté. Ces tests verrouillent le
  comportement du remplaçant.

  Le scénario `payload d'audit` rejoue littéralement la charge utile qui a
  servi à démontrer le défaut avant correction — ne pas l'affaiblir.
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsonInline } from '../src/lib/json-inline.ts';

test("jsonInline neutralise la séquence de fermeture </script>", () => {
  const sortie = jsonInline({ intitule: 'Audit</script><img src=x onerror=alert(1)>' });
  assert.ok(!sortie.includes('</script'), 'la séquence </script doit avoir disparu de la sortie');
  assert.ok(!sortie.includes('<'), 'plus aucun < littéral ne doit subsister');
  assert.ok(sortie.includes('\\u003c'), 'les < doivent être remplacés par \\u003c');
});

test("jsonInline neutralise l'ouverture de commentaire HTML <!--", () => {
  const sortie = jsonInline({ note: '<!--' });
  assert.ok(!sortie.includes('<!--'));
});

test('jsonInline produit du JSON valide et relisible à l’identique', () => {
  const valeur = {
    intitule: 'Audit</script><img src=x onerror=alert(1)>',
    liste: ['<a>', '</SCRIPT >', 'accentué é€'],
    imbrique: { html: '<div class="x">' },
    nombre: 42,
    nul: null,
  };
  // C'est la garantie qui permet de ne rien changer côté client :
  // JSON.parse() du texte échappé rend exactement la valeur d'origine.
  assert.deepEqual(JSON.parse(jsonInline(valeur)), valeur);
});

test('jsonInline échappe les séparateurs de ligne Unicode U+2028/U+2029', () => {
  const sortie = jsonInline({ texte: `avant\u2028milieu\u2029apres` });
  assert.ok(!sortie.includes('\u2028'));
  assert.ok(!sortie.includes('\u2029'));
  assert.equal(JSON.parse(sortie).texte, `avant\u2028milieu\u2029apres`);
});

test('jsonInline laisse intact un contenu sans caractère dangereux', () => {
  const valeur = { reference: 'SEF26-001', intitule: 'Technicien de maintenance' };
  assert.equal(jsonInline(valeur), JSON.stringify(valeur));
});

test('jsonInline traite les types primitifs et les tableaux racine', () => {
  assert.equal(jsonInline('<x>'), '"\\u003cx>"');
  assert.equal(JSON.parse(jsonInline(['<a>', '<b>'])).join('|'), '<a>|<b>');
});

/*
  Garde-fou de source (même esprit que `npm run content:check`) : les tests
  ci-dessus valident le helper, mais ne détecteraient PAS un retour en
  arrière — avec les données actuelles, qui ne contiennent aucun `<`, un
  `JSON.stringify()` réintroduit par mégarde produirait exactement la même
  sortie. Ce test relit donc les sources et refuse le motif dangereux, quelle
  que soit la donnée du moment.
*/
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function fichiersSources(racine) {
  return readdirSync(racine, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) return fichiersSources(chemin);
    return /\.(astro|ts|tsx|mjs)$/.test(entree.name) ? [chemin] : [];
  });
}

test('aucune source ne réintroduit set:html={JSON.stringify(...)} dans un <script>', () => {
  const fautifs = fichiersSources('src')
    // json-inline.ts cite volontairement le motif dans sa documentation.
    .filter((chemin) => !chemin.endsWith('json-inline.ts'))
    .filter((chemin) => readFileSync(chemin, 'utf8').includes('set:html={JSON.stringify'));

  assert.deepEqual(
    fautifs,
    [],
    'Utiliser jsonInline() (src/lib/json-inline.ts) au lieu de JSON.stringify() dans un set:html — voir la documentation de ce module.',
  );
});
