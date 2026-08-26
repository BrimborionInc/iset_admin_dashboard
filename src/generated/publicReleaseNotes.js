const publicReleaseNotes = {
  "generatedAt": "2026-08-26T02:18:51.672Z",
  "releaseId": "",
  "releaseLabel": "Current build",
  "releaseDateEn": "26th August 2026",
  "releaseDateFr": "26 aout 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Approved application funding packages are no longer blocked by unrelated applicationless or earlier-application agreement history on the same client file.",
      "Participant Details corrections can now be saved after opening a file directly from ISET Clients, without requiring an application ID.",
      "Eligible staff-uploaded documents can now be removed from normal use and restored by a System Administrator, while protected records explain why PATH must keep them.",
      "Secure Messaging now labels an item as `Applicant replied` only when the applicant actually replied.",
      "Returning applicants keep earlier application messages and activity attached to the correct application, and can safely remove their own unused draft uploads."
    ],
    "featurePackages": [
      {
        "title": "Release 20260825-signing-lineage-r2",
        "items": [
          "Secure-message and decision-letter retries now reuse the original completed send instead of creating a duplicate message, signing package, agreement version, or decision update after a lost connection.",
          "Secure Messaging now creates funding agreements and financial overviews for the exact selected application and Action Plan. Older applicationless and sibling-application forms remain available as history but no longer block or get changed by unrelated work.",
          "PATH keeps one continuous agreement history for the case. Only a contradiction in the exact form being generated or signed stops that form operation; ordinary messages and other casework remain available.",
          "Forms that use an intervention, including attendance reports, show that context before sending. Ordinary messages do not silently inherit the intervention or Action Plan selected elsewhere in the workspace.",
          "Historical conversations and authorized attachments remain available after application or account-link changes. PATH preserves their recorded ownership; only a signing form aimed at a former account or a proven file-ownership conflict stops the affected action."
        ]
      },
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
      "Les trousses de financement d'une demande approuvée ne sont plus bloquées par l'historique d'ententes sans demande ou d'une demande antérieure dans le même dossier client.",
      "Les corrections aux détails du participant peuvent maintenant être enregistrées après l'ouverture directe d'un dossier depuis Clients ISET, sans identifiant de demande.",
      "Les téléversements admissibles du personnel peuvent maintenant être retirés de l'utilisation normale et restaurés par un administrateur système, tandis que PATH explique pourquoi les dossiers protégés doivent être conservés.",
      "La messagerie sécurisée indique maintenant `Réponse du demandeur` uniquement lorsque la personne participante a réellement répondu.",
      "Pour les demandes répétées, les anciens messages et activités restent liés à la bonne demande, et la personne participante peut retirer en toute sécurité ses propres téléversements de brouillon inutilisés."
    ],
    "featurePackages": [
      {
        "title": "Release 20260825-signing-lineage-r2",
        "items": [
          "Les nouvelles tentatives d'envoi d'un message sécurisé ou d'une lettre de décision réutilisent maintenant l'envoi déjà terminé, plutôt que de créer un message, une trousse de signature, une version d'entente ou une mise à jour de décision en double après une perte de connexion.",
          "La messagerie sécurisée crée maintenant les ententes de financement et les aperçus financiers pour la demande et le plan d'action sélectionnés exactement. Les formulaires sans demande ou liés à une autre demande restent dans l'historique, sans bloquer ni être modifiés par un travail indépendant.",
          "PATH conserve un historique continu des ententes du dossier. Seule une contradiction dans le formulaire exact en cours de création ou de signature bloque cette opération; les messages ordinaires et les autres travaux au dossier restent disponibles.",
          "Les formulaires qui utilisent une intervention, y compris les rapports de présence, affichent ce contexte avant l'envoi. Les messages ordinaires n'héritent pas silencieusement de l'intervention ou du plan d'action sélectionné ailleurs dans l'espace de travail.",
          "Les conversations historiques et les pièces jointes autorisées restent accessibles après un changement de demande ou de compte lié. PATH préserve leur propriété enregistrée; seul un formulaire de signature destiné à un ancien compte ou un conflit de propriété de fichier prouvé bloque l'action concernée."
        ]
      },
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
      }
    ],
    "knownIssuesHeading": "Problemes connus",
    "knownIssues": [],
    "comingNextHeading": "A venir",
    "comingNext": []
  }
};

export default publicReleaseNotes;
