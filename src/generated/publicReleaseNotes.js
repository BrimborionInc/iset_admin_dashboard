const publicReleaseNotes = {
  "generatedAt": "2026-04-30T14:40:42.886Z",
  "releaseId": "20260430-auth-region-db-test",
  "releaseLabel": "Release 20260430-auth-region-db-test",
  "releaseDateEn": "30th April 2026",
  "releaseDateFr": "30 avril 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Client files now follow a cleaner one-client, one-case model. Historical duplicate case records are consolidated into the surviving client file while keeping action plans, interventions, documents, notes, and message history attached.",
      "Secure Messaging, Supporting Documents, Notes, Timeline, and payment-packet access have been tightened so staff actions stay scoped to the case, application, client, or payment record they are authorized to use.",
      "Older public-portal applications that were missing generated signed consent/declaration PDFs have been repaired, and new submissions continue to store the signed forms in Supporting Documents.",
      "Assessment submission now fails clearly if required generated PDFs cannot be created before a file moves to Pending Decision, reducing the chance of a decision file missing its assessment, application, or financial overview PDFs.",
      "Approval and pending-completion flows are more stable: approval items open the intended review step, staff can look back through the wizard, and denied files leave Pending Completion once the denial letter is sent.",
      "Historical intake uploads are easier to recover in the application workspace and checklist, including older files where uploads were saved before PATH linked them to the final application record.",
      "The application-workspace Secure Messaging widget no longer flashes or reloads messages repeatedly while a global maintenance warning countdown is visible.",
      "Maintenance warnings now use shorter, more direct wording and can be shown before planned downtime without adding extra save-progress language."
    ],
    "knownIssuesHeading": "Known issues",
    "knownIssues": [
      "Some staff may still see Supporting Documents load errors or confusing empty results when document filters are active.",
      "Some New Applications may not show the expected assignment or reassignment action, especially where EI verification is overdue.",
      "Secure-message notification coverage for messages in client files is still under review.",
      "The admin upload-client/intake entry point needs review because staff may not always see the expected upload tab.",
      "Some updated case-manager assessment records still need review where staff expect a refreshed assessment PDF to appear in Supporting Documents."
    ],
    "comingNextHeading": "Coming next",
    "comingNext": [
      "Clearer workflow options for applications that are withdrawn or paused while waiting for external funding or other information.",
      "A review of Supporting Documents filters so staff can tell the difference between no matching documents and a real load failure.",
      "Follow-up on New Application assignment and reassignment behaviour after EI verification becomes overdue.",
      "Follow-up on message notification behaviour for application and case secure messages."
    ]
  },
  "fr": {
    "sectionEyebrow": "Lecture optionnelle",
    "description": "",
    "featuresHeading": "Ce qui a change",
    "features": [
      "Les dossiers clients suivent maintenant un modele plus clair: un client, un dossier. Les anciens dossiers en double sont consolides dans le dossier client conserve, tout en gardant les plans d'action, interventions, documents, notes et messages.",
      "La messagerie securisee, les documents justificatifs, les notes, la chronologie et les lots de paiement sont mieux limites aux dossiers, demandes, clients ou paiements que le personnel est autorise a utiliser.",
      "Les anciennes demandes du portail public auxquelles il manquait des PDF signes de consentement et de declaration ont ete reparees, et les nouvelles soumissions continuent d'enregistrer ces formulaires signes dans les documents justificatifs.",
      "La soumission d'une evaluation echoue maintenant clairement si les PDF requis ne peuvent pas etre crees avant qu'un dossier passe a la file de decision, ce qui reduit les dossiers de decision incomplets.",
      "Les flux d'approbation et de suivi sont plus stables: les elements d'approbation ouvrent l'etape de revision attendue, le personnel peut revenir aux etapes precedentes, et les refus quittent la file de suivi apres l'envoi de la lettre.",
      "Les anciens televersements d'admission sont plus faciles a retrouver dans l'espace de travail de la demande et la liste de controle, y compris lorsque les fichiers avaient ete enregistres avant le lien final avec la demande.",
      "Le widget Messagerie securisee de l'espace de travail de la demande ne clignote plus et ne recharge plus les messages en boucle lorsqu'un avis de maintenance avec compte a rebours est visible.",
      "Les avis de maintenance utilisent maintenant un texte plus court et plus direct, sans ajouter de consigne supplementaire de sauvegarde du travail."
    ],
    "knownIssuesHeading": "Points connus",
    "knownIssues": [
      "Certains membres du personnel peuvent encore voir des erreurs de chargement ou des resultats vides confus dans Documents justificatifs lorsque des filtres sont actifs.",
      "Certaines nouvelles demandes peuvent ne pas afficher l'action d'affectation ou de reaffectation attendue, surtout lorsque la verification AE est en retard.",
      "La couverture des notifications de messagerie securisee pour les messages dans les dossiers clients est encore en cours d'examen.",
      "Le point d'entree d'admission ou de televersement d'un client dans l'administration doit etre revu, car le personnel peut ne pas toujours voir l'onglet attendu.",
      "Certains dossiers d'evaluation par le gestionnaire de cas doivent encore etre verifies lorsque le personnel s'attend a voir un nouveau PDF d'evaluation dans Documents justificatifs."
    ],
    "comingNextHeading": "A venir",
    "comingNext": [
      "Des options de flux de travail plus claires pour les demandes retirees ou mises en pause pendant l'attente d'un financement externe ou d'autres renseignements.",
      "Une revision des filtres de Documents justificatifs afin que le personnel distingue mieux une absence de documents correspondants d'une vraie erreur de chargement.",
      "Un suivi du comportement d'affectation et de reaffectation des nouvelles demandes lorsque la verification AE est en retard.",
      "Un suivi du comportement des notifications pour les messages securises lies aux demandes et aux dossiers."
    ]
  }
};

export default publicReleaseNotes;
