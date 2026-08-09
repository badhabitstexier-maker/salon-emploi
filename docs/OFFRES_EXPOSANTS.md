# Collecte des offres exposants — Google Forms & Google Sheets

Ce document décrit la collecte des offres auprès des **exposants recruteurs
confirmés**, en amont de leur publication sur `/offres`. Il complète
`docs/OFFRES.md` (fonctionnement du catalogue publié) et
`docs/WORKFLOW_OFFRES_2026.md` (procédure opérationnelle complète, de bout en
bout).

> Claude Code n'a pas accès au compte Google LabEvents : le Google Form et le
> Google Sheet décrits ici ne sont **pas créés**. Ce document donne toutes les
> informations nécessaires pour que Philippe (ou une personne LabEvents) les
> crée sans ambiguïté. Voir la section 9 pour la liste des actions manuelles
> restantes.

**Date limite de déclaration : 12 octobre 2026.** Elle doit apparaître dans
le formulaire, dans ce document, et dans le modèle d'email
(`docs/email-exposants-offres.md`).

---

## 1. Qui reçoit ce formulaire

Uniquement les exposants recruteurs **confirmés** (participation actée).
Aucun envoi à un prospect non confirmé.

---

## 2. Structure exacte du Google Form

### Réglages généraux du formulaire

- Titre : « Salon de l'Emploi & de la Formation 2026 — Déclaration des offres exposant ».
- Description (haut de formulaire) : rappeler la date limite du **12 octobre
  2026**, le fait que les offres restent soumises à validation LabEvents
  avant publication, et le contact `labevents@icloud.com` en cas de
  question.
- Paramètres → Réponses → **activer** « Modifier après l'envoi » (ce
  réglage seul ne suffit pas à notifier automatiquement l'exposant du lien
  de modification — voir section 6).
