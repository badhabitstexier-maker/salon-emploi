# Visuels de la homepage

Déposer les photos définitives dans `public/images/`, en **WebP**, aux chemins exacts
attendus par `src/components/Visuel.astro`. Aucune modification de code n'est nécessaire :
le composant détecte la présence du fichier au moment du build et remplace
automatiquement le panneau de repli par la photo.

| Fichier attendu | Emplacement sur la page | Dimensions conseillées | Cadrage |
|---|---|---|---|
| `hero-salon.webp` | Hero, moitié droite (découpe diagonale) | 1600 × 1400 px | sujets centrés ; les bords gauche et bas sont rognés par la découpe |
| `hall-emploi-formation.webp` | Carte « Hall Emploi-Formation » | 1200 × 450 px | bandeau large, sujets au centre |
| `village-maintenance-industrie.webp` | Carte « Village Maintenance & Industrie » | 1200 × 450 px | bandeau large, sujets au centre |
| `exposants-salon.webp` | Bloc « Devenir exposant » | 1200 × 900 px | format 4/3 |

Les textes alternatifs sont déjà rédigés dans `src/pages/index.astro` : les
adapter si la photo livrée montre autre chose que ce qui est décrit.

Sous-dossier `exposants/` : logos des exposants confirmés, à créer uniquement
quand Philippe a validé la liste nommément (cf. CLAUDE.md section 3).
