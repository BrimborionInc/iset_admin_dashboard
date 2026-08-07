const publicReleaseNotes = {
  "generatedAt": "2026-08-07T03:02:25.566Z",
  "releaseId": "20260806-assessment-correction-hotfix-r2",
  "releaseLabel": "Release 20260806-assessment-correction-hotfix-r2",
  "releaseDateEn": "7th August 2026",
  "releaseDateFr": "7 aout 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Returned Application Assessments now stay in the correct review queue while Financial Overview requests are completed, so Regional Managers can forward changes and the original submitter can correct and resubmit the assessment.",
      "Client Funding Agreement signing now completes the signed file, document links, agreement version, and request state together, without leaving a partial completion if any step fails."
    ],
    "featurePackages": [
      {
        "title": "Release 20260806-assessment-correction-hotfix-r2",
        "items": [
          "Financial Overview requests and signing no longer replace the active Application Assessment review stage or hide a returned assessment from the correct queue.",
          "A returned assessment can be edited and resubmitted only by the staff member recorded as its original submitter; a correction-required reopened assessment must be returned for correction before it can move forward again.",
          "Client Funding Agreement signing now commits the exact application, agreement version, signed document, request, message, and audit event as one protected operation, with safe retry and rollback behavior."
        ]
      },
      {
        "title": "Release 20260805-cfa-signing-hotfix-r3",
        "items": [
          "Fixed Client Funding Agreement signing so PATH carries the agreement's verified application link into the signed PDF, agreement version, document record, and case event.",
          "Repeated submission of an already signed agreement remains safe and does not create duplicate documents or events."
        ]
      },
      {
        "title": "Release 20260801-returned-assessment-edit",
        "items": [
          "Regional Managers can now edit an Application Assessment returned to them when they were the staff member who originally submitted it."
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
      "Les évaluations de demande retournées restent maintenant dans la bonne file de révision pendant le traitement des demandes d'aperçu financier. Les gestionnaires régionaux peuvent donc transmettre les changements et la personne ayant soumis l'évaluation peut la corriger et la soumettre de nouveau.",
      "La signature d'une entente de financement du client finalise maintenant ensemble le fichier signé, les liens de document, la version de l'entente et l'état de la demande, sans laisser de traitement partiel en cas d'échec."
    ],
    "featurePackages": [
      {
        "title": "Release 20260806-assessment-correction-hotfix-r2",
        "items": [
          "Les demandes et signatures d'aperçu financier ne remplacent plus l'étape active de révision d'une évaluation de demande et ne masquent plus une évaluation retournée dans la mauvaise file.",
          "Une évaluation retournée peut être modifiée et soumise de nouveau uniquement par la personne enregistrée comme l'ayant soumise initialement. Une évaluation rouverte pour correction doit être retournée avant de pouvoir progresser de nouveau.",
          "La signature d'une entente de financement du client enregistre maintenant la demande exacte, la version de l'entente, le document signé, la demande de signature, le message et l'événement d'audit dans une seule opération protégée, avec une reprise et une annulation sécuritaires."
        ]
      },
      {
        "title": "Release 20260805-cfa-signing-hotfix-r3",
        "items": [
          "Correction de la signature des ententes de financement du client : PATH transmet maintenant le lien vérifié de la demande au PDF signé, à la version de l'entente, au document et à l'événement du dossier.",
          "Une nouvelle soumission d'une entente déjà signée demeure sans danger et ne crée pas de documents ni d'événements en double."
        ]
      },
      {
        "title": "Release 20260801-returned-assessment-edit",
        "items": [
          "Les gestionnaires régionaux peuvent maintenant modifier une évaluation de demande qui leur est retournée lorsqu'ils l'avaient initialement soumise."
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
