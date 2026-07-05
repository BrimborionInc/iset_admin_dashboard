const publicReleaseNotes = {
  "generatedAt": "2026-07-05T11:26:17.883Z",
  "releaseId": "",
  "releaseLabel": "Current build",
  "releaseDateEn": "5th July 2026",
  "releaseDateFr": "5 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Regional Managers who submit their own draft assessments, intervention proposals, or intervention amendments now enter the same Regional Manager review workflow as ISET Coordinator submissions."
    ],
    "featurePackages": [
      {
        "title": "Release 20260626-rm-two-step-role-matrix-prod",
        "items": [
          "Regional Managers who are acting as submitters can submit application assessments, new intervention proposals, and intervention amendments into Regional Manager review.",
          "ISET Coordinators and Regional Managers are the only roles that can start the two-step review workflow; NWAC Administrators and System Administrators remain final-decision actors only.",
          "The workflow now rejects invalid starters before saving submitted intervention rows, preventing submitted items from being left without review workflow audit rows.",
          "The release was tested with the four actual PATH roles and with browser workflow smokes for application assessments, new intervention proposals, and intervention amendments."
        ]
      },
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
      "Les gestionnaires regionaux qui soumettent leurs propres brouillons d'evaluation, de proposition d'intervention ou d'amendement passent maintenant par le meme processus de revision du gestionnaire regional que les soumissions des coordonnateurs ISET."
    ],
    "featurePackages": [
      {
        "title": "Release 20260626-rm-two-step-role-matrix-prod",
        "items": [
          "Les gestionnaires regionaux qui agissent comme soumissionnaires peuvent soumettre des evaluations de demande, de nouvelles propositions d'intervention et des amendements d'intervention a la revision du gestionnaire regional.",
          "Les coordonnateurs ISET et les gestionnaires regionaux sont les seuls roles qui peuvent demarrer le processus de revision en deux etapes; les administrateurs NWAC et les administrateurs systeme restent limites a l'etape de decision finale.",
          "Le processus rejette maintenant les soumissionnaires non autorises avant d'enregistrer des interventions comme soumises, ce qui evite de laisser des elements soumis sans ligne d'audit de revision.",
          "La version a ete testee avec les quatre vrais roles PATH et avec des tests navigateur pour les evaluations de demande, les nouvelles propositions d'intervention et les amendements d'intervention."
        ]
      },
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
      }
    ],
    "knownIssuesHeading": "Problemes connus",
    "knownIssues": [],
    "comingNextHeading": "A venir",
    "comingNext": []
  }
};

export default publicReleaseNotes;
