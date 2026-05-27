const publicReleaseNotes = {
  "generatedAt": "2026-05-27T00:50:57.773Z",
  "releaseId": "20260526-prod-snapshot-scope-guard",
  "releaseLabel": "Release 20260526-prod-snapshot-scope-guard",
  "releaseDateEn": "27th May 2026",
  "releaseDateFr": "27 mai 2026",
  "en": {
    "sectionEyebrow": "Optional reading",
    "description": "",
    "featuresHeading": "What changed",
    "features": [
      "Financial Reports now opens with a cleaner funded-interventions view and better intervention-detail controls.",
      "Manage ISET Applications and ISET Clients now include `Show All` page-size options and sort full filtered results before pagination.",
      "Regional Snapshot funding and funded-client totals now align with Financial Reports for approved CRF/EI funding by participant home province.",
      "Other funders can now be marked confirmed, pending, denied, or unknown, with optional amount and notes.",
      "Financial Reports help now gives staff-facing guidance for the annual ISET Advances and Active Clients report.",
      "Fixed a bug where some denied applications could still appear in active application lists after the denial letter was sent.",
      "Finance Settings now shows a read-only preview of the payment-packet email sent to Finance.",
      "Improved denied and withdrawn application reporting records so ILMP validation has the required agreement and education fields.",
      "Withdrawn applications now create the reporting-only action plan and two completed interventions needed for ILMP reporting.",
      "Intervention planned-cost fields now accept normal dollars-and-cents amounts.",
      "Supporting Documents uploads now work on case files where an older application has an unsafe applicant-account link.",
      "Applicant portal case/status/message routes now double-check that the signed-in account belongs to the same client as the application and case being shown."
    ],
    "featurePackages": [
      {
        "title": "Release 20260526-prod-snapshot-scope-guard",
        "items": [
          "Manage ISET Applications and ISET Clients now include `Show All` page-size options and sort the full filtered result set before pagination.",
          "Regional Snapshot now uses the same approved CRF/EI funding and participant-home-province rules as Financial Reports for funding and funded-client totals.",
          "Financial Reports help is organized around annual-report workflow, including approval-year scope, visible-row totals, carry-over confidence, export scope, and first checks when a number looks wrong.",
          "Applicant portal message, signing, status, and intervention routes now double-check that the signed-in account belongs to the same client as the application and case being shown.",
          "Applicant session-audit writes now match the deployed `user_session_audit` table shape and prune old rows with bounded retention."
        ]
      },
      {
        "title": "Release 20260525-prod-bugcr-batch",
        "items": [
          "Financial Reports now defaults Intervention detail to funded interventions only, with an option to include all approved interventions when zero-dollar counselling or career-research rows need review.",
          "The Financial Reports detail table now hides reference-number clutter under participant names, shows CRF/EI and approved funding near the front, and supports column selection, resizing, and sorting.",
          "Regional Snapshot now uses the same approved CRF/EI funding and participant-home-province rules as Financial Reports for funding and funded-client totals.",
          "Financial Reports help now includes section-level guidance and AI-help coverage for the annual report purpose, export scope, and PATH-versus-Sage payment-status caveat.",
          "Other funders can now be marked confirmed, pending, denied, or unknown; only confirmed other funders require coverage details and generate other-funder letters.",
          "Finance payment-packet emails now include a seven-day download link for the packet evidence bundle.",
          "Payment packets now require only the Client Funding Agreement and the signed EFT banking form as baseline evidence.",
          "Finance Settings now shows a read-only preview of the payment-packet email sent to Finance."
        ]
      },
      {
        "title": "Release 20260522-prod-document-upload-scope",
        "items": [
          "Fixed a bug where some denied applications could still appear in active application lists after the denial letter was sent.",
          "Improved denied application reporting records so ILMP validation has the required agreement and education fields.",
          "Withdrawn applications now create the reporting-only action plan and two completed interventions needed for ILMP reporting.",
          "Intervention planned-cost fields now accept normal dollars-and-cents amounts.",
          "Supporting Documents uploads now work on case files where an older application has an unsafe applicant-account link."
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
      "Financial Reports s'ouvre maintenant avec une vue plus claire des interventions financees et de meilleurs controles de detail.",
      "Manage ISET Applications et ISET Clients incluent maintenant l'option `Show All` et trient tous les resultats filtres avant la pagination.",
      "Regional Snapshot aligne maintenant le financement et le nombre de clients finances avec les regles de Financial Reports, selon le financement CRF/EI approuve et la province de residence.",
      "Les autres bailleurs de fonds peuvent maintenant etre marques comme confirmes, en attente, refuses ou inconnus, avec montant et notes facultatifs.",
      "L'aide de Financial Reports donne maintenant des consignes pratiques pour le rapport annuel ISET Advances and Active Clients.",
      "Correction d'un probleme ou certaines demandes refusees pouvaient encore apparaitre dans les listes actives apres l'envoi de la lettre de refus.",
      "Finance Settings affiche maintenant un apercu en lecture seule du courriel de packet de paiement envoye aux Finances.",
      "Amelioration des dossiers de reporting pour les demandes refusees et retirees afin que la validation ILMP ait les champs requis.",
      "Les demandes retirees creent maintenant le plan d'action reserve au reporting et les deux interventions completees requis pour le reporting ILMP.",
      "Les champs de cout prevu des interventions acceptent maintenant les montants courants en dollars et cents.",
      "Les televersements dans Supporting Documents fonctionnent maintenant pour les dossiers ou une ancienne demande a un lien de compte client non securitaire.",
      "Le portail applicant verifie maintenant que le compte connecte appartient au meme client que la demande et le dossier affiches."
    ],
    "featurePackages": [
      {
        "title": "Release 20260526-prod-snapshot-scope-guard",
        "items": [
          "Manage ISET Applications et ISET Clients incluent maintenant l'option `Show All` et trient tous les resultats filtres avant la pagination.",
          "Regional Snapshot utilise maintenant les memes regles que Financial Reports pour le financement CRF/EI approuve et les clients finances par province de residence.",
          "L'aide de Financial Reports est organisee autour du travail de rapport annuel, notamment la portee par annee d'approbation, les totaux des lignes visibles, la fiabilite du report, la portee de l'export et les premieres verifications quand un montant semble incorrect.",
          "Les routes de messages, signatures, statuts et interventions du portail applicant verifient maintenant que le compte connecte appartient au meme client que la demande et le dossier affiches.",
          "L'audit de session applicant ecrit maintenant selon la structure de table `user_session_audit` deployee et supprime les anciennes lignes avec une retention bornee."
        ]
      },
      {
        "title": "Release 20260525-prod-bugcr-batch",
        "items": [
          "Financial Reports affiche maintenant par defaut seulement les interventions financees dans le detail, avec une option pour inclure toutes les interventions approuvees lorsque les lignes a zero dollar doivent etre examinees.",
          "Le tableau de detail de Financial Reports masque les numeros de reference sous les noms des participantes et participants, affiche CRF/EI et le financement approuve plus tot, et permet de choisir, redimensionner et trier les colonnes.",
          "Regional Snapshot utilise maintenant les memes regles que Financial Reports pour le financement CRF/EI approuve et les clients finances par province de residence.",
          "L'aide de Financial Reports comprend maintenant des consignes par section et une couverture d'aide IA pour le but du rapport annuel, la portee de l'export et la distinction entre le suivi PATH et Sage.",
          "Les autres bailleurs de fonds peuvent maintenant etre marques comme confirmes, en attente, refuses ou inconnus; seuls les bailleurs confirmes exigent les details de couverture et generent des lettres.",
          "Les courriels de packet de paiement incluent maintenant un lien de telechargement valide sept jours pour le paquet de pieces justificatives.",
          "Les packets de paiement exigent maintenant seulement le Client Funding Agreement et le formulaire bancaire EFT signe comme pieces justificatives de base.",
          "Finance Settings affiche maintenant un apercu en lecture seule du courriel de packet de paiement envoye aux Finances."
        ]
      },
      {
        "title": "Release 20260522-prod-document-upload-scope",
        "items": [
          "Correction d'un probleme ou certaines demandes refusees pouvaient encore apparaitre dans les listes actives apres l'envoi de la lettre de refus.",
          "Amelioration des dossiers de reporting des demandes refusees afin que la validation ILMP ait les champs d'entente et d'education requis.",
          "Les demandes retirees creent maintenant le plan d'action reserve au reporting et les deux interventions completees requis pour le reporting ILMP.",
          "Les champs de cout prevu des interventions acceptent maintenant les montants courants en dollars et cents.",
          "Les televersements dans Supporting Documents fonctionnent maintenant pour les dossiers ou une ancienne demande a un lien de compte client non securitaire."
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
