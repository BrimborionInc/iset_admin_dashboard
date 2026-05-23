const publicReleaseNotes = {
  "generatedAt": "2026-05-23T12:59:33.975Z",
  "releaseId": "",
  "releaseLabel": "Current build",
  "releaseDateEn": "23rd May 2026",
  "releaseDateFr": "23 mai 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Fixed a bug where some denied applications could still appear in active application lists after the denial letter was sent.",
      "Improved denied and withdrawn application reporting records so ILMP validation has the required agreement and education fields.",
      "Withdrawn applications now create the reporting-only action plan and two completed interventions needed for ILMP reporting.",
      "Intervention planned-cost fields now accept normal dollars-and-cents amounts.",
      "Supporting Documents uploads now work on case files where an older application has an unsafe applicant-account link."
    ],
    "featurePackages": [
      {
        "title": "Release 20260522-prod-document-upload-scope",
        "items": [
          "Fixed a bug where some denied applications could still appear in active application lists after the denial letter was sent.",
          "Improved denied application reporting records so ILMP validation has the required agreement and education fields.",
          "Withdrawn applications now create the reporting-only action plan and two completed interventions needed for ILMP reporting.",
          "Intervention planned-cost fields now accept normal dollars-and-cents amounts.",
          "Supporting Documents uploads now work on case files where an older application has an unsafe applicant-account link."
        ]
      },
      {
        "title": "Release 20260521-prod-admin-bugcr-packets",
        "items": [
          "Improved ILMP validation so current barrier selections and stored NOC codes are recognized more reliably.",
          "ILMP readiness now ignores archived action-plan validation rows when choosing the current case validation record.",
          "Withdrawn-only applications now close the case as Withdrawn so staff can find them under Dormant or All clients.",
          "Application approval and denial decisions now stay on the decision screen after Commit and offer letter preparation as a separate next action."
        ]
      },
      {
        "title": "Release 20260520-prod-denial-reporting",
        "items": [
          "Fixed homepage item-list sorting so Work Queue Items tables sort correctly from the column headers for NWAC Administrators, Regional Managers, and ISET Coordinators.",
          "Denied applications now complete when the denial letter is sent, so they leave Pending Completion once there are no remaining denial follow-up steps.",
          "New denied applications now create the reporting-only action plan and two completed interventions NWAC needs for ILMP reporting.",
          "The denial-reporting action plan is named `Actions leading to denial` and includes completed `Career Research and Exploration` and `Employment Counselling` interventions dated to the denial decision day.",
          "Existing denied applications that already had denial letters were back-loaded into the same reporting structure as part of this release after a TEST rehearsal."
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
      "Correction d'un probleme ou certaines demandes refusees pouvaient encore apparaitre dans les listes actives apres l'envoi de la lettre de refus.",
      "Amelioration des dossiers de reporting pour les demandes refusees et retirees afin que la validation ILMP ait les champs requis.",
      "Les demandes retirees creent maintenant le plan d'action reserve au reporting et les deux interventions completees requis pour le reporting ILMP.",
      "Les champs de cout prevu des interventions acceptent maintenant les montants courants en dollars et cents.",
      "Les televersements dans Supporting Documents fonctionnent maintenant pour les dossiers ou une ancienne demande a un lien de compte client non securitaire."
    ],
    "featurePackages": [
      {
        "title": "Release 20260522-prod-document-upload-scope",
        "items": [
          "Correction d'un probleme ou certaines demandes refusees pouvaient encore apparaitre dans les listes actives apres l'envoi de la lettre de refus.",
          "Amelioration des dossiers de reporting des demandes refusees afin que la validation ILMP ait les champs d'entente et d'education requis.",
          "Les demandes retirees creent maintenant le plan d'action reserve au reporting et les deux interventions completees requis pour le reporting ILMP.",
          "Les champs de cout prevu des interventions acceptent maintenant les montants courants en dollars et cents.",
          "Les televersements dans Supporting Documents fonctionnent maintenant pour les dossiers ou une ancienne demande a un lien de compte client non securitaire."
        ]
      },
      {
        "title": "Release 20260521-prod-admin-bugcr-packets",
        "items": [
          "Amelioration de la validation ILMP afin que les barrieres courantes et les codes CNP enregistres soient mieux reconnus.",
          "La disponibilite ILMP ignore maintenant les anciennes validations liees a des plans d'action archives lorsqu'elle choisit la validation courante du dossier.",
          "Les demandes retirees sans activite de dossier ferment maintenant le dossier comme Retire, afin que le personnel puisse les retrouver dans Dormants ou Tous.",
          "Les decisions d'approbation et de refus restent maintenant sur l'ecran de decision apres Commit et proposent la preparation de lettre comme prochaine action separee."
        ]
      },
      {
        "title": "Release 20260520-prod-denial-reporting",
        "items": [
          "Correction du tri dans les listes d'elements de la page d'accueil afin que les tableaux Work Queue Items se trient correctement depuis les en-tetes de colonnes pour les administratrices et administrateurs NWAC, les gestionnaires regionaux et les coordinatrices et coordinateurs ISET.",
          "Les demandes refusees se terminent maintenant lorsque la lettre de refus est envoyee; elles quittent donc En attente de completion lorsqu'il ne reste aucune etape de suivi du refus.",
          "Les nouvelles demandes refusees creent maintenant le plan d'action reserve au reporting et les deux interventions completees requis par NWAC pour le reporting ILMP.",
          "Le plan d'action de reporting des refus s'appelle `Actions leading to denial` et comprend les interventions completees `Career Research and Exploration` et `Employment Counselling`, datees du jour de la decision de refus.",
          "Les demandes refusees existantes dont la lettre de refus avait deja ete envoyee ont ete rechargees dans la meme structure de reporting dans cette release, apres une repetition en TEST."
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
