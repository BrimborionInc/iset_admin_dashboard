const publicReleaseNotes = {
  "generatedAt": "2026-07-10T10:33:11.614Z",
  "releaseId": "20260710-conflict-disposition-notes-prod",
  "releaseLabel": "Release 20260710-conflict-disposition-notes-prod",
  "releaseDateEn": "10th July 2026",
  "releaseDateFr": "10 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Conflict resolution now requires reviewer notes, and conflict-related reassignment supports optional notes; both decisions are recorded and sent to the staff member who declared the conflict."
    ],
    "featurePackages": [
      {
        "title": "Release 20260710-conflict-disposition-notes-prod",
        "items": [
          "Resolving a declared conflict now requires notes and records a `cleared` disposition without rewriting the original declaration.",
          "Conflict-related reassignment now records a separate `reassigned` disposition and supports optional reviewer notes.",
          "Both outcomes create a human-readable audit event and send the declaring staff member a direct notification using the applicant's name."
        ]
      },
      {
        "title": "Release 20260709-portal-application-start-gate-prod",
        "items": [
          "The applicant dashboard now hides Start New and any saved draft while a submitted non-terminal application is in process.",
          "Direct links to the intake wizard now recheck eligibility before rendering the form and return the applicant to the dashboard when another application is blocking.",
          "The eligibility check now covers admin/manual-intake, account-activation, and future console-created application-only cases by checking the applicant's linked client record as well as the original submission owner."
        ]
      },
      {
        "title": "Release 20260708-critical-feedback-reporting-prod",
        "items": [
          "Manually entered existing interventions now use the entered intervention start date as the inferred historical approval date for approval-date financial reporting.",
          "Regional Snapshot now labels the application-status count as `Approved Applications` instead of `Approved / Funded Applications`.",
          "Bugs and Change Requests now emails System Administrators when a report is saved as Critical, including when an existing report is upgraded to Critical."
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
      "La resolution d'un conflit exige maintenant des notes de revision, et la reaffectation liee a un conflit accepte des notes facultatives; les deux decisions sont consignees et envoyees au membre du personnel qui a declare le conflit."
    ],
    "featurePackages": [
      {
        "title": "Release 20260710-conflict-disposition-notes-prod",
        "items": [
          "La resolution d'un conflit declare exige maintenant des notes et consigne une decision `cleared` sans modifier la declaration originale.",
          "La reaffectation liee a un conflit consigne maintenant une decision distincte `reassigned` et accepte des notes de revision facultatives.",
          "Les deux resultats creent un evenement d'audit lisible et envoient une notification directe au membre du personnel qui a declare le conflit, en utilisant le nom du demandeur."
        ]
      },
      {
        "title": "Release 20260709-portal-application-start-gate-prod",
        "items": [
          "Le tableau de bord demandeur masque maintenant Commencer une nouvelle demande et tout brouillon sauvegarde lorsqu'une demande soumise non terminale est en traitement.",
          "Les liens directs vers le formulaire d'admission reverifient maintenant l'admissibilite avant d'afficher le formulaire et retournent le demandeur au tableau de bord lorsqu'une autre demande bloque le demarrage.",
          "La verification couvre maintenant les cas d'admission manuelle/admin, d'activation de compte et les futurs cas d'application sans soumission creee dans la console, en utilisant le dossier client lie au demandeur en plus du proprietaire original de la soumission."
        ]
      },
      {
        "title": "Release 20260708-critical-feedback-reporting-prod",
        "items": [
          "Les interventions existantes entrees manuellement utilisent maintenant la date de debut de l'intervention comme date d'approbation historique inferee pour les rapports financiers par date d'approbation.",
          "Regional Snapshot nomme maintenant le compteur de statut des demandes `Approved Applications` au lieu de `Approved / Funded Applications`.",
          "Bugs and Change Requests envoie maintenant un courriel aux administrateurs systeme lorsqu'un rapport est enregistre comme critique, y compris lorsqu'un rapport existant est augmente a critique."
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
