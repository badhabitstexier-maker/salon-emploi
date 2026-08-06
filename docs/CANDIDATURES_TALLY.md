# Parcours de candidature et intégration Tally

Ce document explique le fonctionnement du **Lot 2** du dispositif « Offres et
candidatures » : la page `/candidater`, la validation des offres
sélectionnées, l'intégration du formulaire Tally et la structure exacte
attendue de ce formulaire (créé dans Tally, en dehors de ce dépôt).

> Rappel (CLAUDE.md, section 2) : ne jamais transmettre de candidature à un
> exposant avant la clôture du salon. Le Lot 2 ne développe ni le dispatch
> automatique, ni l'envoi aux recruteurs — voir docs/OFFRES.md pour le
> fonctionnement du catalogue (Lot 1).

## 1. Objectif du dispositif

Permettre à un visiteur ayant sélectionné 0 à 5 offres sur `/offres` (Lot 1)
de préparer et déposer sa candidature avant le salon, via un formulaire Tally
intégré sur la page `/candidater`. La candidature prépare la rencontre
physique sur le salon ; elle ne la remplace pas et ne garantit ni entretien,
ni réponse, ni recrutement.

## 2. Architecture générale

```
/offres → sélection (offre1..offre5, URL) → /candidater
  → validation des références (client, contre les offres publiées et
    acceptant la candidature en ligne)
  → récapitulatif « Ma sélection »
  → case « orientation LabEvents » (paramètre orientation=1)
  → construction de l'URL Tally (champs cachés)
  → <iframe> Tally (src défini par le script client)
```

Le site restant en sortie statique (`output: 'static'`), toute cette logique
tourne **côté client**, au chargement de `/candidater` — voir section 3.

## 3. Route `/candidater`

Fichier : `src/pages/candidater.astro`. Page statique générée une seule fois
au build ; son contenu dynamique (récapitulatif, iframe Tally) est entièrement
peuplé par un script client au chargement, à partir des paramètres présents
dans l'URL du visiteur.

## 4. Paramètres URL acceptés

| Paramètre | Rôle |
|---|---|
| `offre1`..`offre5` | Références des offres sélectionnées (Lot 1) |
| `orientation` | `1` = candidature « sans offre », orientation LabEvents |

Aucun autre paramètre n'est interprété comme une référence d'offre ou un
indicateur métier.

## 5. Absence de stockage navigateur

Comme au Lot 1, ce lot n'utilise **ni `localStorage`, ni `sessionStorage`, ni
cookie de sélection, ni `IndexedDB`, ni compte candidat, ni session
serveur**. L'état (sélection + orientation) reste entièrement dans l'URL du
site, lue et réécrite via `URLSearchParams` et `history.replaceState`
(`src/lib/candidature-selection.ts`, `src/lib/selection-ui.ts`). Le
formulaire Tally lui-même collecte les données personnelles dans son propre
état interne (hors du site Astro) au moment de la saisie — jamais dans l'URL
du site.

## 6. Variable `PUBLIC_TALLY_CANDIDATURE_URL`

L'URL de base du formulaire Tally est configurée via la variable
d'environnement publique `PUBLIC_TALLY_CANDIDATURE_URL` (voir
`.env.example` et `src/env.d.ts`). Elle n'est pas un secret, mais reste
**configurable sans modifier le code** : aucune URL réelle ou fictive n'est
codée en dur dans les composants.

URL du formulaire Tally réel utilisée en préproduction (depuis la
correction du 06/08/2026 ajoutant le champ `orientation_labevents_label`,
voir section 15) : `https://tally.so/r/xX7gek`. Elle n'est active qu'en
préproduction à ce stade — la production n'est pas modifiée tant que
Philippe n'a pas validé la recette.

Si la variable est absente ou vide :

- aucune iframe n'est affichée (pas d'iframe cassée) ;
- aucun bouton ne pointe vers une URL vide ;
- le message « Le formulaire de candidature sera prochainement disponible. »
  s'affiche à la place (voir `src/components/TallyCandidatureEmbed.astro`) ;
- le récapitulatif de sélection et les informations légales restent
  affichés normalement.

## 7. Procédure de configuration locale et de préproduction

1. Créer le formulaire dans Tally (voir section 10) et copier son URL
   publique (ex. `https://tally.so/r/XXXXXXXX`).
2. En local : ajouter `PUBLIC_TALLY_CANDIDATURE_URL=https://tally.so/r/XXXXXXXX`
   dans `.env` (non commité).
