const publicReleaseNotes = {
  "generatedAt": "2026-08-01T10:39:04.928Z",
  "releaseId": "20260801-assessment-document-lineage-r2",
  "releaseLabel": "Release 20260801-assessment-document-lineage-r2",
  "releaseDateEn": "1st August 2026",
  "releaseDateFr": "1 aout 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Fixed a bug that could block submission of a repeat application assessment by treating documents from an older application as if they belonged to the current one.",
      "Newly approved repeat applications now use their own action plan and intervention details when PATH creates a Client Funding Agreement."
    ],
    "featurePackages": [
      {
        "title": "Release 20260801-assessment-document-lineage-r2",
        "items": [
          "Repeat application assessments now preserve Application Forms and Financial Overviews only when the document belongs to the application being submitted.",
          "Documents from an older application or the general case file no longer prevent PATH from generating the required documents for the current application."
        ]
      },
      {
        "title": "Release 20260730-feedback-173-cfa-hotfix",
        "items": [
          "Newly approved repeat applications now create and use an application-linked action plan, so historical plan information cannot replace the current intervention details in a Client Funding Agreement.",
          "When a participant signs a versioned Client Funding Agreement, PATH now links the signed PDF to that exact version and records the version as signed."
        ]
      },
      {
        "title": "Release 20260728-regional-snapshot-data-quality-funding",
        "items": [
          "Regional Snapshot data-quality issues now name the participant, application, and intervention type and explain the problem and corrective action in plain English.",
          "Section C now retains valid positive approved funding from non-manual interventions when an application link is missing or conflicting. Section B application activity remains excluded until the lineage is corrected, and the report continues to flag the data issue."
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
      "Correction d'un problème qui pouvait bloquer la soumission de l'évaluation d'une demande répétée en traitant les documents d'une ancienne demande comme s'ils appartenaient à la demande actuelle.",
      "Les nouvelles demandes approuvees utilisent maintenant leur propre plan d'action et leurs propres details d'intervention lorsque PATH cree une entente de financement du client."
    ],
    "featurePackages": [
      {
        "title": "Release 20260801-assessment-document-lineage-r2",
        "items": [
          "Les évaluations de demandes répétées conservent maintenant les formulaires de demande et les aperçus financiers uniquement lorsque le document appartient à la demande soumise.",
          "Les documents d'une ancienne demande ou du dossier général ne bloquent plus la production des documents requis pour la demande actuelle."
        ]
      },
      {
        "title": "Release 20260730-feedback-173-cfa-hotfix",
        "items": [
          "Les nouvelles demandes approuvees creent et utilisent maintenant un plan d'action lie a la demande, afin que l'information d'un ancien plan ne remplace pas les details d'intervention actuels dans une entente de financement du client.",
          "Lorsqu'une participante ou un participant signe une entente de financement du client geree par version, PATH lie maintenant le PDF signe a cette version precise et enregistre la version comme signee."
        ]
      },
      {
        "title": "Release 20260728-regional-snapshot-data-quality-funding",
        "items": [
          "Les problèmes de qualité des données de l'instantané régional indiquent maintenant la participante ou le participant, la demande et le type d'intervention, puis expliquent en langage clair le problème et la correction requise.",
          "La section C conserve maintenant le financement approuvé positif et valide des interventions non manuelles lorsqu'un lien de demande est absent ou contradictoire. L'activité des demandes de la section B reste exclue jusqu'à la correction de la filiation, et le rapport continue de signaler le problème de données."
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
