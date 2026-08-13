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

describe('application assessment correction-return caller guard', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let applyApplicationAssessmentReviewWorkflowAction;
  let applicationAssessmentCaseContextMutationKinds;
  let classifyApplicationAssessmentMutationRequest;
  let resolveApplicationAssessmentDraftStart;
  let projectApplicationAssessmentCaseContextPatch;
  let assertApplicationAssessmentReviewOwnedStatusMutationAllowed;
  let assertApplicationAssessmentMutationStageAllowed;
  let assertApplicationAssessmentPostDecisionCommunicationAllowed;
  let assertApplicationAssessmentReturnedToSubmitterActor;
  let startApplicationAssessmentReviewWorkflow;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      applyApplicationAssessmentReviewWorkflowAction,
      applicationAssessmentCaseContextMutationKinds,
      classifyApplicationAssessmentMutationRequest,
      resolveApplicationAssessmentDraftStart,
      projectApplicationAssessmentCaseContextPatch,
      assertApplicationAssessmentReviewOwnedStatusMutationAllowed,
      assertApplicationAssessmentMutationStageAllowed,
      assertApplicationAssessmentPostDecisionCommunicationAllowed,
      assertApplicationAssessmentReturnedToSubmitterActor,
      startApplicationAssessmentReviewWorkflow,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  test('the real workflow application boundary rejects RM escalation before any write', async () => {
    const queries = [];
    const liveSchemaFaithfulWorkflowRow = {
      id: 17,
      workflow_type: 'application_assessment',
      subject_key: 'application_assessment:application:61',
      case_id: 138,
      application_id: 61,
      action_plan_id: null,
      intervention_id: null,
      proposal_id: null,
      current_stage: 'rm_review',
      current_owner_role: 'Regional Manager',
      current_owner_staff_profile_id: null,
      submitted_by_staff_profile_id: 5697,
      submitted_at: '2026-07-30 21:02:32',
      rm_reviewed_by_staff_profile_id: null,
      rm_reviewed_at: null,
      rm_review_note: null,
      nwac_decided_by_staff_profile_id: null,
      nwac_decided_at: null,
      nwac_decision: null,
      nwac_decision_note: null,
      metadata_json: JSON.stringify({
        source: 'system_admin_post_decision_correction_recovery',
        requiresSubmitterCorrectionReturn: true,
      }),
      archived_at: null,
      created_at: '2026-07-07 19:42:39',
      updated_at: '2026-08-06 12:00:00',
    };
    const connection = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params });
        if (String(sql).includes('FROM iset_review_workflow') && String(sql).includes('subject_key = ?')) {
          return [[liveSchemaFaithfulWorkflowRow], []];
        }
        throw new Error(`unexpected_mutation:${String(sql)}`);
      }),
    };

    await expect(
      applyApplicationAssessmentReviewWorkflowAction(connection, {
        caseId: 138,
        applicationId: 61,
        action: 'rm_submit_to_nwac',
        actorStaffProfileId: 995581,
        actorRole: 'Regional Manager',
        note: 'The unchanged assessment should not move upward.',
      })
    ).rejects.toMatchObject({
      code: 'review_workflow_return_required',
      status: 409,
      publicMessage: expect.stringContaining('Return this reopened assessment'),
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].params).toEqual(['application_assessment:application:61']);
  });

  test('the RM workspace hides escalation and explains the required return', () => {
    const fs = require('fs');
    const source = fs.readFileSync(
      require('path').join(process.cwd(), 'src/widgets/CoordinatorAssessmentWidget.js'),
      'utf8'
    );

    expect(source).toContain('requiresSubmitterCorrectionReturn');
    expect(source).toContain('Submitter correction required');
    expect(source).toContain("!requiresSubmitterCorrectionReturn && (");
    expect(source).toContain('Return this reopened assessment to the original submitter for correction');
  });

  const buildReturnedWorkflowRow = () => ({
    id: 56,
    workflow_type: 'application_assessment',
    subject_key: 'application_assessment:application:123',
    case_id: 76,
    application_id: 123,
    action_plan_id: null,
    intervention_id: null,
    proposal_id: null,
    current_stage: 'returned_to_submitter',
    current_owner_role: 'Submitter',
    current_owner_staff_profile_id: null,
    submitted_by_staff_profile_id: 54,
    submitted_at: '2026-08-01 14:00:00',
    rm_reviewed_by_staff_profile_id: 54,
    rm_reviewed_at: '2026-08-06 12:00:00',
    rm_review_note: 'Please add the requested Financial Overview information.',
    nwac_decided_by_staff_profile_id: 51,
    nwac_decided_at: '2026-08-05 13:00:00',
    nwac_decision: 'changes_requested',
    nwac_decision_note: 'We need household income on the Financial Overview.',
    metadata_json: JSON.stringify({ source: 'application_assessment_review_action' }),
    archived_at: null,
    created_at: '2026-08-01 14:00:00',
    updated_at: '2026-08-06 12:00:00',
  });

  const buildStartReviewConnection = () => {
    const queries = [];
    const returnedWorkflow = buildReturnedWorkflowRow();
    const updatedWorkflow = {
      ...returnedWorkflow,
      current_stage: 'rm_review',
      current_owner_role: 'Regional Manager',
      rm_reviewed_by_staff_profile_id: null,
      rm_reviewed_at: null,
      rm_review_note: null,
      nwac_decided_by_staff_profile_id: null,
      nwac_decided_at: null,
      nwac_decision: null,
      nwac_decision_note: null,
    };
    return {
      queries,
      connection: {
        query: jest.fn(async (sql, params) => {
          const statement = String(sql);
          queries.push({ sql: statement, params });
          if (statement.includes('FROM iset_review_workflow') && statement.includes('subject_key = ?')) {
            return [[returnedWorkflow], []];
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
      },
    };
  };

  test('generic assessment mutation guard denies another staff actor and allows the recorded submitter', () => {
    const workflow = buildReturnedWorkflowRow();

    let denialError = null;
    try {
      assertApplicationAssessmentReturnedToSubmitterActor({
        reviewWorkflow: workflow,
        actorStaffProfileId: 88,
        actorRole: 'Regional Manager',
        assessmentMutationRequested: true,
      });
    } catch (error) {
      denialError = error;
    }
    expect(denialError).toMatchObject({
      code: 'assessment_returned_to_submitter_actor_forbidden',
      status: 403,
    });

    expect(
      assertApplicationAssessmentReturnedToSubmitterActor({
        reviewWorkflow: workflow,
        actorStaffProfileId: 54,
        actorRole: 'Regional Manager',
        assessmentMutationRequested: true,
      })
    ).toEqual({ enforced: true, reason: 'original_submitter' });
  });

  test.each([
    ['rm_review'],
    ['returned_to_rm'],
    ['nwac_review'],
    ['final_decision_recorded'],
  ])('authoritative review stage %s blocks body edits despite lifecycle drift', currentStage => {
    let error = null;
    try {
      assertApplicationAssessmentMutationStageAllowed({
        reviewWorkflow: {
          ...buildReturnedWorkflowRow(),
          current_stage: currentStage,
        },
        assessmentMutationRequested: true,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'assessment_submission_locked',
      status: 409,
    });
  });

  test('returned-to-submitter remains editable before the original-submitter actor guard runs', () => {
    expect(assertApplicationAssessmentMutationStageAllowed({
      reviewWorkflow: buildReturnedWorkflowRow(),
      assessmentMutationRequested: true,
    })).toEqual({ enforced: false, reason: 'stage_allows_assessment_mutation' });
  });

  test('field ownership keeps Decision Maker payloads out of the submitter-body guard', () => {
    expect(classifyApplicationAssessmentMutationRequest({
      assessmentPayloadKeysPresent: [
        'assessment_nwac_review_status',
        'assessment_nwac_review',
        'assessment_nwac_reason',
        'assessment_intervention_pot_id',
      ],
      assessmentReviewStatusProvided: true,
      caseContextMutationKinds: { contentChanged: false, decisionChanged: false, communicationChanged: false },
    })).toMatchObject({
      assessmentBodyMutationRequested: false,
      assessmentDecisionMutationRequested: true,
    });

    expect(classifyApplicationAssessmentMutationRequest({
      assessmentPayloadKeysPresent: [
        'assessment_nwac_review_status',
        'assessment_employment_goals',
      ],
      assessmentReviewStatusProvided: true,
      caseContextMutationKinds: { contentChanged: false, decisionChanged: false, communicationChanged: false },
    })).toMatchObject({
      assessmentBodyMutationRequested: true,
      assessmentDecisionMutationRequested: true,
    });
  });

  test('returned-to-RM correction lock permits only the separate conflict declaration operation', () => {
    const returnedToRmWorkflow = {
      ...buildReturnedWorkflowRow(),
      current_stage: 'returned_to_rm',
    };
    const declarationOnly = classifyApplicationAssessmentMutationRequest({
      assessmentPayloadKeysPresent: [],
      assessmentReviewStatusProvided: false,
      conflictSignatureRequested: true,
      caseContextMutationKinds: { contentChanged: false, decisionChanged: false, communicationChanged: false },
    });

    expect(declarationOnly).toMatchObject({
      assessmentBodyMutationRequested: false,
      assessmentDecisionMutationRequested: false,
      conflictDeclarationMutationRequested: true,
    });
    expect(assertApplicationAssessmentMutationStageAllowed({
      reviewWorkflow: returnedToRmWorkflow,
      assessmentMutationRequested: declarationOnly.assessmentBodyMutationRequested,
    })).toEqual({ enforced: false, reason: 'no_assessment_mutation' });

    const declarationWithAssessmentEdit = classifyApplicationAssessmentMutationRequest({
      assessmentPayloadKeysPresent: ['assessment_employment_goals'],
      assessmentReviewStatusProvided: false,
      conflictSignatureRequested: true,
      caseContextMutationKinds: { contentChanged: false, decisionChanged: false, communicationChanged: false },
    });
    expect(declarationWithAssessmentEdit).toMatchObject({
      assessmentBodyMutationRequested: true,
      conflictDeclarationMutationRequested: true,
    });
    expect(() => assertApplicationAssessmentMutationStageAllowed({
      reviewWorkflow: returnedToRmWorkflow,
      assessmentMutationRequested: declarationWithAssessmentEdit.assessmentBodyMutationRequested,
    })).toThrow(expect.objectContaining({ code: 'assessment_submission_locked' }));
  });

  test('case-context ownership separates post-decision communication from decision and assessment content', () => {
    const existing = {
      applicationAnswers: { goal: 'Existing goal' },
      applicationDecisionLetters: {
        123: {
          assessmentOtherFunding: { involved: false },
          decisionLetterDrafts: { approval: { decision_intro: 'Old draft' } },
        },
      },
    };
    const communicationOnly = {
      ...existing,
      applicationDecisionLetters: {
        123: {
          ...existing.applicationDecisionLetters[123],
          decisionLetterDrafts: { approval: { decision_intro: 'New draft' } },
        },
      },
    };
    expect(applicationAssessmentCaseContextMutationKinds(existing, communicationOnly, 123)).toEqual({
      contentChanged: false,
      decisionChanged: false,
      communicationChanged: true,
    });

    const contentOnly = {
      ...existing,
      applicationDecisionLetters: {
        123: {
          ...existing.applicationDecisionLetters[123],
          assessmentOtherFunding: { involved: true },
        },
      },
    };
    expect(applicationAssessmentCaseContextMutationKinds(existing, contentOnly, 123)).toEqual({
      contentChanged: true,
      decisionChanged: false,
      communicationChanged: false,
    });

    const changedAssessment = {
      ...communicationOnly,
      applicationDecisionLetters: {
        123: {
          ...communicationOnly.applicationDecisionLetters[123],
          assessmentOtherFunding: { involved: true },
        },
      },
    };
    expect(applicationAssessmentCaseContextMutationKinds(existing, changedAssessment, 123)).toEqual({
      contentChanged: true,
      decisionChanged: false,
      communicationChanged: true,
    });

    const reviewerDecision = {
      ...existing,
      applicationDecisionLetters: {
        123: {
          ...existing.applicationDecisionLetters[123],
          assessment_nwac_review_status: 'approve',
        },
      },
    };
    expect(applicationAssessmentCaseContextMutationKinds(existing, reviewerDecision, 123)).toEqual({
      contentChanged: false,
      decisionChanged: true,
      communicationChanged: false,
    });
  });

  test('content-only scoped patches preserve legacy reviewer metadata without claiming a reviewer mutation', () => {
    const existing = {
      applicationAnswers: { goal: 'Existing goal' },
      assessment_nwac_review_status: 'push_back',
      decisionLetterDrafts: { approval: { decision_intro: 'Legacy draft' } },
      applicationDecisionLetters: {
        123: {
          assessmentOtherFunding: { involved: false },
        },
      },
    };
    const incoming = {
      applicationDecisionLetters: {
        123: {
          assessmentOtherFunding: { involved: true },
        },
      },
    };
    const projected = projectApplicationAssessmentCaseContextPatch(existing, incoming, 123);

    expect(projected.assessment_nwac_review_status).toBe('push_back');
    expect(projected.decisionLetterDrafts).toEqual(existing.decisionLetterDrafts);
    expect(projected.applicationDecisionLetters[123].assessmentOtherFunding).toEqual({ involved: true });
    expect(applicationAssessmentCaseContextMutationKinds(existing, projected, 123)).toEqual({
      contentChanged: true,
      decisionChanged: false,
      communicationChanged: false,
    });
  });

  test('an explicit scoped letter patch remains classified as post-decision communication', () => {
    const existing = {
      assessment_nwac_review_status: 'push_back',
      applicationDecisionLetters: {
        123: { assessmentOtherFunding: { involved: false } },
      },
    };
    const incoming = {
      applicationDecisionLetters: {
        123: {
          decisionLetterDrafts: { approval: { decision_intro: 'New draft' } },
        },
      },
    };
    const projected = projectApplicationAssessmentCaseContextPatch(existing, incoming, 123);

    expect(projected).not.toHaveProperty('assessment_nwac_review_status');
    expect(applicationAssessmentCaseContextMutationKinds(existing, projected, 123)).toMatchObject({
      contentChanged: false,
      decisionChanged: false,
      communicationChanged: true,
    });
  });

  test('post-decision communication is allowed only after the final decision boundary', () => {
    expect(assertApplicationAssessmentPostDecisionCommunicationAllowed({
      reviewWorkflow: { current_stage: 'final_decision_recorded' },
      communicationMutationRequested: true,
      decisionOutcome: 'approved',
    })).toEqual({ enforced: true, reason: 'final_decision_workflow_recorded' });

    expect(() => assertApplicationAssessmentPostDecisionCommunicationAllowed({
      reviewWorkflow: { current_stage: 'nwac_review' },
      communicationMutationRequested: true,
      decisionOutcome: 'approved',
    })).toThrow(expect.objectContaining({
      code: 'assessment_communication_not_ready',
      status: 409,
    }));

    expect(assertApplicationAssessmentPostDecisionCommunicationAllowed({
      reviewWorkflow: null,
      communicationMutationRequested: true,
      decisionOutcome: 'denied',
    })).toEqual({ enforced: true, reason: 'legacy_final_decision_recorded' });

    expect(() => assertApplicationAssessmentPostDecisionCommunicationAllowed({
      reviewWorkflow: null,
      communicationMutationRequested: true,
      decisionOutcome: null,
    })).toThrow(expect.objectContaining({ code: 'assessment_communication_not_ready' }));
  });

  test('the generic PUT classifier does not send letter work through Decision Maker authorization', () => {
    expect(classifyApplicationAssessmentMutationRequest({
      assessmentPayloadKeysPresent: [],
      assessmentReviewStatusProvided: false,
      caseContextMutationKinds: {
        contentChanged: false,
        decisionChanged: false,
        communicationChanged: true,
      },
    })).toMatchObject({
      assessmentBodyMutationRequested: false,
      assessmentDecisionMutationRequested: false,
      assessmentCommunicationMutationRequested: true,
    });
  });

  test.each([
    'decisionLetterDrafts',
    'decision_letter_drafts',
    'decisionLetter',
    'decision_letter',
    'decisionLetterPackDrafts',
    'decision_letter_pack_drafts',
    'decisionLetterSent',
    'decision_letter_sent',
    'decisionLetterSentType',
    'decision_letter_sent_type',
    'decisionLetterSentAt',
    'decision_letter_sent_at',
    'fundingDecisionReasonCode',
    'fundingDecisionReasonLabel',
    'fundingDecisionReasonExplanation',
  ])('%s remains post-decision communication rather than a Decision Maker field', key => {
    const existing = {
      applicationDecisionLetters: {
        123: { assessment_nwac_review_status: 'reject' },
      },
    };
    const projected = {
      applicationDecisionLetters: {
        123: {
          assessment_nwac_review_status: 'reject',
          [key]: { denial: 'updated' },
        },
      },
    };

    expect(applicationAssessmentCaseContextMutationKinds(existing, projected, 123)).toEqual({
      contentChanged: false,
      decisionChanged: false,
      communicationChanged: true,
    });
  });

  test('review-owned status transitions allow only the stage owner or explicit support path', () => {
    const base = {
      applicationStatusMutationRequested: true,
      caseStatusMutationRequested: true,
      beforeApplicationStatus: 'pending_approval',
      nextApplicationStatus: 'approved',
      actorRole: 'NWAC Administrator',
    };
    expect(() => assertApplicationAssessmentReviewOwnedStatusMutationAllowed({
      ...base,
      reviewWorkflow: { current_stage: 'rm_review' },
      assessmentReviewStatusProvided: true,
      canRecordDecision: true,
    })).toThrow(expect.objectContaining({ code: 'assessment_review_status_transition_forbidden' }));

    expect(assertApplicationAssessmentReviewOwnedStatusMutationAllowed({
      ...base,
      reviewWorkflow: { current_stage: 'nwac_review' },
      assessmentReviewStatusProvided: true,
      canRecordDecision: true,
    })).toEqual({ enforced: true, reason: 'authorized_review_owned_status_transition' });

    expect(() => assertApplicationAssessmentReviewOwnedStatusMutationAllowed({
      applicationStatusMutationRequested: true,
      reviewWorkflow: { current_stage: 'returned_to_submitter' },
      assessmentSubmittedForWorkflow: false,
      actorRole: 'Regional Manager',
      beforeApplicationStatus: 'in_review',
      nextApplicationStatus: 'pending_approval',
    })).toThrow(expect.objectContaining({ code: 'assessment_review_status_transition_forbidden' }));

    expect(assertApplicationAssessmentReviewOwnedStatusMutationAllowed({
      applicationStatusMutationRequested: true,
      reviewWorkflow: { current_stage: 'returned_to_submitter' },
      assessmentSubmittedForWorkflow: true,
      actorRole: 'Regional Manager',
      beforeApplicationStatus: 'in_review',
      nextApplicationStatus: 'pending_approval',
    })).toEqual({ enforced: true, reason: 'authorized_review_owned_status_transition' });
  });

  test('generic assessment mutation guard leaves docs-only follow-up outside the submitter restriction', () => {
    expect(
      assertApplicationAssessmentReturnedToSubmitterActor({
        reviewWorkflow: buildReturnedWorkflowRow(),
        actorStaffProfileId: 88,
        actorRole: 'Regional Manager',
        assessmentMutationRequested: false,
      })
    ).toEqual({ enforced: false, reason: 'no_assessment_mutation' });
  });

  test('the generic PUT classifier preserves the established eligibility-only correction exception', () => {
    expect(classifyApplicationAssessmentMutationRequest({
      assessmentPayloadKeysPresent: ['assessment_esdc_eligibility'],
      assessmentReviewStatusProvided: false,
      caseContextMutationKinds: { contentChanged: false, decisionChanged: false, communicationChanged: false },
    })).toMatchObject({
      assessmentBodyMutationRequested: false,
      assessmentDecisionMutationRequested: false,
    });
  });

  test('the draft-start boundary reuses the assigned staff member case declaration', async () => {
    const queries = [];
    const connection = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params });
        return [[{
          id: 173,
          declaration_choice: 'no_conflict',
          resolution_outcome: null,
        }], []];
      }),
    };

    await expect(resolveApplicationAssessmentDraftStart(connection, {
      caseId: 187,
      applicationId: 163,
      beforeApplicationStatus: 'submitted',
      assessmentWriteRequested: true,
      assessmentSubmittedForWorkflow: false,
      reviewWorkflow: null,
      actorStaffProfileId: 55,
      actorRole: 'Regional Manager',
      assignedStaffProfileId: 55,
    })).resolves.toEqual({
      shouldStart: true,
      reason: 'first_assessment_write',
      declarationId: 173,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].params).toEqual([187, 55]);
    expect(queries[0].sql).toContain('FROM iset_case_conflict_declaration');
    expect(queries[0].sql).toContain('revoked_at IS NULL');
  });

  test('the draft-start boundary validates direct submission without adding an intermediate status', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        id: 174,
        declaration_choice: 'no_conflict',
        resolution_outcome: null,
      }], []]),
    };

    await expect(resolveApplicationAssessmentDraftStart(connection, {
      caseId: 187,
      applicationId: 163,
      beforeApplicationStatus: 'submitted',
      assessmentWriteRequested: true,
      assessmentSubmittedForWorkflow: true,
      reviewWorkflow: null,
      actorStaffProfileId: 55,
      actorRole: 'Regional Manager',
      assignedStaffProfileId: 55,
    })).resolves.toMatchObject({
      shouldStart: false,
      reason: 'assessment_submits_directly_to_review',
    });
  });

  test('the draft-start boundary fails before declaration lookup for a different staff member', async () => {
    const connection = { query: jest.fn() };

    await expect(resolveApplicationAssessmentDraftStart(connection, {
      caseId: 187,
      applicationId: 163,
      beforeApplicationStatus: 'submitted',
      assessmentWriteRequested: true,
      reviewWorkflow: null,
      actorStaffProfileId: 88,
      actorRole: 'Regional Manager',
      assignedStaffProfileId: 55,
    })).rejects.toMatchObject({
      code: 'assessment_start_forbidden',
      status: 403,
    });
    expect(connection.query).not.toHaveBeenCalled();
  });

  test.each([
    [[], 'conflict_declaration_required'],
    [[{ id: 175, declaration_choice: 'conflict', resolution_outcome: null }], 'conflict_declaration_unresolved'],
  ])('the draft-start boundary rejects a missing or unresolved declaration', async (rows, errorCode) => {
    const connection = { query: jest.fn(async () => [rows, []]) };

    await expect(resolveApplicationAssessmentDraftStart(connection, {
      caseId: 187,
      applicationId: 163,
      beforeApplicationStatus: 'submitted',
      assessmentWriteRequested: true,
      reviewWorkflow: null,
      actorStaffProfileId: 55,
      actorRole: 'Regional Manager',
      assignedStaffProfileId: 55,
    })).rejects.toMatchObject({ code: errorCode, status: 409 });
  });

  test('the draft-start boundary accepts a declared conflict only after it is cleared', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        id: 176,
        declaration_choice: 'conflict',
        resolution_outcome: 'cleared',
      }], []]),
    };

    await expect(resolveApplicationAssessmentDraftStart(connection, {
      caseId: 187,
      applicationId: 163,
      beforeApplicationStatus: 'submitted',
      assessmentWriteRequested: true,
      reviewWorkflow: null,
      actorStaffProfileId: 55,
      actorRole: 'Regional Manager',
      assignedStaffProfileId: 55,
    })).resolves.toMatchObject({ shouldStart: true });
  });

  test('real application start-review boundary denies a different staff actor before any write', async () => {
    const { connection, queries } = buildStartReviewConnection();

    await expect(
      startApplicationAssessmentReviewWorkflow(connection, {
        caseId: 76,
        applicationId: 123,
        actorStaffProfileId: 88,
        actorRole: 'Regional Manager',
        metadata: { source: 'application_assessment_submit' },
      })
    ).rejects.toMatchObject({
      code: 'assessment_returned_to_submitter_actor_forbidden',
      status: 403,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].params).toEqual(['application_assessment:application:123']);
  });

  test('real application start-review boundary allows the dual-role original submitter', async () => {
    const { connection, queries } = buildStartReviewConnection();

    await expect(
      startApplicationAssessmentReviewWorkflow(connection, {
        caseId: 76,
        applicationId: 123,
        actorStaffProfileId: 54,
        actorRole: 'Regional Manager',
        metadata: { source: 'application_assessment_submit' },
      })
    ).resolves.toMatchObject({
      current_stage: 'rm_review',
      submitted_by_staff_profile_id: 54,
    });

    const update = queries.find(entry => entry.sql.includes('UPDATE iset_review_workflow'));
    expect(update).toBeTruthy();
    expect(update.params[7]).toBe(54);
  });

  test('System Administrator can resubmit as technical support without replacing the original submitter', async () => {
    const { connection, queries } = buildStartReviewConnection();

    await expect(
      startApplicationAssessmentReviewWorkflow(connection, {
        caseId: 76,
        applicationId: 123,
        actorStaffProfileId: 999,
        actorRole: 'System Administrator',
        metadata: { source: 'system_administrator_support' },
      })
    ).resolves.toMatchObject({ current_stage: 'rm_review' });

    const update = queries.find(entry => entry.sql.includes('UPDATE iset_review_workflow'));
    const event = queries.find(entry => entry.sql.includes('INSERT INTO iset_review_workflow_event'));
    expect(update.params[7]).toBe(54);
    expect(event.params[6]).toBe(999);
    expect(event.params[7]).toBe('System Administrator');
  });
});
