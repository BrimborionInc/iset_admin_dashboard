export const documentationCategories = [
  {
    id: 'training-compliance',
    title: 'Training & Compliance',
    description: 'Orientation modules and audit-ready checklists for ISET case managers and PTMA staff.',
    items: [
      {
        id: 'iset-orientation-2025',
        title: 'ISET Orientation Training Modules (2025-2026)',
        runtimeId: 'training-modules-2025',
        sourcePath: 'docs/training/TRAINING_MODULES_September_2025_extracted.md',
        sourceNote: 'Source lives in the repo docs folder; not bundled into the runtime build.',
        summary: [
          'Orientation to the NWAC ↔ ESDC contribution agreement, funding streams (EI/CRF), and program mandate.',
          'Eligibility and documentation expectations for case managers, including ARMS usage and audit readiness.',
          'Overview of intervention pathways (training, wage subsidy, JCP, SEB) and case management cadence.'
        ]
      },
      {
        id: 'compliant-file-checklist',
        title: 'Compliant File Checklist',
        sourcePath: 'docs/training/compliance file list.txt',
        sourceNote: 'Checklist stored under docs/training; copy or publish externally if it must be user-facing.',
        summary: [
          'One-page checklist for audit-ready client files: EI consent/verification, IDs, Indigenous self-declaration.',
          'Includes band funding/denial letters, educational institution proof, and consent forms.',
          'Covers financial overview, income/expense verification, attendance forms for living allowances.'
        ]
      }
    ],
  },
];

export default documentationCategories;
