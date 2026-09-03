const { Blob, File } = require('buffer');
const { ReadableStream } = require('stream/web');
const { MessageChannel, MessagePort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

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

describe('intervention application lineage and assessment signatures', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let resolveInterventionApplicationScopeId;
  let resolveInterventionReviewScope;
  let isInterventionApprovalQueueScopeAllowed;
  let isInterventionCompletionQueueScopeAllowed;
  let resolveExactFinalApprovedInterventionWorkflow;
  let resolveRevisionProposalApplicationId;
  let buildInterventionSubmissionApplicationScopeRow;
  let syncInterventionProposalCompatibility;
  let fetchAssessmentPdfSignatureContext;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      resolveInterventionApplicationScopeId,
      resolveInterventionReviewScope,
      isInterventionApprovalQueueScopeAllowed,
      isInterventionCompletionQueueScopeAllowed,
      resolveExactFinalApprovedInterventionWorkflow,
      resolveRevisionProposalApplicationId,
      buildInterventionSubmissionApplicationScopeRow,
      syncInterventionProposalCompatibility,
      fetchAssessmentPdfSignatureContext,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  test('uses explicit proposal/action-plan lineage and never the case-primary fallback', () => {
    expect(resolveInterventionApplicationScopeId({
      case_id: 76,
      proposal_application_id: 123,
      action_plan_application_id: 123,
      resolved_application_case_id: 76,
      application_id: 999,
      review_workflow_application_id: 123,
    }, { required: true })).toBe(123);

    expect(() => resolveInterventionApplicationScopeId({
      case_id: 76,
      proposal_application_id: null,
      action_plan_application_id: null,
      resolved_application_case_id: 76,
      application_id: 999,
    }, { required: true })).toThrow('intervention_application_scope_required');
  });

  test.each([
    [{ proposal_application_id: 123, action_plan_application_id: 124 }, 'proposal and Action Plan'],
    [{
      proposal_application_id: 123,
      action_plan_application_id: 123,
      review_workflow_application_id: 124,
    }, 'review workflow'],
    [{
      case_id: 76,
      proposal_application_id: 123,
      action_plan_application_id: 123,
      resolved_application_case_id: 77,
    }, 'does not belong'],
  ])('fails closed when explicit application lineage conflicts (%s)', (row, message) => {
    try {
      resolveInterventionApplicationScopeId(row, { required: true });
      throw new Error('expected_scope_conflict');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'intervention_application_scope_conflict',
        publicMessage: expect.stringContaining(message),
      });
    }
  });

  test('an application-linked revision inherits the exact source intervention application on a case-owned plan', () => {
    const sourceRow = {
      id: 219,
      case_id: 44,
      action_plan_id: 15,
      proposal_application_id: 88,
      action_plan_application_id: null,
      resolved_application_case_id: 44,
    };
    expect(resolveRevisionProposalApplicationId({
      interventionRow: { id: 290, case_id: 44, action_plan_id: 15 },
      sourceInterventionId: 219,
      sourceRow,
      actionPlanApplicationId: null,
    })).toBe(88);

    const submissionScope = buildInterventionSubmissionApplicationScopeRow({
      id: 290,
      case_id: 44,
      proposal_application_id: 88,
      action_plan_application_id: null,
      resolved_application_case_id: 44,
    }, {
      id: 15,
      application_id: null,
      application_case_id: null,
    });
    expect(resolveInterventionApplicationScopeId(submissionScope, { required: true })).toBe(88);
  });

  test('recognizes only an explicitly classified applicationless historical amendment', async () => {
    const revisionRow = {
      id: 521,
      case_id: 40,
      action_plan_id: 6,
      proposal_id: 555,
      proposal_kind: 'revision',
      proposal_source_intervention_id: 11,
      proposal_application_id: null,
      action_plan_application_id: null,
      review_workflow_application_id: null,
      metadata_json: JSON.stringify({ revision: { sourceInterventionId: 11 } }),
    };
    const planRow = {
      id: 6,
      case_id: 40,
      application_id: null,
      metadata_json: JSON.stringify({ source: 'manual_backload', entryMode: 'existing' }),
    };
    const sourceRow = {
      id: 11,
      case_id: 40,
      action_plan_id: 6,
      proposal_application_id: null,
      action_plan_application_id: null,
      metadata_json: JSON.stringify({ source: 'manual_backload', entryMode: 'existing' }),
    };

    await expect(resolveInterventionReviewScope(null, {
      interventionRow: revisionRow,
      planRow,
      sourceRow,
    })).resolves.toMatchObject({
      kind: 'historical_manual',
      caseId: 40,
      applicationId: null,
      actionPlanId: 6,
      interventionId: 521,
      proposalId: 555,
      sourceInterventionId: 11,
    });

    await expect(resolveInterventionReviewScope(null, {
      interventionRow: revisionRow,
      planRow: { ...planRow, metadata_json: '{}' },
      sourceRow,
    })).rejects.toMatchObject({
      code: 'intervention_historical_manual_scope_unverified',
      status: 409,
    });
  });

  test('keeps unexplained applicationless work out of intervention review queues', () => {
    const queueRow = {
      application_id: null,
      proposal_kind: 'revision',
      revision_source_intervention_id: 11,
      review_workflow_application_id: null,
      action_plan_metadata_json: JSON.stringify({ source: 'manual_backload' }),
      revision_source_metadata_json: JSON.stringify({ entryMode: 'existing' }),
    };
    expect(isInterventionApprovalQueueScopeAllowed(queueRow)).toBe(true);
    expect(isInterventionApprovalQueueScopeAllowed({
      ...queueRow,
      revision_source_metadata_json: '{}',
    })).toBe(false);

    const completionRow = {
      application_id: null,
      proposal_kind: 'revision',
      has_applied_revision: 1,
      metadata_json: JSON.stringify({ source: 'manual_backload' }),
      action_plan_metadata_json: JSON.stringify({ entryMode: 'existing' }),
    };
    expect(isInterventionCompletionQueueScopeAllowed(completionRow)).toBe(true);
    expect(isInterventionCompletionQueueScopeAllowed({
      ...completionRow,
      action_plan_metadata_json: '{}',
    })).toBe(false);
  });

  test('accepts a final approved workflow with null application only with verified manual scope', () => {
    const row = {
      id: 521,
      case_id: 40,
      action_plan_id: 6,
      proposal_id: 555,
      proposal_application_id: null,
      action_plan_application_id: null,
      proposal_kind: 'revision',
      review_workflow_id: 701,
      review_workflow_type: 'intervention_revision',
      review_workflow_intervention_id: 521,
      review_workflow_proposal_id: 555,
      review_workflow_application_id: null,
      review_workflow_current_stage: 'final_decision_recorded',
      review_workflow_nwac_decision: 'approved',
    };
    const interventionScope = {
      kind: 'historical_manual',
      caseId: 40,
      applicationId: null,
      actionPlanId: 6,
      interventionId: 521,
      proposalId: 555,
      sourceInterventionId: 11,
    };
    expect(resolveExactFinalApprovedInterventionWorkflow(row, {
      interventionScope,
    })).toMatchObject({
      eligible: true,
      applicationId: null,
      scopeKind: 'historical_manual',
    });
    expect(() => resolveExactFinalApprovedInterventionWorkflow(row)).toThrow(
      'intervention_application_scope_required'
    );
  });

  test('revision compatibility writes inherit source proposal lineage without attaching the mixed Action Plan', async () => {
    const statements = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const statement = String(sql);
        statements.push({ statement, params });
        if (statement.includes('SELECT application_id') && statement.includes('FROM iset_case_action_plan')) {
          return [[{ application_id: null }], []];
        }
        if (statement.includes('FROM iset_case_intervention ci') && statement.includes('WHERE ci.id = ?')) {
          return [[{
            id: 219,
            case_id: 44,
            action_plan_id: 15,
            status: 'in_progress',
            delivery_status: 'in_progress',
            proposal_application_id: 88,
            action_plan_application_id: null,
            resolved_application_case_id: 44,
          }], []];
        }
        if (statement.includes('INSERT INTO iset_intervention_proposal')) {
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${statement}`);
      }),
    };

    await syncInterventionProposalCompatibility({
      id: 290,
      case_id: 44,
      action_plan_id: 15,
      intervention_code: 11,
      status: 'draft',
      delivery_status: null,
      intervention_cost: 4885,
      metadata_json: JSON.stringify({
        revision: { sourceInterventionId: 219 },
      }),
    }, connection);

    const proposalWrite = statements.find(({ statement }) => (
      statement.includes('INSERT INTO iset_intervention_proposal')
    ));
    expect(proposalWrite).toBeTruthy();
    expect(proposalWrite.params[2]).toBe(88);
    expect(proposalWrite.params[4]).toBe(219);
    expect(proposalWrite.params[5]).toBe('revision');
  });

  test('revision lineage refuses a source outside the exact case or Action Plan', () => {
    expect(() => resolveRevisionProposalApplicationId({
      interventionRow: { id: 290, case_id: 44, action_plan_id: 15 },
      sourceInterventionId: 219,
      sourceRow: {
        id: 219,
        case_id: 45,
        action_plan_id: 15,
        proposal_application_id: 88,
        action_plan_application_id: null,
        resolved_application_case_id: 45,
      },
      actionPlanApplicationId: null,
    })).toThrow(expect.objectContaining({
      code: 'intervention_revision_source_scope_conflict',
      status: 409,
    }));
  });

  test('exact workflow stamps are authoritative before current-request fallbacks', async () => {
    const connection = {
      query: jest.fn(async sql => {
        const text = String(sql);
        if (text.includes('rw.submitted_at')) {
          return [[{
            review_workflow_id: 801,
            submitted_at: '2026-08-09 12:00:01',
            submitted_by_staff_profile_id: 51,
            signer_name: 'Recorded Submitter',
          }], []];
        }
        if (text.includes('rw.nwac_decided_at')) {
          return [[{
            review_workflow_id: 801,
            nwac_decided_at: '2026-08-09 12:20:01',
            nwac_decided_by_staff_profile_id: 53,
            nwac_decision: 'denied',
            nwac_decision_note: 'Recorded denial note.',
            signer_name: 'Recorded Decision Maker',
          }], []];
        }
        if (text.includes('rw.rm_reviewed_at')) {
          return [[{
            review_workflow_id: 801,
            rm_reviewed_at: '2026-08-09 12:10:00',
            rm_reviewed_by_staff_profile_id: 52,
            rm_review_note: 'Recorded RM note.',
            signer_name: 'RM Two',
          }], []];
        }
        throw new Error(`unexpected_query:${String(sql)}`);
      }),
    };
    const submittedFallback = {
      signerName: 'Submitter Two',
      signedAt: '2026-08-09T12:00:00.000Z',
    };
    const approvedFallback = {
      signerName: 'Decision Maker Two',
      signedAt: '2026-08-09T12:20:00.000Z',
    };

    await expect(fetchAssessmentPdfSignatureContext({
      caseId: 76,
      applicationId: 123,
      connection,
      submittedFallback,
      approvedFallback,
      finalDecisionOutcome: 'denied',
    })).resolves.toEqual({
      submittedSignature: expect.objectContaining({
        workflowId: 801,
        staffProfileId: 51,
        signerName: 'Recorded Submitter',
        roleLabel: 'Submitter',
      }),
      reviewSignature: expect.objectContaining({
        workflowId: 801,
        staffProfileId: 52,
        signerName: 'RM Two',
        roleLabel: 'Regional Manager',
        reviewNote: 'Recorded RM note.',
      }),
      approvedSignature: expect.objectContaining({
        workflowId: 801,
        staffProfileId: 53,
        signerName: 'Recorded Decision Maker',
        roleLabel: 'Decision Maker',
        decisionOutcome: 'denied',
        decisionNote: 'Recorded denial note.',
      }),
      finalDecisionOutcome: 'denied',
      rmReviewNote: 'Recorded RM note.',
      decisionNote: 'Recorded denial note.',
    });
    expect(connection.query).toHaveBeenCalledTimes(3);
    connection.query.mock.calls.forEach(([, params]) => {
      expect(params).toEqual(['application_assessment:application:123']);
    });
  });

  test('historical PDF regeneration resolves all three signatures from the exact workflow', async () => {
    const connection = {
      query: jest.fn(async sql => {
        const text = String(sql);
        if (text.includes('rw.submitted_at')) {
          return [[{ submitted_at: '2026-08-09 12:00:00', signer_name: 'Submitter B' }], []];
        }
        if (text.includes('rw.nwac_decided_at')) {
          return [[{
            nwac_decided_at: '2026-08-09 12:20:00',
            nwac_decision: 'approved',
            nwac_decision_note: 'Approved after final review.',
            signer_name: 'Decision Maker B',
          }], []];
        }
        if (text.includes('rw.rm_reviewed_at')) {
          return [[{
            rm_reviewed_at: '2026-08-09 12:10:00',
            rm_review_note: 'RM sign-off note.',
            signer_name: 'RM B',
          }], []];
        }
        throw new Error(`case-wide_event_lookup_forbidden:${text}`);
      }),
    };

    const result = await fetchAssessmentPdfSignatureContext({
      caseId: 76,
      applicationId: 123,
      connection,
    });

    expect(result.submittedSignature.signerName).toBe('Submitter B');
    expect(result.reviewSignature.signerName).toBe('RM B');
    expect(result.approvedSignature.signerName).toBe('Decision Maker B');
    expect(result).toMatchObject({
      finalDecisionOutcome: 'approved',
      rmReviewNote: 'RM sign-off note.',
      decisionNote: 'Approved after final review.',
    });
    expect(connection.query).toHaveBeenCalledTimes(3);
    connection.query.mock.calls.forEach(([, params]) => {
      expect(params).toEqual(['application_assessment:application:123']);
    });
  });

  test('approval and completion queues never fall back to the case-primary application', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const start = source.indexOf("app.get('/api/dashboard/intervention-approval-items'");
    const end = source.indexOf("app.get('/api/dashboard/intervention-milestone-items'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const queues = source.slice(start, end);

    expect(queues).toContain('.filter(isInterventionApprovalQueueScopeAllowed)');
    expect(queues).toContain('.filter(isInterventionCompletionQueueScopeAllowed)');
    expect(queues).toContain('ON a.id = COALESCE(p.application_id, ap.application_id)');
    expect(queues).toContain('p.application_id = ap.application_id');
    expect(queues).toContain('rw.application_id = COALESCE(p.application_id, ap.application_id)');
    expect(queues).not.toContain("buildCasePrimaryApplicationIdSql('c')");
    expect(queues).not.toContain("buildCasePrimaryApplicationJoinSql('c', 'a')");
  });

  test('intervention PDFs resolve prior versions inside the exact intervention stream', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const start = source.indexOf('async function generateAndStoreInterventionAssessmentPdf');
    const end = source.indexOf('async function generateAndStoreRevisionAssessmentPdf', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const generator = source.slice(start, end);

    expect(generator).toContain('const assessmentDocumentInterventionId');
    expect(generator).toContain('const exactReviewSubjectRow');
    expect(generator).toContain('interventionId: assessmentDocumentInterventionId');
    expect(generator).not.toContain('fallbackAssessmentDocumentInterventionId');
    expect(generator).toContain('buildInterventionReviewWorkflowSubject(exactReviewSubjectRow)');
    expect(generator).toContain('fetchReviewWorkflowSubmittedSignature(');
    expect(generator).toContain('fetchReviewWorkflowRmSignature(connection, workflowSubject)');
    expect(generator).toContain('fetchReviewWorkflowDecisionMakerSignature(connection, workflowSubject)');
    expect(generator).toContain('assessment_subject_key: isFinalDecisionPacket ? workflowSubjectKey : null');
    expect(generator).toContain('isFinalDecisionPacket && isRevisionSubject');
    expect(generator).toContain("finalDecisionOutcome: resolvedFinalOutcome");
  });

  test('application packets exclude intervention document streams even though the compatibility category is shared', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const fetchStart = source.indexOf('async function fetchLatestAssessmentDocumentInfo');
    const fetchEnd = source.indexOf('const ASSESSMENT_RECALL_VERSIONED_DOCUMENT_TYPES', fetchStart);
    const fetcher = source.slice(fetchStart, fetchEnd);
    expect(fetcher).toContain('excludeInterventionDocuments = false');
    expect(fetcher).toContain("JSON_EXTRACT(metadata, '$.intervention_id') IS NULL");

    const routeStart = source.indexOf("app.put('/api/cases/:id'");
    const routeEnd = source.indexOf('// --- Event timeline endpoints', routeStart);
    const assessmentRoute = source.slice(routeStart, routeEnd);
    expect(assessmentRoute).toContain('excludeInterventionDocuments: true');
    expect(assessmentRoute).toContain("assessment_source: 'application_assessment_final_decision'");
    expect(assessmentRoute).toContain('assessment_subject_key: applicationAssessmentSubjectKey');
    expect(assessmentRoute).toContain('workflowSubject: applicationWorkflowSubject');
  });

  test('application approve and deny create a neutral exact-subject final packet while request changes does not', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const routeStart = source.indexOf("app.put('/api/cases/:id'");
    const routeEnd = source.indexOf('// --- Event timeline endpoints', routeStart);
    const assessmentRoute = source.slice(routeStart, routeEnd);

    expect(assessmentRoute).toContain("afterAssessmentReviewStatus === 'approve'");
    expect(assessmentRoute).toContain("afterAssessmentReviewStatus === 'reject'");
    expect(assessmentRoute).toContain("? 'approved'");
    expect(assessmentRoute).toContain("? 'denied'");
    expect(assessmentRoute).toContain('const shouldGenerateFinalAssessmentPdf =');
    expect(assessmentRoute).toContain("documentType: isFinalDecisionPacket ? 'case_assessment_approved' : 'case_assessment'");
    expect(assessmentRoute).toContain("fileNamePrefix: isFinalDecisionPacket ? 'final-assessment-packet'");
    expect(assessmentRoute).toContain("const isFinalDecisionPacket = Boolean(normalizedFinalOutcome)");
  });

  test('intervention and Action Plan metric detail never inherit the newest case application', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const start = source.indexOf('async function fetchMetricActionPlanDetailRows');
    const end = source.indexOf('async function fetchMetricActiveCaseDetailRows', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const metricDetails = source.slice(start, end);

    expect(metricDetails).toContain('a.id = ap.application_id');
    expect(metricDetails).toContain('p.application_id = ap.application_id');
    expect(metricDetails).not.toContain("buildCasePrimaryApplicationIdSql('c')");
    expect(metricDetails).not.toContain("buildCasePrimaryApplicationJoinSql('c', 'a')");
  });
});
