const publicReleaseNotes = {
  "generatedAt": "2026-06-25T13:22:02.945Z",
  "releaseId": "",
  "releaseLabel": "Current build",
  "releaseDateEn": "25th June 2026",
  "releaseDateFr": "25 juin 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Regional Managers can again edit application assessments while the application is still In Review and has not been submitted into the two-step review workflow."
    ],
    "featurePackages": [
      {
        "title": "Release 20260624-rm-draft-edit-hotfix",
        "items": [
          "Regional Managers can again edit application assessments while the application is still In Review and has not been submitted into the two-step review workflow.",
          "Submitted assessments remain read-only for Regional Managers and continue to move through the Regional Manager review actions."
        ]
      },
      {
        "title": "Release 20260622-path-bugfix-patch",
        "items": [
          "Overdue application rows now keep the saved EI eligibility result, so files that are overdue for assessment or follow-up timing are no longer labelled `Awaiting EI Validation` unless EI is actually still missing.",
          "Re-submitting an already signed Financial Overview no longer creates another active signed PDF or overwrites the signed version snapshot.",
          "Closed cases and completed applications no longer keep active document-request/reminder work alive after the file has reached a terminal state.",
          "Completed approved applications now retain the approved decision outcome when the assessment recommendation and final review agree."
        ]
      },
      {
        "title": "Release 20260620-rm-two-step-review-rollout",
        "items": [
          "Application assessments, new intervention proposals, and intervention amendments now move through Regional Manager review before the final Decision Maker step, with Regional Manager sign-off included in approved assessment PDFs.",
          "Regional Managers get `Pending Review` queue items and bell alerts when work arrives for review; Decision Makers receive final-decision alerts only after Regional Manager sign-off.",
          "Regional Manager and Decision Maker notes are recorded in Notes and Tasks, included in event data, and shown in the Events Timeline for the related review action.",
          "Staff document-upload notifications now name the staff uploader instead of saying the applicant uploaded the document.",
          "Coordinator and Regional Manager `My Applications` queues keep assigned files visible until completion and open post-decision files at the right follow-up step; the `Pending Review` table now shows review-focused columns.",
          "High-value funding decisions still require Shelley Stacey for approvals of `$20,000` or above, while other Decision Makers can still deny or request changes.",
          "The notification sort switch now appears only when the notification stack is expanded, reducing page-top clutter."
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
      "Les gestionnaires regionaux peuvent de nouveau modifier une evaluation de demande tant que la demande est encore In Review et n'a pas ete soumise dans le processus de revision en deux etapes."
    ],
    "featurePackages": [
      {
        "title": "Release 20260624-rm-draft-edit-hotfix",
        "items": [
          "Les gestionnaires regionaux peuvent de nouveau modifier une evaluation de demande tant que la demande est encore In Review et n'a pas ete soumise dans le processus de revision en deux etapes.",
          "Les evaluations soumises restent en lecture seule pour les gestionnaires regionaux et continuent de passer par les actions de revision du gestionnaire regional."
        ]
      },
      {
        "title": "Release 20260622-path-bugfix-patch",
        "items": [
          "Les lignes en retard conservent maintenant le resultat EI enregistre; les dossiers en retard pour l'evaluation ou le suivi ne sont plus marques `Awaiting EI Validation` sauf si le statut EI manque vraiment.",
          "Soumettre de nouveau un Financial Overview deja signe ne cree plus un autre PDF signe actif et ne remplace plus l'instantane de version signe.",
          "Les dossiers fermes et les demandes terminees ne gardent plus de demandes de documents ou rappels actifs apres leur etat final.",
          "Les demandes approuvees et terminees conservent maintenant le resultat de decision approuve lorsque la recommandation d'evaluation et la revision finale concordent."
        ]
      },
      {
        "title": "Release 20260620-rm-two-step-review-rollout",
        "items": [
          "Les evaluations de demande, nouvelles propositions d'intervention et amendements d'intervention passent maintenant par une revision du gestionnaire regional avant l'etape finale du Decision Maker, avec la signature du gestionnaire regional dans les PDF d'evaluation approuves.",
          "Les gestionnaires regionaux recoivent les elements `Pending Review` et les alertes lorsque du travail arrive pour revision; les Decision Makers recoivent les alertes de decision finale seulement apres la signature du gestionnaire regional.",
          "Les notes du gestionnaire regional et du Decision Maker sont enregistrees dans Notes and Tasks, incluses dans les donnees d'evenement et visibles dans Events Timeline pour l'action de revision.",
          "Les notifications de televersement de documents par le personnel nomment maintenant le membre du personnel qui a televerse le document, au lieu d'indiquer que le participant l'a fait.",
          "Les files `My Applications` des coordonnateurs et gestionnaires regionaux gardent les demandes assignees visibles jusqu'a la fin du dossier et ouvrent les dossiers apres decision a la bonne etape de suivi; le tableau `Pending Review` montre maintenant les colonnes utiles a la revision.",
          "Les approbations de financement de `$20,000` ou plus restent reservees a Shelley Stacey, tandis que les autres Decision Makers peuvent quand meme refuser ou demander des changements.",
          "Le controle de tri des notifications apparait maintenant seulement quand la pile de notifications est ouverte, ce qui reduit l'encombrement en haut de page."
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
