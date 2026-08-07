/**
 * Salon de l'Emploi & de la Formation 2026 — envoi automatique du lien de
 * modification de réponse (Google Forms « Offres exposant »).
 *
 * FACULTATIF ET NON DÉPLOYÉ. Voir docs/OFFRES_EXPOSANTS.md, section 6, pour
 * le contexte : Google Forms ne renvoie pas automatiquement par email le
 * lien permettant à un exposant de modifier sa réponse. Ce script comble ce
 * manque, sans backend ni développement web : il tourne uniquement dans
 * Google Apps Script, à l'intérieur du compte Google LabEvents.
 *
 * Installation (à faire manuellement par une personne ayant accès au compte
 * Google LabEvents — Claude Code ne peut pas le faire) :
 *   1. Ouvrir le Google Sheet de réponses du formulaire.
 *   2. Menu Extensions → Apps Script.
 *   3. Coller ce fichier dans l'éditeur (remplace le contenu par défaut).
 *   4. Ajuster EMAIL_CONTACT_COLONNE et EMAIL_ENTREPRISE_COLONNE ci-dessous
 *      si les intitulés de colonnes diffèrent de ceux du formulaire réel.
 *   5. Menu Déclencheurs (icône horloge) → Ajouter un déclencheur :
 *      fonction `surEnvoiFormulaire`, source d'événement « Depuis le
 *      formulaire », type d'événement « Sur envoi du formulaire ».
 *   6. Autoriser le script (première exécution) avec le compte Google
 *      LabEvents.
 *
 * Sans cette installation, ce fichier n'a aucun effet : il ne s'exécute nulle
 * part tant qu'il n'est pas collé dans un projet Apps Script réel et lié à
 * un déclencheur.
 */

// Nom exact des colonnes du formulaire à utiliser pour retrouver le contact.
// À ajuster si les intitulés des questions du formulaire réel diffèrent.
const EMAIL_CONTACT_COLONNE = 'Adresse email';
const NOM_CONTACT_COLONNE = 'Nom et prénom du contact RH / recrutement';
const ENTREPRISE_COLONNE = 'Entreprise / organisme';

const DATE_LIMITE = '12 octobre 2026';
const CONTACT_LABEVENTS = 'labevents@icloud.com';

/**
 * Déclenché automatiquement à chaque envoi du formulaire (voir installation
 * ci-dessus). Récupère le lien de modification propre à cette réponse et
 * l'envoie par email au contact déclaré.
 */
function surEnvoiFormulaire(evenement) {
  const reponse = evenement.response;
  if (!reponse) return;

  const lienModification = reponse.getEditResponseUrl();
  const items = reponse.getItemResponses();

  const valeurPour = (intitule) => {
    const item = items.find((i) => i.getItem().getTitle() === intitule);
    return item ? item.getResponse() : '';
  };

  const email = valeurPour(EMAIL_CONTACT_COLONNE);
  const nomContact = valeurPour(NOM_CONTACT_COLONNE) || 'Bonjour';
  const entreprise = valeurPour(ENTREPRISE_COLONNE) || 'votre entreprise';

  if (!email) {
    Logger.log('Pas d\'adresse email trouvée pour cette réponse — aucun envoi.');
    return;
  }

  const sujet = 'Salon de l\'Emploi 2026 — Confirmation de votre déclaration d\'offres';
  const corps = [
    `${nomContact},`,
    '',
    `Nous avons bien reçu la déclaration d'offres de ${entreprise} pour le Salon de l'Emploi & de la Formation 2026.`,
    '',
    `Vous pouvez la modifier jusqu'au ${DATE_LIMITE} via ce lien :`,
    lienModification,
    '',
    `Pour toute question : ${CONTACT_LABEVENTS}`,
    '',
    'L\'équipe LabEvents',
  ].join('\n');

  MailApp.sendEmail(email, sujet, corps);
}