- Paramètres → Réponses → **désactiver** la limite à une réponse par
  compte Google (les exposants n'ont pas de compte Google dédié).

### Section 1 — Identification

| Question | Type | Obligatoire |
|---|---|---|
| Entreprise / organisme | Réponse courte | Oui |
| Identifiant exposant (fourni par LabEvents) | Réponse courte | Oui — voir section 5 |
| Nom et prénom du contact RH / recrutement | Réponse courte | Oui |
| Adresse email | Réponse courte (validation e-mail) | Oui |
| Téléphone | Réponse courte | Oui |
| Type de soumission | Choix unique : « Nouvelle déclaration » / « Mise à jour ou remplacement de ma déclaration précédente » | Oui |

### Section 2 — Offres (blocs 1 à 10)

Dupliquer un bloc identique **10 fois** (« Offre 1 » à « Offre 10 »), pour
couvrir la formule Silver (10 offres). Pour Gold au-delà de 10 offres, voir
la section 8 — ne pas ajouter de 11ᵉ bloc au formulaire.

Le bloc « Offre 1 » a son intitulé **obligatoire**. Les blocs « Offre 2 » à
« Offre 10 » ont leur intitulé **facultatif** : un exposant qui n'a que 3
offres laisse les blocs 4 à 10 entièrement vides. **Un bloc dont l'intitulé
est vide est ignoré à l'import** (voir `scripts/import-offres.mjs`) — ne
jamais forcer un exposant à remplir un bloc qu'il n'utilise pas.

Pour chaque bloc « Offre N », questions dans cet ordre :

| Question | Type | Obligatoire |
|---|---|---|
| Offre N — Intitulé du poste | Réponse courte | Oui pour le bloc 1, facultatif ensuite |
| Offre N — Type de contrat | Cases à cocher : CDI / CDD / Alternance / Stage / Intérim / Saisonnier / Autre | Facultatif si bloc vide |
| Offre N — Niveau d'expérience souhaité | Réponse courte | Facultatif si bloc vide |
| Offre N — Niveau de formation souhaité | Cases à cocher (texte libre en complément si besoin) | Facultatif |
| Offre N — Localisation | Réponse courte | Facultatif si bloc vide |
| Offre N — Secteur | Réponse courte | Facultatif si bloc vide |
| Offre N — Description courte du poste | Paragraphe | Facultatif si bloc vide |
| Offre N — Compétences / prérequis | Paragraphe | Facultatif |
| Offre N — Nombre de postes à pourvoir | Réponse courte (nombre) | Facultatif, LabEvents applique 1 par défaut si vide |
| Offre N — Rémunération (facultatif, communiquée uniquement si vous le souhaitez) | Réponse courte | Facultatif |
| Offre N — Date limite de candidature, si connue | Date | Non — laissez vide si aucune date limite n'est fixée |
| Offre N — Cette offre accepte-t-elle les candidatures en ligne ? | Choix unique : Oui / Non | Facultatif, LabEvents applique « Oui » par défaut si vide |

> Champ « Date limite de candidature » : devient le champ `dateCloture` de
> l'offre lors de la normalisation Sheets → CSV (voir section 9). Il s'agit
> **uniquement** de la date de fin de validité de cette offre précise — pas
> de la durée de conservation des données candidat (fixée au 31 décembre
> 2026 pour les données collectées via Tally, voir
> `docs/CANDIDATURES_TALLY.md`), qui n'a aucun lien avec ce champ. Si
> l'exposant ne fixe aucune date limite, laisser la question vide : ne
> jamais inventer une date de clôture.

> Champ « Temps de travail » : **non repris ici**, car le schéma Astro
> actuel de la collection `offres` (`src/content.config.ts`) ne comporte
> aucun champ de temps de travail — voir l'audit en tête de PR. L'ajouter au
> formulaire créerait une donnée collectée mais jamais utilisée sur le site.
> Si Philippe souhaite l'afficher publiquement, c'est une évolution de
> schéma à traiter dans un lot dédié, pas une extension silencieuse du Lot 3.
>
> Champ « Rémunération » : collecté **pour information interne LabEvents
> uniquement** (négociation, cohérence entre exposants). Il n'est **pas**
> publié sur le site : le schéma `offres` ne le prévoit pas, et CLAUDE.md
> demande explicitement de ne publier aucune information tarifaire non
> confirmée. La colonne correspondante du CSV normalisé
> (`data/templates/offres-import.csv`) est volontairement absente ; si ce
> champ apparaît dans l'export Sheets, le script d'import l'ignore sans
> erreur (voir `COLONNES_INTERNES_IGNOREES` dans
> `scripts/lib/offres-import-core.mjs`).

### Section 3 — Profils candidats compatibles

Une seule question, terminologie commerciale actuelle (jamais « CVthèque
générale ») :

> **Souhaitez-vous accéder aux profils candidats compatibles avec vos
> besoins ?**
> Choix unique :
> - Oui, je souhaite être mis en relation avec des profils compatibles
> - Non, pas pour cette édition
> - Je souhaite en discuter avec LabEvents avant de me décider

### Section 4 — Informations complémentaires

| Question | Type | Obligatoire |
|---|---|---|
| Informations ou besoins particuliers concernant le recrutement | Paragraphe | Non |
| Souhaitez-vous un point de préparation avec LabEvents avant le salon ? | Choix unique : Oui / Non | Non |

Ne pas ajouter ici de question sur le stand (dimensions, mobilier,
électricité…) : si un canal dédié existe déjà ailleurs dans le projet pour
ces demandes techniques, ce formulaire n'a pas vocation à le dupliquer.

---

## 3. Ce que Google Forms permet réellement (et ce qu'il ne permet pas)

Un lien **prérempli** Google Forms peut préremplir les champs « Entreprise »
et « Identifiant exposant ». **Mais un répondant peut modifier une réponse
préremplie avant l'envoi** : Google Forms n'offre aucun verrouillage natif
de champ. Ne jamais documenter ni communiquer ce préremplissage comme un
verrouillage.

Le besoin fonctionnel (« chaque exposant reçoit un lien qui identifie
fiablement sa déclaration ») est couvert autrement, sans backend :

1. **Identifiant exposant unique**, attribué par LabEvents (section 5),
   demandé en question obligatoire du formulaire.
2. **Nom de l'entreprise préremployé** dans le lien envoyé à l'exposant, à
   titre de confort (pas de garantie de non-modification).
3. **Contrôle de cohérence humain** au moment de la normalisation
   Sheets → CSV (section 7 et `docs/WORKFLOW_OFFRES_2026.md`, étape F) : si
   l'identifiant exposant et le nom d'entreprise déclarés ne correspondent
   pas à ce qui était attendu, la ligne reste au statut « à compléter »
   plutôt que d'être validée automatiquement.

### Procédure pour créer un lien prérempli

1. Ouvrir le formulaire → menu ⋮ → **Obtenir le lien prérempli**.
2. Remplir « Entreprise / organisme » et « Identifiant exposant » avec les
   valeurs de l'exposant concerné.
3. Cliquer sur **Obtenir le lien**, copier l'URL générée.
4. Coller cette URL dans le modèle d'email (`docs/email-exposants-offres.md`).

### Le lien de modification n'est pas envoyé automatiquement

Activer « Modifier après l'envoi » dans les paramètres du formulaire permet
à un exposant d'éditer sa réponse **s'il retrouve le lien affiché sur la
page de confirmation après son envoi initial**. Google Forms ne renvoie
**pas** automatiquement ce lien par email dans la configuration standard.

Deux options, sans développer de backend :

- **Option simple (recommandée pour V1)** : dans le modèle d'email
  (section « Type de soumission »), indiquer explicitement à l'exposant de
  conserver la page de confirmation affichée après son envoi, qui contient
  le lien « Modifier votre réponse ». En cas de perte, il recontacte
  `labevents@icloud.com`.
- **Option outillée (facultative)** : le petit script
  `scripts/google-apps-script/offres-exposants.gs` (section 6) récupère
  automatiquement l'URL de modification (`editResponseUrl`) à chaque
  soumission et l'envoie par email au contact exposant. **Non déployé** tant
  que Philippe ne l'installe pas dans le compte Google LabEvents (Apps
  Script lié à la feuille de réponses).

