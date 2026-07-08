const publicReleaseNotes = {
  "generatedAt": "2026-07-08T09:55:31.904Z",
  "releaseId": "20260708-admin-user-ei-notification-fix",
  "releaseLabel": "Release 20260708-admin-user-ei-notification-fix",
  "releaseDateEn": "8th July 2026",
  "releaseDateFr": "8 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Staff setup emails are sent only after PATH saves the Cognito group and staff access.",
      "Authorized managers and admins can correct EI status from Application Assessment after submission when it is safe to do so.",
      "Applicant-related staff alerts now show applicant names when available instead of email-shaped account display names."
    ],
    "featurePackages": [
      {
        "title": "Release 20260708-admin-user-ei-notification-fix",
        "items": [
          "User Management now completes the PATH-side staff access setup before sending the Cognito temporary-password email, so new regional managers are not invited before their access exists.",
          "Application Assessment now allows authorized managers and admins to correct EI status after submission when no dependent action plan or intervention work would be invalidated.",
          "Staff notifications about applicant files now prefer the applicant's first and last name when PATH has it, with the registered email kept as the fallback."
        ]
      },
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
      "Les courriels de creation de compte du personnel sont envoyes seulement apres l'enregistrement du groupe Cognito et de l'acces PATH.",
      "Les gestionnaires et administrateurs autorises peuvent corriger le statut AE dans Application Assessment apres soumission lorsque c'est securitaire.",
      "Les alertes du personnel qui concernent un participant affichent maintenant le nom du participant lorsque PATH le connait, avec l'adresse courriel comme solution de repli."
    ],
    "featurePackages": [
      {
        "title": "Release 20260708-admin-user-ei-notification-fix",
        "items": [
          "Gestion des utilisateurs termine maintenant la configuration d'acces PATH avant d'envoyer le courriel Cognito de mot de passe temporaire, pour eviter d'inviter un gestionnaire regional avant que son acces existe.",
          "Application Assessment permet maintenant aux gestionnaires et administrateurs autorises de corriger le statut AE apres soumission lorsqu'aucun plan d'action ou travail d'intervention dependant ne serait invalide.",
          "Les alertes du personnel a propos des dossiers participants preferent maintenant le prenom et le nom du participant lorsque PATH les connait, avec l'adresse courriel inscrite comme solution de repli."
        ]
      },
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
      }
    ],
    "knownIssuesHeading": "Problemes connus",
    "knownIssues": [],
    "comingNextHeading": "A venir",
    "comingNext": []
  }
};

export default publicReleaseNotes;
