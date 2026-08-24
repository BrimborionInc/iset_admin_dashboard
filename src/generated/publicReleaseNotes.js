const publicReleaseNotes = {
  "generatedAt": "2026-08-24T21:41:32.087Z",
  "releaseId": "20260824-path-maintenance-r1",
  "releaseLabel": "Release 20260824-path-maintenance-r1",
  "releaseDateEn": "24th August 2026",
  "releaseDateFr": "24 aout 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Participant Details corrections can now be saved after opening a file directly from ISET Clients, without requiring an application ID.",
      "Eligible staff-uploaded documents can now be removed from normal use and restored by a System Administrator, while protected records explain why PATH must keep them.",
      "Secure Messaging now labels an item as `Applicant replied` only when the applicant actually replied.",
      "Returning applicants keep earlier application messages and activity attached to the correct application, and can safely remove their own unused draft uploads."
    ],
    "featurePackages": [
      {
        "title": "Release 20260824-path-maintenance-r1",
        "items": [
          "Participant Details corrections can now be saved from a client file opened directly through ISET Clients. PATH updates only the changed participant fields and preserves application decisions, assessments, and submitted reporting evidence.",
          "Eligible ordinary staff uploads can now be removed from normal document lists without deleting the stored audit history. System Administrators can review and restore them, while protected workflow, signing, message, agreement, and payment documents clearly explain why they must be retained.",
          "Secure Messaging now records `Applicant replied` only for a real applicant-origin reply; staff follow-ups no longer change an earlier staff message to that status.",
          "Repeat-application portal activity remains attached to the exact application, and applicants can safely remove only their own unused pre-submission draft uploads."
        ]
      },
      {
        "title": "Release 20260818-admin-workflow-fixes-r2",
        "items": [
          "Recalled assessments now return to an editable submitter-correction state and can be resubmitted through the normal Regional Manager review path. PATH preserves the original submitter and recall history and clears stale reviewer decisions.",
          "Supporting-document titles and types can now be corrected for applicant uploads, secure-message attachments, staff uploads, generated documents, and older records. Source ownership and dependent signing, version, and payment evidence remain protected."
        ]
      },
      {
        "title": "Release 20260818-admin-workflow-fixes-r1",
        "items": [
          "Assessment submission now refreshes the selected application before checking for concurrent edits. Genuine concurrent changes reload the latest assessment; other workflow problems show their actual message.",
          "Staff can rename a supporting document's display title without changing its stored file, document type, ownership, workflow links, or audit evidence."
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
      "Les corrections aux détails du participant peuvent maintenant être enregistrées après l'ouverture directe d'un dossier depuis Clients ISET, sans identifiant de demande.",
      "Les téléversements admissibles du personnel peuvent maintenant être retirés de l'utilisation normale et restaurés par un administrateur système, tandis que PATH explique pourquoi les dossiers protégés doivent être conservés.",
      "La messagerie sécurisée indique maintenant `Réponse du demandeur` uniquement lorsque la personne participante a réellement répondu.",
      "Pour les demandes répétées, les anciens messages et activités restent liés à la bonne demande, et la personne participante peut retirer en toute sécurité ses propres téléversements de brouillon inutilisés."
    ],
    "featurePackages": [
      {
        "title": "Release 20260824-path-maintenance-r1",
        "items": [
          "Les corrections aux détails du participant peuvent maintenant être enregistrées depuis un dossier client ouvert directement par Clients ISET. PATH met à jour uniquement les champs modifiés et préserve les décisions, les évaluations et les preuves de rapport déjà soumises.",
          "Les téléversements ordinaires admissibles du personnel peuvent maintenant être retirés des listes normales sans supprimer l'historique d'audit. Les administrateurs système peuvent les examiner et les restaurer, tandis que PATH explique clairement pourquoi les documents liés aux processus, aux signatures, aux messages, aux ententes et aux paiements doivent être conservés.",
          "La messagerie sécurisée enregistre maintenant `Réponse du demandeur` uniquement pour une véritable réponse provenant de la personne participante; les suivis du personnel ne changent plus ainsi le statut d'un message antérieur du personnel.",
          "Pour les demandes répétées, l'activité du portail reste liée à la demande exacte, et les personnes participantes peuvent retirer en toute sécurité uniquement leurs propres téléversements de brouillon inutilisés avant la soumission."
        ]
      },
      {
        "title": "Release 20260818-admin-workflow-fixes-r2",
        "items": [
          "Les évaluations rappelées redeviennent modifiables par la personne enregistrée comme les ayant soumises et peuvent être soumises de nouveau selon le processus normal de révision du gestionnaire régional. PATH préserve l'historique du rappel et efface les anciennes décisions des réviseurs.",
          "Les titres et les types des documents justificatifs peuvent maintenant être corrigés pour les téléversements des demandeurs, les pièces jointes aux messages sécurisés, les téléversements du personnel, les documents générés et les anciens dossiers. La provenance et les preuves liées aux signatures, aux versions et aux paiements demeurent protégées."
        ]
      },
      {
        "title": "Release 20260818-admin-workflow-fixes-r1",
        "items": [
          "La soumission d'une évaluation actualise maintenant d'abord la demande sélectionnée avant de vérifier les modifications simultanées. Les vrais conflits rechargent l'évaluation la plus récente; les autres problèmes du flux de travail affichent leur message réel.",
          "Le personnel peut renommer le titre d'affichage d'un document justificatif sans modifier son fichier stocké, son type, son propriétaire, ses liens de flux de travail ni sa preuve d'audit."
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
