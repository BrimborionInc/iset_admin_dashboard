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

describe('intervention decision integrity', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let assertInterventionDecisionOutcomeConsistency;
  let assertInterventionDecisionNoteReady;
  let isInterventionDecisionMakerRole;
  let resolveExactFinalApprovedInterventionWorkflow;
  let resolveApprovedInterventionProposalLetterEligibilityFromRow;
  let assertInterventionCloseAllowed;
  let assertInterventionDeleteAllowed;
  let assertInterventionDecisionCoreVersionCurrent;
  let runInterventionDecisionCoreTransaction;
  let assertApprovedInterventionMaterializationReplayMatches;
  let findApprovedInterventionMaterializationReplay;
  let materializeApprovedInterventionProposalAdditionalItems;
  let isAppliedRevisionEvidenceIntervention;
  let buildOperationalInterventionSql;
  let partitionAppliedRevisionEvidenceRows;
  let filterOperationalInterventionRows;
  let mapAppliedRevisionEvidenceRow;
  let assertOperationalInterventionRow;
  let assertOperationalPaymentInterventionIds;
  let buildPaymentHistoryIntegrityFields;
  let assertOperationalPaymentHistoryRecord;
  let assertOperationalPaymentPacketTargets;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      assertInterventionDecisionOutcomeConsistency,
      assertInterventionDecisionNoteReady,
      isInterventionDecisionMakerRole,
      resolveExactFinalApprovedInterventionWorkflow,
      resolveApprovedInterventionProposalLetterEligibilityFromRow,
      assertInterventionCloseAllowed,
      assertInterventionDeleteAllowed,
      assertInterventionDecisionCoreVersionCurrent,
      runInterventionDecisionCoreTransaction,
      assertApprovedInterventionMaterializationReplayMatches,
      findApprovedInterventionMaterializationReplay,
      materializeApprovedInterventionProposalAdditionalItems,
      isAppliedRevisionEvidenceIntervention,
      buildOperationalInterventionSql,
      partitionAppliedRevisionEvidenceRows,
      filterOperationalInterventionRows,
      mapAppliedRevisionEvidenceRow,
      assertOperationalInterventionRow,
      assertOperationalPaymentInterventionIds,
      buildPaymentHistoryIntegrityFields,
      assertOperationalPaymentHistoryRecord,
      assertOperationalPaymentPacketTargets,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  const finalApprovedRow = (overrides = {}) => ({
    id: 7,
    case_id: 76,
    action_plan_id: 3,
    status: 'approved',
    delivery_status: 'planned',
    metadata_json: JSON.stringify({ review: { decision: 'approved' } }),
    proposal_id: 801,
    proposal_kind: 'new',
    proposal_review_status: 'approved',
    proposal_application_id: 123,
    action_plan_application_id: 123,
    resolved_application_case_id: 76,
    review_workflow_id: 701,
    review_workflow_type: 'intervention_proposal',
    review_workflow_intervention_id: 7,
    review_workflow_proposal_id: 801,
    review_workflow_application_id: 123,
    review_workflow_current_stage: 'final_decision_recorded',
    review_workflow_nwac_decision: 'approved',
    ...overrides,
  });

  const finalApprovedWorkflow = (overrides = {}) => ({
    id: 701,
    workflow_type: 'intervention_proposal',
    intervention_id: 7,
    proposal_id: 801,
    application_id: 123,
    current_stage: 'final_decision_recorded',
    nwac_decision: 'approved',
    nwac_decided_by_staff_profile_id: 91,
    ...overrides,
  });

  const buildMaterializationTransaction = () => {
    const durableRows = [];
    let stagedRows = null;
    const connection = {
      beginTransaction: jest.fn(async () => {
        stagedRows = durableRows.map(row => ({ ...row }));
      }),
      commit: jest.fn(async () => {
        durableRows.splice(0, durableRows.length, ...stagedRows.map(row => ({ ...row })));
        stagedRows = null;
      }),
      rollback: jest.fn(async () => {
        stagedRows = null;
      }),
      release: jest.fn(),
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql.includes('FROM esdc_intervention_code')) {
          return [[{ label: `Intervention code ${params[0]}` }], []];
        }
        if (normalizedSql.includes("JSON_EXTRACT(ci.metadata_json, '$.approvalMaterialization")) {
          return [[], []];
        }
        if (normalizedSql.startsWith('INSERT INTO iset_case_intervention')) {
          const insertedRow = {
            id: 9,
            case_id: params[0],
            action_plan_id: params[1],
            intervention_code: params[2],
            status: 'approved',
            delivery_status: 'planned',
            start_date: params[3],
            end_date: params[4],
            duration_days: params[5],
            budget_amount: params[6],
            intervention_cost: params[7],
            related_noc: params[8],
            related_noc_version: params[9],
            notes: params[10],
            metadata_json: params[11],
            esdc_intervention_json: params[12],
            created_by_staff_profile_id: params[13],
            reviewed_by_staff_profile_id: params[14],
            review_notes: params[15],
            action_plan_application_id: 123,
            proposal_application_id: null,
            resolved_application_case_id: 76,
            proposal_id: null,
            created_at: '2026-08-09 12:00:00',
            updated_at: '2026-08-09 12:00:00',
          };
          stagedRows.push(insertedRow);
          return [{ insertId: insertedRow.id, affectedRows: 1 }, []];
        }
        if (normalizedSql.includes('FROM iset_case_intervention ci')) {
          const requestedId = Number(params[0]);
          return [[stagedRows.find(row => Number(row.id) === requestedId) || null], []];
        }
        if (normalizedSql.includes('FROM iset_case_action_plan')) {
          return [[{ application_id: 123 }], []];
        }
        if (normalizedSql.startsWith('INSERT INTO iset_intervention_proposal')) {
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`unexpected materialization query: ${normalizedSql}`);
      }),
    };
    return {
      durableRows,
      connection,
      connectionPool: { getConnection: jest.fn(async () => connection) },
    };
  };

  test.each([
    ['approved', 'approve'],
    ['rejected', 'denied'],
    ['changes_requested', 'request changes'],
  ])('requires metadata decision %s to match the requested status', (status, decision) => {
    expect(assertInterventionDecisionOutcomeConsistency({
      requestedReviewStatus: status,
      review: { decision },
    })).toMatchObject({
      enforced: true,
      decision: status,
    });
  });

  test.each([
    [null, 'approved'],
    ['rejected', 'approved'],
    ['approved', 'changes_requested'],
  ])('rejects a missing or contradictory decision (%s vs %s)', (decision, status) => {
    expect(() => assertInterventionDecisionOutcomeConsistency({
      requestedReviewStatus: status,
      review: decision ? { decision } : {},
    })).toThrow(expect.objectContaining({
      code: 'intervention_decision_outcome_mismatch',
      status: 422,
    }));
  });

  test('requires notes before denial or request-changes can reach a write', () => {
    expect(() => assertInterventionDecisionNoteReady({
      action: 'nwac_deny',
      review: { decision: 'rejected', decisionNotes: '' },
    })).toThrow(expect.objectContaining({
      code: 'review_workflow_note_required',
      status: 422,
    }));
    expect(assertInterventionDecisionNoteReady({
      action: 'nwac_request_changes',
      review: { decision: 'changes_requested', decisionNotes: 'Please correct the dates.' },
    })).toMatchObject({ enforced: true, note: 'Please correct the dates.' });
  });

  test('proposal and revision approval/denial create exact-subject final packets but request changes does not', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const finalPacketStart = source.indexOf('const finalInterventionAssessmentOutcome =');
    const finalPacketEnd = source.indexOf('const nextPlanFundingStream =', finalPacketStart);
    expect(finalPacketStart).toBeGreaterThanOrEqual(0);
    expect(finalPacketEnd).toBeGreaterThan(finalPacketStart);
    const finalPacket = source.slice(finalPacketStart, finalPacketEnd);

    expect(finalPacket).toContain("nextInterventionState.reviewStatus === 'approved'");
    expect(finalPacket).toContain("nextInterventionState.reviewStatus === 'rejected'");
    expect(finalPacket).toContain("? 'denied'");
    expect(finalPacket).not.toContain("nextInterventionState.reviewStatus === 'changes_requested'");
    expect(finalPacket).toContain('reviewSubjectInterventionRow: finalReviewSubjectRow');
    expect(finalPacket).toContain('finalDecisionOutcome: finalInterventionAssessmentOutcome');
    expect(finalPacket).toContain('isApplyingApprovedRevision ? revisionDraftRow : updatedRow');
  });

  test('approved revision application is restricted to the Decision Maker role', () => {
    expect(isInterventionDecisionMakerRole('NWAC Administrator')).toBe(true);
    expect(isInterventionDecisionMakerRole('NWAC_Administrator')).toBe(true);
    expect(isInterventionDecisionMakerRole('System Administrator')).toBe(false);
    expect(isInterventionDecisionMakerRole('Regional Manager')).toBe(false);
  });

  test('retained applied revision evidence is partitioned from operational rows and counts', () => {
    const operationalRow = finalApprovedRow({ id: 7 });
    const evidenceRow = finalApprovedRow({
      id: 8,
      metadata_json: JSON.stringify({
        review: { decision: 'approved' },
        revisionApplication: {
          status: 'applied',
          appliedToInterventionId: '7',
        },
      }),
    });

    expect(isAppliedRevisionEvidenceIntervention(operationalRow)).toBe(false);
    expect(isAppliedRevisionEvidenceIntervention(evidenceRow)).toBe(true);
    const partition = partitionAppliedRevisionEvidenceRows([operationalRow, evidenceRow]);
    expect(partition.operationalRows.map(row => row.id)).toEqual([7]);
    expect(partition.appliedRevisionEvidenceRows.map(row => row.id)).toEqual([8]);
    expect(partition.operationalRows).toHaveLength(1);
    expect(partition.appliedRevisionEvidenceRows).toHaveLength(1);

    expect(mapAppliedRevisionEvidenceRow(evidenceRow)).toMatchObject({
      id: 8,
      operational: false,
      recordKind: 'applied_revision_evidence',
      record_kind: 'applied_revision_evidence',
      isAppliedRevisionEvidence: true,
      is_applied_revision_evidence: true,
    });
    expect(buildOperationalInterventionSql('ci')).toContain('revisionApplication.status');
  });

  test.each(['edit or activate', 'close', 'revise', 'delete'])(
    'retained revision evidence rejects %s with a stable 409',
    operation => {
      const evidenceRow = finalApprovedRow({
        metadata_json: JSON.stringify({
          revisionApplication: { status: 'applied' },
        }),
      });
      expect(() => assertOperationalInterventionRow(evidenceRow, { operation })).toThrow(
        expect.objectContaining({
          code: 'applied_revision_evidence_read_only',
          status: 409,
        })
      );
    }
  );

  test('completion queue keeps exactly the operational source follow-up and omits its evidence row', () => {
    const sourceFollowUp = finalApprovedRow({
      id: 7,
      metadata_json: JSON.stringify({
        review: { decision: 'approved' },
        lastAppliedRevision: { revisionDraftInterventionId: 8 },
      }),
    });
    const evidenceRow = finalApprovedRow({
      id: 8,
      metadata_json: JSON.stringify({
        review: { decision: 'approved' },
        revisionApplication: {
          status: 'applied',
          appliedToInterventionId: '7',
        },
      }),
    });

    const queueRows = filterOperationalInterventionRows([sourceFollowUp, evidenceRow]);
    expect(queueRows).toHaveLength(1);
    expect(queueRows[0].id).toBe(7);
  });

  test('payment target validation rejects missing and retained-evidence intervention IDs', () => {
    const operationalRow = finalApprovedRow({ id: 7 });
    const evidenceRow = finalApprovedRow({
      id: 8,
      metadata_json: JSON.stringify({
        revisionApplication: { status: 'applied' },
      }),
    });
    const interventionMap = new Map([
      [7, operationalRow],
      [8, evidenceRow],
    ]);

    expect(assertOperationalPaymentInterventionIds({
      interventionIds: [7],
      interventionMap,
    })).toMatchObject({ enforced: true, interventionIds: [7] });
    expect(() => assertOperationalPaymentInterventionIds({
      interventionIds: [8],
      interventionMap,
    })).toThrow(expect.objectContaining({
      code: 'applied_revision_evidence_read_only',
      status: 409,
    }));
    expect(() => assertOperationalPaymentInterventionIds({
      interventionIds: [9],
      interventionMap,
    })).toThrow(expect.objectContaining({
      code: 'payment_intervention_not_found',
      status: 409,
    }));
  });

  test('historical payment rows stay visible but carry a retained-evidence integrity classification', () => {
    const evidenceRow = finalApprovedRow({
      id: 8,
      metadata_json: JSON.stringify({
        revisionApplication: { status: 'applied' },
      }),
    });
    const fields = buildPaymentHistoryIntegrityFields({
      interventionIds: [8],
      interventionMap: new Map([[8, evidenceRow]]),
      recordKind: 'payment_packet',
    });

    expect(fields).toEqual(expect.objectContaining({
      operational: false,
      recordKind: 'payment_packet_applied_revision_evidence_history',
      record_kind: 'payment_packet_applied_revision_evidence_history',
      isAppliedRevisionEvidenceHistory: true,
      appliedRevisionEvidenceInterventionIds: ['8'],
      integrityWarnings: ['linked_to_retained_applied_revision_evidence'],
    }));
    expect(() => assertOperationalPaymentHistoryRecord(fields, {
      operation: 'export a payment batch',
    })).toThrow(expect.objectContaining({
      code: 'applied_revision_evidence_read_only',
      status: 409,
      interventionIds: ['8'],
    }));
  });

  test('packet target guard rejects a retained-evidence fallback before a downstream write', async () => {
    const evidenceRow = finalApprovedRow({
      id: 8,
      metadata_json: JSON.stringify({
        revisionApplication: { status: 'applied' },
      }),
    });
    const connection = {
      query: jest.fn(async sql => {
        const normalized = String(sql).replace(/\s+/g, ' ').trim();
        if (normalized.startsWith('SELECT id, intervention_id FROM payment_packet')) {
          return [[{ id: 5, intervention_id: 8 }], []];
        }
        if (normalized.startsWith('SELECT id, payment_packet_id, intervention_id, status FROM payment_packet_line')) {
          return [[{
            id: 11,
            payment_packet_id: 5,
            intervention_id: null,
            status: 'approved',
          }], []];
        }
        if (normalized.includes('FROM iset_case_intervention')) {
          return [[evidenceRow], []];
        }
        throw new Error(`unexpected payment guard query: ${normalized}`);
      }),
    };

    await expect(assertOperationalPaymentPacketTargets({
      packetId: 5,
      lineId: 11,
      connection,
      operation: 'record a payment follow-up',
    })).rejects.toMatchObject({
      code: 'applied_revision_evidence_read_only',
      status: 409,
    });
    expect(connection.query.mock.calls.some(([sql]) => /\b(UPDATE|INSERT|DELETE)\b/i.test(sql))).toBe(false);
  });

  test('final approval is valid only for the exact workflow subject and application', () => {
    expect(resolveExactFinalApprovedInterventionWorkflow(finalApprovedRow())).toMatchObject({
      eligible: true,
      workflowId: 701,
      proposalId: 801,
      applicationId: 123,
    });

    expect(resolveExactFinalApprovedInterventionWorkflow(finalApprovedRow({
      review_workflow_proposal_id: 999,
    }))).toEqual(expect.objectContaining({
      eligible: false,
      reason: 'workflow_scope_mismatch',
    }));
    expect(resolveExactFinalApprovedInterventionWorkflow(finalApprovedRow({
      review_workflow_current_stage: 'nwac_review',
    }))).toEqual(expect.objectContaining({
      eligible: false,
      reason: 'workflow_not_final_approved',
    }));
    expect(resolveExactFinalApprovedInterventionWorkflow(finalApprovedRow({
      review_workflow_nwac_decision: 'changes_requested',
    }))).toEqual(expect.objectContaining({
      eligible: false,
      reason: 'workflow_not_final_approved',
    }));
  });

  test('proposal-letter eligibility is gated by that exact final-approved workflow', () => {
    expect(resolveApprovedInterventionProposalLetterEligibilityFromRow(
      finalApprovedRow()
    )).toMatchObject({
      eligible: true,
      proposalKind: 'new',
      reason: 'approved_proposal_final_workflow',
      workflowId: 701,
    });
    expect(resolveApprovedInterventionProposalLetterEligibilityFromRow(
      finalApprovedRow({ review_workflow_intervention_id: 999 })
    )).toMatchObject({
      eligible: false,
      reason: 'workflow_scope_mismatch',
    });
    expect(resolveApprovedInterventionProposalLetterEligibilityFromRow(
      finalApprovedRow({ review_workflow_current_stage: 'nwac_review' })
    )).toMatchObject({
      eligible: false,
      reason: 'workflow_not_final_approved',
    });
  });

  test('close fails closed without an approved state and its exact final-approved workflow', () => {
    expect(assertInterventionCloseAllowed(finalApprovedRow())).toMatchObject({
      enforced: true,
      workflowId: 701,
    });
    expect(() => assertInterventionCloseAllowed(finalApprovedRow({
      status: 'submitted',
      delivery_status: null,
      proposal_review_status: 'submitted',
    }))).toThrow(expect.objectContaining({
      code: 'intervention_close_requires_final_approval',
      status: 409,
    }));
    expect(() => assertInterventionCloseAllowed(finalApprovedRow({
      review_workflow_current_stage: 'nwac_review',
    }))).toThrow(expect.objectContaining({
      code: 'intervention_close_requires_final_approval',
      status: 409,
    }));

    expect(assertInterventionCloseAllowed({
      id: 20,
      status: 'in_progress',
      delivery_status: 'in_progress',
      metadata_json: JSON.stringify({ source: 'manual_backload' }),
    })).toEqual({ enforced: false, reason: 'manual_backload' });
  });

  test('delete is restricted to the original creator draft or System Administrator support', () => {
    const draft = {
      id: 7,
      status: 'draft',
      delivery_status: null,
      created_by_staff_profile_id: 54,
      review_workflow_id: null,
      review_workflow_current_stage: null,
    };
    expect(assertInterventionDeleteAllowed({
      interventionRow: draft,
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
    })).toEqual({ enforced: true, reason: 'draft_creator' });
    expect(assertInterventionDeleteAllowed({
      interventionRow: { ...draft, created_by_staff_profile_id: 54 },
      actorStaffProfileId: 999,
      actorRole: 'System Administrator',
    })).toEqual({ enforced: true, reason: 'system_administrator_support' });
    expect(assertInterventionDeleteAllowed({
      interventionRow: {
        ...draft,
        review_workflow_id: 701,
        review_workflow_current_stage: 'withdrawn',
      },
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
    })).toEqual({ enforced: true, reason: 'withdrawn_creator' });
    expect(() => assertInterventionDeleteAllowed({
      interventionRow: { ...draft, status: 'submitted' },
      actorStaffProfileId: 54,
      actorRole: 'ISET Coordinator',
    })).toThrow(expect.objectContaining({ code: 'intervention_delete_forbidden', status: 409 }));
    expect(() => assertInterventionDeleteAllowed({
      interventionRow: draft,
      actorStaffProfileId: 88,
      actorRole: 'Regional Manager',
    })).toThrow(expect.objectContaining({ code: 'intervention_delete_actor_forbidden', status: 403 }));
  });

  test('a stale locked core row aborts before mutation', () => {
    expect(() => assertInterventionDecisionCoreVersionCurrent(
      finalApprovedRow({ updated_at: '2026-08-09 12:00:00' }),
      finalApprovedRow({ updated_at: '2026-08-09 12:00:01' })
    )).toThrow(expect.objectContaining({
      code: 'intervention_decision_stale',
      status: 409,
    }));
  });

  test('failure after staged intervention/proposal writes rolls the whole core transaction back', async () => {
    const durable = { intervention: 'submitted', proposal: 'submitted', workflow: 'nwac_review', noteCount: 0 };
    let staged = null;
    const connection = {
      beginTransaction: jest.fn(async () => { staged = { ...durable }; }),
      commit: jest.fn(async () => { Object.assign(durable, staged); staged = null; }),
      rollback: jest.fn(async () => { staged = null; }),
      release: jest.fn(),
    };
    const connectionPool = { getConnection: jest.fn(async () => connection) };

    await expect(runInterventionDecisionCoreTransaction(connectionPool, async () => {
      staged.intervention = 'approved';
      staged.proposal = 'approved';
      throw Object.assign(new Error('workflow_event_write_failed'), { code: 'workflow_event_write_failed' });
    })).rejects.toMatchObject({ code: 'workflow_event_write_failed' });

    expect(durable).toEqual({
      intervention: 'submitted',
      proposal: 'submitted',
      workflow: 'nwac_review',
      noteCount: 0,
    });
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('a two-item approved proposal materializes its additional item inside the core transaction', async () => {
    const transaction = buildMaterializationTransaction();
    const sourceInterventionRow = finalApprovedRow({
      metadata_json: JSON.stringify({
        proposedInterventions: [
          {
            id: 'primary-item',
            code: '1',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
            cost: 100,
          },
          {
            id: 'additional-item',
            code: '2',
            startDate: '2026-09-08',
            endDate: '2026-09-12',
            cost: 125,
            costLines: [{ id: 'line-2', type: 'tuition', amount: 125 }],
          },
        ],
        rationale: 'Approved two-item proposal.',
        review: {
          decision: 'approved',
          decisionNotes: 'Approved as submitted.',
        },
      }),
      created_by_staff_profile_id: 54,
    });

    const result = await runInterventionDecisionCoreTransaction(
      transaction.connectionPool,
      connection => materializeApprovedInterventionProposalAdditionalItems(connection, {
        sourceInterventionRow,
        sourceReviewWorkflow: finalApprovedWorkflow(),
        actionPlanId: 3,
        caseId: 76,
        potId: 44,
        postingContext: 'external',
        reviewedByStaffProfileId: 91,
      })
    );

    expect(result).toMatchObject([{
      interventionId: 9,
      sourceItemId: 'additional-item',
      replayed: false,
    }]);
    expect(transaction.connection.commit).toHaveBeenCalledTimes(1);
    expect(transaction.connection.rollback).not.toHaveBeenCalled();
    expect(transaction.durableRows).toHaveLength(1);
    expect(JSON.parse(transaction.durableRows[0].metadata_json)).toMatchObject({
      review: { decision: 'approved' },
      approvalMaterialization: {
        sourceInterventionId: 7,
        sourceItemId: 'additional-item',
        sourceWorkflowId: 701,
      },
    });
  });

  test('an invalid additional item aborts materialization and rolls back before commit', async () => {
    const transaction = buildMaterializationTransaction();
    const sourceInterventionRow = finalApprovedRow({
      metadata_json: JSON.stringify({
        proposedInterventions: [
          {
            id: 'primary-item',
            code: '1',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
            cost: 100,
          },
          {
            id: 'invalid-additional-item',
            code: null,
            startDate: '2026-09-08',
            endDate: '2026-09-12',
            cost: 125,
          },
        ],
        review: { decision: 'approved' },
      }),
      created_by_staff_profile_id: 54,
    });

    await expect(runInterventionDecisionCoreTransaction(
      transaction.connectionPool,
      connection => materializeApprovedInterventionProposalAdditionalItems(connection, {
        sourceInterventionRow,
        sourceReviewWorkflow: finalApprovedWorkflow(),
        actionPlanId: 3,
        caseId: 76,
        potId: 44,
        reviewedByStaffProfileId: 91,
      })
    )).rejects.toMatchObject({
      code: 'approved_intervention_source_item_invalid',
      status: 409,
    });

    expect(transaction.connection.commit).not.toHaveBeenCalled();
    expect(transaction.connection.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.durableRows).toEqual([]);
    expect(
      transaction.connection.query.mock.calls.some(([sql]) => (
        String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO iset_case_intervention')
      ))
    ).toBe(false);
  });

  test('approved-item replay returns one exact row and conflicts on historical duplicates', async () => {
    const approvedSourceItem = {
      id: 'additional-item',
      code: '2',
      startDate: '2026-09-08',
      endDate: '2026-09-12',
      cost: 125,
      costLines: [{ id: 'line-2', type: 'tuition', amount: 125 }],
    };
    const exactRow = {
      id: 9,
      case_id: 76,
      action_plan_id: 3,
      status: 'approved',
      delivery_status: 'planned',
      metadata_json: JSON.stringify({
        approvalMaterialization: {
          sourceInterventionId: 7,
          sourceItemId: 'additional-item',
          sourceWorkflowId: 701,
        },
        proposedInterventions: [approvedSourceItem],
      }),
    };
    expect(assertApprovedInterventionMaterializationReplayMatches(exactRow, {
      sourceItem: approvedSourceItem,
      sourceWorkflowId: 701,
    })).toEqual({ enforced: true, reason: 'exact_materialization_replay' });

    expect(() => assertApprovedInterventionMaterializationReplayMatches({
      ...exactRow,
      metadata_json: JSON.stringify({
        approvalMaterialization: {
          sourceInterventionId: 7,
          sourceItemId: 'additional-item',
          sourceWorkflowId: 701,
        },
        proposedInterventions: [{ ...approvedSourceItem, cost: 999, costLines: [] }],
      }),
    }, {
      sourceItem: approvedSourceItem,
      sourceWorkflowId: 701,
    })).toThrow(expect.objectContaining({
      code: 'approved_intervention_materialization_conflict',
      status: 409,
    }));

    const connection = { query: jest.fn(async () => [[exactRow], []]) };
    await expect(findApprovedInterventionMaterializationReplay(connection, {
      caseId: 76,
      actionPlanId: 3,
      sourceInterventionId: 7,
      sourceItemId: 'additional-item',
      forUpdate: true,
    })).resolves.toMatchObject({ id: 9 });
    expect(connection.query.mock.calls[0][0]).toContain('FOR UPDATE');

    connection.query.mockResolvedValueOnce([[exactRow, { ...exactRow, id: 10 }], []]);
    await expect(findApprovedInterventionMaterializationReplay(connection, {
      caseId: 76,
      actionPlanId: 3,
      sourceInterventionId: 7,
      sourceItemId: 'additional-item',
    })).rejects.toMatchObject({
      code: 'approved_intervention_materialization_duplicate',
      status: 409,
    });
  });

  test('route contract keeps all decision core writes and additional items inside one transaction', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const start = source.indexOf("app.patch('/api/interventions/:id'");
    const end = source.indexOf("app.post('/api/interventions/:id/close'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const route = source.slice(start, end);
    const transactionStart = route.indexOf('runInterventionDecisionCoreTransaction(pool');
    const transactionEnd = route.indexOf('const payload = mapInterventionRow', transactionStart);
    const core = route.slice(transactionStart, transactionEnd);

    expect(core).toContain('fetchInterventionWithCase(interventionId, connection');
    expect(core).toContain('connection.query(sql, params)');
    expect(core).toContain('syncInterventionProposalCompatibility(coreUpdatedRow, connection)');
    expect(core).toContain('applyInterventionReviewWorkflowAction(connection');
    expect(core).toContain('insertReviewWorkflowCaseNote(connection, req');
    expect(core).toContain("status = 'approved'");
    expect(core).toContain("delivery_status = 'planned'");
    expect(core).toContain("status: 'applied'");
    expect(core).toContain('materializeApprovedInterventionProposalAdditionalItems(connection');
    expect(core).not.toContain('applyInterventionReviewWorkflowAction(pool');
    expect(core).not.toContain('insertReviewWorkflowCaseNote(pool');

    const potValidation = route.indexOf('await ensureChargeablePot({');
    expect(potValidation).toBeGreaterThanOrEqual(0);
    expect(potValidation).toBeLessThan(transactionStart);

    expect(route).toContain(
      'isApplyingApprovedRevision && !canApplyApprovedInterventionRevision(req)'
    );
  });

  test('close/delete routes invoke fail-closed guards before their first mutation', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const closeStart = source.indexOf("app.post('/api/interventions/:id/close'");
    const deleteStart = source.indexOf("app.post('/api/interventions/:id/delete'", closeStart);
    const deleteEnd = source.indexOf("app.post('/api/action-plans/:id/close'", deleteStart);
    const closeRoute = source.slice(closeStart, deleteStart);
    const deleteRoute = source.slice(deleteStart, deleteEnd);

    expect(closeRoute.indexOf('assertOperationalInterventionRow')).toBeLessThan(
      closeRoute.indexOf('assertInterventionCloseAllowed')
    );
    expect(closeRoute.indexOf('assertInterventionCloseAllowed')).toBeLessThan(
      closeRoute.indexOf('UPDATE iset_case_intervention')
    );
    expect(deleteRoute.indexOf('assertOperationalInterventionRow')).toBeLessThan(
      deleteRoute.indexOf('assertInterventionDeleteAllowed')
    );
    expect(deleteRoute.indexOf('assertInterventionDeleteAllowed')).toBeLessThan(
      deleteRoute.indexOf('DELETE FROM payment_packet')
    );
    expect(deleteRoute).not.toContain('only_deletable_interventions_allowed');
  });

  test('operational read APIs and queues partition retained revision evidence', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const workspaceStart = source.indexOf("app.get('/api/cases/:id/workspace'");
    const workspaceEnd = source.indexOf("app.post('/api/cases/:id/validate-ilmp'", workspaceStart);
    const workspaceRoute = source.slice(workspaceStart, workspaceEnd);
    expect(workspaceRoute).toContain('partitionAppliedRevisionEvidenceRows(interventionRows)');
    expect(workspaceRoute).toContain('operationalInterventionRows.forEach');
    expect(workspaceRoute).toContain('mapped.interventionCount = interventions.length');
    expect(workspaceRoute).toContain('mapped.appliedRevisionEvidence = appliedRevisionEvidence');
    expect(workspaceRoute).toContain('appliedRevisionEvidenceCount: appliedRevisionEvidence.length');

    const planListStart = source.indexOf("app.get('/api/action-plans/:id/interventions'");
    const planListEnd = source.indexOf("app.post('/api/action-plans/:id/interventions'", planListStart);
    const planListRoute = source.slice(planListStart, planListEnd);
    expect(planListRoute).toContain('partitionAppliedRevisionEvidenceRows(rows)');
    expect(planListRoute).toContain('interventions,');
    expect(planListRoute).toContain('appliedRevisionEvidence,');
    expect(planListRoute).toContain('appliedRevisionEvidenceCount: appliedRevisionEvidence.length');

    const approvalStart = source.indexOf("app.get('/api/dashboard/intervention-approval-items'");
    const completionStart = source.indexOf("app.get('/api/dashboard/intervention-completion-items'", approvalStart);
    const milestoneStart = source.indexOf("app.get('/api/dashboard/intervention-milestone-items'", completionStart);
    const paymentProofStart = source.indexOf("app.get('/api/dashboard/payment-proof-due-items'", milestoneStart);
    expect(source.slice(approvalStart, completionStart)).toContain(
      'filterOperationalInterventionRows(rows)'
    );
    expect(source.slice(completionStart, milestoneStart)).toContain(
      "buildOperationalInterventionSql('ci')"
    );
    expect(source.slice(milestoneStart, paymentProofStart)).toContain(
      "buildOperationalInterventionSql('ci')"
    );
  });

  test('edit, activate, close, revise, and delete paths explicitly guard retained evidence', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const reviseStart = source.indexOf("app.post('/api/interventions/:id/revise'");
    const recallStart = source.indexOf("app.post('/api/interventions/:id/assessment/recall'", reviseStart);
    const patchStart = source.indexOf("app.patch('/api/interventions/:id'", recallStart);
    const closeStart = source.indexOf("app.post('/api/interventions/:id/close'", patchStart);
    const deleteStart = source.indexOf("app.post('/api/interventions/:id/delete'", closeStart);
    const reopenStart = source.indexOf("app.post('/api/cases/:id/reopen-recovery'", deleteStart);
    const planActivateStart = source.indexOf("app.post('/api/action-plans/:id/activate'", reopenStart);

    expect(source.slice(reviseStart, recallStart)).toContain(
      "assertOperationalInterventionRow(sourceRow, { operation: 'revise' })"
    );
    expect(source.slice(patchStart, closeStart)).toContain(
      "assertOperationalInterventionRow(interventionRow, { operation: 'edit or activate' })"
    );
    expect(source.slice(closeStart, deleteStart)).toContain(
      "assertOperationalInterventionRow(interventionRow, { operation: 'close' })"
    );
    expect(source.slice(deleteStart, reopenStart)).toContain(
      "assertOperationalInterventionRow(interventionRow, { operation: 'delete' })"
    );
    expect(source.slice(reopenStart, planActivateStart)).toContain(
      "assertOperationalInterventionRow(selectedInterventionRow, { operation: 'reactivate' })"
    );
  });

  test('payment actions fail closed while historical finance reads are integrity-labelled', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const slice = (startMarker, endMarker) => {
      const start = source.indexOf(startMarker);
      const end = source.indexOf(endMarker, start + startMarker.length);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      return source.slice(start, end);
    };

    expect(slice(
      "app.post('/api/finance/payment-communications'",
      "app.get('/api/finance/payment-followups'"
    )).toContain('assertOperationalPaymentPacketTargets');
    expect(slice(
      'async function handleRecordPaymentFollowUp',
      "app.post('/api/finance/payment-packets/:id/follow-up'"
    )).toContain('assertOperationalPaymentPacketTargets');
    expect(slice(
      "app.post('/api/finance/payment-packets/:id/documents'",
      "app.put('/api/finance/payment-documents/:id'"
    )).toContain('assertOperationalPaymentPacketTargets');
    expect(slice(
      "app.put('/api/finance/payment-documents/:id'",
      "app.delete('/api/finance/payment-documents/:id'"
    )).toContain('assertOperationalPaymentPacketTargets');
    expect(slice(
      "app.post('/api/finance/payment-batches'",
      "app.post('/api/finance/payment-batches/:id/status'"
    )).toContain('assertOperationalPaymentPacketTargets');
    expect(slice(
      "app.post('/api/finance/payment-batches/:id/status'",
      "app.post('/api/finance/payment-batches/:id/export'"
    )).toContain('assertOperationalPaymentHistoryRecord');
    expect(slice(
      "app.post('/api/finance/payment-batches/:id/export'",
      "app.get('/api/finance/payment-ledger-export'"
    )).toContain('assertOperationalPaymentHistoryRecord');
    expect(slice(
      'async function createFinanceTransactionForLine',
      'async function fetchPaymentPacketById'
    )).toContain('assertOperationalPaymentInterventionIds');

    expect(slice(
      "app.get('/api/finance/transactions'",
      "app.get('/api/finance/intacct/submissions'"
    )).toContain("recordKind: 'finance_transaction'");
    expect(slice(
      "app.get('/api/finance/intacct/submissions'",
      "app.get('/api/finance/reconciliation/transactions'"
    )).toContain("recordKind: 'intacct_submission'");
    expect(slice(
      "app.get('/api/finance/reconciliation/transactions'",
      "app.post('/api/finance/reconciliation/transactions/request-evidence'"
    )).toContain("recordKind: 'reconciliation_transaction'");
    expect(slice(
      'async function fetchPaymentLedgerExportRows',
      'const buildPacketAttachmentSummary'
    )).toContain("recordKind: 'payment_ledger_transaction'");
  });
});
