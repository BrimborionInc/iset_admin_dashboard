const publicReleaseNotes = {
  "generatedAt": "2026-09-02T22:06:16.129Z",
  "releaseId": "20260902-feedback-198-withdrawal-r1",
  "releaseLabel": "Release 20260902-feedback-198-withdrawal-r1",
  "releaseDateEn": "2nd September 2026",
  "releaseDateFr": "2 septembre 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Staff can now withdraw an eligible application while its assessment is under review or returned for corrections. PATH closes the application and review together while preserving the assessment history.",
      "Staff can now delete ordinary Supporting Documents regardless of how the file reached PATH. Signed documents, files currently out for signature, formal version history, and payment evidence remain protected.",
      "Intervention revisions now keep the exact application of their source intervention on mixed historical/current Action Plans and refuse contradictory lineage."
    ],
    "featurePackages": [
      {
        "title": "Release 20260902-feedback-198-withdrawal-r1",
        "items": [
          "`Withdraw application` now works when the selected application's assessment is with a Regional Manager or Decision Maker, has been returned for corrections, or was previously recalled.",
          "PATH requires the withdrawal reason, closes the application and its active review together, removes the item from review queues, and preserves the submitted assessment, reviewer evidence, notes, and event history.",
          "Applications with a recorded final decision still use the separate correction process and cannot be withdrawn through this action."
        ]
      },
      {
        "title": "Release 20260829-supporting-document-deletion-r1",
        "items": [
          "Supporting Documents now uses one simple deletion rule: staff can delete an ordinary document they are authorized to manage, while PATH keeps signed documents, files currently out for signature, CFA and Financial Overview version history, and payment evidence.",
          "Deleting a secure-message attachment from Supporting Documents leaves the original message and attachment intact. Deleting a checklist document does not move the workflow backwards, though it can block a current or future checklist that still requires the document.",
          "Delete now asks only “Delete this document?”; payment evidence can be removed only while its packet is Draft or Ready to send."
        ]
      },
      {
        "title": "Release 20260828-admin-document-lineage-r1",
        "items": [
          "All four PATH staff roles can use reversible Delete for an eligible Applicant upload they can already access. The file leaves normal lists and checklists, while a System Administrator can restore it.",
          "Applicant-upload deletion does not change the submitted application and does not enable Duplicate. Signing, secure-message, generated, version, payment, legacy, and unknown records remain protected.",
          "Intervention revisions created on mixed historical/current Action Plans now preserve the exact application of their source intervention after PATH proves the same case and Action Plan."
        ]
      }
    ],
    "knownIssuesHeading": "Known Bugs",
    "knownIssues": [],
    "comingNextHeading": "What's Coming",
    "comingNext": [
      "An administrator-only Operations Report will help NWAC review workload, backlog, workflow timing, and communication measures after its live reporting source is ready."
    ]
  },
  "fr": {
    "sectionEyebrow": "Lecture optionnelle",
    "description": "",
    "featuresHeading": "Ce qui a change",
    "features": [
      "Le personnel peut maintenant retirer une demande admissible pendant que son évaluation est en cours d'examen ou retournée pour corrections. PATH ferme ensemble la demande et l'examen tout en préservant l'historique de l'évaluation.",
      "Le personnel peut maintenant supprimer les documents de soutien ordinaires, peu importe leur provenance. Les documents signés, les fichiers en cours de signature, l'historique officiel des versions et les preuves de paiement demeurent protégés.",
      "Les révisions d'intervention conservent maintenant la demande exacte de leur intervention source dans les plans d'action mixtes historiques et actuels, et PATH refuse toute filiation contradictoire."
    ],
    "featurePackages": [
      {
        "title": "Release 20260902-feedback-198-withdrawal-r1",
        "items": [
          "`Retirer la demande` fonctionne maintenant lorsque l'évaluation de la demande sélectionnée est auprès d'un gestionnaire régional ou d'un décideur, a été retournée pour corrections ou a déjà été rappelée.",
          "PATH exige le motif du retrait, ferme ensemble la demande et son examen actif, retire l'élément des files d'examen et préserve l'évaluation soumise, les preuves des réviseurs, les notes et l'historique des événements.",
          "Une demande pour laquelle une décision finale a été enregistrée doit toujours suivre le processus de correction distinct et ne peut pas être retirée au moyen de cette action."
        ]
      },
      {
        "title": "Release 20260829-supporting-document-deletion-r1",
        "items": [
          "Les documents de soutien suivent maintenant une règle de suppression simple : le personnel peut supprimer un document ordinaire qu'il est autorisé à gérer, tandis que PATH conserve les documents signés, les fichiers en cours de signature, l'historique des versions des ententes de financement et des aperçus financiers, ainsi que les preuves de paiement.",
          "La suppression d'une pièce jointe de la liste des documents de soutien laisse le message sécurisé et sa pièce jointe intacts. La suppression d'un document de liste de contrôle ne fait pas reculer le processus, mais peut bloquer une vérification actuelle ou future qui exige encore ce document.",
          "La confirmation demande seulement « Supprimer ce document? »; une preuve de paiement peut être retirée uniquement lorsque sa trousse est à l'état Brouillon ou Prête à envoyer."
        ]
      },
      {
        "title": "Release 20260828-admin-document-lineage-r1",
        "items": [
          "Les quatre rôles du personnel PATH peuvent utiliser la suppression réversible pour un Téléversement du demandeur admissible auquel ils ont déjà accès. Le fichier disparaît des listes et listes de contrôle normales, et un administrateur système peut le restaurer.",
          "La suppression d'un téléversement du demandeur ne modifie pas la demande soumise et n'autorise pas la duplication. Les dossiers liés aux signatures, aux messages sécurisés, aux documents générés, aux versions, aux paiements, aux sources anciennes ou inconnues demeurent protégés.",
          "Les révisions d'intervention créées dans un plan d'action mixte historique et actuel conservent maintenant la demande exacte de l'intervention source après vérification du même dossier et du même plan d'action."
        ]
      }
    ],
    "knownIssuesHeading": "Problemes connus",
    "knownIssues": [],
    "comingNextHeading": "A venir",
    "comingNext": [
      "Un rapport des opérations réservé aux administrateurs aidera l'AFAC à examiner la charge de travail, les dossiers en attente, les délais des processus et les communications lorsque sa source de rapports en direct sera prête."
    ]
  }
};

export default publicReleaseNotes;
