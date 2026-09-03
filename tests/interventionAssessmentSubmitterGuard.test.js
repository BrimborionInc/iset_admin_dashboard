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

describe('intervention proposal submitter ownership guards', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let assertInterventionReturnedToSubmitterActor;
  let assertInterventionSubmitterOwnedMutationAllowed;
  let assertInterventionFinalDecisionMutationAllowed;
  let assertInterventionDecisionPayloadOwnership;
  let validateApprovedInterventionMaterializationRequest;
  let validateApprovedInterventionRevisionApplicationRequest;
  let assertInterventionRevisionApplyPayloadOwnership;
  let startInterventionReviewWorkflow;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      assertInterventionReturnedToSubmitterActor,
      assertInterventionSubmitterOwnedMutationAllowed,
      assertInterventionFinalDecisionMutationAllowed,
      assertInterventionDecisionPayloadOwnership,
      validateApprovedInterventionMaterializationRequest,
      validateApprovedInterventionRevisionApplicationRequest,
      assertInterventionRevisionApplyPayloadOwnership,
      startInterventionReviewWorkflow,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  const buildReturnedWorkflow = workflowType => ({
    id: workflowType === 'intervention_revision' ? 702 : 701,
    workflow_type: workflowType,
    subject_key: `${workflowType}:proposal:${workflowType === 'intervention_revision' ? 802 : 801}`,
    case_id: 76,
    application_id: 123,
    action_plan_id: 3,
    intervention_id: workflowType === 'intervention_revision' ? 8 : 7,
    proposal_id: workflowType === 'intervention_revision' ? 802 : 801,
    current_stage: 'returned_to_submitter',
    current_owner_role: 'Submitter',
    current_owner_staff_profile_id: null,
    submitted_by_staff_profile_id: 54,
    submitted_at: '2026-08-09 12:00:00',
    rm_reviewed_by_staff_profile_id: 54,
    rm_reviewed_at: '2026-08-09 12:10:00',
    rm_review_note: 'Please make the requested correction.',
    nwac_decided_by_staff_profile_id: 51,
    nwac_decided_at: '2026-08-09 12:20:00',
    nwac_decision: 'changes_requested',
    nwac_decision_note: 'Please correct the proposal.',
    metadata_json: JSON.stringify({ source: 'intervention_review_action' }),
    archived_at: null,
    created_at: '2026-08-09 12:00:00',
    updated_at: '2026-08-09 12:30:00',
  });

  test('allows only the creator to mutate an existing draft', () => {
    const interventionRow = {
      id: 7,
      status: 'draft',
      delivery_status: null,
      created_by_staff_profile_id: 54,
    };

    expect(assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow,
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
      proposalMutationRequested: true,
    })).toEqual({ enforced: true, reason: 'draft_creator' });

    expect(() => assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow,
      actorStaffProfileId: 88,
      actorRole: 'Regional Manager',
      proposalMutationRequested: true,
    })).toThrow(expect.objectContaining({
      code: 'intervention_submitter_actor_forbidden',
      status: 403,
    }));
  });

  test.each([
    ['intervention_proposal'],
    ['intervention_revision'],
  ])('identity-binds returned %s work to its recorded submitter', workflowType => {
    const reviewWorkflow = buildReturnedWorkflow(workflowType);
    const interventionRow = {
      id: reviewWorkflow.intervention_id,
      status: 'changes_requested',
      delivery_status: null,
      created_by_staff_profile_id: 88,
    };

    expect(assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow,
      reviewWorkflow,
      actorStaffProfileId: 54,
      actorRole: 'Regional Manager',
      proposalMutationRequested: true,
    })).toEqual({ enforced: true, reason: 'original_submitter' });

    expect(() => assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow,
      reviewWorkflow,
      actorStaffProfileId: 88,
      actorRole: 'Regional Manager',
      proposalMutationRequested: true,
    })).toThrow(expect.objectContaining({
      code: 'intervention_submitter_actor_forbidden',
      status: 403,
    }));
  });

  test('fails closed for another role and for incomplete returned lineage', () => {
    expect(() => assertInterventionReturnedToSubmitterActor({
      reviewWorkflow: buildReturnedWorkflow('intervention_proposal'),
      actorStaffProfileId: 54,
      actorRole: 'NWAC Administrator',
      proposalMutationRequested: true,
    })).toThrow(expect.objectContaining({
      code: 'intervention_submitter_actor_forbidden',
      status: 403,
    }));

    expect(() => assertInterventionReturnedToSubmitterActor({
      reviewWorkflow: {
        ...buildReturnedWorkflow('intervention_proposal'),
        submitted_by_staff_profile_id: null,
      },
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
      proposalMutationRequested: true,
    })).toThrow(expect.objectContaining({
      code: 'intervention_submitter_actor_forbidden',
      status: 403,
    }));
  });

  test('keeps a returned packet locked when its workflow has not reached the submitter', () => {
    expect(() => assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow: {
        id: 7,
        status: 'changes_requested',
        delivery_status: null,
        created_by_staff_profile_id: 54,
      },
      reviewWorkflow: {
        ...buildReturnedWorkflow('intervention_proposal'),
        current_stage: 'returned_to_rm',
      },
      actorStaffProfileId: 54,
      actorRole: 'Regional Manager',
      proposalMutationRequested: true,
    })).toThrow(expect.objectContaining({
      code: 'intervention_submission_locked',
      status: 409,
    }));
  });

  test('keeps changes-requested work locked when authoritative workflow lineage is missing', () => {
    expect(() => assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow: {
        id: 7,
        status: 'changes_requested',
        delivery_status: null,
        created_by_staff_profile_id: 54,
      },
      reviewWorkflow: null,
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
      proposalMutationRequested: true,
    })).toThrow(expect.objectContaining({
      code: 'intervention_submission_locked',
      status: 409,
    }));
  });

  test('preserves the explicit System Administrator support exception', () => {
    expect(assertInterventionSubmitterOwnedMutationAllowed({
      interventionRow: {
        id: 7,
        status: 'changes_requested',
        delivery_status: null,
        created_by_staff_profile_id: 54,
      },
      reviewWorkflow: buildReturnedWorkflow('intervention_proposal'),
      actorStaffProfileId: 999,
      actorRole: 'System Administrator',
      proposalMutationRequested: true,
    })).toEqual({ enforced: true, reason: 'system_administrator_support' });
  });

  test.each([
    ['intervention_proposal'],
    ['intervention_revision'],
  ])('keeps final %s proposal facts immutable while allowing approved delivery operations', workflowType => {
    const finalWorkflow = {
      ...buildReturnedWorkflow(workflowType),
      current_stage: 'final_decision_recorded',
      current_owner_role: null,
      nwac_decision: 'approved',
    };
    const interventionRow = {
      id: finalWorkflow.intervention_id,
      status: 'approved',
      delivery_status: 'planned',
      created_by_staff_profile_id: 54,
    };

    expect(assertInterventionFinalDecisionMutationAllowed({
      reviewWorkflow: finalWorkflow,
      interventionRow,
      body: { deliveryStatus: 'in_progress' },
      nextStatusPersistence: { reviewStatus: 'approved', deliveryStatus: 'in_progress' },
    })).toEqual({ enforced: true, reason: 'approved_delivery_operation' });

    expect(() => assertInterventionFinalDecisionMutationAllowed({
      reviewWorkflow: finalWorkflow,
      interventionRow,
      body: { status: 'submitted', title: 'Forged reopened proposal' },
      nextStatusPersistence: { reviewStatus: 'submitted', deliveryStatus: null },
    })).toThrow(expect.objectContaining({
      code: 'intervention_final_decision_locked',
      status: 409,
    }));
  });

  test('allows proposal facts to change only while applying a separately approved revision', () => {
    expect(assertInterventionFinalDecisionMutationAllowed({
      reviewWorkflow: {
        ...buildReturnedWorkflow('intervention_proposal'),
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
      interventionRow: {
        id: 7,
        status: 'approved',
        delivery_status: 'planned',
      },
      body: {
        title: 'Approved revision title',
        revisionAppliedFromInterventionId: 8,
      },
      isApplyingApprovedRevision: true,
    })).toEqual({ enforced: true, reason: 'approved_revision_application' });
  });

  test('freezes approved compatibility-proposal facts when an older decision has no review-workflow row', () => {
    const interventionRow = {
      id: 109,
      status: 'in_progress',
      delivery_status: 'in_progress',
      proposal_id: 233,
      proposal_review_status: 'approved',
    };

    expect(assertInterventionFinalDecisionMutationAllowed({
      reviewWorkflow: null,
      interventionRow,
      body: { deliveryStatus: 'suspended' },
      nextStatusPersistence: { reviewStatus: 'approved', deliveryStatus: 'suspended' },
    })).toEqual({ enforced: true, reason: 'approved_delivery_operation' });

    expect(() => assertInterventionFinalDecisionMutationAllowed({
      reviewWorkflow: null,
      interventionRow,
      body: { institution: 'Renamed school' },
    })).toThrow(expect.objectContaining({
      code: 'intervention_final_decision_locked',
      status: 409,
    }));
  });

  test('limits Decision Maker updates to reviewer-owned fields', () => {
    expect(assertInterventionDecisionPayloadOwnership({
      isRecordingProposalDecision: true,
      body: {
        status: 'approved',
        potId: '1780058672308',
        postingContext: 'external',
        metadata: {
          review: {
            eiStatus: 'CRF',
            eiNotes: 'Verified.',
            decision: 'approved',
            decisionNotes: 'Approved.',
            eiDocumentId: 1646,
          },
        },
      },
    })).toEqual({ enforced: true, reason: 'decision_owned_fields_only' });

    expect(() => assertInterventionDecisionPayloadOwnership({
      isRecordingProposalDecision: true,
      body: {
        status: 'approved',
        cost: 25000,
        metadata: {
          snapshot: { costTotal: 25000 },
          review: { decision: 'approved' },
        },
      },
    })).toThrow(expect.objectContaining({
      code: 'intervention_submitted_packet_immutable',
      status: 409,
    }));
  });

  test('materializes additional rows only from exact facts in a final approved proposal', () => {
    const sourceInterventionRow = {
      id: 7,
      case_id: 76,
      action_plan_id: 3,
      status: 'approved',
      delivery_status: 'planned',
      created_by_staff_profile_id: 54,
      metadata_json: JSON.stringify({
        proposedInterventions: [
          {
            id: 'primary-item',
            code: '1',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            costLines: [{ id: 'line-1', type: 'TUITION', amount: 500 }],
          },
          {
            id: 'additional-item',
            code: '2',
            startDate: '2026-10-01',
            endDate: '2026-10-31',
            costLines: [{ id: 'line-2', type: 'TRANSPORT', amount: 750 }],
          },
        ],
        review: { eiStatus: 'CRF', decision: 'approved' },
      }),
    };
    const sourceReviewWorkflow = {
      ...buildReturnedWorkflow('intervention_proposal'),
      current_stage: 'final_decision_recorded',
      current_owner_role: null,
      nwac_decision: 'approved',
    };

    expect(validateApprovedInterventionMaterializationRequest({
      sourceInterventionRow,
      sourceReviewWorkflow,
      sourceItemId: 'additional-item',
      targetPlanId: 3,
      targetCaseId: 76,
      requestedCode: '2',
      requestedStartDate: '2026-10-01',
      requestedEndDate: '2026-10-31',
      requestedCost: 750,
      requestedNoc: null,
      requestedNocVersion: null,
    })).toMatchObject({
      sourceItemIndex: 1,
      normalizedSourceItem: {
        id: 'additional-item',
        code: '2',
        costTotal: 750,
      },
    });

    expect(() => validateApprovedInterventionMaterializationRequest({
      sourceInterventionRow,
      sourceReviewWorkflow,
      sourceItemId: 'additional-item',
      targetPlanId: 3,
      targetCaseId: 76,
      requestedCode: '2',
      requestedStartDate: '2026-10-01',
      requestedEndDate: '2026-10-31',
      requestedCost: 25000,
    })).toThrow(expect.objectContaining({
      code: 'approved_intervention_source_item_mismatch',
      status: 409,
    }));

    expect(() => validateApprovedInterventionMaterializationRequest({
      sourceInterventionRow,
      sourceReviewWorkflow,
      sourceItemId: 'additional-item',
      targetPlanId: 3,
      targetCaseId: 76,
      requestedCode: '2',
      requestedTitle: 'Forged title',
      expectedTitle: 'Employment assistance services',
      requestedStartDate: '2026-10-01',
      requestedEndDate: '2026-10-31',
      requestedDurationDays: 31,
      expectedDurationDays: 31,
      requestedCost: 750,
      requestedNotes: 'Trusted rationale',
      expectedNotes: 'Trusted rationale',
    })).toThrow(expect.objectContaining({
      code: 'approved_intervention_source_item_mismatch',
      status: 409,
    }));

    expect(() => validateApprovedInterventionMaterializationRequest({
      sourceInterventionRow,
      sourceReviewWorkflow,
      sourceItemId: 'primary-item',
      targetPlanId: 3,
      targetCaseId: 76,
      requestedCode: '1',
      requestedStartDate: '2026-09-01',
      requestedEndDate: '2026-09-30',
      requestedCost: 500,
    })).toThrow(expect.objectContaining({
      code: 'approved_intervention_source_item_invalid',
      status: 409,
    }));
  });

  test('applies only the exact proposal facts from an approved revision draft', () => {
    const revisionDraftRow = {
      id: 8,
      status: 'submitted',
      delivery_status: null,
      intervention_code: '2',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      intervention_cost: 750,
      budget_amount: 750,
      related_noc: null,
      related_noc_version: null,
      duration_days: 31,
      notes: 'Trusted rationale',
      metadata_json: JSON.stringify({
        title: 'Trusted intervention title',
        rationale: 'Trusted rationale',
        revision: { sourceInterventionId: 7 },
        proposedInterventions: [{
          id: 'revision-item',
          code: '2',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          institution: 'Trusted provider',
          costLines: [{ id: 'line-2', type: 'TRANSPORT', amount: 750 }],
        }],
      }),
    };

    expect(validateApprovedInterventionRevisionApplicationRequest({
      revisionDraftRow,
      requestedCode: '2',
      requestedTitle: 'Trusted intervention title',
      requestedStartDate: '2026-10-01',
      requestedEndDate: '2026-10-31',
      requestedDurationDays: 31,
      requestedCost: 750,
      requestedNotes: 'Trusted rationale',
      requestedNoc: null,
      requestedNocVersion: null,
    })).toMatchObject({
      normalizedRevision: {
        code: '2',
        institution: 'Trusted provider',
        costTotal: 750,
      },
    });

    expect(() => validateApprovedInterventionRevisionApplicationRequest({
      revisionDraftRow,
      requestedCode: '2',
      requestedTitle: 'Trusted intervention title',
      requestedStartDate: '2026-10-01',
      requestedEndDate: '2026-10-31',
      requestedDurationDays: 31,
      requestedCost: 25000,
      requestedNotes: 'Trusted rationale',
      requestedNoc: null,
      requestedNocVersion: null,
    })).toThrow(expect.objectContaining({
      code: 'approved_revision_packet_mismatch',
      status: 409,
    }));

    expect(() => validateApprovedInterventionRevisionApplicationRequest({
      revisionDraftRow,
      requestedCode: '2',
      requestedTitle: 'Forged intervention title',
      requestedStartDate: '2026-10-01',
      requestedEndDate: '2026-10-31',
      requestedDurationDays: 31,
      requestedCost: 750,
      requestedNotes: 'Trusted rationale',
      requestedNoc: null,
      requestedNocVersion: null,
    })).toThrow(expect.objectContaining({
      code: 'approved_revision_packet_mismatch',
      status: 409,
    }));

    expect(() => assertInterventionRevisionApplyPayloadOwnership({
      body: {
        status: 'approved',
        title: 'Trusted intervention title',
        revisionAppliedFromInterventionId: 8,
        approvedAmount: 999999,
      },
    })).toThrow(expect.objectContaining({
      code: 'approved_revision_packet_mismatch',
      status: 409,
    }));
  });

  test.each([
    ['intervention_proposal'],
    ['intervention_revision'],
  ])('rejects a different actor before any %s workflow write', async workflowType => {
    const reviewWorkflow = buildReturnedWorkflow(workflowType);
    const queries = [];
    const connection = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params });
        if (String(sql).includes('FROM iset_review_workflow') && String(sql).includes('subject_key = ?')) {
          return [[reviewWorkflow], []];
        }
        throw new Error(`unexpected_write:${String(sql)}`);
      }),
    };

    await expect(startInterventionReviewWorkflow(connection, {
      workflowType,
      caseId: reviewWorkflow.case_id,
      applicationId: reviewWorkflow.application_id,
      actionPlanId: reviewWorkflow.action_plan_id,
      interventionId: reviewWorkflow.intervention_id,
      proposalId: reviewWorkflow.proposal_id,
      interventionScope: {
        kind: 'application',
        caseId: reviewWorkflow.case_id,
        applicationId: reviewWorkflow.application_id,
        actionPlanId: reviewWorkflow.action_plan_id,
        interventionId: reviewWorkflow.intervention_id,
        proposalId: reviewWorkflow.proposal_id,
      },
      actorStaffProfileId: 88,
      actorRole: 'Regional Manager',
      metadata: { source: 'intervention_proposal_submit', reviewStatus: 'submitted' },
    })).rejects.toMatchObject({
      code: 'intervention_submitter_actor_forbidden',
      status: 403,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('FROM iset_review_workflow');
  });

  test('refuses to start an intervention workflow without exact application lineage', async () => {
    const connection = { query: jest.fn() };
    await expect(startInterventionReviewWorkflow(connection, {
      workflowType: 'intervention_proposal',
      caseId: 76,
      applicationId: null,
      actionPlanId: 3,
      interventionId: 7,
      proposalId: 801,
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
    })).rejects.toMatchObject({
      code: 'intervention_review_scope_conflict',
      status: 409,
    });
    expect(connection.query).not.toHaveBeenCalled();
  });

  test('starts an exact historical manual revision workflow with no application', async () => {
    const insertedWorkflow = {
      id: 703,
      workflow_type: 'intervention_revision',
      subject_key: 'intervention_revision:proposal:803',
      case_id: 40,
      application_id: null,
      action_plan_id: 6,
      intervention_id: 521,
      proposal_id: 803,
      current_stage: 'rm_review',
      current_owner_role: 'Regional Manager',
      submitted_by_staff_profile_id: 54,
    };
    const queries = [];
    const connection = {
      query: jest.fn(async (sql, params) => {
        const statement = String(sql);
        queries.push({ statement, params });
        if (statement.includes('FROM iset_review_workflow') && statement.includes('subject_key = ?')) {
          return [[], []];
        }
        if (statement.includes('INSERT INTO iset_review_workflow') && !statement.includes('_event')) {
          return [{ insertId: insertedWorkflow.id }, []];
        }
        if (statement.includes('SELECT * FROM iset_review_workflow WHERE id = ?')) {
          return [[insertedWorkflow], []];
        }
        if (statement.includes('INSERT INTO iset_review_workflow_event')) {
          return [{ insertId: 904 }, []];
        }
        throw new Error(`unexpected_query:${statement}`);
      }),
    };

    await expect(startInterventionReviewWorkflow(connection, {
      workflowType: 'intervention_revision',
      caseId: 40,
      applicationId: null,
      actionPlanId: 6,
      interventionId: 521,
      proposalId: 803,
      interventionScope: {
        kind: 'historical_manual',
        caseId: 40,
        applicationId: null,
        actionPlanId: 6,
        interventionId: 521,
        proposalId: 803,
        sourceInterventionId: 11,
      },
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
      metadata: { source: 'intervention_revision_submit', reviewStatus: 'submitted' },
    })).resolves.toMatchObject(insertedWorkflow);

    const insert = queries.find(query => (
      query.statement.includes('INSERT INTO iset_review_workflow') &&
      !query.statement.includes('_event')
    ));
    expect(insert.params).toEqual(expect.arrayContaining([
      'intervention_revision',
      'intervention_revision:proposal:803',
      40,
      6,
      521,
      803,
    ]));
    expect(insert.params[3]).toBeNull();
  });

  test('System Administrator support resubmission preserves submitter lineage and records the support actor', async () => {
    const reviewWorkflow = buildReturnedWorkflow('intervention_proposal');
    const updatedWorkflow = {
      ...reviewWorkflow,
      current_stage: 'rm_review',
      current_owner_role: 'Regional Manager',
      updated_at: '2026-08-09 12:40:00',
    };
    const queries = [];
    const connection = {
      query: jest.fn(async (sql, params) => {
        const statement = String(sql);
        queries.push({ sql: statement, params });
        if (statement.includes('FROM iset_review_workflow') && statement.includes('subject_key = ?')) {
          return [[reviewWorkflow], []];
        }
        if (statement.includes('UPDATE iset_review_workflow')) {
          return [{ affectedRows: 1 }, []];
        }
        if (statement.includes('SELECT * FROM iset_review_workflow WHERE id = ?')) {
          return [[updatedWorkflow], []];
        }
        if (statement.includes('INSERT INTO iset_review_workflow_event')) {
          return [{ insertId: 901 }, []];
        }
        throw new Error(`unexpected_query:${statement}`);
      }),
    };

    await expect(startInterventionReviewWorkflow(connection, {
      workflowType: reviewWorkflow.workflow_type,
      caseId: reviewWorkflow.case_id,
      applicationId: reviewWorkflow.application_id,
      actionPlanId: reviewWorkflow.action_plan_id,
      interventionId: reviewWorkflow.intervention_id,
      proposalId: reviewWorkflow.proposal_id,
      interventionScope: {
        kind: 'application',
        caseId: reviewWorkflow.case_id,
        applicationId: reviewWorkflow.application_id,
        actionPlanId: reviewWorkflow.action_plan_id,
        interventionId: reviewWorkflow.intervention_id,
        proposalId: reviewWorkflow.proposal_id,
      },
      actorStaffProfileId: 999,
      actorRole: 'System Administrator',
      metadata: { source: 'intervention_proposal_submit', reviewStatus: 'submitted' },
    })).resolves.toMatchObject({
      current_stage: 'rm_review',
      submitted_by_staff_profile_id: 54,
    });

    const workflowUpdate = queries.find(query => query.sql.includes('UPDATE iset_review_workflow'));
    const workflowEvent = queries.find(query => query.sql.includes('INSERT INTO iset_review_workflow_event'));
    expect(workflowUpdate.params[7]).toBe(54);
    expect(workflowEvent.params[6]).toBe(999);
    expect(workflowEvent.params[7]).toBe('System Administrator');
  });

  test.each([
    ['intervention_proposal'],
    ['intervention_revision'],
  ])('cannot restart a final %s workflow or clear its signatures', async workflowType => {
    const finalWorkflow = {
      ...buildReturnedWorkflow(workflowType),
      current_stage: 'final_decision_recorded',
      current_owner_role: null,
      nwac_decision: 'approved',
    };
    const queries = [];
    const connection = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params });
        if (String(sql).includes('FROM iset_review_workflow') && String(sql).includes('subject_key = ?')) {
          return [[finalWorkflow], []];
        }
        throw new Error(`unexpected_write:${String(sql)}`);
      }),
    };

    await expect(startInterventionReviewWorkflow(connection, {
      workflowType,
      caseId: finalWorkflow.case_id,
      applicationId: finalWorkflow.application_id,
      actionPlanId: finalWorkflow.action_plan_id,
      interventionId: finalWorkflow.intervention_id,
      proposalId: finalWorkflow.proposal_id,
      interventionScope: {
        kind: 'application',
        caseId: finalWorkflow.case_id,
        applicationId: finalWorkflow.application_id,
        actionPlanId: finalWorkflow.action_plan_id,
        interventionId: finalWorkflow.intervention_id,
        proposalId: finalWorkflow.proposal_id,
      },
      actorStaffProfileId: 54,
      actorRole: 'Regional Manager',
      metadata: { source: 'intervention_proposal_submit', reviewStatus: 'submitted' },
    })).rejects.toMatchObject({
      status: 403,
      message: 'review_workflow_transition_forbidden',
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('FROM iset_review_workflow');
  });
});
