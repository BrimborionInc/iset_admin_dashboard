const publicReleaseNotes = {
  "generatedAt": "2026-07-27T12:26:45.217Z",
  "releaseId": "20260727-financial-overview-preservation",
  "releaseLabel": "Release 20260727-financial-overview-preservation",
  "releaseDateEn": "27th July 2026",
  "releaseDateFr": "27 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Signed and version-managed Financial Overviews now remain available when an Application Assessment is submitted again.",
      "Existing interventions now reopen with their own saved Internal/NWAC or External/PTMA `Paid from` value.",
      "Intervention revisions with a blank review-level EI value now prefill it from the same Action Plan for Decision Maker review."
    ],
    "featurePackages": [
      {
        "title": "Release 20260727-financial-overview-preservation",
        "items": [
          "Submitting or resubmitting an Application Assessment no longer hides signed or version-managed Financial Overviews from Supporting Documents.",
          "Financial Overview revisions continue through the dedicated version and participant-signature workflow."
        ]
      },
      {
        "title": "Release 20260723-end-of-day-r4",
        "items": [
          "Existing interventions now preserve their own saved `Paid from` value when reopened for editing; new interventions still inherit the parent Action Plan as their starting value.",
          "Intervention revisions with a blank review-level EI value now prefill it from the same Action Plan's structured EI claimant category. New proposals still require a fresh EI selection."
        ]
      },
      {
        "title": "Release 20260719-rm-cross-region-reassignment-r3",
        "items": [
          "Regional Managers can now reassign a client file they can access to any active casework staff member, regardless of the assignee's region.",
          "Existing client-file access rules remain unchanged, and inactive staff cannot be selected as assignees."
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
      "Les apercus financiers signes et geres par version restent maintenant disponibles lorsqu'une evaluation de demande est soumise de nouveau.",
      "Les interventions existantes conservent maintenant leur valeur enregistree « Paye par » Interne/AFAC ou Externe/PTMA lorsqu'elles sont rouvertes.",
      "Pour une revision d'intervention sans valeur d'AE au niveau de l'examen, PATH reprend maintenant la valeur du meme plan d'action afin que la personne decisionnaire puisse la verifier."
    ],
    "featurePackages": [
      {
        "title": "Release 20260727-financial-overview-preservation",
        "items": [
          "La soumission ou la nouvelle soumission d'une evaluation de demande ne masque plus les apercus financiers signes ou geres par version dans les documents justificatifs.",
          "Les revisions d'un apercu financier continuent de suivre le processus distinct de gestion des versions et de signature de la participante ou du participant."
        ]
      },
      {
        "title": "Release 20260723-end-of-day-r4",
        "items": [
          "Les interventions existantes conservent maintenant leur propre valeur enregistree « Paye par » lorsqu'elles sont rouvertes pour modification; les nouvelles interventions reprennent toujours la valeur initiale du plan d'action parent.",
          "Pour une revision d'intervention sans valeur d'AE au niveau de l'examen, PATH reprend maintenant la categorie structuree de prestataire d'AE du meme plan d'action. Les nouvelles propositions exigent toujours une nouvelle selection."
        ]
      },
      {
        "title": "Release 20260719-rm-cross-region-reassignment-r3",
        "items": [
          "Les gestionnaires regionaux peuvent maintenant reattribuer un dossier client auquel ils ont acces a toute personne active affectee au travail de cas, quelle que soit la region de cette personne.",
          "Les regles existantes d'acces aux dossiers clients restent inchangees et les membres du personnel inactifs ne peuvent pas etre selectionnes."
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
