const publicReleaseNotes = {
  "generatedAt": "2026-06-13T01:26:11.954Z",
  "releaseId": "20260612-212548",
  "releaseLabel": "Release 20260612-212548",
  "releaseDateEn": "13th June 2026",
  "releaseDateFr": "13 juin 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "System Administrators can reopen a closed action plan from Case Workspace when circumstances change after closeout.",
      "User Management name edits now also update Display name when it was still mirroring the old staff name.",
      "Intake steps can be organized with configurable groups, group filters, group badges, and a group catalogue editor.",
      "Manual Application Intake now guides staff through client/account search, account handling, application details, and review before create.",
      "Funding revision letters now recover when a current approved amendment needs a Client Funding Agreement draft that does not exist yet.",
      "The staff side-navigation collapse control now works reliably."
    ],
    "featurePackages": [
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
      },
      {
        "title": "Release 20260610-prod-modify-component-editor",
        "items": [
          "Clearing a stale Docs Requested flag in Application Workspace no longer shows a false concurrent-update warning.",
          "Application Workspace widgets are easier to use during file review, with document search, secure-message table sorting, cleaner notes refresh behavior, clearer calendar fallbacks, and conflict-declaration wording focused on the staff member working the file.",
          "Manage Intake Steps now has standard dashboard controls, sortable/resizable step-library columns, full-list sorting before display, fewer unnecessary reloads, and a preview that stays inside the widget.",
          "Modify Intake Step now shows the current step name, adds component search, preserves repeated static content blocks, keeps clean saves disabled, preserves step metadata, and shows precise save errors.",
          "User Management and Manage ISET Applications now use cleaner table-first layouts with better sorting, resizing, pagination, and server-backed filters where needed."
        ]
      },
      {
        "title": "Release 20260608-prod-ilmp-validation-messages",
        "items": [
          "ILMP blockers and warnings now tell staff what to fix, where to fix it, and which ESDC Data Exchange Guide source is involved.",
          "ILMP messages now point to Participant Details, the named action plan, or the named intervention instead of showing raw database IDs.",
          "PATH-only review checks are labelled as PATH-only so staff can distinguish them from ESDC gateway blockers.",
          "The unsupported childcare `No funding received` warning was removed because that is a valid ESDC childcare funding code."
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
      "Les administrateurs systeme peuvent rouvrir un plan d'action ferme depuis Case Workspace quand la situation change apres la fermeture.",
      "Dans User Management, changer le nom met aussi a jour Display name quand il reprenait encore l'ancien nom du membre du personnel.",
      "Les etapes d'admission peuvent etre organisees avec des groupes configurables, des filtres, des badges et un editeur de catalogue.",
      "Manual Application Intake guide maintenant le personnel dans la recherche client/compte, le choix de gestion de compte, les details de la demande et la revision avant creation.",
      "Les lettres de revision de financement recuperent maintenant les dossiers ou un brouillon Client Funding Agreement manque pour un amendement courant approuve.",
      "Le controle de fermeture de la navigation laterale du personnel fonctionne maintenant de facon fiable."
    ],
    "featurePackages": [
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
      },
      {
        "title": "Release 20260610-prod-modify-component-editor",
        "items": [
          "Effacer un ancien indicateur Docs Requested dans Application Workspace n'affiche plus un faux avertissement de mise a jour concurrente.",
          "Les widgets Application Workspace sont plus faciles a utiliser pendant la revision d'un dossier, avec recherche de documents, tri des messages securises, actualisation des notes plus propre, fallbacks calendrier plus clairs et texte de conflit d'interets centre sur la personne qui travaille le dossier.",
          "Manage Intake Steps a maintenant les controles standard du tableau de bord, des colonnes triables/redimensionnables, le tri de la liste complete avant affichage, moins de rechargements inutiles et un apercu qui reste dans le widget.",
          "Modify Intake Step affiche maintenant le nom de l'etape courante, ajoute la recherche de composants, preserve les blocs de contenu statique repetes, garde Save desactive quand rien n'a change, preserve les metadonnees de l'etape et affiche les erreurs d'enregistrement exactes.",
          "User Management et Manage ISET Applications utilisent maintenant des mises en page plus simples centrees sur les tableaux avec meilleur tri, redimensionnement, pagination et filtres cote serveur au besoin."
        ]
      },
      {
        "title": "Release 20260608-prod-ilmp-validation-messages",
        "items": [
          "Les blocages et avertissements ILMP indiquent maintenant quoi corriger, ou le corriger, et quelle source du guide d'echange de donnees EDSC est concernee.",
          "Les messages ILMP pointent maintenant vers Participant Details, le plan d'action nomme ou l'intervention nommee au lieu d'afficher des identifiants de base de donnees.",
          "Les verifications PATH seulement sont indiquees comme telles pour distinguer les controles internes des blocages de la passerelle EDSC.",
          "L'avertissement childcare `No funding received` non justifie a ete retire, car il s'agit d'un code valide de financement childcare EDSC."
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
