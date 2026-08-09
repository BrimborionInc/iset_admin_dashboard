const { Blob, File } = require('buffer');
const { ReadableStream } = require('stream/web');
const { MessageChannel, MessagePort } = require('worker_threads');

global.Blob = global.Blob || Blob;
global.File = global.File || File;
global.ReadableStream = global.ReadableStream || ReadableStream;
global.MessageChannel = global.MessageChannel || MessageChannel;
global.MessagePort = global.MessagePort || MessagePort;
global.DOMException = global.DOMException || class DOMException extends Error {
  constructor(message = '', name = 'Error') {
    super(message);
    this.name = name;
  }
};

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

describe('final two-step assessment packet rendering', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let buildAssessmentPdfFields;
  let buildAssessmentDocumentMetadata;
  let buildAssessmentVersionLabel;
  let mergeAssessmentSignatureEvidence;
  let buildAssessmentFinalEvidenceMetadata;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      buildAssessmentPdfFields,
      buildAssessmentDocumentMetadata,
      buildAssessmentVersionLabel,
      mergeAssessmentSignatureEvidence,
      buildAssessmentFinalEvidenceMetadata,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  const snapshot = (overrides = {}) => ({
    reference_number: 'APP-123',
    date_of_assessment: '2026-08-09',
    client_name: 'Packet Applicant',
    proposed_interventions: [],
    intervention_label_lookup: {},
    recommendation: 'fund',
    recommendation_justification: 'The submitted packet supports the requested plan.',
    agree_with_coordinator: 'agree',
    denial_reason: '',
    ...overrides,
  });

  const signatures = {
    recommendationSignature: {
      signerName: 'Recorded Submitter',
      signedAt: '2026-08-09T12:00:00.000Z',
      roleLabel: 'Mutable staff primary role must not render',
    },
    reviewSignature: {
      signerName: 'Regional Reviewer',
      signedAt: '2026-08-09T12:10:00.000Z',
      roleLabel: 'Mutable staff primary role must not render',
    },
    approvalSignature: {
      signerName: 'Final Decider',
      signedAt: '2026-08-09T12:20:00.000Z',
      roleLabel: 'Mutable staff primary role must not render',
    },
  };

  test.each([
    ['approved', 'Approved', 'Approved after final review.'],
    ['denied', 'Denied', 'Required denial reason from the Decision Maker.'],
  ])('renders complete %s evidence with semantic capacities', async (outcome, outcomeLabel, decisionNote) => {
    const fields = await buildAssessmentPdfFields({
      caseRow: {},
      snapshotOverride: snapshot({
        agree_with_coordinator: outcome === 'approved' ? 'agree' : 'disagree',
        denial_reason: outcome === 'denied' ? decisionNote : '',
      }),
      ...signatures,
      includeAgreementSection: true,
      finalDecisionOutcome: outcome,
      rmReviewNote: 'Regional Manager packet review complete.',
      decisionNote,
      versionNumber: 4,
      variant: 'final',
    });

    const html = fields.agreement_section_html.html;
    expect(fields.assessment_version_label).toBe(`v4 final - ${outcomeLabel}`);
    expect(html).toContain('FINAL REVIEW AND DECISION');
    expect(html).toContain(`Final decision outcome`);
    expect(html).toContain(`>${outcomeLabel}<`);
    expect(html).toContain('Recorded Submitter');
    expect(html).toContain('Capacity: Submitter');
    expect(html).toContain('Regional Reviewer');
    expect(html).toContain('Capacity: Regional Manager');
    expect(html).toContain('Regional Manager packet review complete.');
    expect(html).toContain('Final Decider');
    expect(html).toContain('Capacity: Decision Maker');
    expect(html).toContain(decisionNote);
    if (outcome === 'denied') {
      expect(html).toContain('Decision Maker decision note (required for denial)');
    }
    expect(html).not.toContain('Reason for denial by NWAC');
    expect(html).not.toContain('Approver eSignature');
    expect(html).not.toContain('Mutable staff primary role must not render');
  });

  test('final metadata keeps the compatibility category but records neutral final identity and outcome', () => {
    const finalEvidence = buildAssessmentFinalEvidenceMetadata({
      finalDecisionOutcome: 'reject',
      assessmentSubjectKey: 'application_assessment:application:123',
      workflowType: 'application_assessment',
      workflowSubject: {
        workflowType: 'application_assessment',
        caseId: 76,
        applicationId: 123,
      },
      submittedSignature: {
        workflowId: 901,
        staffProfileId: 54,
        signerName: 'Recorded Submitter',
        signedAt: '2026-08-09T12:00:00.000Z',
      },
      reviewSignature: {
        workflowId: 901,
        staffProfileId: 55,
        signerName: 'Regional Reviewer',
        signedAt: '2026-08-09T12:10:00.000Z',
      },
      decisionSignature: {
        workflowId: 901,
        staffProfileId: 56,
        signerName: 'Final Decider',
        signedAt: '2026-08-09T12:20:00.000Z',
      },
      rmReviewNote: 'RM note.',
      decisionNote: 'Required denial note.',
    });
    const metadata = JSON.parse(buildAssessmentDocumentMetadata({
      label: 'Final assessment packet v2 - Denied',
      documentType: 'case_assessment_approved',
      versionNumber: 2,
      variant: 'final',
      finalDecisionOutcome: 'reject',
      extraMetadata: {
        assessment_subject_key: 'application_assessment:application:123',
        assessment_final_evidence: finalEvidence,
      },
    }));

    expect(metadata).toMatchObject({
      document_type: 'case_assessment_approved',
      assessment_version_number: 2,
      assessment_variant: 'final',
      assessment_final_outcome: 'denied',
      assessment_subject_key: 'application_assessment:application:123',
      assessment_final_evidence: {
        outcome: 'denied',
        subjectKey: 'application_assessment:application:123',
        workflowType: 'application_assessment',
        workflowId: 901,
        subject: {
          key: 'application_assessment:application:123',
          caseId: 76,
          applicationId: 123,
        },
        submitter: {
          staffProfileId: 54,
          name: 'Recorded Submitter',
          signedAt: '2026-08-09T12:00:00.000Z',
          capacity: 'Submitter',
        },
        regionalManager: {
          staffProfileId: 55,
          name: 'Regional Reviewer',
          signedAt: '2026-08-09T12:10:00.000Z',
          capacity: 'Regional Manager',
          note: 'RM note.',
        },
        decisionMaker: {
          staffProfileId: 56,
          name: 'Final Decider',
          signedAt: '2026-08-09T12:20:00.000Z',
          capacity: 'Decision Maker',
          note: 'Required denial note.',
        },
      },
    });
  });

  test('submitted and redline metadata do not acquire final-decision fields', () => {
    for (const variant of ['submitted', 'redline']) {
      const metadata = JSON.parse(buildAssessmentDocumentMetadata({
        label: `Assessment ${variant}`,
        documentType: variant === 'redline' ? 'case_assessment_redline' : 'case_assessment',
        versionNumber: 3,
        variant,
      }));
      expect(metadata).not.toHaveProperty('assessment_final_outcome');
      expect(metadata).not.toHaveProperty('assessment_final_evidence');
    }
  });

  test('exact workflow stamp wins while request-time fallback fills only missing identity', () => {
    expect(mergeAssessmentSignatureEvidence({
      authoritative: {
        signerName: null,
        signedAt: '2026-08-09T12:20:01.000Z',
        decisionOutcome: 'denied',
        decisionNote: 'Exact workflow denial note.',
      },
      fallback: {
        signerName: 'Request Actor',
        signedAt: '2026-08-09T12:20:00.000Z',
        decisionNote: 'Request fallback must not replace workflow evidence.',
      },
      roleLabel: 'Decision Maker',
    })).toEqual({
      signerName: 'Request Actor',
      signedAt: '2026-08-09T12:20:01.000Z',
      decisionOutcome: 'denied',
      decisionNote: 'Exact workflow denial note.',
      roleLabel: 'Decision Maker',
    });
  });
});
