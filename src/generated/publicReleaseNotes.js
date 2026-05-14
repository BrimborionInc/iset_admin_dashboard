const publicReleaseNotes = {
  "generatedAt": "2026-05-14T14:02:36.327Z",
  "releaseId": "",
  "releaseLabel": "Current build",
  "releaseDateEn": "14th May 2026",
  "releaseDateFr": "14 mai 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Brought Production up to the current DEV/TEST release set, including the latest admin, public portal, shared runtime, schema, and approved workflow-configuration updates.",
      "Updated the intake so Household Income and base Household Expenses are collected for all support requests, not only Living allowance requests.",
      "Added the Financial Overview signing workflow so case managers can send the current financial overview to the client for signature, with signed PDFs and version history retained on the file.",
      "Added payment follow-up tracking for Finance email handoffs, including packet and line-level follow-up status, notes, evidence links, and communication history.",
      "Restored the cross-client Payments dashboard and added Payment Communications to Case Workspace Manage Payments so packet detail, evidence, and follow-up history are available in both places.",
      "Standardized PATH denial wording so application and intervention denial decisions display as Denied instead of Rejected or Not Approved in admin screens, letters, reports, supporting-document selectors, and applicant decision-email labels.",
      "Renamed the application withdrawal workflow to Withdraw application and show withdrawn applications as Withdrawn while keeping them out of active queues.",
      "Updated the ISET Clients dashboard help so Open, Funded, Dormant, Ineligible, and All client filters match the current case-management list behavior."
    ],
    "knownIssuesHeading": "Known issues",
    "knownIssues": [],
    "previousChangesHeading": "Earlier changes",
    "previousChanges": [
      "Retired the public portal Contact function as an applicant support path; applicants should use secure Messages for case-manager contact, and staff can continue to triage any legacy contact-message records in Contact Communications.",
      "Fixed application decision validation so approval and denial outcomes must match the reviewer agreement with the case manager recommendation.",
      "Fixed decision-letter dates so generated and sent approval/denial letters use the current send date instead of an older draft or assessment date.",
      "Fixed Regional Manager ISET Clients access so directly assigned and in-scope case files appear in the case-management list.",
      "Made Contact Communications available to Regional Managers for legacy contact messages linked to applications in their case scope.",
      "Fixed repeat-application assessments so each selected application loads and saves its own assessment and approval-letter state instead of reusing data from an earlier application on the same case.",
      "Updated the public portal dashboard so signed-in applicants see saved drafts, current support, and application history before starting or resuming an intake.",
      "Improved Ask the AI guidance and guardrails for common application, document, approval-letter, and Pending Completion questions.",
      "Made application approval decisions clearer by separating agreement with the case manager recommendation from the final funding outcome.",
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
      "Mise a niveau de la Production avec l'ensemble courant valide en DEV/TEST, y compris les mises a jour admin, portail public, runtime partage, schema et configuration de flux approuvee.",
      "Mise a jour de la demande afin que le revenu du menage et les depenses de base du menage soient recueillis pour toutes les demandes de soutien, pas seulement les demandes d'allocation de subsistance.",
      "Ajout du flux de signature Apercu financier afin que les gestionnaires de cas puissent envoyer l'apercu financier courant a la cliente ou au client pour signature, avec PDF signe et historique de versions conserves au dossier.",
      "Ajout du suivi des paiements apres envoi aux Finances par courriel, avec statut de suivi par paquet et par ligne, notes, preuves liees et historique des communications.",
      "Retablissement du tableau de bord Paiements multi-clients et ajout de Communications de paiement a la vue Gerer les paiements dans l'espace Dossier.",
      "Uniformisation du libelle des refus afin que les decisions de refus PATH s'affichent comme Refusee/Refuse au lieu de Rejected ou Not Approved dans les ecrans admin, les lettres, les rapports, les selecteurs de documents et les courriels de decision.",
      "Le flux de retrait d'une demande s'appelle maintenant Retirer la demande et les demandes retirees s'affichent comme Retiree, tout en restant exclues des files actives.",
      "Mise a jour de l'aide du tableau Clients ISET afin que les filtres Ouverts, Finances, Dormants, Inadmissibles et Tous correspondent au comportement actuel de la liste de gestion des cas."
    ],
    "knownIssuesHeading": "Points connus",
    "knownIssues": [],
    "previousChangesHeading": "Changements precedents",
    "previousChanges": [
      "Retrait de la fonction Contact du portail public comme voie de soutien aux candidates et candidats; les personnes inscrites doivent utiliser les Messages securises pour joindre leur gestionnaire de cas, tandis que le personnel peut continuer a trier les anciens messages Contact dans Communications Contact.",
      "Correction de la validation des decisions de demande afin que l'approbation ou le refus corresponde a l'accord indique avec la recommandation du gestionnaire de cas.",
      "Correction des dates des lettres de decision afin que les lettres d'approbation ou de refus envoyees utilisent la date d'envoi courante, et non une ancienne date de brouillon ou d'evaluation.",
      "Correction de l'acces des gestionnaires regionaux a Clients ISET afin que les dossiers assignes directement et les dossiers dans leur portee apparaissent dans la liste de gestion des cas.",
      "Communications Contact est maintenant disponible aux gestionnaires regionaux pour les anciens messages lies aux demandes dans leur portee de cas.",
      "Correction des evaluations de demandes repetees afin que chaque demande selectionnee charge et enregistre sa propre evaluation et son propre etat de lettres d'approbation, au lieu de reutiliser les donnees d'une demande precedente dans le meme dossier.",
      "Mise a jour du tableau de bord du portail public afin que les personnes connectees voient les brouillons sauvegardes, le soutien en cours et l'historique des demandes avant de commencer ou reprendre une demande.",
      "Amelioration des consignes et garde-fous de Ask the AI pour les questions courantes sur les demandes, documents, lettres d'approbation et la file En attente de completion.",
      "Clarification des decisions d'approbation des demandes en separant l'accord avec la recommandation du gestionnaire de cas du resultat final de financement.",
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
