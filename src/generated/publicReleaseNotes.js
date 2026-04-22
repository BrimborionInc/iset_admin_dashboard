const publicReleaseNotes = {
  "generatedAt": "2026-04-22T15:18:47.931Z",
  "releaseId": "20260422-151756",
  "releaseLabel": "Release 20260422-151756",
  "releaseDateEn": "22nd April 2026",
  "releaseDateFr": "22 avril 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "Recent PATH changes are summarized here for staff who want them before signing in.",
    "featuresHeading": "What changed",
    "features": [
      "Approval items now open the correct review layout and decision step in both the application and case workspaces instead of dropping staff back into an old personal board or remembered wizard step.",
      "Application, intervention, and revision wizards now use clearer phase-based headings and guidance so staff can tell more easily whether they are drafting, reviewing, or completing follow-up work.",
      "Revised intervention submissions now generate a fresh case-manager assessment PDF, and revised client funding agreements can now redline against the immediately previous agreement in the series.",
      "Application approval handling is more coherent: decisions now write real outcome statuses right away, request-changes notes appear immediately, and follow-up communication steps behave more consistently.",
      "Finance packet routing is more flexible: province finance addresses can use multiple recipients, and case-manager sender, reply-to, and CC details are now carried through when available.",
      "Client and case views now resolve participant names more consistently across the Clients table, case header, and applicant details displays, reducing mismatches between different workspace surfaces.",
      "Approval queues now show clearer request types for new applications, additional interventions, and proposed intervention changes, with more stable launch behavior from the homepage.",
      "The public landing page now publishes release notes from this log and stamps them with the deployed release ID/date so the published notes and the visible build line stay in sync."
    ],
    "knownIssuesHeading": "Known issues",
    "knownIssues": [
      "No major release-blocking issues are currently logged for this release.",
      "Some labels and workflow wording are still being refined as the new approval and revision flows settle into everyday use."
    ],
    "comingNextHeading": "Coming next",
    "comingNext": [
      "Further cleanup of approval and revision status wording so staff can see more clearly whether PATH is dealing with a new application, an additional intervention, or a proposed change to an approved intervention.",
      "Continued finance and document workflow hardening around payment packets, supporting evidence, and generated client correspondence."
    ]
  },
  "fr": {
    "sectionEyebrow": "Lecture optionnelle",
    "description": "Les changements recents de PATH sont resumes ici pour le personnel qui souhaite les consulter avant de se connecter.",
    "featuresHeading": "Ce qui a change",
    "features": [
      "Les elements d'approbation ouvrent maintenant la bonne disposition de revision et la bonne etape de decision dans les espaces de travail des demandes et des dossiers, au lieu de ramener le personnel a une ancienne disposition personnelle ou a une etape memorisee.",
      "Les assistants de demande, d'intervention et de revision utilisent maintenant des titres et des indications mieux adaptes a la phase en cours, afin qu'il soit plus facile de voir si le personnel prepare, revise ou termine un suivi.",
      "Les soumissions de revision d'intervention generent maintenant un nouveau PDF d'evaluation du gestionnaire de cas, et les ententes de financement revisees peuvent maintenant afficher les modifications par rapport a l'entente precedente immediate de la serie.",
      "Le traitement des decisions d'approbation des demandes est plus coherent: les decisions ecrivent immediatement le bon resultat, les notes de demande de changements apparaissent tout de suite et les etapes de suivi se comportent de facon plus uniforme.",
      "Les courriels de lots de paiement prennent maintenant en charge l'acheminement par province, ainsi que l'expediteur, le repondre-a, la copie conforme et plusieurs adresses pour le gestionnaire de cas lorsque ces adresses sont configurees.",
      "Les vues client et dossier resolvent maintenant plus uniformement le nom de la participante dans le tableau Clients, l'en-tete du dossier et les details de la demandeuse, ce qui reduit les ecarts entre les ecrans.",
      "Les files d'attente d'approbation affichent maintenant des types de demande plus clairs pour les nouvelles demandes, les interventions additionnelles et les changements proposes aux interventions approuvees, avec un lancement plus fiable depuis la page d'accueil.",
      "La page d'accueil publique publie maintenant les notes de version a partir de ce journal et les marque avec l'identifiant et la date de la version deployee afin que les notes publiees et la ligne de build visible restent synchronisees."
    ],
    "knownIssuesHeading": "Points connus",
    "knownIssues": [
      "Aucun probleme bloquant majeur n'est actuellement consigne pour cette version.",
      "Certains libelles et certaines formulations de flux de travail continuent d'etre affines pendant que les nouveaux flux d'approbation et de revision se stabilisent."
    ],
    "comingNextHeading": "A venir",
    "comingNext": [
      "Poursuivre le nettoyage du libelle des statuts d'approbation et de revision afin que le personnel voie plus clairement si PATH traite une nouvelle demande, une intervention additionnelle ou un changement propose a une intervention approuvee.",
      "Poursuivre le renforcement des flux de travail financiers et documentaires autour des lots de paiement, des pieces justificatives et de la correspondance client generee."
    ]
  }
};

export default publicReleaseNotes;
