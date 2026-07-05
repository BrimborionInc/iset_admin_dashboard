const publicReleaseNotes = {
  "generatedAt": "2026-07-05T15:44:15.490Z",
  "releaseId": "20260705-two-step-review-test-notification-fix",
  "releaseLabel": "Release 20260705-two-step-review-test-notification-fix",
  "releaseDateEn": "5th July 2026",
  "releaseDateFr": "5 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Staff secure messages now distinguish moving a message out of your own mailbox from withdrawing a sent message for everyone.",
      "Secure-message email alerts for staff now use the applicant name from the file record when the portal account name is an email address.",
      "Two-step review alerts now cover intervention proposals entering Regional Manager review and intervention proposals returned by the Decision Maker for changes."
    ],
    "featurePackages": [
      {
        "title": "Release 20260705-two-step-review-test-notification-fix",
        "items": [
          "New intervention proposals submitted for review now send the Regional Manager `Pending Review` bell alert.",
          "Decision Maker change requests on intervention proposals now use the two-step review change-request alert routed back to the Regional Manager.",
          "The TEST smoke now covers application assessments, new intervention proposals, intervention revisions, role guards, edit locks, generated documents, browser routes, notification routing, and cleanup."
        ]
      },
      {
        "title": "Release 20260705-secure-message-batch",
        "items": [
          "Staff compose now asks staff to confirm the case participant before sending a secure message.",
          "Plain staff-to-applicant messages can be withdrawn with audit-preserving redaction; messages with linked files or forms stay blocked from withdrawal until that artifact-aware workflow is reviewed.",
          "Applicant-origin secure-message email alerts now use the applicant name from the file record when the portal account name is an email address."
        ]
      },
      {
        "title": "Release 20260626-rm-two-step-role-matrix-prod",
        "items": [
          "Regional Managers who are acting as submitters can submit application assessments, new intervention proposals, and intervention amendments into Regional Manager review.",
          "ISET Coordinators and Regional Managers are the only roles that can start the two-step review workflow; NWAC Administrators and System Administrators remain final-decision actors only.",
          "The workflow now rejects invalid starters before saving submitted intervention rows, preventing submitted items from being left without review workflow audit rows.",
          "The release was tested with the four actual PATH roles and with browser workflow smokes for application assessments, new intervention proposals, and intervention amendments."
        ]
      }
    ],
    "knownIssuesHeading": "Known Bugs",
    "knownIssues": [],
    "comingNextHeading": "What's Coming",
    "comingNext": []
  },
  "fr": {
    "sectionEyebrow": "Lecture optionnelle",
    "description": "",
    "featuresHeading": "Ce qui a change",
    "features": [
      "Les messages securises du personnel distinguent maintenant le nettoyage de sa propre boite aux lettres du retrait d'un message envoye pour tout le monde.",
      "Les alertes courriel de messages securises pour le personnel utilisent maintenant le nom du participant dans le dossier lorsque le nom du compte portail est une adresse courriel.",
      "Les alertes de revision en deux etapes couvrent maintenant les propositions d'intervention envoyees au gestionnaire regional et celles retournees par le decideur pour changements."
    ],
    "featurePackages": [
      {
        "title": "Release 20260705-two-step-review-test-notification-fix",
        "items": [
          "Les nouvelles propositions d'intervention soumises pour revision envoient maintenant l'alerte `Pending Review` au gestionnaire regional.",
          "Les demandes de changements du decideur sur les propositions d'intervention utilisent maintenant l'alerte de revision en deux etapes retournee au gestionnaire regional.",
          "Le test TEST couvre maintenant les evaluations de demande, les nouvelles propositions d'intervention, les revisions d'intervention, les roles, les verrous de modification, les documents generes, les routes navigateur, les alertes et le nettoyage."
        ]
      },
      {
        "title": "Release 20260705-secure-message-batch",
        "items": [
          "La redaction d'un message securise demande maintenant au personnel de confirmer le participant du dossier avant l'envoi.",
          "Les messages simples envoyes par le personnel aux participants peuvent etre retires avec une redaction qui preserve l'audit; les messages avec fichiers ou formulaires lies restent bloques jusqu'a la revision de ce processus.",
          "Les alertes courriel pour les messages securises envoyes par un participant utilisent maintenant le nom du participant dans le dossier lorsque le nom du compte portail est une adresse courriel."
        ]
      },
      {
        "title": "Release 20260626-rm-two-step-role-matrix-prod",
        "items": [
          "Les gestionnaires regionaux qui agissent comme soumissionnaires peuvent soumettre des evaluations de demande, de nouvelles propositions d'intervention et des amendements d'intervention a la revision du gestionnaire regional.",
          "Les coordonnateurs ISET et les gestionnaires regionaux sont les seuls roles qui peuvent demarrer le processus de revision en deux etapes; les administrateurs NWAC et les administrateurs systeme restent limites a l'etape de decision finale.",
          "Le processus rejette maintenant les soumissionnaires non autorises avant d'enregistrer des interventions comme soumises, ce qui evite de laisser des elements soumis sans ligne d'audit de revision.",
          "La version a ete testee avec les quatre vrais roles PATH et avec des tests navigateur pour les evaluations de demande, les nouvelles propositions d'intervention et les amendements d'intervention."
        ]
      }
    ],
    "knownIssuesHeading": "Problemes connus",
    "knownIssues": [],
    "comingNextHeading": "A venir",
    "comingNext": []
  }
};

export default publicReleaseNotes;
