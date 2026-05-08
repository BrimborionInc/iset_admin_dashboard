const publicReleaseNotes = {
  "generatedAt": "2026-05-08T19:19:12.215Z",
  "releaseId": "",
  "releaseLabel": "Current build",
  "releaseDateEn": "8th May 2026",
  "releaseDateFr": "8 mai 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Retired the public portal Contact function as an applicant support path; applicants should use secure Messages for case-manager contact, and staff can continue to triage any legacy contact-message records in Contact Communications.",
      "Made application approval decisions clearer by separating agreement with the case manager recommendation from the final funding outcome.",
      "Improved Ask the AI guidance and guardrails for common application, document, approval-letter, and Pending Completion questions."
    ],
    "knownIssuesHeading": "Known issues",
    "knownIssues": [
      "Known issue: repeat applications for an existing client can currently open the previous application's assessment. Please avoid editing the assessment on a repeat application for now, because changes can overwrite the earlier assessment; we plan to fix this over the weekend."
    ],
    "previousChangesHeading": "Earlier changes",
    "previousChanges": [
      "Added an On Hold stage for applications that need to stay open but leave active assessment and decision queues until staff resume review.",
      "Added Application Overview actions to put an application on hold with a reason and review reminder, then resume it when follow-up is ready.",
      "Fixed a public-portal submission issue where final submission could create an upload/signature-only record instead of preserving the full saved application.",
      "Made secure-message drafting non-blocking so staff can keep reviewing the file while composing a message, even after changing quick layouts.",
      "Made approval decision steps show the case manager recommendation and rationale before reviewers record the decision.",
      "Made approval-letter packs editable for supporting institution, loan-provider, and other-funder letters before staff send or download them.",
      "Fixed the Case Workspace `Prepare approval letters` action so approved intervention proposals open the approval-letter follow-up directly.",
      "Fixed document checklist rules so tuition/books-only applications are not blocked by income or expense evidence, and Band/Nation decision letters count correctly in intervention proposal checklists."
    ],
    "comingNextHeading": "Coming next",
    "comingNext": []
  },
  "fr": {
    "sectionEyebrow": "Lecture optionnelle",
    "description": "",
    "featuresHeading": "Ce qui a change",
    "features": [
      "Retrait de la fonction Contact du portail public comme voie de soutien aux candidates et candidats; les personnes inscrites doivent utiliser les Messages securises pour joindre leur gestionnaire de cas, tandis que le personnel peut continuer a trier les anciens messages Contact dans Communications Contact.",
      "Clarification des decisions d'approbation des demandes en separant l'accord avec la recommandation du gestionnaire de cas du resultat final de financement.",
      "Amelioration des consignes et garde-fous de Ask the AI pour les questions courantes sur les demandes, documents, lettres d'approbation et la file En attente de completion."
    ],
    "knownIssuesHeading": "Points connus",
    "knownIssues": [
      "Probleme connu : les nouvelles demandes d'un client deja inscrit peuvent ouvrir l'evaluation de la demande precedente. Evitez de modifier l'evaluation d'une demande repetee pour l'instant, car les changements peuvent remplacer l'evaluation precedente; une correction est prevue pendant la fin de semaine."
    ],
    "previousChangesHeading": "Changements precedents",
    "previousChanges": [
      "Ajout d'une etape En attente pour les demandes qui doivent rester ouvertes, mais sortir des files d'evaluation et de decision jusqu'a la reprise de la revue.",
      "Ajout d'actions dans l'apercu de la demande pour mettre une demande en attente avec une raison et un rappel, puis reprendre la revue.",
      "Correction d'un probleme du portail public ou la soumission finale pouvait creer un dossier limite aux televersements/signatures au lieu de conserver toute la demande enregistree.",
      "La redaction des messages securises ne bloque plus l'espace de travail, afin que le personnel puisse continuer a consulter le dossier pendant la redaction.",
      "Les etapes de decision d'approbation affichent maintenant la recommandation et la justification du gestionnaire de cas avant la saisie de la decision.",
      "Les ensembles de lettres d'approbation permettent maintenant de modifier les lettres aux etablissements, preteurs et autres bailleurs de fonds avant l'envoi ou le telechargement.",
      "Correction de l'action `Preparer les lettres d'approbation` dans l'espace Dossier afin que les propositions d'intervention approuvees ouvrent directement le suivi de lettre d'approbation.",
      "Correction des regles de liste de verification des documents afin que les demandes pour frais de scolarite/livres seulement ne soient pas bloquees par les preuves de revenu ou de depenses, et que les lettres de decision de bande ou de nation soient bien reconnues dans les propositions d'intervention."
    ],
    "comingNextHeading": "A venir",
    "comingNext": []
  }
};

export default publicReleaseNotes;
