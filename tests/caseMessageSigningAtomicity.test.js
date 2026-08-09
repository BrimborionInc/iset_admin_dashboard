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

describe('case secure-message signing atomicity', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let validateCaseMessageSigningAttachmentRequest;
  let resolveCaseMessageFundingSigningWorkflowKind;
  let assertCaseMessageFundingFormsPostApproval;
  let resolveCaseMessageApplicationDecisionAuthorization;
  let assertCaseMessageApplicationDecisionLetters;
  let resolveCaseMessageApplicationFundingApproval;
  let validateAutoFundingWorkflowAttachmentResolution;
  let assertUniqueVersionedSigningWorkflowAttachments;
  let resolveEligibleSigningWorkflowRows;
  let buildRequiredSigningWorkflowSchemas;
  let filterApplicationScopedVersionRows;
  let resolveApplicationScopedCfaDraft;
  let isAppliedRevisionEvidenceIntervention;
  let interventionHasCfaFunding;
  let cfaSnapshotHasFunding;
  let shouldIncludeFundedInterventionForCfa;
  let createCfaVersionForPlan;
  let deleteUploadedObjectKeysBestEffort;
  let inspectCaseMessageCommitOutcome;
  let inspectGeneratedVersionCommitOutcome;
  let commitCaseMessageWriteTransaction;
  let commitGeneratedVersionWriteTransaction;
  let rollbackCaseMessageWriteTransaction;
  let mapCaseMessagePublicError;
  let resolveS3UploadVersionId;
  let trackGeneratedObjectUploadAttempt;
  let verifyGeneratedObjectUploadIdentity;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      validateCaseMessageSigningAttachmentRequest,
      resolveCaseMessageFundingSigningWorkflowKind,
      assertCaseMessageFundingFormsPostApproval,
      resolveCaseMessageApplicationDecisionAuthorization,
      assertCaseMessageApplicationDecisionLetters,
      resolveCaseMessageApplicationFundingApproval,
      validateAutoFundingWorkflowAttachmentResolution,
      assertUniqueVersionedSigningWorkflowAttachments,
      resolveEligibleSigningWorkflowRows,
      buildRequiredSigningWorkflowSchemas,
      filterApplicationScopedVersionRows,
      resolveApplicationScopedCfaDraft,
      isAppliedRevisionEvidenceIntervention,
      interventionHasCfaFunding,
      cfaSnapshotHasFunding,
      shouldIncludeFundedInterventionForCfa,
      createCfaVersionForPlan,
      deleteUploadedObjectKeysBestEffort,
      inspectCaseMessageCommitOutcome,
      inspectGeneratedVersionCommitOutcome,
      commitCaseMessageWriteTransaction,
      commitGeneratedVersionWriteTransaction,
      rollbackCaseMessageWriteTransaction,
      mapCaseMessagePublicError,
      resolveS3UploadVersionId,
      trackGeneratedObjectUploadAttempt,
      verifyGeneratedObjectUploadIdentity,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  test('malformed, duplicate, and incomplete auto attachment sets fail closed', () => {
    expect(validateCaseMessageSigningAttachmentRequest(
      [{ workflow_id: '52junk' }],
      []
    )).toEqual({ valid: false, error: 'invalid_signing_workflow_id' });

    expect(validateCaseMessageSigningAttachmentRequest(
      [{ workflow_id: 52 }, { workflow_id: '52' }],
      [{ workflow_id: 52 }, { workflow_id: 52 }]
    )).toEqual({ valid: false, error: 'duplicate_signing_workflow_id' });

    expect(() => validateAutoFundingWorkflowAttachmentResolution({
      attachments: [{ workflow_id: 52 }],
      missing: [],
    })).toThrow(expect.objectContaining({
      publicError: 'funding_forms_workflows_invalid',
      httpStatus: 409,
    }));
  });

  test('funding agreements and EFT forms are recognized from authoritative types or catalogue names', () => {
    expect(resolveCaseMessageFundingSigningWorkflowKind({
      document_type: 'funding_agreement',
      name: 'Unrelated label',
    })).toBe('funding_agreement');
    expect(resolveCaseMessageFundingSigningWorkflowKind({
      document_type: null,
      name: 'Client Funding Agreement',
    })).toBe('funding_agreement');
    expect(resolveCaseMessageFundingSigningWorkflowKind({
      document_type: 'eft_or_wire_transfer_direct_deposit_form',
      name: 'Bank form',
    })).toBe('eft_form');
    expect(resolveCaseMessageFundingSigningWorkflowKind({
      document_type: null,
      name: 'EFT Form',
    })).toBe('eft_form');
    expect(resolveCaseMessageFundingSigningWorkflowKind({
      document_type: 'assessment_approval_letter',
      name: 'Approval letter',
    })).toBeNull();
  });

  test('post-approval funding forms require a final decision on the exact application', () => {
    const fundingRows = [
      { document_type: 'funding_agreement', name: 'Funding agreement' },
      { document_type: 'eft_form', name: 'EFT form' },
    ];

    expect(() => assertCaseMessageFundingFormsPostApproval({
      attachmentRows: fundingRows,
      selectedApplicationId: 123,
      approvedApplicationId: 123,
      finalApprovalRecorded: false,
      hasFundedCostLines: true,
      sourceType: 'application',
    })).toThrow(expect.objectContaining({
      publicError: 'funding_forms_final_approval_required',
      httpStatus: 422,
    }));

    expect(() => assertCaseMessageFundingFormsPostApproval({
      attachmentRows: fundingRows,
      selectedApplicationId: 123,
      approvedApplicationId: 999,
      finalApprovalRecorded: true,
      hasFundedCostLines: true,
      sourceType: 'intervention',
    })).toThrow(expect.objectContaining({
      publicError: 'funding_forms_application_scope_conflict',
      httpStatus: 409,
      publicDetails: expect.objectContaining({
        selectedApplicationId: 123,
        approvedApplicationId: 999,
        sourceType: 'intervention',
      }),
    }));
  });

  test('zero-funded approvals cannot attach funding forms while approval letters remain independent', () => {
    expect(() => assertCaseMessageFundingFormsPostApproval({
      attachmentRows: [{ document_type: 'funding_agreement' }],
      selectedApplicationId: 123,
      approvedApplicationId: 123,
      finalApprovalRecorded: true,
      hasFundedCostLines: false,
      sourceType: 'application',
    })).toThrow(expect.objectContaining({
      publicError: 'funding_forms_not_applicable',
      httpStatus: 422,
    }));

    expect(assertCaseMessageFundingFormsPostApproval({
      attachmentRows: [{ document_type: 'assessment_approval_letter' }],
      selectedApplicationId: 123,
      approvedApplicationId: null,
      finalApprovalRecorded: false,
      hasFundedCostLines: false,
    })).toEqual({ enforced: false, reason: 'no_funding_forms' });

    expect(assertCaseMessageFundingFormsPostApproval({
      attachmentRows: [
        { document_type: 'assessment_approval_letter' },
        { document_type: 'funding_agreement' },
        { document_type: 'eft_form' },
      ],
      selectedApplicationId: 123,
      approvedApplicationId: 123,
      finalApprovalRecorded: true,
      hasFundedCostLines: true,
      sourceType: 'intervention',
    })).toMatchObject({
      enforced: true,
      selectedApplicationId: 123,
      approvedApplicationId: 123,
      sourceType: 'intervention',
      fundingFormKinds: ['funding_agreement', 'eft_form'],
    });
  });

  test('name-only funding forms fail closed unless the server resolved an authoritative fallback type', () => {
    expect(() => assertCaseMessageFundingFormsPostApproval({
      attachmentRows: [{ id: 52, document_type: null, name: 'Client Funding Agreement' }],
      selectedApplicationId: 123,
      approvedApplicationId: 123,
      finalApprovalRecorded: true,
      hasFundedCostLines: true,
    })).toThrow(expect.objectContaining({
      publicError: 'funding_forms_workflows_invalid',
      httpStatus: 409,
      publicDetails: expect.objectContaining({ workflowId: 52 }),
    }));

    expect(assertCaseMessageFundingFormsPostApproval({
      attachmentRows: [{ id: 53, document_type: null, name: 'EFT/Wire Transfer Form' }],
      selectedApplicationId: 123,
      approvedApplicationId: 123,
      finalApprovalRecorded: true,
      hasFundedCostLines: true,
      documentTypeFallbackByWorkflowId: new Map([[53, 'EFT_form']]),
    })).toMatchObject({
      enforced: true,
      fundingFormKinds: ['eft_form'],
    });
  });

  test('an active two-step workflow is authoritative over stale application approval fields', () => {
    const applicationRow = {
      id: 123,
      status: 'approved',
      decision_outcome: 'approved',
    };
    expect(resolveCaseMessageApplicationFundingApproval({
      selectedApplicationId: 123,
      applicationRow,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 123,
        current_stage: 'rm_review',
        nwac_decision: null,
      },
    })).toMatchObject({
      finalApprovalRecorded: false,
      approvedApplicationId: 123,
      reason: 'review_not_final',
    });

    expect(resolveCaseMessageApplicationFundingApproval({
      selectedApplicationId: 123,
      applicationRow,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 123,
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
    })).toMatchObject({
      finalApprovalRecorded: true,
      approvedApplicationId: 123,
      reason: 'workflow_final_approval',
    });

    expect(resolveCaseMessageApplicationFundingApproval({
      selectedApplicationId: 123,
      applicationRow,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 999,
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
    })).toMatchObject({
      finalApprovalRecorded: false,
      approvedApplicationId: 999,
      reason: 'workflow_application_scope_mismatch',
    });

    expect(resolveCaseMessageApplicationFundingApproval({
      selectedApplicationId: 123,
      applicationRow,
      caseStatus: 'active',
      reviewWorkflow: null,
    })).toMatchObject({
      finalApprovalRecorded: true,
      approvedApplicationId: 123,
      reason: 'legacy_final_approval',
    });
  });

  test('two-step final decisions are authoritative for approval and denial letters', () => {
    const staleApprovedApplication = {
      id: 123,
      status: 'approved',
      decision_outcome: 'approved',
    };
    const approvalLetter = [{ document_type: 'assessment_approval_letter' }];
    const denialLetter = [{ document_type: 'assessment_denial_letter' }];

    expect(resolveCaseMessageApplicationDecisionAuthorization({
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 123,
        current_stage: 'rm_review',
        nwac_decision: null,
      },
    })).toMatchObject({
      outcome: null,
      reason: 'review_not_final',
      authoritativeSource: 'review_workflow',
    });
    expect(() => assertCaseMessageApplicationDecisionLetters({
      attachmentRows: approvalLetter,
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 123,
        current_stage: 'rm_review',
        nwac_decision: null,
      },
    })).toThrow(expect.objectContaining({
      publicError: 'invalid_letter_attachment',
      httpStatus: 422,
      publicDetails: expect.objectContaining({ decisionReason: 'review_not_final' }),
    }));

    expect(assertCaseMessageApplicationDecisionLetters({
      attachmentRows: approvalLetter,
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 123,
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
    })).toMatchObject({
      enforced: true,
      outcome: 'approved',
      allowedDocumentType: 'assessment_approval_letter',
      authoritativeSource: 'review_workflow',
    });

    const finalDenialWorkflow = {
      application_id: 123,
      current_stage: 'final_decision_recorded',
      nwac_decision: 'denied',
    };
    expect(assertCaseMessageApplicationDecisionLetters({
      attachmentRows: denialLetter,
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: finalDenialWorkflow,
    })).toMatchObject({
      enforced: true,
      outcome: 'denied',
      allowedDocumentType: 'assessment_denial_letter',
      authoritativeSource: 'review_workflow',
    });
    expect(() => assertCaseMessageApplicationDecisionLetters({
      attachmentRows: approvalLetter,
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: finalDenialWorkflow,
    })).toThrow(expect.objectContaining({ publicError: 'invalid_letter_attachment' }));

    expect(() => assertCaseMessageApplicationDecisionLetters({
      attachmentRows: approvalLetter,
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: {
        application_id: 999,
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
    })).toThrow(expect.objectContaining({
      publicDetails: expect.objectContaining({
        decisionReason: 'workflow_application_scope_mismatch',
      }),
    }));

    expect(assertCaseMessageApplicationDecisionLetters({
      attachmentRows: approvalLetter,
      selectedApplicationId: 123,
      applicationRow: staleApprovedApplication,
      caseStatus: 'active',
      reviewWorkflow: null,
    })).toMatchObject({
      outcome: 'approved',
      authoritativeSource: 'legacy_application',
    });
  });

  test('CFA inclusion requires positive funding and excludes applied revision evidence rows', () => {
    expect(interventionHasCfaFunding({
      costLines: [{ amount: 0 }],
      costTotal: 0,
    })).toBe(false);
    expect(cfaSnapshotHasFunding({
      interventions: [{ costLines: [], costTotal: 0 }],
    })).toBe(false);
    expect(interventionHasCfaFunding({
      costLines: [{
        amount: null,
        recurrence: { enabled: true, amountPerPeriod: 75, occurrences: 2 },
      }],
      costTotal: 0,
    })).toBe(true);
    expect(cfaSnapshotHasFunding({
      interventions: [{ costLines: [], costTotal: 250 }],
    })).toBe(true);

    expect(isAppliedRevisionEvidenceIntervention({
      metadata_json: JSON.stringify({
        revisionApplication: {
          status: 'applied',
          appliedToInterventionId: '77',
          appliedAt: '2026-08-09T12:00:00.000Z',
        },
      }),
    })).toBe(true);
    expect(isAppliedRevisionEvidenceIntervention({
      metadata_json: JSON.stringify({ revisionApplication: { status: 'draft' } }),
    })).toBe(false);

    expect(shouldIncludeFundedInterventionForCfa('approved', {
      metadata_json: JSON.stringify({
        costLines: [{ type: 'TuitionFeesDirect', amount: 0 }],
      }),
    }, 'CRF')).toBe(false);
    expect(shouldIncludeFundedInterventionForCfa('approved', {
      metadata_json: JSON.stringify({
        costLines: [{ type: 'TuitionFeesDirect', amount: 250 }],
      }),
    }, 'CRF')).toBe(true);
    expect(shouldIncludeFundedInterventionForCfa('draft', {
      metadata_json: JSON.stringify({
        costLines: [{ type: 'TuitionFeesDirect', amount: 250 }],
      }),
    }, 'CRF')).toBe(false);
    expect(shouldIncludeFundedInterventionForCfa('approved', {
      metadata_json: JSON.stringify({
        costLines: [{ type: 'TuitionFeesDirect', amount: 250 }],
        revisionApplication: { status: 'applied' },
      }),
    }, 'CRF')).toBe(false);
  });

  test('zero-funded plan snapshots skip before CFA series lookup or draft supersession', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
          return [[{ id: 76 }], []];
        }
        if (normalizedSql.includes('FROM iset_case_action_plan')) {
          return [[{
            id: 3,
            application_id: 123,
            name: 'Application 123 plan',
            funding_stream: 'CRF',
            agreement_number: null,
            effective_date: null,
          }], []];
        }
        if (normalizedSql.includes('FROM iset_case c')) {
          return [[{
            id: 76,
            case_number: 'CASE-76',
            application_id: 123,
            client_id: 45,
            case_context_json: '{}',
            applicant_user_id: 67,
            reference_number: 'APP-123',
            intake_payload: '{}',
          }], []];
        }
        if (normalizedSql.includes('FROM iset_case_intervention')) {
          return [[{
            id: 7,
            status: 'approved',
            intervention_code: '100',
            start_date: '2026-08-10',
            end_date: '2026-08-11',
            intervention_cost: 0,
            budget_amount: 0,
            approved_amount: 0,
            related_noc: null,
            related_noc_version: null,
            funding_stream: 'CRF',
            metadata_json: JSON.stringify({
              costLines: [{ type: 'TuitionFeesDirect', amount: 0 }],
              snapshot: { costTotal: 0 },
            }),
            notes: null,
          }], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    await expect(createCfaVersionForPlan({
      caseId: 76,
      actionPlanId: 3,
      applicationId: 123,
      changeReason: 'NEW_INTERVENTION_APPROVED',
      changeSummary: 'Zero funding',
      actorUserId: 88,
      staffProfileId: 54,
      caseManagerName: 'Case Manager',
      connection,
    })).resolves.toEqual({ skipped: true, reason: 'no_interventions' });

    expect(calls.some(call => call.sql.includes('FROM cfa_series'))).toBe(false);
    expect(calls.some(call => call.sql.includes('FROM cfa_version'))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('UPDATE cfa_version'))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('UPDATE signing_request'))).toBe(false);
  });

  test('every requested workflow must resolve exactly once and be signing eligible', async () => {
    const missingConnection = {
      query: jest.fn(async () => [[{
        id: 52,
        name: 'Funding agreement',
        workflow_type: 'consent-cm-prefill',
        document_type: 'funding_agreement',
      }], []]),
    };
    await expect(resolveEligibleSigningWorkflowRows(missingConnection, [
      { workflow_id: 52 },
      { workflow_id: 53 },
    ])).rejects.toMatchObject({
      publicError: 'signing_workflow_not_found',
      httpStatus: 422,
      publicDetails: { workflowId: 53 },
    });

    const ineligibleConnection = {
      query: jest.fn(async () => [[{
        id: 52,
        name: 'Main intake',
        workflow_type: 'main-intake',
        document_type: null,
      }], []]),
    };
    await expect(resolveEligibleSigningWorkflowRows(ineligibleConnection, [
      { workflow_id: 52 },
    ])).rejects.toMatchObject({
      publicError: 'signing_workflow_ineligible',
      httpStatus: 422,
    });

    const duplicateRowsConnection = {
      query: jest.fn(async () => [[
        { id: 52, name: 'One', workflow_type: 'consent-no-prefill', document_type: null },
        { id: 52, name: 'Two', workflow_type: 'consent-no-prefill', document_type: null },
      ], []]),
    };
    await expect(resolveEligibleSigningWorkflowRows(duplicateRowsConnection, [
      { workflow_id: 52 },
    ])).rejects.toMatchObject({
      publicError: 'signing_workflow_resolution_ambiguous',
      httpStatus: 409,
    });
  });

  test('the transactional workflow recheck locks the exact selected catalogue rows', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        id: 52,
        name: 'Financial Overview',
        workflow_type: 'consent-cm-prefill',
        document_type: 'financial_overview',
      }], []]),
    };

    await expect(resolveEligibleSigningWorkflowRows(
      connection,
      [{ workflow_id: 52 }],
      { forUpdate: true }
    )).resolves.toEqual([{
      id: 52,
      name: 'Financial Overview',
      workflow_type: 'consent-cm-prefill',
      document_type: 'financial_overview',
    }]);
    expect(String(connection.query.mock.calls[0][0]).trim()).toMatch(/FOR UPDATE$/);
    expect(connection.query.mock.calls[0][1]).toEqual([52]);
  });

  test('every attachment must have a successfully built nonempty schema before writes', async () => {
    const workflows = [
      { id: 52 },
      { id: 53 },
    ];
    const connection = { query: jest.fn() };
    const validBuilder = jest.fn(async ({ workflowId }) => ({
      steps: [{ id: workflowId }],
      meta: { workflowId },
    }));
    const schemas = await buildRequiredSigningWorkflowSchemas(
      connection,
      workflows,
      { schemaBuilder: validBuilder }
    );
    expect(validBuilder).toHaveBeenCalledTimes(2);
    expect(schemas.get(52).steps).toEqual([{ id: 52 }]);
    expect(schemas.get(53).steps).toEqual([{ id: 53 }]);

    await expect(buildRequiredSigningWorkflowSchemas(
      connection,
      workflows,
      { schemaBuilder: async ({ workflowId }) => (
        workflowId === 52 ? { steps: [{ id: 52 }] } : null
      ) }
    )).rejects.toMatchObject({
      publicError: 'signing_workflow_schema_invalid',
      httpStatus: 409,
      publicDetails: { workflowId: 53 },
    });

    await expect(buildRequiredSigningWorkflowSchemas(
      connection,
      workflows,
      { schemaBuilder: async () => { throw new Error('internal schema detail'); } }
    )).rejects.toMatchObject({
      publicError: 'signing_workflow_schema_invalid',
      publicDetails: { workflowId: 52 },
    });
  });

  test('only one CFA or financial-overview workflow can target a version in one message', () => {
    expect(() => assertUniqueVersionedSigningWorkflowAttachments([
      { id: 1, document_type: 'funding_agreement' },
      { id: 2, document_type: 'funding_agreement' },
    ])).toThrow(expect.objectContaining({
      publicError: 'duplicate_versioned_signing_form',
      httpStatus: 422,
    }));
    expect(() => assertUniqueVersionedSigningWorkflowAttachments([
      { id: 1, document_type: 'funding_agreement' },
      { id: 2, document_type: 'financial_overview' },
    ])).not.toThrow();
  });

  test('version lineage filtering never selects a sibling application snapshot', () => {
    const rows = [
      { id: 1, metadata_json: JSON.stringify({ case: { applicationId: 123 } }) },
      { id: 2, metadata_json: JSON.stringify({ case: { applicationId: 999 } }) },
      { id: 3, metadata_json: null },
    ];
    expect(filterApplicationScopedVersionRows(rows, 123).map(row => row.id)).toEqual([1]);
    expect(filterApplicationScopedVersionRows(rows, 999).map(row => row.id)).toEqual([2]);
    expect(filterApplicationScopedVersionRows(rows, null)).toEqual([]);
  });

  test('CFA draft reuse supersedes and cancels only the exact application lineage', async () => {
    const calls = [];
    const exact = applicationId => JSON.stringify({ case: { applicationId } });
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql.startsWith('SELECT id FROM cfa_series')) {
          return [[{ id: 7 }], []];
        }
        if (normalizedSql.includes('FROM cfa_version v')) {
          return [[
            { id: 104, series_id: 7, version_number: 4, status: 'draft', metadata_json: exact(123), supersedes_version_id: null },
            { id: 103, series_id: 7, version_number: 3, status: 'draft', metadata_json: exact(999), supersedes_version_id: null },
            { id: 102, series_id: 7, version_number: 2, status: 'sent', metadata_json: exact(123), supersedes_version_id: null },
            { id: 101, series_id: 7, version_number: 1, status: 'signed', metadata_json: exact(123), supersedes_version_id: null },
          ], []];
        }
        if (normalizedSql.startsWith('UPDATE cfa_version SET status')) {
          return [{ affectedRows: 1 }, []];
        }
        if (normalizedSql.startsWith('UPDATE signing_request')) {
          return [{ affectedRows: params.length }, []];
        }
        if (normalizedSql.startsWith('UPDATE cfa_version SET supersedes_version_id')) {
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    await expect(resolveApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
    })).resolves.toMatchObject({
      id: 104,
      supersedes_version_id: 101,
    });

    const withdrawal = calls.find(call => call.sql.startsWith('UPDATE cfa_version SET status'));
    expect(withdrawal.params).toEqual([102]);
    const cancellations = calls.filter(call => call.sql.startsWith('UPDATE signing_request'));
    expect(cancellations.map(call => call.params)).toEqual([['104', '102', '101']]);
    expect(calls.some(call => call.params.includes(103) || call.params.includes('103'))).toBe(false);
  });

  test('duplicate physical CFA series fail closed even if one series has no versions', async () => {
    const connection = {
      query: jest.fn(async () => [[{ id: 7 }, { id: 8 }], []]),
    };
    await expect(resolveApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
    })).rejects.toThrow('cfa_series_ambiguous');
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('an unsigned legacy CFA without application lineage blocks new signable work', async () => {
    const connection = {
      query: jest.fn(async (sql) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql.startsWith('SELECT id FROM cfa_series')) {
          return [[{ id: 7 }], []];
        }
        if (normalizedSql.includes('FROM cfa_version v')) {
          return [[{
            id: 104,
            series_id: 7,
            version_number: 4,
            status: 'sent',
            metadata_json: JSON.stringify({ case: {} }),
            supersedes_version_id: null,
          }], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };
    await expect(resolveApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
    })).rejects.toThrow('cfa_version_application_scope_unknown');
    expect(connection.query).toHaveBeenCalledTimes(2);
  });

  test('generated upload identity captures the exact S3 version from the PUT response', async () => {
    const uploads = [];
    const record = trackGeneratedObjectUploadAttempt(uploads, 'generated/a.pdf', {
      requestOwnedKey: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-a',
    });
    const headObjectFn = jest.fn(async () => ({
      exists: true,
      versionId: 'version-a',
      size: 12,
      metadata: { 'path-sha256': 'checksum-a' },
    }));
    expect(resolveS3UploadVersionId({ 'x-amz-version-id': 'version-a' }))
      .toBe('version-a');

    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: record,
      uploadResponse: { headers: { 'x-amz-version-id': 'version-a' } },
      headObjectFn,
      versionCompensationSupported: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-a',
    })).resolves.toBe(record);

    expect(record).toMatchObject({
      key: 'generated/a.pdf',
      versionId: 'version-a',
      versionIdentityVerified: true,
      objectIdentityVerified: true,
      identityMode: 'version',
    });
    expect(headObjectFn).toHaveBeenCalledWith({
      key: 'generated/a.pdf',
      versionId: 'version-a',
    });
  });

  test('missing PUT version headers are resolved through version-aware HeadObject or fail closed', async () => {
    const record = trackGeneratedObjectUploadAttempt([], 'generated/b.pdf', {
      requestOwnedKey: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-b',
    });
    const headObjectFn = jest.fn(async () => ({
      exists: true,
      versionId: 'version-b',
      size: 12,
      metadata: { 'path-sha256': 'checksum-b' },
    }));
    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: record,
      uploadResponse: { headers: {} },
      headObjectFn,
      versionCompensationSupported: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-b',
    })).resolves.toMatchObject({
      versionId: 'version-b',
      versionIdentityVerified: true,
    });

    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: trackGeneratedObjectUploadAttempt([], 'generated/c.pdf'),
      uploadResponse: { headers: {} },
      headObjectFn: async () => ({ exists: true }),
      versionCompensationSupported: true,
    })).rejects.toThrow('s3_upload_identity_unverified');

    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: trackGeneratedObjectUploadAttempt([], 'generated/d.pdf'),
      uploadResponse: { headers: { 'x-amz-version-id': 'version-d' } },
      headObjectFn,
      versionCompensationSupported: false,
    })).rejects.toThrow('s3_version_compensation_unavailable');
  });

  test('generated upload identity supports a checksum-verified request-owned key in an unversioned bucket', async () => {
    const record = trackGeneratedObjectUploadAttempt([], 'generated/unversioned.pdf', {
      requestOwnedKey: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-u',
    });
    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: record,
      uploadResponse: { headers: {} },
      headObjectFn: async () => ({
        exists: true,
        versionId: null,
        size: 12,
        metadata: { 'path-sha256': 'checksum-u' },
      }),
      versionCompensationSupported: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-u',
    })).resolves.toMatchObject({
      key: 'generated/unversioned.pdf',
      versionId: null,
      versionIdentityVerified: false,
      objectIdentityVerified: true,
      identityMode: 'request_owned_key_checksum',
    });

    const deleteObjectFn = jest.fn(async () => ({ deleted: true, versionId: null }));
    await expect(deleteUploadedObjectKeysBestEffort([record], {
      driver: 's3',
      versionCompensationSupported: true,
      headObjectFn: async () => ({
        exists: true,
        versionId: null,
        size: 12,
        metadata: { 'path-sha256': 'checksum-u' },
      }),
      deleteObjectFn,
      logger: { warn: jest.fn() },
    })).resolves.toEqual({ attempted: 1, deleted: 1, failed: 0 });
    expect(deleteObjectFn).toHaveBeenCalledWith({ key: 'generated/unversioned.pdf' });
  });

  test('rolled-back uploads delete only exact generated keys and cleanup failures require manual review', async () => {
    const deleteAttempts = [];
    const logger = { warn: jest.fn(), error: jest.fn() };
    const cleanupFn = async keys => deleteUploadedObjectKeysBestEffort(keys, {
      driver: 's3',
      logger,
      versionCompensationSupported: true,
      headObjectFn: async ({ key }) => ({
        exists: true,
        versionId: key.endsWith('b.pdf') ? 'version-b' : 'version-a',
      }),
      deleteObjectFn: async ({ key, versionId }) => {
        expect(staged).toBeNull();
        deleteAttempts.push({ key, versionId });
        if (key === 'generated/b.pdf') throw new Error('delete failed');
      },
    });
    const durable = { oldVersion: 'sent', oldRequest: 'pending', messages: 0 };
    let staged = { oldVersion: 'withdrawn', oldRequest: 'cancelled', messages: 1 };
    const connection = {
      rollback: jest.fn(async () => { staged = null; }),
      release: jest.fn(),
    };
    const originalError = new Error('late signing-link insert fault');

    const returnedError = await rollbackCaseMessageWriteTransaction({
      connection,
      transactionStarted: true,
      uploadedObjectKeys: [
        { key: 'generated/a.pdf', versionId: 'version-a', versionIdentityVerified: true },
        { key: 'generated/b.pdf', versionId: null, versionIdentityVerified: false },
        { key: 'generated/a.pdf', versionId: 'version-a', versionIdentityVerified: true },
      ],
      originalError,
      cleanupFn,
      logger,
    });

    expect(returnedError).toMatchObject({
      publicError: 'message_send_cleanup_incomplete',
      httpStatus: 503,
      retrySafe: false,
      manualReviewRequired: true,
      cause: originalError,
    });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(staged).toBeNull();
    expect(durable).toEqual({ oldVersion: 'sent', oldRequest: 'pending', messages: 0 });
    expect(deleteAttempts).toEqual([
      { key: 'generated/b.pdf', versionId: 'version-b' },
      { key: 'generated/a.pdf', versionId: 'version-a' },
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    const rollbackUncertainCleanup = jest.fn();
    const destroy = jest.fn();
    const uncertainRollbackLogger = { warn: jest.fn(), error: jest.fn() };
    await expect(rollbackCaseMessageWriteTransaction({
      connection: {
        rollback: jest.fn(async () => { throw new Error('rollback logging fault'); }),
        release: jest.fn(),
        destroy,
      },
      transactionStarted: true,
      uploadedObjectKeys: ['generated/c.pdf'],
      originalError,
      cleanupFn: rollbackUncertainCleanup,
      logger: uncertainRollbackLogger,
    })).resolves.toBe(originalError);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(rollbackUncertainCleanup).not.toHaveBeenCalled();
    expect(uncertainRollbackLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('rollback outcome is uncertain')
    );

    const cleanupFailure = new Error('cleanup provider failed');
    await expect(rollbackCaseMessageWriteTransaction({
      connection: {
        rollback: jest.fn(),
        release: jest.fn(),
      },
      transactionStarted: true,
      uploadedObjectKeys: ['generated/c.pdf'],
      originalError,
      cleanupFn: async () => { throw cleanupFailure; },
      logger,
    })).resolves.toMatchObject({
      publicError: 'message_send_cleanup_incomplete',
      httpStatus: 503,
      retrySafe: false,
      manualReviewRequired: true,
      cause: originalError,
      cleanupError: cleanupFailure,
    });

    const unsupportedDelete = jest.fn();
    await expect(deleteUploadedObjectKeysBestEffort([
      { key: 'generated/versioned.pdf', versionId: 'version-z', versionIdentityVerified: true },
    ], {
      driver: 's3',
      versionCompensationSupported: false,
      headObjectFn: async () => ({ exists: true, versionId: 'version-z' }),
      deleteObjectFn: unsupportedDelete,
      logger,
    })).resolves.toEqual({ attempted: 1, deleted: 0, failed: 1 });
    expect(unsupportedDelete).not.toHaveBeenCalled();
  });

  test('an uncertain COMMIT retains generated objects and never attempts rollback cleanup', async () => {
    const originalError = new Error('commit acknowledgement lost');
    const connection = {
      rollback: jest.fn(),
      release: jest.fn(),
      destroy: jest.fn(),
    };
    const cleanupFn = jest.fn();
    const logger = { warn: jest.fn(), error: jest.fn() };

    await expect(rollbackCaseMessageWriteTransaction({
      connection,
      transactionStarted: true,
      commitAttempted: true,
      uploadedObjectKeys: [
        { key: 'generated/committed.pdf', versionId: 'version-committed', versionIdentityVerified: true },
      ],
      originalError,
      cleanupFn,
      logger,
    })).resolves.toBe(originalError);

    expect(connection.rollback).not.toHaveBeenCalled();
    expect(cleanupFn).not.toHaveBeenCalled();
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.release).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('commit outcome is uncertain')
    );
  });

  test('a freshly verified rolled-back COMMIT compensates objects without reusing the broken connection', async () => {
    const connection = { rollback: jest.fn(), release: jest.fn() };
    const cleanupFn = jest.fn(async () => ({ attempted: 1, deleted: 1, failed: 0 }));
    const originalError = new Error('commit rejected before apply');

    await expect(rollbackCaseMessageWriteTransaction({
      connection,
      transactionStarted: true,
      commitAttempted: true,
      commitOutcome: 'rolled_back',
      uploadedObjectKeys: [
        { key: 'generated/rolled-back.pdf', versionId: 'version-rb', versionIdentityVerified: true },
      ],
      originalError,
      cleanupFn,
      logger: { warn: jest.fn(), error: jest.fn() },
    })).resolves.toBe(originalError);

    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  test('message COMMIT reconciliation proves only the exact committed manifest and treats absence or partial state as uncertain', async () => {
    const identity = {
      messageId: 701,
      caseId: 76,
      applicationId: 123,
      senderActorType: 'staff_profile',
      senderUserId: 41,
      senderStaffProfileId: 17,
      recipientUserId: 88,
      subject: 'Financial Overview required',
      body: 'Please complete the attached form.',
      urgent: false,
      signingRequestIds: [902, 901],
    };
    const messageRow = {
      id: 701,
      sender_actor_type: 'staff_profile',
      sender_user_id: 41,
      sender_staff_profile_id: 17,
      recipient_actor_type: 'applicant_user',
      recipient_user_id: 88,
      recipient_staff_profile_id: null,
      case_id: 76,
      application_id: 123,
      subject: identity.subject,
      body: identity.body,
      status: 'unread',
      urgent: 0,
    };
    const committedConnection = {
      query: jest.fn(async sql => (
        String(sql).includes('FROM messages')
          ? [[messageRow], []]
          : [[
              { signing_request_id: 901, case_id: 76, participant_user_id: 88, status: 'pending' },
              { signing_request_id: 902, case_id: 76, participant_user_id: 88, status: 'pending' },
            ], []]
      )),
    };
    await expect(inspectCaseMessageCommitOutcome({
      ...identity,
      connection: committedConnection,
    })).resolves.toEqual({ outcome: 'committed', messageId: 701 });

    await expect(inspectCaseMessageCommitOutcome({
      ...identity,
      connection: { query: jest.fn(async () => [[], []]) },
    })).resolves.toEqual({
      outcome: 'uncertain',
      reason: 'message_commit_not_observed',
      messageId: 701,
    });

    const partialConnection = {
      query: jest.fn(async sql => (
        String(sql).includes('FROM messages')
          ? [[messageRow], []]
          : [[{ signing_request_id: 901, case_id: 76, participant_user_id: 88, status: 'pending' }], []]
      )),
    };
    await expect(inspectCaseMessageCommitOutcome({
      ...identity,
      connection: partialConnection,
    })).resolves.toMatchObject({
      outcome: 'uncertain',
      reason: 'message_commit_request_manifest_mismatch',
      messageId: 701,
    });
  });

  test('the production message COMMIT boundary recovers applied commits and distinguishes safe retry from ambiguity', async () => {
    const messageIdentity = { messageId: 701 };
    const appliedCommitError = new Error('ack lost after apply');
    const appliedConnection = {
      commit: jest.fn(async () => { throw appliedCommitError; }),
    };
    const logger = { warn: jest.fn() };
    await expect(commitCaseMessageWriteTransaction({
      connection: appliedConnection,
      messageIdentity,
      signingRequestIds: [901],
      inspectCommitFn: jest.fn(async input => {
        expect(input).toEqual({ messageId: 701, signingRequestIds: [901] });
        return { outcome: 'committed', messageId: 701 };
      }),
      logger,
    })).resolves.toMatchObject({ outcome: 'committed', recovered: true });
    expect(logger.warn).toHaveBeenCalledTimes(1);

    await expect(commitCaseMessageWriteTransaction({
      connection: { commit: jest.fn(async () => { throw new Error('rejected before apply'); }) },
      messageIdentity,
      inspectCommitFn: async () => ({ outcome: 'rolled_back', messageId: 701 }),
      logger,
    })).rejects.toMatchObject({
      httpStatus: 503,
      publicError: 'message_send_commit_failed',
      commitOutcome: 'rolled_back',
    });

    await expect(commitCaseMessageWriteTransaction({
      connection: { commit: jest.fn(async () => { throw new Error('database unavailable'); }) },
      messageIdentity,
      inspectCommitFn: async () => ({ outcome: 'uncertain', reason: 'recheck_unavailable' }),
      logger,
    })).rejects.toMatchObject({
      httpStatus: 503,
      publicError: 'message_send_outcome_uncertain',
      commitOutcome: 'uncertain',
    });
  });

  test.each([
    ['funding_overview', 'funding_overview_version'],
    ['cfa', 'cfa_version'],
  ])('version COMMIT reconciliation verifies the exact %s draft identity', async (versionKind, tableName) => {
    const committedConnection = {
      query: jest.fn(async sql => {
        expect(String(sql)).toContain(`FROM ${tableName}`);
        return [[{ id: 301, series_id: 44, version_number: 3, status: 'draft' }], []];
      }),
    };
    await expect(inspectGeneratedVersionCommitOutcome({
      versionKind,
      versionId: 301,
      seriesId: 44,
      versionNumber: 3,
      connection: committedConnection,
    })).resolves.toEqual({ outcome: 'committed', versionId: 301 });

    await expect(inspectGeneratedVersionCommitOutcome({
      versionKind,
      versionId: 301,
      seriesId: 44,
      versionNumber: 3,
      connection: { query: jest.fn(async () => [[], []]) },
    })).resolves.toEqual({
      outcome: 'uncertain',
      reason: 'version_commit_not_observed',
      versionId: 301,
    });
  });

  test('the production version COMMIT boundary recovers applied commits and exposes rolled-back or uncertain outcomes', async () => {
    const identity = {
      versionKind: 'funding_overview',
      versionId: 301,
      seriesId: 44,
      versionNumber: 3,
    };
    const logger = { warn: jest.fn() };
    await expect(commitGeneratedVersionWriteTransaction({
      connection: { commit: jest.fn(async () => { throw new Error('ack lost'); }) },
      ...identity,
      inspectCommitFn: jest.fn(async input => {
        expect(input).toEqual(identity);
        return { outcome: 'committed', versionId: 301 };
      }),
      logger,
    })).resolves.toMatchObject({ outcome: 'committed', recovered: true });
    expect(logger.warn).toHaveBeenCalledTimes(1);

    await expect(commitGeneratedVersionWriteTransaction({
      connection: { commit: jest.fn(async () => { throw new Error('rejected'); }) },
      ...identity,
      inspectCommitFn: async () => ({ outcome: 'rolled_back', versionId: 301 }),
      logger,
    })).rejects.toMatchObject({ commitOutcome: 'rolled_back' });

    await expect(commitGeneratedVersionWriteTransaction({
      connection: { commit: jest.fn(async () => { throw new Error('unavailable'); }) },
      ...identity,
      inspectCommitFn: async () => ({ outcome: 'uncertain', reason: 'recheck_unavailable' }),
      logger,
    })).rejects.toMatchObject({ commitOutcome: 'uncertain' });
  });

  test.each([
    ['version supersession', { versions: 2 }],
    ['generated document link', { versions: 2, documents: 1 }],
    ['message insert', { versions: 2, documents: 1, messages: 1 }],
    ['signing-request link', { versions: 2, documents: 1, messages: 1, requests: 1, links: 1 }],
    ['document-request activation', { versions: 2, documents: 1, messages: 1, requests: 1, links: 1, docsActive: true }],
  ])('a deterministic late fault after %s restores the prior durable state', async (phase, stagedDelta) => {
    const durable = {
      versions: 1,
      documents: 0,
      messages: 0,
      requests: 0,
      links: 0,
      docsActive: false,
    };
    let staged = { ...durable, ...stagedDelta };
    const connection = {
      rollback: jest.fn(async () => { staged = { ...durable }; }),
      release: jest.fn(),
    };
    const phaseError = new Error(`fault:${phase}`);
    const cleanupFn = jest.fn(async () => ({ attempted: 0, deleted: 0, failed: 0 }));

    await expect(rollbackCaseMessageWriteTransaction({
      connection,
      transactionStarted: true,
      uploadedObjectKeys: [],
      originalError: phaseError,
      cleanupFn,
      logger: { warn: jest.fn(), error: jest.fn() },
    })).resolves.toBe(phaseError);

    expect(staged).toEqual(durable);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  test.each([
    'cfa_application_scope_conflict',
    'cfa_supersession_conflict',
    'funding_overview_supersession_conflict',
  ])('maps internal mutation conflict %s to a stable public response', code => {
    const mapped = mapCaseMessagePublicError(new Error(code));
    expect(mapped).toMatchObject({
      httpStatus: 409,
      publicError: 'signing_message_state_conflict',
    });
    expect(mapped.publicMessage).not.toContain(code);
  });

  test.each([
    's3_version_compensation_unavailable',
    's3_upload_identity_unverified',
  ])('maps storage identity failure %s to a retryable public response', code => {
    expect(mapCaseMessagePublicError(new Error(code))).toMatchObject({
      httpStatus: 503,
      publicError: 'signing_artifact_storage_unavailable',
    });
  });
});
