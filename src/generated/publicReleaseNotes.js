const publicReleaseNotes = {
  "generatedAt": "2026-07-14T00:13:09.462Z",
  "releaseId": "20260713-client-monthly-attendance-final-test",
  "releaseLabel": "Release 20260713-client-monthly-attendance-final-test",
  "releaseDateEn": "14th July 2026",
  "releaseDateFr": "14 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Case managers can now send a Client Monthly Attendance Report as a secure-message digital form for the participant to complete and sign.",
      "Absence dates stay within the selected reporting month, supporting evidence is attached securely, and the completed report is saved as an NWAC-style PDF."
    ],
    "featurePackages": [
      {
        "title": "Release 20260713-client-monthly-attendance-final-test",
        "items": [
          "Added the Client Monthly Attendance Report to the digital forms that case managers can attach to secure messages.",
          "PATH pre-fills available participant, institution, and program details while keeping them editable for correction.",
          "Participants report absences through progressively added rows, with date pickers restricted to the selected reporting month and supporting documentation required when absences are reported.",
          "Completed reports use the NWAC form layout, including a proper absence table and the participant's electronic signature."
        ]
      },
      {
        "title": "Release 20260713-prod-incident-requalification",
        "items": [
          "Fixed a portal error that could prevent signed-in applicants from opening messages or support activities."
        ]
      },
      {
        "title": "Release 20260713-admin-schema-readiness-hotfix",
        "items": [
          "Fixed a schema-readiness error that caused signed-in admin console requests to return 503."
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
      "Les gestionnaires de cas peuvent maintenant envoyer le Rapport mensuel de presence du client comme formulaire numerique par messagerie securisee afin que la participante ou le participant le remplisse et le signe.",
      "Les dates d'absence restent dans le mois de declaration selectionne, les pieces justificatives sont jointes de facon securisee et le rapport rempli est enregistre comme PDF au format de l'AFAC."
    ],
    "featurePackages": [
      {
        "title": "Release 20260713-client-monthly-attendance-final-test",
        "items": [
          "Ajout du Rapport mensuel de presence du client aux formulaires numeriques que les gestionnaires de cas peuvent joindre aux messages securises.",
          "PATH pre-remplit les renseignements disponibles sur la participante ou le participant, l'etablissement et le programme, tout en permettant de les corriger.",
          "Les absences sont saisies dans des rangees ajoutees au besoin; les calendriers sont limites au mois de declaration selectionne et une piece justificative est requise lorsque des absences sont declarees.",
          "Le rapport rempli reprend la presentation du formulaire de l'AFAC, y compris un tableau des absences et la signature electronique de la participante ou du participant."
        ]
      },
      {
        "title": "Release 20260713-prod-incident-requalification",
        "items": [
          "Correction d'une erreur du portail qui pouvait empecher les demandeurs connectes d'ouvrir leurs messages ou activites de soutien."
        ]
      },
      {
        "title": "Release 20260713-admin-schema-readiness-hotfix",
        "items": [
          "Correction d'une erreur de preparation du schema qui faisait retourner une erreur 503 aux requetes de la console d'administration apres la connexion."
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