3. En préproduction : contrairement à `PUBLIC_WEB3FORMS_ACCESS_KEY` (un
   secret), cette URL n'est pas sensible. Elle est injectée dans
   `.github/workflows/deploy-preprod.yml` via `${{ vars.PUBLIC_TALLY_CANDIDATURE_URL }}`
   — une **variable** d'environnement GitHub, pas un secret. À créer dans
   *Settings → Environments → preprod → Variables* (et non *Secrets*), avec :
   - nom : `PUBLIC_TALLY_CANDIDATURE_URL`
   - valeur : `https://tally.so/r/xX7gek`
4. En production : la variable n'est volontairement **pas encore** câblée
   dans `.github/workflows/deploy-production.yml`. Ce câblage sera fait dans
   un lot ultérieur, après validation de la recette en préproduction par
   Philippe.
5. Aucune modification de composant n'est nécessaire pour changer cette URL.

## 8. Liste exacte des champs cachés transmis à Tally

Construits par `construireUrlTally()` (`src/lib/candidature-selection.ts`),
uniquement pour les offres valides (voir section 9) et dans l'ordre de la
sélection :

```
offre_1_ref, offre_1_titre, offre_1_exposant
offre_2_ref, offre_2_titre, offre_2_exposant
offre_3_ref, offre_3_titre, offre_3_exposant
offre_4_ref, offre_4_titre, offre_4_exposant
offre_5_ref, offre_5_titre, offre_5_exposant
```

Les emplacements sans offre ne sont **pas** transmis (pas de champ
`offre_4_ref=""` si seules 3 offres sont sélectionnées).

Champs supplémentaires :

```
orientation_labevents       = true | false                     (toujours transmis)
orientation_labevents_label = <texte exact, section 15>         (transmis uniquement si orientation_labevents = true)
source                       = salon-emploi.nc                  (toujours transmis)
edition                      = 2026                              (toujours transmis)
```

`orientation_labevents` est la valeur technique exploitée pour l'export et
le futur dispatch (section 20). `orientation_labevents_label` sert
uniquement à précocher visuellement la checkbox « Orientation de ma
candidature » dans Tally — ce n'est pas une donnée d'exploitation. Les deux
champs restent volontairement distincts (voir `construireUrlTally()` dans
`src/lib/candidature-selection.ts`) : ne jamais les fusionner.

Aucune donnée personnelle (nom, email, téléphone, CV…) n'est jamais placée
dans cette URL : ces informations ne sont saisies que dans Tally lui-même.

## 9. Règles de validation des références

Au chargement de `/candidater` (`src/pages/candidater.astro`, réutilise
`initSelectionUI()` de `src/lib/selection-ui.ts`) :

1. lire `offre1` à `offre5` ;
2. supprimer les valeurs vides ;
3. dédupliquer (première occurrence conservée) ;
4. conserver l'ordre ;
5. limiter à cinq ;
6. ne garder une référence que si elle correspond à une offre **publiée**
   *et* acceptant la candidature en ligne (`accepteCandidaturesEnLigne: true`)
   — ce filtre est appliqué en amont, côté build, dans la liste JSON
   embarquée (`offres-eligibles-donnees`), donc toute référence absente de
   cette liste est automatiquement ignorée ;
7. si une ou plusieurs références ont été écartées, afficher le message
   accessible « Une ou plusieurs offres de votre sélection ne sont plus
   disponibles pour la candidature en ligne. » (région `aria-live`,
   `#message-offres-ecartees`) — sans jamais révéler la raison précise
   (offre inconnue, retirée, clôturée ou hors ligne) ;
8. la page ne plante jamais, quel que soit le contenu de l'URL.

