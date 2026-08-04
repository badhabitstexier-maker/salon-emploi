# Visuels de la homepage

**Les 4 photos définitives sont intégrées** dans `public/images/`, en WebP.
Ce document reste utile pour tout remplacement futur : déposer un fichier au
même chemin, avec les mêmes proportions, et relancer le build — aucune
modification de code n'est nécessaire, `src/components/Visuel.astro` détecte
le fichier automatiquement.

| Fichier | Emplacement | Dimensions actuelles | Cadrage (`object-position`) |
|---|---|---|---|
| `hero-salon.webp` | Hero, moitié droite (découpe diagonale) | 1448 × 1086 px | `fit="contain"` — aucun rognage, fond `#0a1930` raccordé à la teinte des bords de la photo |
| `hall-emploi-formation.webp` | Carte « Hall Emploi-Formation » | 1672 × 941 px | `cover`, `object-[center_22%]` |
| `village-maintenance-industrie.webp` | Carte « Village Maintenance & Industrie » | 1672 × 941 px | `cover`, `object-[center_18%]` |
| `exposants-salon.webp` | Bloc « Devenir exposant » | 1672 × 941 px | `cover`, `object-[78%_center]` |

**Le hero est le seul visuel en `fit="contain"`** : la photo est un portrait
de groupe sur fond navi quasi uniforme, très différent en proportions du
panneau qui l'accueille (de 0,61 à 1,31 selon la largeur d'écran). Le mode
`contain` garantit qu'aucune personne n'est jamais rognée ; la propriété
`fondImage="#0a1930"` sur le composant `Visuel` fait en sorte que l'éventuel
espace résiduel autour de la photo se fonde dans son propre fond plutôt que
de créer une bande visible. Si le prochain remplacement du hero a un fond
d'une autre teinte, ajuster `fondImage` en conséquence (échantillonner la
couleur des bords de la nouvelle photo).

Les trois autres visuels sont en `cover` avec un `object-position` réglé au
cas par cas pour garder les visages dans le cadre — à revérifier après tout
remplacement, en particulier si le nouveau cadrage d'origine diffère.

Sous-dossier `exposants/` : logos des exposants confirmés, à créer uniquement
quand Philippe a validé la liste nommément (cf. CLAUDE.md section 3).
