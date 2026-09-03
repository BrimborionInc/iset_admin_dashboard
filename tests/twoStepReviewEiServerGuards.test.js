const fs = require('fs');
const path = require('path');
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

describe('two-step review EI server guards', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let hasActiveApplicationAssessmentEiEvidence;
  let assertApplicationAssessmentEiEligibilityChangeEvidence;
  let assertApplicationAssessmentEiSubmissionReady;
  let assertInterventionApprovalEiFundingAlignment;
  let assertInterventionEiEvidenceLink;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      hasActiveApplicationAssessmentEiEvidence,
      assertApplicationAssessmentEiEligibilityChangeEvidence,
      assertApplicationAssessmentEiSubmissionReady,
      assertInterventionApprovalEiFundingAlignment,
      assertInterventionEiEvidenceLink,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  test('finds only active EI evidence attached to the exact case and application', async () => {
    const connection = {
      query: jest.fn(async () => [[{ id: 1646 }], []]),
    };

    await expect(hasActiveApplicationAssessmentEiEvidence(connection, {
      caseId: 76,
      applicationId: 123,
    })).resolves.toBe(true);

    expect(connection.query).toHaveBeenCalledTimes(1);
    const [sql, params] = connection.query.mock.calls[0];
    expect(String(sql)).toContain('FROM iset_document d');
    expect(String(sql)).toContain('d.case_id = ?');
    expect(String(sql)).toContain('d.application_id = ?');
    expect(String(sql)).toContain('d.document_category = ?');
    expect(String(sql)).toContain('d.status = ?');
    expect(params).toEqual([76, 123, 'ei_verification', 'active']);

    connection.query.mockResolvedValueOnce([[], []]);
    await expect(hasActiveApplicationAssessmentEiEvidence(connection, {
      caseId: 76,
      applicationId: 124,
    })).resolves.toBe(false);
  });

  test('requires exact application evidence before an authorized EI status change', () => {
    expect(assertApplicationAssessmentEiEligibilityChangeEvidence({
      previousEligibility: 'EI Active Claim',
      nextEligibility: 'ei_active_claim',
      hasVerificationEvidence: false,
    })).toEqual({ enforced: false, reason: 'eligibility_unchanged' });

    expect(() => assertApplicationAssessmentEiEligibilityChangeEvidence({
      previousEligibility: 'CRF',
      nextEligibility: 'EI Reach Back',
      hasVerificationEvidence: false,
    })).toThrow(expect.objectContaining({
      code: 'assessment_ei_verification_required',
      status: 422,
    }));

    expect(assertApplicationAssessmentEiEligibilityChangeEvidence({
      previousEligibility: 'CRF',
      nextEligibility: 'EI Reach Back',
      hasVerificationEvidence: true,
    })).toMatchObject({
      enforced: true,
      eligibility: 'ei_reach_back',
    });

    expect(() => assertApplicationAssessmentEiEligibilityChangeEvidence({
      previousEligibility: 'CRF',
      nextEligibility: 'unknown status',
      hasVerificationEvidence: true,
    })).toThrow(expect.objectContaining({
      code: 'assessment_ei_status_invalid',
      status: 422,
    }));
  });

  test('requires an EI status and application evidence on first submission for RM review', () => {
    expect(() => assertApplicationAssessmentEiSubmissionReady({
      previousEligibility: null,
      nextEligibility: null,
      hasVerificationEvidence: false,
    })).toThrow(expect.objectContaining({
      code: 'assessment_ei_status_required',
      status: 422,
    }));

    expect(() => assertApplicationAssessmentEiSubmissionReady({
      previousEligibility: null,
      nextEligibility: 'CRF',
      hasVerificationEvidence: false,
    })).toThrow(expect.objectContaining({
      code: 'assessment_ei_verification_required',
      status: 422,
    }));

    expect(assertApplicationAssessmentEiSubmissionReady({
      previousEligibility: null,
      nextEligibility: 'CRF',
      hasVerificationEvidence: true,
    })).toMatchObject({
      enforced: true,
      eligibility: 'crf',
      reason: 'status_and_application_evidence_present',
    });
  });

  test('does not demand retrofitted evidence for an unchanged accepted EI status on correction return', () => {
    expect(assertApplicationAssessmentEiSubmissionReady({
      reviewWorkflow: { current_stage: 'returned_to_submitter' },
      previousEligibility: 'EI Active Claim',
      nextEligibility: 'ei_active_claim',
      hasVerificationEvidence: false,
    })).toMatchObject({
      enforced: true,
      eligibility: 'ei_active_claim',
      reason: 'returned_eligibility_unchanged',
    });

    expect(() => assertApplicationAssessmentEiSubmissionReady({
      reviewWorkflow: { current_stage: 'returned_to_submitter' },
      previousEligibility: 'EI Active Claim',
      nextEligibility: 'EI Reach Back',
      hasVerificationEvidence: false,
    })).toThrow(expect.objectContaining({
      code: 'assessment_ei_verification_required',
      status: 422,
    }));

    expect(assertApplicationAssessmentEiSubmissionReady({
      reviewWorkflow: { current_stage: 'withdrawn' },
      previousEligibility: 'EI Reach Back',
      nextEligibility: 'ei_reach_back',
      hasVerificationEvidence: false,
    })).toMatchObject({
      enforced: true,
      eligibility: 'ei_reach_back',
      reason: 'returned_eligibility_unchanged',
    });
  });

  test.each([
    ['CRF', 'CRF', 'crf'],
    ['EI Active Claim', 'EI', 'ei_active_claim'],
    ['EI Reach Back', 'EI', 'ei_reach_back'],
  ])('accepts %s only with the matching %s Action Plan stream', (eiStatus, fundingStream, normalizedStatus) => {
    expect(assertInterventionApprovalEiFundingAlignment({
      metadata: { review: { eiStatus } },
      planFundingStream: fundingStream,
    })).toMatchObject({
      status: normalizedStatus,
      requiredFundingStream: fundingStream,
      actualFundingStream: fundingStream,
    });
  });

  test('blocks intervention approval without EI or with the wrong funding stream', () => {
    expect(() => assertInterventionApprovalEiFundingAlignment({
      metadata: { review: {} },
      planFundingStream: 'EI',
    })).toThrow(expect.objectContaining({
      code: 'intervention_ei_status_required',
      status: 422,
    }));

    expect(() => assertInterventionApprovalEiFundingAlignment({
      metadata: { review: { eiStatus: 'unverified' } },
      planFundingStream: 'EI',
    })).toThrow(expect.objectContaining({
      code: 'intervention_ei_status_invalid',
      status: 422,
    }));

    expect(() => assertInterventionApprovalEiFundingAlignment({
      metadata: { review: { eiStatus: 'CRF' } },
      planFundingStream: 'EI',
    })).toThrow(expect.objectContaining({
      code: 'intervention_ei_funding_stream_mismatch',
      status: 409,
    }));

    expect(() => assertInterventionApprovalEiFundingAlignment({
      metadata: { review: { eiStatus: 'EI Reach Back' } },
      planFundingStream: 'CRF',
    })).toThrow(expect.objectContaining({
      code: 'intervention_ei_funding_stream_mismatch',
      status: 409,
    }));

    expect(() => assertInterventionApprovalEiFundingAlignment({
      metadata: { review: { eiStatus: 'CRF', eiDocumentId: 'not-an-id' } },
      planFundingStream: 'CRF',
    })).toThrow(expect.objectContaining({
      code: 'intervention_ei_document_invalid',
      status: 422,
    }));
  });

  test('treats intervention evidence as optional but verifies an offered document link exactly', async () => {
    const connection = {
      query: jest.fn(async () => [[{ id: 990 }], []]),
    };

    await expect(assertInterventionEiEvidenceLink(connection, {
      documentId: null,
      caseId: 76,
      actionPlanId: 3,
      applicationId: 123,
      interventionId: 7,
    })).resolves.toEqual({
      enforced: false,
      reason: 'optional_evidence_not_supplied',
    });
    expect(connection.query).not.toHaveBeenCalled();

    await expect(assertInterventionEiEvidenceLink(connection, {
      documentId: 990,
      caseId: 76,
      actionPlanId: 3,
      applicationId: 123,
      interventionId: 7,
    })).resolves.toMatchObject({
      enforced: true,
      documentId: 990,
    });

    const [sql, params] = connection.query.mock.calls[0];
    expect(String(sql)).toContain('JOIN iset_document_intervention di ON di.document_id = d.id');
    expect(String(sql)).toContain('d.case_id = ?');
    expect(String(sql)).toContain('d.application_id = ?');
    expect(String(sql)).toContain('d.action_plan_id = ?');
    expect(String(sql)).toContain('di.intervention_id = ?');
    expect(params).toEqual([990, 76, 3, 123, 'ei_verification', 'active', 7]);

    connection.query.mockResolvedValueOnce([[{ id: 992 }], []]);
    await expect(assertInterventionEiEvidenceLink(connection, {
      documentId: 992,
      caseId: 40,
      actionPlanId: 6,
      applicationId: null,
      interventionId: 521,
    })).resolves.toMatchObject({
      enforced: true,
      documentId: 992,
    });
    const [historicalSql, historicalParams] = connection.query.mock.calls[1];
    expect(String(historicalSql)).toContain('d.application_id IS NULL');
    expect(historicalParams).toEqual([992, 40, 6, 'ei_verification', 'active', 521]);

    connection.query.mockResolvedValueOnce([[], []]);
    await expect(assertInterventionEiEvidenceLink(connection, {
      documentId: 991,
      caseId: 76,
      actionPlanId: 3,
      applicationId: 123,
      interventionId: 7,
    })).rejects.toMatchObject({
      code: 'intervention_ei_document_scope_mismatch',
      status: 422,
    });
  });

  test('wires the EI guards into both server-side workflow transition boundaries', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const applicationRouteStart = source.indexOf("app.put('/api/cases/:id'");
    const applicationRouteEnd = source.indexOf("app.get('/api/cases/:id/application-assessment-pdf'", applicationRouteStart);
    const applicationRoute = source.slice(applicationRouteStart, applicationRouteEnd);
    expect(applicationRoute).toContain('assertApplicationAssessmentEiEligibilityChangeEvidence({');
    expect(applicationRoute).toContain('assertApplicationAssessmentEiSubmissionReady({');

    const interventionRouteStart = source.indexOf("app.patch('/api/interventions/:id'");
    const interventionRouteEnd = source.indexOf("app.delete('/api/interventions/:id'", interventionRouteStart);
    const interventionRoute = source.slice(interventionRouteStart, interventionRouteEnd);
    expect(interventionRoute).toContain('assertInterventionApprovalEiFundingAlignment({');
    expect(interventionRoute).toContain('await assertInterventionEiEvidenceLink(pool, {');
  });
});
