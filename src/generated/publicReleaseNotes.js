const publicReleaseNotes = {
  "generatedAt": "2026-07-09T00:57:57.715Z",
  "releaseId": "20260708-critical-feedback-reporting-prod",
  "releaseLabel": "Release 20260708-critical-feedback-reporting-prod",
  "releaseDateEn": "9th July 2026",
  "releaseDateFr": "9 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Manually entered existing interventions use their intervention start date as the inferred approval date for approval-date financial reporting.",
      "Regional Snapshot now labels the application-status count as `Approved Applications`.",
      "System Administrators now receive email alerts when bug reports or change requests are saved as Critical."
    ],
    "featurePackages": [
      {
        "title": "Release 20260708-critical-feedback-reporting-prod",
        "items": [
          "Manually entered existing interventions now use the entered intervention start date as the inferred historical approval date for approval-date financial reporting.",
          "Regional Snapshot now labels the application-status count as `Approved Applications` instead of `Approved / Funded Applications`.",
          "Bugs and Change Requests now emails System Administrators when a report is saved as Critical, including when an existing report is upgraded to Critical."
        ]
      },
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
      "Les interventions existantes entrees manuellement utilisent maintenant la date de debut de l'intervention comme date d'approbation inferee pour les rapports financiers par date d'approbation.",
      "Regional Snapshot nomme maintenant le compteur de statut des demandes `Approved Applications`.",
      "Les administrateurs systeme recoivent maintenant un courriel lorsqu'un bogue ou une demande de changement est enregistre comme critique."
    ],
    "featurePackages": [
      {
        "title": "Release 20260708-critical-feedback-reporting-prod",
        "items": [
          "Les interventions existantes entrees manuellement utilisent maintenant la date de debut de l'intervention comme date d'approbation historique inferee pour les rapports financiers par date d'approbation.",
          "Regional Snapshot nomme maintenant le compteur de statut des demandes `Approved Applications` au lieu de `Approved / Funded Applications`.",
          "Bugs and Change Requests envoie maintenant un courriel aux administrateurs systeme lorsqu'un rapport est enregistre comme critique, y compris lorsqu'un rapport existant est augmente a critique."
        ]
      },
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
      }
    ],
    "knownIssuesHeading": "Problemes connus",
    "knownIssues": [],
    "comingNextHeading": "A venir",
    "comingNext": []
  }
};

export default publicReleaseNotes;
