const publicReleaseNotes = {
  "generatedAt": "2026-07-13T10:43:58.951Z",
  "releaseId": "20260713-admin-schema-readiness-hotfix",
  "releaseLabel": "Release 20260713-admin-schema-readiness-hotfix",
  "releaseDateEn": "13th July 2026",
  "releaseDateFr": "13 juillet 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Fixed a problem that prevented signed-in staff from using the admin console after the latest release.",
      "PATH now keeps case, payment, applicant, and notification work tied to the correct record while making retries and overlapping background work safer.",
      "Public portal signing, staff-assisted intake, client imports, budget transfers, and external payment handoffs now have stronger duplicate and partial-failure protection."
    ],
    "featurePackages": [
      {
        "title": "Release 20260713-admin-schema-readiness-hotfix",
        "items": [
          "Fixed a schema-readiness error that caused signed-in admin console requests to return 503."
        ]
      },
      {
        "title": "Release 20260713-engineering-audit-prod",
        "items": [
          "Moving between cases, applications, or payment filters now hides the previous record immediately and prevents older responses or selections from acting on the new workspace.",
          "Public portal screens require an applicant account, prior intake answers stay on the server, and message/signing lists return only the information they display.",
          "Repeated signing, client-import, budget-allocation, notification, and payment-handoff work now converges safely instead of creating duplicate or uncertain actions.",
          "Reminder and notification delivery can recover from known temporary failures, while uncertain email outcomes are held for System Administrator review rather than blindly resent.",
          "AI model, parameter, and fallback settings now use one durable configuration across admin, portal, restarts, and instance replacement.",
          "Intake component choices are explicitly static-only, the unused PTMA administration surface is retired, and NWAC Hub Management remains available to System Administrators.",
          "Payment evidence and follow-up actions remain inside their packet/case scope; Finance email and Intacct routing remain disabled for this release."
        ]
      },
      {
        "title": "Release 20260710-r1-intake-completion-prod",
        "items": [
          "Final application submission now rechecks every required answer and signature on the applicant's applicable intake path.",
          "Client, case, submission, and application records are saved together, preventing a transient failure from leaving a partial submitted application.",
          "Safe retries return the existing completed result instead of creating duplicate application records or repeating generated documents and notifications."
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
      "Correction d'un probleme qui empechait le personnel connecte d'utiliser la console d'administration apres la derniere version.",
      "PATH conserve maintenant le travail lie aux cas, paiements, demandeurs et notifications dans le bon dossier, tout en rendant plus securitaires les nouvelles tentatives et les taches d'arriere-plan simultanees.",
      "La signature du portail public, l'admission assistee, l'importation de clients, les transferts budgetaires et les transferts de paiement externes offrent maintenant une meilleure protection contre les doublons et les echecs partiels."
    ],
    "featurePackages": [
      {
        "title": "Release 20260713-admin-schema-readiness-hotfix",
        "items": [
          "Correction d'une erreur de preparation du schema qui faisait retourner une erreur 503 aux requetes de la console d'administration apres la connexion."
        ]
      },
      {
        "title": "Release 20260713-engineering-audit-prod",
        "items": [
          "Le passage entre les cas, demandes ou filtres de paiement masque immediatement l'ancien dossier et empeche les anciennes reponses ou selections d'agir dans le nouvel espace de travail.",
          "Les ecrans du portail public exigent un compte demandeur, les reponses d'admission precedentes restent sur le serveur et les listes de messages et de signatures retournent seulement les renseignements affiches.",
          "Les nouvelles tentatives de signature, d'importation de clients, d'affectation budgetaire, de notification et de transfert de paiement convergent maintenant de facon securitaire au lieu de creer des actions en double ou incertaines.",
          "La livraison des rappels et notifications peut reprendre apres un echec temporaire connu; les resultats de courriel incertains sont conserves pour examen par un administrateur systeme plutot que renvoyes automatiquement.",
          "Les modeles, parametres et solutions de repli de l'IA utilisent maintenant une configuration durable commune a l'administration, au portail, aux redemarrages et au remplacement d'instance.",
          "Les choix de composants d'admission sont maintenant explicitement statiques, l'ancienne administration PTMA inutilisee est retiree et la gestion des carrefours NWAC demeure offerte aux administrateurs systeme.",
          "Les preuves et suivis de paiement restent limites a leur dossier de paiement et a leur cas; le routage des courriels Finance et d'Intacct demeure desactive pour cette version."
        ]
      },
      {
        "title": "Release 20260710-r1-intake-completion-prod",
        "items": [
          "La soumission finale reverifie maintenant chaque reponse et signature obligatoire du parcours d'admission applicable.",
          "Les dossiers client, cas, soumission et demande sont enregistres ensemble afin qu'une erreur temporaire ne laisse pas une demande soumise partiellement.",
          "Une nouvelle tentative securitaire retourne le resultat deja termine au lieu de creer des dossiers en double ou de repeter les documents et notifications generes."
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
