const publicReleaseNotes = {
  "generatedAt": "2026-05-29T22:22:28.843Z",
  "releaseId": "20260529-prod-case-lifecycle-reporting",
  "releaseLabel": "Release 20260529-prod-case-lifecycle-reporting",
  "releaseDateEn": "29th May 2026",
  "releaseDateFr": "29 mai 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Case files previously labelled `Dormant` now display as `No Active Plan`, while the stored status and API filter value remain `dormant`.",
      "Withdrawing one application on a multi-application case now creates application-scoped ILMP reporting artifacts without closing the whole case."
    ],
    "featurePackages": [
      {
        "title": "Release 20260529-prod-case-lifecycle-reporting",
        "items": [
          "Case files previously labelled `Dormant` now display as `No Active Plan` across case status badges, ISET Clients filters, homepage queue descriptions, case re-open copy, and related help guidance.",
          "The persisted case lifecycle value and API query value remain `dormant`, so existing saved filters and backend behavior continue to work.",
          "Withdrawing one application on a multi-application case now creates application-scoped ILMP reporting artifacts without closing the whole case.",
          "Existing non-reporting action plans and other active applications remain in casework scope after an application-specific withdrawal reporting record is created.",
          "Selected-application reporting panels now use the application-specific reporting artifact, and ILMP validation loads the matching action plan context."
        ]
      },
      {
        "title": "Release 20260528-evening-batch",
        "items": [
          "Supporting Documents label edits now save as simple renames without changing document scope, including identity/status documents and older uploaded rows.",
          "Edit document details and duplicate-document saves now send the current file context for client-scoped documents without asking staff to attach those documents to an application.",
          "Recent ILMP exports now uses a compact history table with Summary, Clients exported, and XML tabs, including recorded file path/name and downloader display name.",
          "ILMP batch actions and help now use export/download/manual-upload wording so staff know PATH records the XML export but does not upload it to ESDC.",
          "ILMP readiness now recognizes the mixed-separator `lack_of_job-opportunities` barrier value.",
          "Workflow Preview and Publish no longer fail on instruction-only components that do not have explicit labels.",
          "Submitted payment packets no longer show the retired line-level `Mark paid` action.",
          "Financial Reports now labels the zero-dollar intervention option as `All reportable interventions` and shows `PATH follow-up state` by default."
        ]
      },
      {
        "title": "Release 20260527-prod-casework-ilmp-hotfix",
        "items": [
          "Case Header can now change an unactivated PATH account email before staff resend activation.",
          "Closed action plan details now save closeout corrections such as Action Plan Result Education Level.",
          "Long intervention schedules no longer fail save because PATH caps only the ILMP duration field while preserving the real start/end dates.",
          "Intervention outcomes are recorded only when an intervention is closed, and closeout now requires staff to choose the final ESDC outcome explicitly.",
          "Intervention cost lines can be corrected from Living Allowance to Residence Costs without deleting and rebuilding the line.",
          "The ILMP Participant submission queue now paginates, sorts, validates, and batches participant rows in one consolidated widget.",
          "Denied application reporting records now map applicant education consistently into ILMP start and result education fields."
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
      "Les dossiers auparavant libelles `Dormant` s'affichent maintenant comme `No Active Plan`, tandis que le statut stocke et la valeur de filtre API restent `dormant`.",
      "Le retrait d'une seule demande dans un dossier a plusieurs demandes cree maintenant des artefacts ILMP propres a cette demande sans fermer tout le dossier."
    ],
    "featurePackages": [
      {
        "title": "Release 20260529-prod-case-lifecycle-reporting",
        "items": [
          "Les dossiers auparavant libelles `Dormant` s'affichent maintenant comme `No Active Plan` dans les badges de statut, les filtres ISET Clients, les descriptions de files d'accueil, le texte de reouverture de dossier et l'aide associee.",
          "La valeur de cycle de vie stockee et la valeur de requete API restent `dormant`, afin que les filtres existants et le comportement backend continuent de fonctionner.",
          "Le retrait d'une seule demande dans un dossier a plusieurs demandes cree maintenant des artefacts ILMP propres a cette demande sans fermer tout le dossier.",
          "Les plans d'action non-reporting existants et les autres demandes actives restent dans le suivi de dossier apres la creation d'un enregistrement reporting lie a la demande retiree.",
          "Les panneaux de correction reporting utilisent maintenant l'artefact propre a la demande selectionnee, et la validation ILMP charge le contexte du plan d'action correspondant."
        ]
      },
      {
        "title": "Release 20260528-evening-batch",
        "items": [
          "Les modifications des libelles dans Supporting Documents s'enregistrent comme de simples renommages sans changer la portee du document, y compris pour les documents d'identite/statut et les anciens televersements.",
          "Edit document details et Duplicate document envoient maintenant le contexte du dossier pour les documents a portee client sans demander de les rattacher a une demande.",
          "Recent ILMP exports utilise maintenant un tableau d'historique compact avec les onglets Summary, Clients exported et XML, ainsi que le chemin/nom de fichier et le nom de la personne qui a telecharge.",
          "Les actions et l'aide ILMP utilisent maintenant les mots export, download et manual upload afin que le personnel sache que PATH enregistre l'export XML mais ne le televerse pas dans ESDC.",
          "La validation ILMP reconnait maintenant la valeur de barriere mixte `lack_of_job-opportunities`.",
          "Workflow Preview et Publish ne bloquent plus sur les composants d'instructions sans libelle explicite.",
          "Les packets de paiement envoyes n'affichent plus l'ancienne action `Mark paid` au niveau de la ligne.",
          "Financial Reports appelle maintenant l'option des lignes a zero dollar `All reportable interventions` et affiche `PATH follow-up state` par defaut."
        ]
      },
      {
        "title": "Release 20260527-prod-casework-ilmp-hotfix",
        "items": [
          "Case Header permet maintenant de corriger le courriel d'un compte PATH non active avant que le personnel renvoie l'activation.",
          "Les details d'un plan d'action ferme enregistrent maintenant les corrections de cloture comme le niveau d'education du resultat.",
          "Les longues periodes d'intervention ne bloquent plus l'enregistrement; PATH limite seulement le champ de duree ILMP et conserve les vraies dates de debut et de fin.",
          "Les resultats d'intervention sont enregistres seulement quand une intervention est fermee, et la cloture exige maintenant le choix explicite du resultat ESDC final.",
          "Les lignes de cout d'intervention peuvent etre corrigees de Living Allowance vers Residence Costs sans supprimer et reconstruire la ligne.",
          "La file ILMP Participant regroupe maintenant pagination, tri, validation et generation de lots dans un seul widget.",
          "Les dossiers de reporting des demandes refusees mappent maintenant l'education de la participante ou du participant de facon coherente vers les champs ILMP de debut et de resultat."
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
