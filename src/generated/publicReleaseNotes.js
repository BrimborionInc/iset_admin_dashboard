const publicReleaseNotes = {
  "generatedAt": "2026-05-28T23:28:20.437Z",
  "releaseId": "20260528-prod-evening-batch",
  "releaseLabel": "Release 20260528-prod-evening-batch",
  "releaseDateEn": "28th May 2026",
  "releaseDateFr": "28 mai 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Supporting Documents label edits now save reliably for identity/status documents and older uploaded rows.",
      "Edit document details and duplicate-document saves now preserve client document scope without asking staff to attach identity/status documents to an application.",
      "Recent ILMP exports now shows a compact export history with Summary, Clients exported, and XML tabs.",
      "ILMP export wording now reflects the real workflow: PATH downloads XML for manual upload to ESDC and records the export in history.",
      "ILMP validation now accepts the mixed-separator `lack_of_job-opportunities` barrier value.",
      "Workflow Preview and Publish no longer fail on instruction-only components without explicit labels.",
      "Submitted payment packets no longer show the old line-level `Mark paid` action.",
      "Financial Reports now labels the zero-dollar intervention option as `All reportable interventions` and shows `PATH follow-up state` by default."
    ],
    "featurePackages": [
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
      },
      {
        "title": "Release 20260526-prod-snapshot-scope-guard",
        "items": [
          "Manage ISET Applications and ISET Clients now include `Show All` page-size options and sort the full filtered result set before pagination.",
          "Regional Snapshot now uses the same approved CRF/EI funding and participant-home-province rules as Financial Reports for funding and funded-client totals.",
          "Financial Reports help is organized around annual-report workflow, including approval-year scope, visible-row totals, carry-over confidence, export scope, and first checks when a number looks wrong.",
          "Applicant portal message, signing, status, and intervention routes now double-check that the signed-in account belongs to the same client as the application and case being shown.",
          "Applicant session-audit writes now match the deployed `user_session_audit` table shape and prune old rows with bounded retention."
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
      "Les modifications des libelles dans Supporting Documents s'enregistrent maintenant correctement pour les documents d'identite/statut et les anciens televersements.",
      "Les fenetres Edit document details et Duplicate document conservent maintenant la portee client des documents sans demander de les rattacher a une demande.",
      "Recent ILMP exports affiche maintenant un historique compact avec les onglets Summary, Clients exported et XML.",
      "Le libelle ILMP reflete maintenant le vrai flux: PATH telecharge le XML pour un televersement manuel dans ESDC et enregistre l'export dans l'historique.",
      "La validation ILMP accepte maintenant la valeur de barriere mixte `lack_of_job-opportunities`.",
      "Workflow Preview et Publish ne bloquent plus sur les composants d'instructions sans libelle explicite.",
      "Les packets de paiement envoyes n'affichent plus l'ancienne action `Mark paid` au niveau de la ligne.",
      "Financial Reports appelle maintenant l'option des lignes a zero dollar `All reportable interventions` et affiche `PATH follow-up state` par defaut."
    ],
    "featurePackages": [
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
      },
      {
        "title": "Release 20260526-prod-snapshot-scope-guard",
        "items": [
          "Manage ISET Applications et ISET Clients incluent maintenant l'option `Show All` et trient tous les resultats filtres avant la pagination.",
          "Regional Snapshot utilise maintenant les memes regles que Financial Reports pour le financement CRF/EI approuve et les clients finances par province de residence.",
          "L'aide de Financial Reports est organisee autour du travail de rapport annuel, notamment la portee par annee d'approbation, les totaux des lignes visibles, la fiabilite du report, la portee de l'export et les premieres verifications quand un montant semble incorrect.",
          "Les routes de messages, signatures, statuts et interventions du portail applicant verifient maintenant que le compte connecte appartient au meme client que la demande et le dossier affiches.",
          "L'audit de session applicant ecrit maintenant selon la structure de table `user_session_audit` deployee et supprime les anciennes lignes avec une retention bornee."
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