Le lien « Modifier ma sélection » revient vers `/ma-selection` en ne
conservant que les références valides au sens ci-dessus (une offre publiée
mais n'acceptant pas la candidature en ligne est donc retirée de ce lien de
retour, puisqu'elle ne peut de toute façon pas être candidatée en ligne).

## 10. Structure exacte des sept étapes Tally

Le formulaire est créé dans Tally, hors du dépôt. Sa structure doit
respecter exactement cet ordre :

1. **Coordonnées** — Prénom, Nom, Email, Téléphone, Commune de résidence.
2. **Situation actuelle** — choix unique (Demandeur d'emploi, Salarié,
   Étudiant, Reconversion, Fin de contrat, Autre) + Niveau de formation +
   Expérience professionnelle totale.
3. **Projet professionnel** — Poste recherché (texte court), Secteurs visés
   (cases à cocher multiples), Type de contrat recherché, Disponibilité,
   Mobilité géographique.
4. **Compétences** — Compétences principales (texte long), Langues, Permis
   et habilitations.
5. **CV et valorisation** — upload CV obligatoire (PDF, taille adaptée aux
   limites réelles du compte Tally utilisé) + champ de valorisation
   obligatoire (voir sections 11-12).
6. **Offres sélectionnées** — affichage des offres reçues via les champs
   cachés (référence, intitulé, entreprise), 5 maximum, aucun emplacement
   vide affiché, + case « orientation LabEvents » (voir section 15).
7. **Consentements** — consentement A (obligatoire) et B (optionnel, non
   précoché) + mention de conservation + rappel « ne garantit ni... » (voir
   sections 13-14).

## 11. Intitulé exact du champ de valorisation

```
Pourquoi postuler au salon — valorisez votre candidature
```

Ne jamais remplacer cet intitulé par « Projet personnel », « Motivation »,
« Lettre de motivation », « Message d'accompagnement » ou « Commentaire
candidat ». Champ obligatoire, mis en valeur visuellement, destiné à être lu
par les recruteurs avant l'ouverture du CV.

## 12. Texte d'aide du champ de valorisation

```
C'est votre chance de vous exprimer au-delà du CV. En 5 à 10 lignes, dites
qui vous êtes vraiment : votre parcours en quelques mots, ce que vous
recherchez, ce que vous apportez, et pourquoi vous souhaitez rencontrer les
exposants que vous avez sélectionnés.
```

## 13. Texte exact du consentement A (obligatoire)

```
J'accepte que mes informations et mon CV soient transmis par LabEvents aux
exposants correspondant aux offres que j'ai sélectionnées, dans le cadre du
Salon de l'Emploi & de la Formation 2026.
```

## 14. Texte exact du consentement B (optionnel, non précoché)

```
J'accepte que LabEvents puisse également transmettre mon profil à d'autres
exposants du salon lorsque mes compétences correspondent à leurs besoins.
```

Ce consentement alimente le dispositif « accès aux profils candidats
compatibles » (voir `/exposer`). Il doit être enregistré séparément du
consentement A et n'est jamais précoché automatiquement, quel que soit
l'état de la case d'orientation LabEvents.

## 15. Fonctionnement de l'orientation LabEvents

Distincte du consentement B. Case à cocher visible sur `/candidater`
(`#case-orientation`), utilisable :

- avec zéro offre sélectionnée ;
- avec une ou plusieurs offres sélectionnées (les deux ne s'excluent pas) ;
- jamais précochée par défaut, sauf si l'URL contient explicitement
  `orientation=1` à l'arrivée sur la page.

Cocher la case ajoute `orientation=1` à l'URL du site (`history.replaceState`,
`appliquerOrientationAlUrl()`) ; la décocher le retire. L'état transmis à
Tally via le champ caché `orientation_labevents` correspond exactement à
l'état de cette case au moment du chargement de l'iframe, et se recalcule à
chaque changement (case cochée/décochée ou offre retirée du récapitulatif).
Cette information alimente le futur dispatch manuel LabEvents pour les
candidats « hors liste » — elle est indépendante du consentement B.

Depuis la correction du 06/08/2026, la question visible « Orientation de ma
candidature » dans Tally n'a qu'une seule option, dont le texte exact est :

```
Je souhaite que LabEvents oriente ma candidature vers les exposants les plus adaptés à mon profil.
```

Cette phrase est centralisée côté site dans la constante
`ORIENTATION_LABEVENTS_LABEL` (`src/lib/candidature-selection.ts`) et
transmise telle quelle à Tally via le champ caché
`orientation_labevents_label`, uniquement lorsque `orientation_labevents =
true`. Quand l'orientation est désactivée, ce champ n'est pas transmis du
tout (préféré à une valeur vide). Tally utilise cette valeur pour précocher
automatiquement la case dans le formulaire ; le site ne pilote que le
préremplissage, jamais l'affichage ni la présence de l'option elle-même.

## 16. Mention de conservation jusqu'au 31 décembre 2026

Cette date (deux mois maximum après la clôture du salon) doit apparaître
partout où la conservation des données de candidature est mentionnée :
`/confidentialite` (section « Candidatures aux offres du salon »), ce
document, la mention légale du formulaire Tally (étape 7), et le futur
tableau de transmission (section 20). **Ne jamais** utiliser le 31 octobre
2026, une durée indéterminée, ou une conservation au-delà du 31 décembre
2026.

## 17. Message de confirmation (à paramétrer dans Tally)

```
Votre candidature a bien été enregistrée.

Elle sera transmise après la clôture du salon aux exposants correspondant
aux offres que vous avez sélectionnées et, selon vos choix, aux exposants
dont les besoins correspondent à votre profil.

La transmission de votre candidature ne garantit ni entretien, ni réponse,
ni recrutement.

Nous vous invitons à venir rencontrer directement les recruteurs les 30 et
31 octobre 2026, de 9h à 17h, à la Salle d'exposition de Nouville, Nouméa.
```

Ajouter, dans l'écran de confirmation Tally, un lien vers
`/preparer-ma-visite`. Ne jamais promettre l'envoi automatique d'un email,
une réponse du recruteur, un entretien ou un recrutement.

## 18. Procédure de test

1. Configurer (ou non) `PUBLIC_TALLY_CANDIDATURE_URL` en local.
2. `npm run dev`, puis tester les URL listées en section « Tests des
   routes » du compte rendu de PR — zéro offre, une offre, cinq offres, six
   paramètres, doublon, référence inconnue, `orientation=1` seul, combiné à
   une sélection.
3. Vérifier dans les DevTools que l'`src` de l'iframe contient bien les
   champs cachés attendus (`offre_1_ref`…, `orientation_labevents`,
   `source`, `edition`) et aucune donnée personnelle.
4. Décocher/cocher la case d'orientation et vérifier que l'URL du site et
   l'`src` de l'iframe se mettent à jour.
5. Retirer une offre depuis le récapitulatif et vérifier que le message
   « offres écartées », le compteur et l'iframe se mettent à jour.

## 19. Procédure d'export (hors périmètre technique du Lot 2)

Tally permet l'export CSV des réponses depuis son interface. Ce lot ne
développe aucun export automatisé ; la procédure manuelle (téléchargement
CSV depuis Tally, tri par LabEvents) reste à formaliser au Lot 3.

## 20. Structure du futur tableau de transmission

Colonnes prévues (dispatch manuel, non développé dans ce lot) :

```
identifiant_candidature, date_candidature, prenom, nom, email, telephone,
commune, situation, niveau_formation, experience_totale, poste_recherche,
secteurs_vises, type_contrat, disponibilite, mobilite, competences, langues,
permis_habilitations, cv, valorisation, offre_1_ref, offre_2_ref,
offre_3_ref, offre_4_ref, offre_5_ref, orientation_labevents,
consentement_offres_selectionnees, consentement_profils_compatibles,
statut_dossier, date_suppression_prevue
```

`date_suppression_prevue` vaut toujours `2026-12-31`.

Règles documentées pour le futur dispatch :

- un candidat dispose d'un dossier source unique ;
- ce dossier peut être associé à plusieurs références d'offres (jusqu'à 5) ;
- l'orientation LabEvents (`orientation_labevents`) est distincte du
  consentement aux profils compatibles (`consentement_profils_compatibles`) ;