---

## 4. Contrôle de cohérence, sans backend

En cas d'incohérence détectée lors de la normalisation (section 7) —
identifiant exposant inconnu, nom d'entreprise différent de celui attendu
pour cet identifiant, formule commerciale introuvable — la ligne concernée
reste au statut interne **« à compléter »** dans le Sheet (jamais publiée
automatiquement) jusqu'à vérification manuelle par LabEvents.

Depuis le Lot Admin-1C (voir section 5 ci-dessous et `docs/OFFRES.md`
section 3bis), ce contrôle n'est plus seulement une consigne humaine côté
Sheet : `npm run offres:import` / `npm run offres:check` le vérifient
automatiquement contre le référentiel `exposants` réellement présent dans
le dépôt, et bloquent l'import en cas d'identifiant inconnu ou de formule
divergente.

---

## 5. Identifiant exposant (`exposantId`)

> **Corrigé au Lot Admin-1C.** La version précédente de cette section
> décrivait un format libre (« minuscules, sans accent, tirets ») distinct
> du format réellement en vigueur côté collection `exposants`
> (`EXP26-XXX`, voir `docs/EXPOSANTS_IMPORT.md` section 3) — c'était la
> cause de l'incohérence corrigée par ce lot (les offres TEST utilisaient
> par exemple `entreprise-test-nc`, un identifiant qui n'existait dans
> aucun référentiel). Le format ci-dessous est désormais le seul valide.

- **Format canonique : `EXP26-XXX`** (ex. `EXP26-001`, `EXP26-025`) —
  exactement le même `exposantId` que celui attribué à l'exposant dans la
  collection `exposants` (voir `docs/EXPOSANTS_IMPORT.md` section 3).
  Aucun autre format n'est accepté pour une offre réelle ; le schéma Astro
  (`src/content.config.ts`) et le pipeline d'import le rejettent sinon.
- **LabEvents ne l'invente pas** : l'identifiant à communiquer à l'exposant
  dans le Google Form est celui déjà attribué à sa fiche dans la collection
  `exposants` (import via `scripts/import-exposants.mjs`, voir
  `docs/EXPOSANTS_IMPORT.md`) — jamais un identifiant recréé au moment de la
  collecte des offres. Si l'exposant n'a pas encore de fiche `exposants`,
  celle-ci doit être créée (même `publie: non`) avant de collecter ses
  offres, pour que l'identifiant existe déjà côté référentiel.
- Réutilisé tel quel pour toutes les offres et toutes les mises à jour de
  cet exposant. Ne jamais réattribuer un identifiant existant à un autre
  exposant.
- Sert à regrouper les offres d'un même exposant pour le contrôle des
  quotas (section 8) et à les rattacher à leur fiche exposant dans l'Admin
  (`src/lib/admin.ts`, `offresRattachees`) — c'est la clé technique la plus
  importante de tout le pipeline. **Jamais** par nom d'entreprise ni par
  correspondance approximative.

---

## 6. Google Apps Script (facultatif) — `offres-exposants.gs`

Fichier : `scripts/google-apps-script/offres-exposants.gs`.

Rôle : à chaque nouvelle réponse au formulaire, récupérer l'URL de
modification (`FormResponse.getEditResponseUrl()`) et l'envoyer par email au
contact renseigné dans la réponse, avec un rappel de la date limite.

