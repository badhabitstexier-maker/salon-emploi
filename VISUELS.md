# Visuels de la homepage

**Les 4 photos définitives sont intégrées** dans `public/images/`, en WebP.
Ce document reste utile pour tout remplacement futur : déposer un fichier au
même chemin, avec les mêmes proportions, et relancer le build — aucune
modification de code n'est nécessaire, `src/components/Visuel.astro` détecte
le fichier automatiquement.

| Fichier | Emplacement | Dimensions actuelles | Cadrage (`object-position`) |
|---|---|---|---|
| `hero-salon-desktop.webp` | Hero, moitié droite (découpe diagonale), à partir de lg (1024 px) | 1049 × 937 px | `fit="contain"` — fond `#0c1a2f` |
| `hero-salon-mobile.webp` | Hero, bloc image inline, en dessous de lg | 1448 × 1086 px | `fit="contain"` — fond `#0a1930` |
| `hall-emploi-formation.webp` | Carte « Hall Emploi-Formation » | 1672 × 941 px | `cover`, `object-[center_22%]` |
| `village-maintenance-industrie.webp` | Carte « Village Maintenance & Industrie » | 1672 × 941 px | `cover`, `object-[center_18%]` |
| `exposants-salon.webp` | Bloc « Devenir exposant » | 1672 × 941 px | `cover`, `object-[78%_center]` |

**Le hero a deux versions distinctes selon le breakpoint** (seuil lg = 1024 px,
déjà utilisé pour la bascule nav desktop / menu mobile) :
- `hero-salon-desktop.webp` : recadrage à 3 personnages (le cadre en costume à
  gauche a été retiré), pour un ratio plus proche de celui du panneau diagonal
  et donc moins d'espace vide autour du groupe ;
- `hero-salon-mobile.webp` : version complète à 4 personnages, qui remplit
  bien le bloc image `aspect-[4/3]` sous le hero en dessous de lg.

**Les deux sont en `fit="contain"`** : chaque photo garde une proportion
différente de son panneau selon la largeur d'écran exacte, seul ce mode
garantit qu'aucune personne n'est jamais rognée. La propriété `fondImage` sur
le composant `Visuel` fait en sorte que l'éventuel espace résiduel autour de
la photo se fonde dans son propre fond plutôt que de créer une bande visible
— valeur échantillonnée sur les bords de chaque photo, à réajuster si l'une
des deux est remplacée par une image de teinte différente.

Les trois autres visuels sont en `cover` avec un `object-position` réglé au
cas par cas pour garder les visages dans le cadre — à revérifier après tout
remplacement, en particulier si le nouveau cadrage d'origine diffère.

Sous-dossier `exposants/` : logos des exposants confirmés, à créer uniquement
quand Philippe a validé la liste nommément (cf. CLAUDE.md section 3).