- seules les transmissions autorisées par les consentements donnés sont
  permises ;
- les données doivent être supprimées au plus tard le 31 décembre 2026.

## 21. Limites connues

- Le fonctionnement de `/candidater` dépend de JavaScript (comme l'ensemble
  du dispositif de sélection par URL du Lot 1) : sans JavaScript, seul un
  lien direct vers Tally est proposé (`<noscript>` dans
  `TallyCandidatureEmbed.astro`), sans les champs cachés pré-remplis.
- L'URL Tally réelle n'est pas encore fournie à ce stade : `/candidater`
  fonctionne en état d'attente tant que `PUBLIC_TALLY_CANDIDATURE_URL`
  n'est pas configurée.
- Le formulaire Tally lui-même (étapes, champs, consentements) doit être
  construit manuellement dans l'interface Tally en suivant strictement les
  sections 10 à 14 de ce document — ce lot ne peut pas le vérifier
  automatiquement.

## 22. Aucune candidature transmise avant la clôture du salon

Ce lot ne développe ni dispatch automatique, ni envoi aux recruteurs. Les
candidatures restent dans Tally jusqu'à un traitement manuel par LabEvents,
après la clôture du salon (31 octobre 2026), conformément aux textes du
formulaire (section 13) et de la page `/candidater`.

## 23. Rappel — aucune garantie de réponse

Le formulaire, la page `/candidater` et le message de confirmation Tally
doivent toujours rappeler que la candidature ne garantit ni entretien, ni
réponse, ni recrutement.

## 24. Articulation future avec le Lot 3

Le Lot 3 décrira l'import automatisé des offres (Google Forms exposant →
Google Sheets → validation LabEvents → génération des fichiers
`src/content/offres/`, voir docs/OFFRES.md section 15) et, potentiellement,
une procédure d'export/dispatch plus outillée des candidatures Tally vers le
tableau décrit en section 20. Aucun de ces éléments n'est développé dans le
Lot 2.