**Ce script n'est pas déployé.** Il doit être collé dans l'éditeur Apps
Script lié au Google Sheet de réponses (Extensions → Apps Script), puis un
déclencheur (`Trigger`) « À la soumission du formulaire » doit être créé
manuellement par une personne ayant accès au compte Google LabEvents. Tant
que ce n'est pas fait, seule l'option simple de la section 3 s'applique.

---

## 7. Google Sheets — structure de travail

Le Sheet de réponses (généré automatiquement par Google Forms) doit être
complété par les colonnes de suivi suivantes, ajoutées par LabEvents :

| Colonne | Rôle |
|---|---|
| Statut de traitement | Voir valeurs ci-dessous — **jamais exposé aux candidats** |
| Formule exposant | `standard` / `silver` / `gold` — reportée depuis le contrat commercial, pas depuis une déclaration de l'exposant |
| Validation LabEvents | Case à cocher ou nom de la personne ayant validé |
| Date de réponse | Horodatage Google Forms (colonne automatique) |
| Notes internes | Texte libre, jamais exporté vers le CSV public |

### Statuts internes recommandés

```
reçue → à compléter → validée → publiée → retirée → clôturée
```

Ces statuts correspondent exactement aux valeurs du champ `status` du
schéma Astro (`recue`, `a-completer`, `validee`, `publiee`, `retiree`,
`cloturee` — voir `src/content.config.ts`). **Aucune offre n'est publiée
automatiquement** du seul fait qu'un exposant l'a saisie : le passage à
`validée` puis `publiée` est une action humaine de LabEvents.

---

## 8. Procédure Gold, plus de 10 offres

Le formulaire ne prévoit que 10 blocs (couverture Silver). Un exposant Gold
ayant plus de 10 offres à déclarer n'a **pas de solution technique
implémentée dans ce lot**. Options possibles, à trancher par Philippe selon
les exposants Gold effectivement confirmés :

1. **Second envoi du même formulaire** (« Type de soumission : nouvelle
   déclaration ») pour les offres 11 et suivantes — le plus simple, aucun
   développement.
2. **Onglet Google Sheet dédié**, alimenté directement par LabEvents ou
   l'exposant, avec les mêmes colonnes que le CSV normalisé.
3. **Email structuré** envoyé par l'exposant à `labevents@icloud.com`, que
   LabEvents retranscrit manuellement dans le Sheet.
4. **Sections conditionnelles Google Forms** (« Aller à la section basée sur
   la réponse ») pour débloquer un second lot de 10 blocs si l'exposant
   répond « J'ai plus de 10 offres » — plus complexe à maintenir, non
   recommandé pour cette édition.

**Aucune de ces options n'est mise en œuvre dans ce lot.** Pour Gold, la
formule reste par ailleurs **sans plafond bloquant** (section 11 de la
mission) : le pipeline d'import ne limite jamais structurellement à 10 le
nombre d'offres Gold, quelle que soit l'option retenue pour la collecte.

---

## 9. Export CSV

1. Dans le Google Sheet de réponses, filtrer sur `Statut de traitement =
   validée`.
2. **Normaliser manuellement** : chaque bloc « Offre N » rempli d'une même
   ligne de réponse devient **une ligne** dans le CSV normalisé (une offre
   par ligne — jamais de colonnes `Offre1`, `Offre2`… dans le fichier
   fourni à l'import). Voir `data/templates/offres-import.csv` pour le
   modèle de colonnes exact, qui correspond au schéma `offres`.
3. Ne reporter dans ce CSV **aucune donnée de contact RH** (nom, email,
   téléphone) : elles ne font pas partie du schéma public et ne doivent
   jamais transiter vers un fichier destiné au dépôt du site (voir section
   22 de la mission Lot 3 et `.gitignore`).
4. Exporter ce fichier normalisé au format `.csv` (encodage UTF-8).
5. Lancer l'import en mode `--dry-run` avant tout import réel (voir
   `docs/WORKFLOW_OFFRES_2026.md`, étapes H à J).

---

## 10. Actions manuelles restantes côté Google (récapitulatif)

- [ ] Créer le Google Form selon la structure ci-dessus (sections 1 à 4).
- [ ] Activer « Modifier après l'envoi » dans les paramètres du formulaire.
- [ ] Créer le Google Sheet de réponses et y ajouter les colonnes de suivi
      (section 7).
- [ ] Décider si le Google Apps Script (section 6) est déployé pour cette
      édition, et si oui l'installer et créer le déclencheur.
- [ ] Attribuer un `exposantId` à chaque exposant recruteur confirmé
      (section 5).
- [ ] Décider de l'option retenue pour les exposants Gold à plus de 10
      offres, si un tel cas se présente réellement (section 8).
