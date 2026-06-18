const publicReleaseNotes = {
  "generatedAt": "2026-06-18T20:47:19.422Z",
  "releaseId": "20260618-test-financial-overview-editable",
  "releaseLabel": "Release 20260618-test-financial-overview-editable",
  "releaseDateEn": "18th June 2026",
  "releaseDateFr": "18 juin 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Financial Overview forms sent by secure message can now be blank or pre-filled editable forms focused on income and expenses, with clearer monthly hints and `per month` inputs; participant submissions update PATH Participant Details.",
      "System Administrators can now see app capacity, database stress, and database query-pressure checks in AWS Environment Status.",
      "Submitted assessments and intervention proposals are read-only while awaiting approval.",
      "Manage ISET Applications and ISET Clients now share the same widget-based dashboard treatment.",
      "Submitters can recall a pending assessment or intervention proposal before a decision is recorded.",
      "Recalled submissions archive the withdrawn generated assessment PDFs, record an audit event, and return the work to an editable state for correction and resubmission."
    ],
    "featurePackages": [
      {
        "title": "Release 20260618-test-financial-overview-editable",
        "items": [
          "Financial Overview forms sent by secure message can now be sent blank or pre-filled, and participants can complete or edit clearer monthly income and expense fields before signing.",
          "Participant submissions update the case Participant Details data used by PATH, refresh the Financial Overview version snapshot, and store the signed PDF.",
          "Manage ISET Applications and ISET Clients now share the same widget-based dashboard treatment, and AWS Environment Status includes app capacity, database stress, and query-pressure checks."
        ]
      },
      {
        "title": "Release 20260617-prod-assessment-recall-guardrails",
        "items": [
          "Submitted application assessments, new intervention proposals, and intervention revision/amendment proposals are now read-only while awaiting approval.",
          "The submitter can recall a pending submission before a decision is recorded, returning it to an editable state for correction and resubmission.",
          "Recalled submissions archive the withdrawn generated assessment PDFs, record an audit event, and keep future redlines based on the last active non-recalled submission."
        ]
      },
      {
        "title": "Release 20260612-212548",
        "items": [
          "System Administrators can reopen a closed action plan from the Case Workspace header when circumstances change after closeout. The recovery action records a reason, resets ILMP validation/submission to needs review, and supports either adding a new intervention or reopening one completed intervention for amendment.",
          "User Management name edits now also update Display name when the display name was still mirroring the old staff name, so a saved profile change no longer appears unchanged in the staff table.",
          "Intake steps can now be organized by configurable groups without a database migration. Manage Intake Steps adds group filtering, group badges, workflow usage, and a group catalogue editor; Modify Intake Step can assign a group from the step properties panel.",
          "Manual Application Intake now has a staff-assisted flow widget and wizard for identity/source details, existing client/applicant-account search, account handling, application details, and review before create.",
          "Funding revision letters now create the missing Client Funding Agreement draft from the selected action plan when an approved current amendment needs one and no draft already exists.",
          "The staff side-navigation collapse control now works reliably, and a browser smoke checks close/reopen behavior with real pointer clicks."
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
      "Les formulaires Financial Overview envoyes par message securise peuvent maintenant etre vierges ou pre-remplis et modifiables, centres sur les revenus et depenses mensuels plus clairs, et les reponses du participant mettent a jour Participant Details dans PATH.",
      "Les administrateurs systeme peuvent maintenant voir la capacite applicative, la charge de la base de donnees et la pression des requetes dans AWS Environment Status.",
      "Les evaluations et propositions envoyees sont maintenant en lecture seule pendant l'attente d'approbation.",
      "Les tableaux Demandes ISET et Clients ISET utilisent maintenant la meme presentation de tableau de bord a widgets.",
      "La personne qui a envoye une evaluation ou proposition peut la rappeler avant qu'une decision soit enregistree.",
      "Les rappels archivent les PDF d'evaluation retires, enregistrent un evenement d'audit et remettent le travail en mode modifiable pour correction et nouvel envoi."
    ],
    "featurePackages": [
      {
        "title": "Release 20260618-test-financial-overview-editable",
        "items": [
          "Les formulaires Financial Overview envoyes par message securise peuvent maintenant etre envoyes vierges ou pre-remplis, et les participants peuvent completer ou modifier des champs de revenus et depenses mensuels plus clairs avant de signer.",
          "Les reponses du participant mettent a jour les donnees Participant Details du dossier utilisees par PATH, actualisent l'instantane de version Financial Overview et enregistrent le PDF signe.",
          "Les tableaux Demandes ISET et Clients ISET utilisent maintenant la meme presentation de tableau de bord a widgets, et AWS Environment Status inclut la capacite applicative, la charge de la base de donnees et la pression des requetes."
        ]
      },
      {
        "title": "Release 20260617-prod-assessment-recall-guardrails",
        "items": [
          "Les evaluations de demande, les nouvelles propositions d'intervention et les revisions/amendements d'intervention envoyes sont maintenant en lecture seule pendant l'attente d'approbation.",
          "La personne qui a envoye une demande peut la rappeler avant qu'une decision soit enregistree, afin de la corriger et de la soumettre de nouveau.",
          "Les rappels archivent les PDF d'evaluation retires, enregistrent un evenement d'audit et gardent les futurs redlines bases sur le dernier envoi actif non rappele."
        ]
      },
      {
        "title": "Release 20260612-212548",
        "items": [
          "Les administrateurs systeme peuvent rouvrir un plan d'action ferme depuis l'en-tete Case Workspace quand la situation change apres la fermeture. L'action enregistre une raison, remet la validation/soumission ILMP a Needs review, et permet soit d'ajouter une nouvelle intervention, soit de rouvrir une intervention terminee pour modification.",
          "Dans User Management, changer le nom met aussi a jour Display name quand le display name reprenait encore l'ancien nom du membre du personnel, afin qu'un profil enregistre ne paraisse plus inchange dans le tableau.",
          "Les etapes d'admission peuvent maintenant etre organisees par groupes configurables sans migration de base de donnees. Manage Intake Steps ajoute les filtres de groupe, les badges, l'utilisation dans les workflows et un editeur de catalogue; Modify Intake Step peut assigner un groupe depuis le panneau des proprietes.",
          "Manual Application Intake a maintenant un widget de progression et un assistant pour les details d'identite/source, la recherche de client/compte participant, le choix de gestion de compte, les details de la demande et la revision avant creation.",
          "Les lettres de revision de financement creent maintenant le brouillon Client Funding Agreement manquant a partir du plan d'action selectionne quand un amendement courant approuve en a besoin et qu'aucun brouillon n'existe deja.",
          "Le controle de fermeture de la navigation laterale du personnel fonctionne maintenant de facon fiable, avec un test navigateur qui verifie la fermeture/reouverture par de vrais clics."
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
