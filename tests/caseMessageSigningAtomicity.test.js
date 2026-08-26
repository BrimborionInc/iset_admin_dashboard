const { Blob, File } = require('buffer');
const { ReadableStream } = require('stream/web');
const { MessageChannel, MessagePort } = require('worker_threads');
const { createSyntheticTestEnvironment } = require('../scripts/run-test-all');

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
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;
  let validateCaseMessageSigningAttachmentRequest;
  let resolveCaseMessagePositiveIdInput;
  let resolveCaseMessageFundingSigningWorkflowKind;
  let assessCaseMessageSigningWorkflowContract;
  let assertCaseMessageAttendanceInterventionScope;
  let assertCaseMessageFundingFormsPostApproval;
  let resolveCaseMessageApplicationDecisionAuthorization;
  let assertCaseMessageApplicationDecisionLetters;
  let resolveCaseMessageApplicationFundingApproval;
  let validateAutoFundingWorkflowAttachmentResolution;
  let assertUniqueVersionedSigningWorkflowAttachments;
  let resolveEligibleSigningWorkflowRows;
  let resolveAutoFundingFormsAttachments;
  let buildRequiredSigningWorkflowSchemas;
  let filterApplicationScopedVersionRows;
  let filterCfaActionPlanScopedVersionRows;
  let assertTargetVersionLineageConsistent;
  let resolveCfaActionPlanForApplication;
  let resolveVersionSnapshotParticipantUserId;
  let assessSignedVersionBaseline;
  let requireSignedVersionBaseline;
  let resolveLatestSignedVersionBaseline;
  let buildCfaRenderSet;
  let isCaseMessageVersionedParticipantForm;
  let assertCaseMessageVersionedFormClientScope;
  let computeCfaSnapshotSignature;
  let cfaDraftSnapshotMateriallyMatches;
  let assessApplicationScopedCfaDraft;
  let prepareReusableApplicationScopedCfaDraft;
  let findRetainedCfaVersionForActionPlan;
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
  let resolveCaseMessageClientOperationIdInput;
  let buildCaseMessageSendRequestHash;
  let assertCaseMessageLockedApplicantContext;
  let assertCaseMessageSigningReplyApplicantContext;
  let resolveCaseMessageOperationReplay;
  let claimCaseMessageSendOperation;
  let completeCaseMessageSendOperation;
  let resolveCaseSecureMessageTypedApplicantParticipant;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    ({
      validateCaseMessageSigningAttachmentRequest,
      resolveCaseMessagePositiveIdInput,
      resolveCaseMessageFundingSigningWorkflowKind,
      assessCaseMessageSigningWorkflowContract,
      assertCaseMessageAttendanceInterventionScope,
      assertCaseMessageFundingFormsPostApproval,
      resolveCaseMessageApplicationDecisionAuthorization,
      assertCaseMessageApplicationDecisionLetters,
      resolveCaseMessageApplicationFundingApproval,
      validateAutoFundingWorkflowAttachmentResolution,
      assertUniqueVersionedSigningWorkflowAttachments,
      resolveEligibleSigningWorkflowRows,
      resolveAutoFundingFormsAttachments,
      buildRequiredSigningWorkflowSchemas,
      filterApplicationScopedVersionRows,
      filterCfaActionPlanScopedVersionRows,
      assertTargetVersionLineageConsistent,
      resolveCfaActionPlanForApplication,
      resolveVersionSnapshotParticipantUserId,
      assessSignedVersionBaseline,
      requireSignedVersionBaseline,
      resolveLatestSignedVersionBaseline,
      buildCfaRenderSet,
      isCaseMessageVersionedParticipantForm,
      assertCaseMessageVersionedFormClientScope,
      computeCfaSnapshotSignature,
      cfaDraftSnapshotMateriallyMatches,
      assessApplicationScopedCfaDraft,
      prepareReusableApplicationScopedCfaDraft,
      findRetainedCfaVersionForActionPlan,
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
      resolveCaseMessageClientOperationIdInput,
      buildCaseMessageSendRequestHash,
      assertCaseMessageLockedApplicantContext,
      assertCaseMessageSigningReplyApplicantContext,
      resolveCaseMessageOperationReplay,
      claimCaseMessageSendOperation,
      completeCaseMessageSendOperation,
      resolveCaseSecureMessageTypedApplicantParticipant,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
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

  test('explicit Action Plan request scope accepts only one matching positive safe integer', () => {
    expect(resolveCaseMessagePositiveIdInput(184, undefined)).toEqual({
      valid: true,
      value: 184,
    });
    expect(resolveCaseMessagePositiveIdInput(undefined, '184')).toEqual({
      valid: true,
      value: 184,
    });
    expect(resolveCaseMessagePositiveIdInput('184', 184)).toEqual({
      valid: true,
      value: 184,
    });
    expect(resolveCaseMessagePositiveIdInput('1e2', undefined)).toEqual({
      valid: false,
      value: null,
    });
    expect(resolveCaseMessagePositiveIdInput(184.5, undefined)).toEqual({
      valid: false,
      value: null,
    });
    expect(resolveCaseMessagePositiveIdInput(184, 185)).toEqual({
      valid: false,
      value: null,
    });
  });

  test('version snapshots use the client-bound participant rather than a stale or manual submission author', () => {
    expect(resolveVersionSnapshotParticipantUserId({
      clientBoundUserId: 200,
      clientBoundCognitoSub: 'current-participant-sub',
      submissionUserId: 901,
      participantUserId: 200,
      conflictCode: 'participant_scope_conflict',
    })).toBe(200);

    expect(() => resolveVersionSnapshotParticipantUserId({
      clientBoundUserId: 200,
      clientBoundCognitoSub: 'current-participant-sub',
      submissionUserId: 901,
      participantUserId: 901,
      conflictCode: 'participant_scope_conflict',
    })).toThrow('participant_scope_conflict');

    expect(resolveVersionSnapshotParticipantUserId({
      clientBoundUserId: null,
      clientBoundCognitoSub: '   ',
      submissionUserId: 901,
      participantUserId: 901,
      conflictCode: 'participant_scope_conflict',
    })).toBe(901);

    expect(() => resolveVersionSnapshotParticipantUserId({
      clientBoundUserId: null,
      clientBoundCognitoSub: 'current-participant-sub',
      submissionUserId: 901,
      participantUserId: 901,
      conflictCode: 'participant_scope_conflict',
    })).toThrow('participant_scope_conflict');
  });

  test('signed redline baselines require one exact case, series, and authoritative applicant', () => {
    const validSiblingApplicationBaseline = {
      id: 105,
      series_id: 7,
      case_id: 76,
      application_id: 999,
      version_number: 5,
      status: 'signed',
      signed_by_participant_id: 200,
      metadata_json: JSON.stringify({
        case: { id: 76, applicationId: 999, applicantUserId: 200 },
        interventions: [{ id: 1, costTotal: 500 }],
      }),
    };
    const expectedScope = { seriesId: 7, caseId: 76, applicantUserId: 200 };

    expect(assessSignedVersionBaseline(
      validSiblingApplicationBaseline,
      expectedScope
    )).toMatchObject({ eligible: true, reason: 'eligible' });
    expect(requireSignedVersionBaseline(
      validSiblingApplicationBaseline,
      expectedScope,
      { errorCode: 'cfa_signed_baseline_scope_conflict' }
    )).toMatchObject({ row: { id: 105 }, snapshot: { case: { applicantUserId: 200 } } });
    expect(assessSignedVersionBaseline({
      ...validSiblingApplicationBaseline,
      metadata_json: JSON.stringify({
        case: { id: 76, applicationId: 999, applicantUserId: 901 },
      }),
    }, expectedScope)).toMatchObject({ eligible: true, reason: 'eligible' });
    expect(assessSignedVersionBaseline({
      ...validSiblingApplicationBaseline,
      metadata_json: JSON.stringify({
        case: { id: 76, applicationId: 999 },
      }),
    }, expectedScope)).toMatchObject({ eligible: true, reason: 'eligible' });
    expect(assessSignedVersionBaseline({
      ...validSiblingApplicationBaseline,
      signed_by_participant_id: null,
    }, expectedScope)).toMatchObject({ eligible: true, reason: 'eligible' });

    const invalidRows = [
      { ...validSiblingApplicationBaseline, status: 'sent' },
      { ...validSiblingApplicationBaseline, series_id: 8 },
      { ...validSiblingApplicationBaseline, case_id: 77 },
      { ...validSiblingApplicationBaseline, signed_by_participant_id: 901 },
      { ...validSiblingApplicationBaseline, metadata_json: '{invalid' },
      {
        ...validSiblingApplicationBaseline,
        metadata_json: JSON.stringify({
          case: { id: 77, applicationId: 999, applicantUserId: 200 },
        }),
      },
      {
        ...validSiblingApplicationBaseline,
        metadata_json: JSON.stringify({
          case: { id: 76, caseId: 77, applicationId: 999, applicantUserId: 200 },
        }),
      },
      {
        ...validSiblingApplicationBaseline,
        signed_by_participant_id: null,
        metadata_json: JSON.stringify({
          case: { id: 76, applicationId: 999 },
        }),
      },
      {
        ...validSiblingApplicationBaseline,
        signed_by_participant_id: null,
        metadata_json: JSON.stringify({
          case: { id: 76, applicationId: 999, applicantUserId: 901 },
        }),
      },
    ];
    for (const row of invalidRows) {
      expect(assessSignedVersionBaseline(row, expectedScope).eligible).toBe(false);
      expect(() => requireSignedVersionBaseline(
        row,
        expectedScope,
        { errorCode: 'cfa_signed_baseline_scope_conflict' }
      )).toThrow(expect.objectContaining({
        code: 'cfa_signed_baseline_scope_conflict',
      }));
    }

    const latestContradiction = {
      ...validSiblingApplicationBaseline,
      id: 106,
      version_number: 6,
      signed_by_participant_id: 901,
    };
    expect(() => resolveLatestSignedVersionBaseline(
      [latestContradiction, validSiblingApplicationBaseline],
      expectedScope,
      { errorCode: 'cfa_signed_baseline_scope_conflict' }
    )).toThrow(expect.objectContaining({
      code: 'cfa_signed_baseline_scope_conflict',
      baselineReason: 'baseline_signed_participant_mismatch',
    }));
  });

  test('CFA rendering rejects a current-version/series mismatch before token or baseline reads', async () => {
    const connection = {
      query: jest.fn(async sql => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql === 'SELECT series_id, version_number FROM cfa_version WHERE id = ? LIMIT 1') {
          return [[{ series_id: 8, version_number: 4 }], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };
    await expect(buildCfaRenderSet({
      connection,
      snapshot: {
        case: { id: 76, applicantUserId: 200 },
        client: { name: 'Applicant One' },
        interventions: [{ id: 900, code: '110', costTotal: 500 }],
      },
      applicantName: 'Applicant One',
      caseManagerName: 'Regional Manager One',
      caseManagerSignedDate: '2026-08-25',
      cfaVersionId: 104,
      cfaSeriesId: 7,
      supersedesVersionId: 101,
      participantUserId: 200,
      preferParticipantRedline: true,
    })).rejects.toMatchObject({
      code: 'cfa_signed_baseline_scope_conflict',
      baselineReason: 'current_version_series_mismatch',
    });
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('only versioned participant forms require a complete matching application/client link', () => {
    expect(isCaseMessageVersionedParticipantForm({ document_type: 'funding_agreement' })).toBe(true);
    expect(isCaseMessageVersionedParticipantForm({ document_type: 'financial_overview' })).toBe(true);
    expect(isCaseMessageVersionedParticipantForm({ document_type: 'eft_form' })).toBe(false);
    expect(isCaseMessageVersionedParticipantForm({ document_type: 'assessment_approval_letter' })).toBe(false);

    expect(() => assertCaseMessageVersionedFormClientScope({
      applicationClientId: 41,
      caseClientId: 41,
    })).not.toThrow();
    for (const scope of [
      { applicationClientId: null, caseClientId: 41 },
      { applicationClientId: 41, caseClientId: null },
      { applicationClientId: 41, caseClientId: 42 },
    ]) {
      expect(() => assertCaseMessageVersionedFormClientScope(scope)).toThrow(expect.objectContaining({
        httpStatus: 409,
        publicError: 'versioned_form_client_scope_conflict',
      }));
    }
  });

  test('an immutable message has exactly one directed applicant actor', () => {
    expect(resolveCaseSecureMessageTypedApplicantParticipant({
      sender_actor_type: 'applicant_user',
      sender_user_id: 200,
      recipient_actor_type: 'staff_profile',
      recipient_user_id: 300,
    })).toEqual({ userId: 200, conflict: false });
    expect(resolveCaseSecureMessageTypedApplicantParticipant({
      sender_actor_type: 'applicant_user',
      sender_user_id: 200,
      recipient_actor_type: 'applicant_user',
      recipient_user_id: 200,
    })).toEqual({ userId: null, conflict: true });
    expect(resolveCaseSecureMessageTypedApplicantParticipant({
      sender_actor_type: 'applicant_user',
      sender_user_id: 200,
      recipient_actor_type: 'applicant_user',
      recipient_user_id: 201,
    })).toEqual({ userId: null, conflict: true });
  });

  test('optional secure-message operation IDs are exact ASCII tokens and never permit a NULL actor claim', async () => {
    expect(resolveCaseMessageClientOperationIdInput(
      '6cc6a0e8-4383-4b04-a0e5-d335578ea8f1',
      undefined
    )).toEqual({
      valid: true,
      value: '6cc6a0e8-4383-4b04-a0e5-d335578ea8f1',
    });
    expect(resolveCaseMessageClientOperationIdInput('stable-key-01', 'stable-key-02'))
      .toEqual({ valid: false, value: null });
    expect(resolveCaseMessageClientOperationIdInput('bad key', undefined))
      .toEqual({ valid: false, value: null });

    const connection = { query: jest.fn() };
    await expect(claimCaseMessageSendOperation(connection, {
      clientOperationId: 'stable-key-01',
      requestSha256: 'a'.repeat(64),
      senderUserId: null,
      caseId: 76,
    })).rejects.toThrow('message_send_operation_scope_invalid');
    expect(connection.query).not.toHaveBeenCalled();
  });

  test('secure-message operation hash binds client intent but not the mutable server-resolved applicant', () => {
    const base = {
      caseId: 76,
      applicationId: 123,
      senderUserId: 41,
      recipientUserId: 88,
      subject: 'Letter of Approval',
      body: 'Please review the attached letter.',
      urgent: false,
      toDisplayName: 'Applicant One',
      fromDisplayName: 'Regional Manager One',
      attachments: [{ workflow_id: 46, due_at: null, financial_overview_mode: 'prefill' }],
      interventionId: null,
      actionPlanId: 184,
      expectedApplicationRowVersion: 9,
      replyToMessageId: null,
    };
    const first = buildCaseMessageSendRequestHash(base);
    const reordered = buildCaseMessageSendRequestHash({
      ...base,
      attachments: [{ financial_overview_mode: 'prefill', due_at: null, workflow_id: 46 }],
    });
    expect(first).toBe(reordered);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(buildCaseMessageSendRequestHash({ ...base, recipientUserId: 89 })).toBe(first);
    expect(buildCaseMessageSendRequestHash({ ...base, body: 'Changed body' })).not.toBe(first);
    expect(buildCaseMessageSendRequestHash({ ...base, applicationId: 124 })).not.toBe(first);
    expect(buildCaseMessageSendRequestHash({ ...base, expectedApplicationRowVersion: 10 })).not.toBe(first);
  });

  test('the write-transaction applicant lock rejects a relink before any send claim or write', () => {
    const preflightContext = {
      case_id: 76,
      application_id: null,
      client_id: 501,
      application_client_id: null,
      applicant_user_id: 200,
      applicant_resolution_conflict: false,
    };
    expect(assertCaseMessageLockedApplicantContext({
      preflightContext,
      lockedContext: { ...preflightContext },
    })).toEqual(preflightContext);
    expect(() => assertCaseMessageLockedApplicantContext({
      preflightContext,
      lockedContext: { ...preflightContext, applicant_user_id: 201 },
    })).toThrow(expect.objectContaining({
      httpStatus: 409,
      publicError: 'applicant_account_changed',
      retrySafe: true,
    }));
    expect(() => assertCaseMessageLockedApplicantContext({
      preflightContext,
      lockedContext: { ...preflightContext, client_id: 502 },
    })).toThrow(expect.objectContaining({
      httpStatus: 409,
      publicError: 'message_send_scope_changed',
      retrySafe: true,
    }));
    expect(assertCaseMessageLockedApplicantContext({
      preflightContext,
      lockedContext: { ...preflightContext, applicant_user_id: 201 },
      immutableReply: true,
    })).toEqual({ ...preflightContext, applicant_user_id: 201 });

    expect(assertCaseMessageSigningReplyApplicantContext({
      replyTargetApplicantUserId: 200,
      messagingContext: { ...preflightContext, applicant_user_id: 201 },
      hasSigningAttachments: false,
    })).toEqual({ ...preflightContext, applicant_user_id: 201 });
    expect(assertCaseMessageSigningReplyApplicantContext({
      replyTargetApplicantUserId: 200,
      messagingContext: preflightContext,
      hasSigningAttachments: true,
    })).toEqual(preflightContext);
    expect(() => assertCaseMessageSigningReplyApplicantContext({
      replyTargetApplicantUserId: 200,
      messagingContext: { ...preflightContext, applicant_user_id: 201 },
      hasSigningAttachments: true,
    })).toThrow(expect.objectContaining({
      httpStatus: 409,
      publicError: 'signing_reply_participant_changed',
      retrySafe: false,
      manualReviewRequired: false,
    }));
  });

  test('a completed operation replays its exact response and rejects body/application drift', async () => {
    const rows = new Map();
    let nextId = 1;
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql.startsWith('INSERT INTO message_send_operation ')) {
          const [clientOperationId, requestSha256, senderUserId, senderStaffProfileId, caseId, applicationId] = params;
          const key = `${senderUserId}:${caseId}:${clientOperationId}`;
          if (!rows.has(key)) {
            rows.set(key, {
              id: nextId++,
              client_operation_id: clientOperationId,
              request_sha256: requestSha256,
              sender_user_id: senderUserId,
              sender_staff_profile_id: senderStaffProfileId,
              case_id: caseId,
              application_id: applicationId,
              message_id: null,
              response_status: null,
              response_json: null,
              completed_at: null,
            });
          }
          return [{ affectedRows: 1 }, []];
        }
        if (normalizedSql.includes('FROM message_send_operation AS mso')) {
          const [senderUserId, caseId, clientOperationId] = params;
          return [[rows.get(`${senderUserId}:${caseId}:${clientOperationId}`) || null], []];
        }
        if (normalizedSql.startsWith('UPDATE message_send_operation ')) {
          const [messageId, responseStatus, responseJson, operationId] = params;
          const row = Array.from(rows.values()).find(candidate => candidate.id === operationId);
          if (!row || row.message_id || row.completed_at) return [{ affectedRows: 0 }, []];
          Object.assign(row, {
            message_id: messageId,
            response_status: responseStatus,
            response_json: responseJson,
            completed_at: '2026-08-25T12:00:00.000Z',
          });
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };
    const requestSha256 = 'a'.repeat(64);
    const scope = {
      clientOperationId: 'stable-key-01',
      requestSha256,
      senderUserId: 41,
      senderStaffProfileId: 17,
      caseId: 76,
      applicationId: 123,
    };
    const first = await claimCaseMessageSendOperation(connection, scope);
    expect(first).toEqual({ replay: false, operationId: 1 });
    const responseBody = { message: 'Message sent', messageId: 701, replyToMessageId: null };
    await completeCaseMessageSendOperation(connection, {
      operationId: first.operationId,
      messageId: 701,
      responseStatus: 201,
      responseBody,
    });
    await expect(claimCaseMessageSendOperation(connection, scope)).resolves.toEqual({
      replay: true,
      operationId: 1,
      messageId: 701,
      responseStatus: 201,
      responseBody,
    });
    expect(() => resolveCaseMessageOperationReplay(Array.from(rows.values())[0], {
      applicationId: 123,
      requestSha256: 'b'.repeat(64),
    })).toThrow(expect.objectContaining({
      publicError: 'message_send_operation_payload_conflict',
      httpStatus: 409,
    }));
    expect(() => resolveCaseMessageOperationReplay(Array.from(rows.values())[0], {
      applicationId: 124,
      requestSha256,
    })).toThrow(expect.objectContaining({
      publicError: 'message_send_operation_payload_conflict',
      httpStatus: 409,
    }));
  });

  test('attendance intervention scope requires the selected application while leaving other message operations untouched', () => {
    const exactIntervention = {
      id: 777,
      case_id: 76,
      proposal_application_id: null,
      action_plan_application_id: 123,
      resolved_application_case_id: 76,
      review_workflow_application_id: 123,
    };

    expect(assertCaseMessageAttendanceInterventionScope({
      interventionRow: exactIntervention,
      caseId: 76,
      applicationId: 123,
    })).toEqual({
      interventionId: 777,
      caseId: 76,
      applicationId: 123,
    });

    [
      {
        name: 'sibling application',
        row: {
          ...exactIntervention,
          action_plan_application_id: 124,
          resolved_application_case_id: 76,
          review_workflow_application_id: 124,
        },
      },
      {
        name: 'applicationless Action Plan',
        row: {
          ...exactIntervention,
          proposal_application_id: null,
          action_plan_application_id: null,
          resolved_application_case_id: null,
          review_workflow_application_id: null,
        },
      },
      {
        name: 'different case',
        row: {
          ...exactIntervention,
          case_id: 77,
          resolved_application_case_id: 77,
        },
      },
      {
        name: 'conflicting proposal and Action Plan lineage',
        row: {
          ...exactIntervention,
          proposal_application_id: 124,
          action_plan_application_id: 123,
        },
      },
    ].forEach(({ name, row }) => {
      expect(() => assertCaseMessageAttendanceInterventionScope({
        interventionRow: row,
        caseId: 76,
        applicationId: 123,
      })).toThrow(expect.objectContaining({
        publicError: 'attendance_intervention_application_scope_conflict',
        httpStatus: 422,
        publicDetails: expect.objectContaining({
          interventionId: 777,
          applicationId: 123,
          retrySafe: false,
          manualReviewRequired: false,
        }),
      }));
    });
  });

  test('funding classification recognizes canonical and unsafe alias definitions', () => {
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

  test('secure-message workflow contract matrix is operation-specific and canonical', () => {
    const matrix = [
      ['missing workflow id', 'active', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_ineligible', null],
      ['nonpositive workflow id', 'active', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_ineligible', 0],
      ['ordinary consent', 'active', 'consent-no-prefill', 'general_consent', true, null],
      ['approval letter', 'active', 'consent-no-prefill', 'assessment_approval_letter', true, null],
      ['denial letter', 'active', 'consent-no-prefill', 'assessment_denial_letter', true, null],
      ['canonical funding', 'active', 'consent-cm-prefill', 'funding_agreement', true, null],
      ['canonical financial overview', 'active', 'consent-cm-prefill', 'financial_overview', true, null],
      ['canonical attendance', 'active', 'consent-cm-prefill', 'attendance_form', true, null],
      ['canonical EFT', 'active', 'consent-no-prefill', 'eft_form', true, null],
      ['MOU/Co-Funding Agreement Letter', 'active', 'consent-no-prefill', 'mou_co_funding_agreement_letter', true, null],
      ['inactive consent', 'inactive', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_inactive'],
      ['wrong general type', 'active', 'main-intake', 'general_consent', false, 'signing_workflow_ineligible'],
      ['wrong funding mode', 'active', 'consent-no-prefill', 'funding_agreement', false, 'signing_workflow_mode_unsupported'],
      ['wrong financial mode', 'active', 'consent-no-prefill', 'financial_overview', false, 'signing_workflow_mode_unsupported'],
      ['wrong attendance mode', 'active', 'consent-no-prefill', 'attendance_form', false, 'signing_workflow_mode_unsupported'],
      ['funding alias', 'active', 'consent-cm-prefill', 'client_funding_agreement', false, 'signing_workflow_document_type_unsupported'],
      ['EFT alias', 'active', 'consent-no-prefill', 'eft_or_wire_transfer_form', false, 'signing_workflow_document_type_unsupported'],
      ['versioned funding alias', 'active', 'consent-cm-prefill', 'funding_agreement_v2', false, 'signing_workflow_document_type_unsupported'],
      ['signed funding alias', 'active', 'consent-cm-prefill', 'signed_funding_agreement', false, 'signing_workflow_document_type_unsupported'],
      ['legacy client funding alias', 'active', 'consent-cm-prefill', 'legacy_client_funding_agreement', false, 'signing_workflow_document_type_unsupported'],
      ['financial form alias', 'active', 'consent-cm-prefill', 'financial_overview_form', false, 'signing_workflow_document_type_unsupported'],
      ['attendance report alias', 'active', 'consent-cm-prefill', 'attendance_report', false, 'signing_workflow_document_type_unsupported'],
      ['electronic transfer alias', 'active', 'consent-no-prefill', 'electronic_funds_transfer_form', false, 'signing_workflow_document_type_unsupported'],
      ['signed EFT alias', 'active', 'consent-no-prefill', 'signed_eft_form', false, 'signing_workflow_document_type_unsupported'],
      ['approval letter alias', 'active', 'consent-no-prefill', 'approval_letter', false, 'signing_workflow_document_type_unsupported'],
      ['versioned approval letter alias', 'active', 'consent-no-prefill', 'assessment_approval_letter_v2', false, 'signing_workflow_document_type_unsupported'],
      ['denial letter alias', 'active', 'consent-no-prefill', 'denial_letter', false, 'signing_workflow_document_type_unsupported'],
      ['ambiguous decision letter', 'active', 'consent-no-prefill', 'decision_letter', false, 'signing_workflow_document_type_unsupported'],
      ['Client Funding Agreement', 'active', 'consent-cm-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Financial Overview', 'active', 'consent-cm-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Client Monthly Attendance Report', 'active', 'consent-cm-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Attendance Form', 'active', 'consent-cm-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['EFT Form', 'active', 'consent-no-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Electronic Funds Transfer Form', 'active', 'consent-no-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Letter of Approval', 'active', 'consent-no-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Letter of Denial', 'active', 'consent-no-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Decision Letter', 'active', 'consent-no-prefill', null, false, 'signing_workflow_document_type_unsupported'],
      ['Letter of Approval', 'active', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['Letter of Denial', 'active', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['Decision Letter', 'active', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['Client Funding Agreement', 'active', 'consent-cm-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['Financial Overview', 'active', 'consent-cm-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['Attendance Form', 'active', 'consent-cm-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['EFT Form', 'active', 'consent-no-prefill', 'general_consent', false, 'signing_workflow_document_type_unsupported'],
      ['Financial Overview', 'active', 'consent-cm-prefill', 'funding_agreement', false, 'signing_workflow_document_type_unsupported'],
    ];

    matrix.forEach(([
      name,
      status,
      workflowType,
      documentType,
      valid,
      expectedError,
      workflowIdOverride,
    ], index) => {
      const assessment = assessCaseMessageSigningWorkflowContract({
        id: typeof workflowIdOverride === 'undefined' ? 100 + index : workflowIdOverride,
        name,
        status,
        workflow_type: workflowType,
        document_type: documentType,
      });
      if (valid) {
        expect(assessment).toMatchObject({
          valid: true,
          workflow: {
            status: 'active',
            workflow_type: workflowType,
            document_type: documentType,
          },
        });
      } else {
        expect(assessment).toMatchObject({
          valid: false,
          error: {
            publicError: expectedError,
            httpStatus: 422,
          },
        });
      }
    });
  });

  test('the proven TEST and PROD consent catalogue remains usable without reopening other draft workflows', () => {
    const catalogue = [
      [41, 'FORM 7 - Consent for use of Image, Video and Audio', 'draft', 'consent-no-prefill', 'media_consent', false],
      [42, 'FORM 6 - Authorisation for release of ISET client information', 'draft', 'consent-no-prefill', 'iset_client_info_release', false],
      [43, 'EFT & Wire Transfer Direct Debit', 'draft', 'consent-no-prefill', 'EFT_form', true],
      [44, 'Client Acknowledgement of Funding Source', 'active', 'consent-no-prefill', 'client_acknowledgement', true],
      [45, 'Client Funding Agreement', 'active', 'consent-cm-prefill', 'funding_agreement', true],
      [46, 'Letter of Approval', 'active', 'consent-cm-prefill', 'assessment_approval_letter', true],
      [47, 'Letter of Denial', 'active', 'consent-cm-prefill', 'assessment_denial_letter', true],
      [49, 'EI Consent Form', 'active', 'consent-no-prefill', 'ei_consent', true],
      [50, 'Indigenous Declaration', 'active', 'consent-no-prefill', 'indigenous_declaration', true],
      [51, 'Conflict of Interest Form', 'active', 'consent-no-prefill', 'conflict_of_interest', true],
      [52, 'Financial Overview', 'active', 'consent-cm-prefill', 'financial_overview', true],
      [54, 'Client Monthly Attendance Report', 'active', 'consent-cm-prefill', 'attendance_form', true],
    ];

    catalogue.forEach(([id, name, status, workflowType, documentType, expectedValid]) => {
      const assessment = assessCaseMessageSigningWorkflowContract({
        id,
        name,
        status,
        workflow_type: workflowType,
        document_type: documentType,
      });
      expect(assessment.valid).toBe(expectedValid);
      if (expectedValid) {
        expect(assessment.workflow).toMatchObject({
          id,
          status,
          workflow_type: workflowType,
          document_type: documentType,
        });
      } else {
        expect(assessment.error).toMatchObject({
          publicError: 'signing_workflow_inactive',
          httpStatus: 422,
        });
      }
    });

    [
      { id: 143, name: 'EFT & Wire Transfer Direct Debit', status: 'draft' },
      { id: 43, name: 'Different EFT Form', status: 'draft' },
      { id: 43, name: 'EFT & Wire Transfer Direct Debit', status: 'inactive' },
    ].forEach(overrides => {
      expect(assessCaseMessageSigningWorkflowContract({
        workflow_type: 'consent-no-prefill',
        document_type: 'EFT_form',
        ...overrides,
      })).toMatchObject({
        valid: false,
        error: {
          publicError: 'signing_workflow_inactive',
          httpStatus: 422,
        },
      });
    });
  });

  test('generic institution and band letters remain eligible while managed decision aliases stay reserved', () => {
    [
      {
        id: 201,
        name: 'Institution Approval Letter',
        document_type: 'institution_approval_letter',
      },
      {
        id: 202,
        name: 'Band Funding Decision Letter',
        document_type: 'band_funding_decision',
      },
      {
        id: 207,
        name: 'Band Funding Decision Letter',
        document_type: 'band_funding_decision_letter',
      },
    ].forEach(workflowRow => {
      expect(assessCaseMessageSigningWorkflowContract({
        ...workflowRow,
        status: 'active',
        workflow_type: 'consent-no-prefill',
      })).toMatchObject({ valid: true });
    });

    [
      { id: 203, name: 'Letter of Approval', document_type: 'general_consent' },
      { id: 204, name: 'Letter of Denial', document_type: null },
      { id: 205, name: 'Approval alias', document_type: 'signed_assessment_approval_letter' },
      { id: 206, name: 'Denial alias', document_type: 'assessment_denial_letter_v2' },
      { id: 208, name: 'Decision alias', document_type: 'assessment_decision_letter_v2' },
      { id: 209, name: 'Signed decision alias', document_type: 'signed_decision_letter' },
    ].forEach(workflowRow => {
      expect(assessCaseMessageSigningWorkflowContract({
        ...workflowRow,
        status: 'active',
        workflow_type: 'consent-no-prefill',
      })).toMatchObject({
        valid: false,
        error: { publicError: 'signing_workflow_document_type_unsupported' },
      });
    });
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
        status: 'active',
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
        status: 'active',
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
        { id: 52, name: 'One', status: 'active', workflow_type: 'consent-no-prefill', document_type: null },
        { id: 52, name: 'Two', status: 'active', workflow_type: 'consent-no-prefill', document_type: null },
      ], []]),
    };
    await expect(resolveEligibleSigningWorkflowRows(duplicateRowsConnection, [
      { workflow_id: 52 },
    ])).rejects.toMatchObject({
      publicError: 'signing_workflow_resolution_ambiguous',
      httpStatus: 409,
    });
  });

  test('inactive, unsupported-mode, and noncanonical funding workflows fail before writes', async () => {
    const cases = [
      {
        workflow: {
          id: 52,
          name: 'Funding agreement',
          status: 'draft',
          workflow_type: 'consent-cm-prefill',
          document_type: 'funding_agreement',
        },
        error: 'signing_workflow_inactive',
      },
      ...[
        ['funding_agreement', 'Funding agreement'],
        ['financial_overview', 'Financial Overview'],
        ['attendance_form', 'Client Monthly Attendance Report'],
      ].map(([documentType, name], index) => ({
        workflow: {
          id: 60 + index,
          name,
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: documentType,
        },
        error: 'signing_workflow_mode_unsupported',
      })),
      ...[
        ['client_funding_agreement', 'Client Funding Agreement'],
        ['eft_or_wire_transfer_direct_deposit_form', 'EFT or Wire Transfer Form'],
        ['funding_agreement_v2', 'Funding Agreement v2'],
        ['signed_funding_agreement', 'Signed Funding Agreement'],
        ['legacy_client_funding_agreement', 'Legacy Client Funding Agreement'],
        ['financial_overview_form', 'Financial Overview Form'],
        ['attendance_report', 'Attendance Report'],
        ['electronic_funds_transfer_form', 'Electronic Funds Transfer Form'],
        ['signed_eft_form', 'Signed EFT Form'],
        ['approval_letter', 'Approval Letter'],
        ['assessment_approval_letter_v2', 'Assessment Approval Letter v2'],
        ['denial_letter', 'Denial Letter'],
        ['decision_letter', 'Decision Letter'],
        [null, 'Client Funding Agreement'],
        [null, 'Financial Overview'],
        [null, 'Client Monthly Attendance Report'],
        [null, 'EFT Form'],
        [null, 'Electronic Funds Transfer Form'],
        [null, 'Letter of Approval'],
        [null, 'Letter of Denial'],
        [null, 'Decision Letter'],
      ].map(([documentType, name], index) => ({
        workflow: {
          id: 70 + index,
          name,
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: documentType,
        },
        error: 'signing_workflow_document_type_unsupported',
      })),
    ];

    for (const scenario of cases) {
      const connection = {
        query: jest.fn(async () => [[scenario.workflow], []]),
      };
      await expect(resolveEligibleSigningWorkflowRows(
        connection,
        [{ workflow_id: scenario.workflow.id }]
      )).rejects.toMatchObject({
        publicError: scenario.error,
        httpStatus: 422,
      });
      expect(connection.query).toHaveBeenCalledTimes(1);
      expect(String(connection.query.mock.calls[0][0])).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE)\b/i);
    }
  });

  test('active canonical funding, financial, attendance, EFT, and generic workflows remain eligible', async () => {
    const rows = [
      { id: 51, name: 'Funding agreement', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'funding_agreement' },
      { id: 52, name: 'Financial Overview', status: 'ACTIVE', workflow_type: 'consent-cm-prefill', document_type: 'financial_overview' },
      { id: 53, name: 'Attendance', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'attendance_form' },
      { id: 54, name: 'EFT', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'eft_form' },
      { id: 55, name: 'Consent', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'general_consent' },
    ];
    const connection = { query: jest.fn(async () => [rows, []]) };

    await expect(resolveEligibleSigningWorkflowRows(
      connection,
      rows.map(row => ({ workflow_id: row.id }))
    )).resolves.toEqual(rows.map(row => ({
      id: row.id,
      name: row.name,
      status: 'active',
      workflow_type: row.workflow_type,
      document_type: row.document_type,
    })));
  });

  test('automatic approval forms prefer active canonical EFT over the exact legacy compatibility row', async () => {
    const connection = {
      query: jest.fn(async () => [[
        { id: 99, name: 'Draft funding', status: 'draft', workflow_type: 'consent-cm-prefill', document_type: 'funding_agreement', updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 98, name: 'Wrong-mode funding', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'funding_agreement', updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 97, name: 'Alias funding', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'client_funding_agreement', updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 52, name: 'Canonical funding', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'funding_agreement', updated_at: '2026-08-25T12:00:00.000Z' },
        { id: 96, name: 'Inactive EFT', status: 'inactive', workflow_type: 'consent-no-prefill', document_type: 'eft_form', updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 95, name: 'Alias EFT', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'eft_or_wire_transfer_form', updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 94, name: 'EFT Form', status: 'active', workflow_type: 'consent-no-prefill', document_type: null, updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 93, name: 'Financial Overview', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'eft_form', updated_at: '2026-08-25T14:00:00.000Z' },
        { id: 0, name: 'Canonical EFT', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'eft_form', updated_at: '2026-08-25T15:00:00.000Z' },
        { id: 43, name: 'EFT & Wire Transfer Direct Debit', status: 'draft', workflow_type: 'consent-no-prefill', document_type: 'EFT_form', updated_at: '2026-08-26T12:00:00.000Z' },
        { id: 53, name: 'Canonical EFT', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'eft_form', updated_at: '2026-08-25T12:00:00.000Z' },
      ], []]),
    };

    await expect(resolveAutoFundingFormsAttachments(connection)).resolves.toEqual({
      attachments: [{ workflow_id: 52 }, { workflow_id: 53 }],
      missing: [],
    });
    expect(String(connection.query.mock.calls[0][0])).toContain('WHERE (status = ? OR id = ?)');
    expect(connection.query.mock.calls[0][1]).toEqual([
      'active',
      43,
      'consent-no-prefill',
      'consent-cm-prefill',
    ]);
  });

  test('automatic approval forms use the exact legacy EFT row when no active canonical EFT exists', async () => {
    const connection = {
      query: jest.fn(async () => [[
        { id: 52, name: 'Client Funding Agreement', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'funding_agreement', updated_at: '2026-08-25T12:00:00.000Z' },
        { id: 43, name: 'EFT & Wire Transfer Direct Debit', status: 'draft', workflow_type: 'consent-no-prefill', document_type: 'EFT_form', updated_at: '2026-01-09T11:33:26.000Z' },
        { id: 142, name: 'Different draft EFT', status: 'draft', workflow_type: 'consent-no-prefill', document_type: 'EFT_form', updated_at: '2026-08-25T14:00:00.000Z' },
      ], []]),
    };

    await expect(resolveAutoFundingFormsAttachments(connection)).resolves.toEqual({
      attachments: [{ workflow_id: 52 }, { workflow_id: 43 }],
      missing: [],
    });
  });

  test('the transactional workflow recheck locks the exact selected catalogue rows', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        id: 52,
        name: 'Financial Overview',
        status: 'active',
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
      status: 'active',
      workflow_type: 'consent-cm-prefill',
      document_type: 'financial_overview',
    }]);
    expect(String(connection.query.mock.calls[0][0]).trim()).toMatch(/FOR UPDATE$/);
    expect(connection.query.mock.calls[0][1]).toEqual([52]);

    const inactiveConnection = {
      query: jest.fn(async () => [[{
        id: 52,
        name: 'Financial Overview',
        status: 'inactive',
        workflow_type: 'consent-cm-prefill',
        document_type: 'financial_overview',
      }], []]),
    };
    await expect(resolveEligibleSigningWorkflowRows(
      inactiveConnection,
      [{ workflow_id: 52 }],
      { forUpdate: true }
    )).rejects.toMatchObject({
      publicError: 'signing_workflow_inactive',
      httpStatus: 422,
    });
    expect(String(inactiveConnection.query.mock.calls[0][0]).trim()).toMatch(/FOR UPDATE$/);
    expect(String(inactiveConnection.query.mock.calls[0][0])).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE)\b/i);
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

  test('duplicate versioned forms and semantic EFT definitions are rejected in one message', () => {
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
    expect(() => assertUniqueVersionedSigningWorkflowAttachments([
      { id: 43, name: 'EFT & Wire Transfer Direct Debit', document_type: 'EFT_form' },
      { id: 53, name: 'Canonical EFT', document_type: 'eft_form' },
    ])).toThrow(expect.objectContaining({
      publicError: 'duplicate_funding_signing_form',
      httpStatus: 422,
    }));
  });

  test('version lineage filtering never selects a sibling application snapshot', () => {
    const rows = [
      { id: 1, metadata_json: JSON.stringify({ case: { applicationId: 123 } }) },
      { id: 2, metadata_json: JSON.stringify({ case: { applicationId: 999 } }) },
      { id: 3, metadata_json: null },
      {
        id: 4,
        application_id: 123,
        metadata_json: JSON.stringify({ case: { applicationId: 123 } }),
      },
      {
        id: 5,
        application_id: null,
        metadata_json: JSON.stringify({ case: { applicationId: 123 } }),
      },
      {
        id: 6,
        application_id: 0,
        metadata_json: JSON.stringify({ case: { applicationId: 123 } }),
      },
    ];
    expect(filterApplicationScopedVersionRows(rows, 123).map(row => row.id)).toEqual([1, 4, 5]);
    expect(filterApplicationScopedVersionRows(rows, 999).map(row => row.id)).toEqual([2]);
    expect(filterApplicationScopedVersionRows(rows, null)).toEqual([]);
  });

  test('CFA plan lineage filtering never selects a sibling plan or legacy unknown row', () => {
    const rows = [
      { id: 1, application_id: 123, action_plan_id: 184, metadata_json: null },
      { id: 2, application_id: 123, action_plan_id: 185, metadata_json: null },
      { id: 3, application_id: 999, action_plan_id: 184, metadata_json: null },
      { id: 4, metadata_json: JSON.stringify({ case: {}, plan: {} }) },
      {
        id: 5,
        metadata_json: JSON.stringify({ case: { applicationId: 123 }, plan: { id: 184 } }),
      },
      {
        id: 6,
        application_id: 123,
        action_plan_id: null,
        metadata_json: JSON.stringify({ case: { applicationId: 123 }, plan: { id: 184 } }),
      },
      {
        id: 7,
        application_id: 123,
        action_plan_id: 0,
        metadata_json: JSON.stringify({ case: { applicationId: 123 }, plan: { id: 184 } }),
      },
    ];
    expect(filterCfaActionPlanScopedVersionRows(rows, 123, 184).map(row => row.id))
      .toEqual([1, 5]);
  });

  test('lineage conflicts block only when they touch the selected application', () => {
    const siblingConflict = {
      id: 1,
      application_id: 999,
      metadata_json: JSON.stringify({ case: { applicationId: 123 } }),
    };
    expect(() => assertTargetVersionLineageConsistent([siblingConflict], {
      applicationId: 123,
      errorCode: 'cfa_application_scope_conflict',
    })).not.toThrow();

    const targetConflict = {
      id: 2,
      application_id: 123,
      metadata_json: JSON.stringify({ case: { applicationId: 999 } }),
    };
    expect(() => assertTargetVersionLineageConsistent([targetConflict], {
      applicationId: 123,
      errorCode: 'cfa_application_scope_conflict',
    })).toThrow('cfa_application_scope_conflict');

    const siblingPlanWithStaleTargetJson = {
      id: 3,
      application_id: 123,
      action_plan_id: 185,
      metadata_json: JSON.stringify({ case: { applicationId: 123 }, plan: { id: 184 } }),
    };
    expect(() => assertTargetVersionLineageConsistent([siblingPlanWithStaleTargetJson], {
      applicationId: 123,
      actionPlanId: 184,
      errorCode: 'cfa_application_scope_conflict',
    })).not.toThrow();

    const siblingPlanWithStaleApplicationJson = {
      id: 31,
      application_id: 123,
      action_plan_id: 185,
      metadata_json: JSON.stringify({ case: { applicationId: 999 }, plan: { id: 184 } }),
    };
    expect(() => assertTargetVersionLineageConsistent([siblingPlanWithStaleApplicationJson], {
      applicationId: 123,
      actionPlanId: 184,
      errorCode: 'cfa_application_scope_conflict',
    })).not.toThrow();

    const modernPlanlessWithStalePlanJson = {
      id: 32,
      application_id: 123,
      action_plan_id: null,
      metadata_json: JSON.stringify({ case: { applicationId: 123 }, plan: { id: 184 } }),
    };
    expect(filterCfaActionPlanScopedVersionRows(
      [modernPlanlessWithStalePlanJson],
      123,
      184
    )).toEqual([]);
    expect(() => assertTargetVersionLineageConsistent([modernPlanlessWithStalePlanJson], {
      applicationId: 123,
      actionPlanId: 184,
      errorCode: 'cfa_application_scope_conflict',
    })).not.toThrow();

    const targetPlanConflict = {
      id: 4,
      application_id: 123,
      action_plan_id: 184,
      metadata_json: JSON.stringify({ case: { applicationId: 123 }, plan: { id: 185 } }),
    };
    expect(() => assertTargetVersionLineageConsistent([targetPlanConflict], {
      applicationId: 123,
      actionPlanId: 184,
      errorCode: 'cfa_application_scope_conflict',
    })).toThrow('cfa_application_scope_conflict');
  });

  test('exact application action-plan resolution ignores legacy and sibling plans', async () => {
    const connection = {
      query: jest.fn(async (_sql, params) => {
        expect(params).toEqual([76, 123]);
        return [[{ id: 184, status: 'draft' }], []];
      }),
    };
    await expect(resolveCfaActionPlanForApplication(connection, {
      caseId: 76,
      applicationId: 123,
      forUpdate: true,
    })).resolves.toEqual({ id: 184, status: 'draft' });
    expect(String(connection.query.mock.calls[0][0])).toContain('application_id = ?');
    expect(String(connection.query.mock.calls[0][0]).trim()).toMatch(/FOR UPDATE$/);
  });

  test('multiple current plans block only the selected application with a stable code', async () => {
    const connection = {
      query: jest.fn(async () => [[
        { id: 184, status: 'draft' },
        { id: 185, status: 'active' },
      ], []]),
    };
    await expect(resolveCfaActionPlanForApplication(connection, {
      caseId: 76,
      applicationId: 123,
    })).rejects.toThrow('cfa_action_plan_selection_required');
  });

  test('an explicit Action Plan is accepted only when its case and application match', async () => {
    const exactConnection = {
      query: jest.fn(async (_sql, params) => {
        expect(params).toEqual([184]);
        return [[{
          id: 184,
          case_id: 76,
          application_id: 123,
          status: 'active',
          archived_at: null,
        }], []];
      }),
    };
    await expect(resolveCfaActionPlanForApplication(exactConnection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      forUpdate: true,
    })).resolves.toEqual({ id: 184, status: 'active' });

    const mismatchConnection = {
      query: jest.fn(async () => [[{
        id: 184,
        case_id: 76,
        application_id: 999,
        status: 'active',
        archived_at: null,
      }], []]),
    };
    await expect(resolveCfaActionPlanForApplication(mismatchConnection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
    })).rejects.toThrow('cfa_action_plan_scope_conflict');
  });

  test('plan-delete evidence lookup is limited to a typed exact Action Plan owner', async () => {
    const retainedConnection = {
      query: jest.fn(async (_sql, params) => {
        expect(params).toEqual([184]);
        return [[{ id: 44, version_number: 3, status: 'signed' }], []];
      }),
    };
    await expect(findRetainedCfaVersionForActionPlan(retainedConnection, 184))
      .resolves.toEqual({ id: 44, versionNumber: 3, status: 'signed' });
    const lookupSql = String(retainedConnection.query.mock.calls[0][0])
      .replace(/\s+/g, ' ')
      .trim();
    expect(lookupSql).toContain('FROM cfa_version');
    expect(lookupSql).toContain('WHERE action_plan_id = ?');
    expect(lookupSql).not.toContain('metadata_json');

    const noExactOwnerConnection = {
      query: jest.fn(async () => [[], []]),
    };
    await expect(findRetainedCfaVersionForActionPlan(noExactOwnerConnection, 184))
      .resolves.toBeNull();
  });

  test('CFA draft reuse preserves the immutable exact draft and supersedes only other unsigned rows in that lineage', async () => {
    const calls = [];
    const freshSnapshot = {
      case: { id: 76, applicationId: 123, applicantUserId: 200 },
      client: { name: 'Applicant One' },
      plan: { id: 184, name: 'Application 123 plan' },
      interventions: [{ id: 900, code: '110', costTotal: 500 }],
      totalsByFundingStream: { EI: 500 },
    };
    const storedSnapshot = {
      ...freshSnapshot,
      case: {
        ...freshSnapshot.case,
        assignedStaffProfileId: 54,
        caseManagerName: 'Regional Manager One',
      },
    };
    const storedHash = computeCfaSnapshotSignature(storedSnapshot).hash;
    const exact = (applicationId, actionPlanId) => JSON.stringify({
      case: { id: 76, applicationId, applicantUserId: 200 },
      plan: { id: actionPlanId },
    });
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql.startsWith('SELECT id FROM cfa_series')) {
          return [[{ id: 7 }], []];
        }
        if (normalizedSql.includes('FROM cfa_version v')) {
          return [[
            { id: 106, series_id: 7, version_number: 6, status: 'draft', application_id: 123, action_plan_id: 185, metadata_json: exact(123, 185), supersedes_version_id: null },
            { id: 107, series_id: 7, version_number: 7, status: 'sent', application_id: 123, action_plan_id: null, metadata_json: exact(123, 184), supersedes_version_id: null },
            { id: 105, series_id: 7, case_id: 76, version_number: 5, status: 'signed', signed_by_participant_id: 200, application_id: 999, action_plan_id: 900, metadata_json: exact(999, 900), supersedes_version_id: 101 },
            { id: 104, series_id: 7, version_number: 4, status: 'draft', application_id: 123, action_plan_id: 184, metadata_json: JSON.stringify(storedSnapshot), snapshot_hash: storedHash, supersedes_version_id: 105 },
            { id: 103, series_id: 7, version_number: 3, status: 'draft', application_id: 999, action_plan_id: 184, metadata_json: exact(999, 184), supersedes_version_id: null },
            { id: 102, series_id: 7, version_number: 2, status: 'sent', application_id: 123, action_plan_id: 184, metadata_json: exact(123, 184), supersedes_version_id: null },
            { id: 101, series_id: 7, version_number: 1, status: 'signed', application_id: 123, action_plan_id: 184, metadata_json: exact(123, 184), supersedes_version_id: null },
            { id: 100, series_id: 7, version_number: 0, status: 'sent', metadata_json: JSON.stringify({ case: {} }), supersedes_version_id: null },
          ], []];
        }
        if (normalizedSql.startsWith('UPDATE cfa_version SET status')) {
          return [{ affectedRows: 1 }, []];
        }
        if (normalizedSql.startsWith('UPDATE signing_request')) {
          return [{ affectedRows: params.length }, []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    const assessment = await assessApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      freshSnapshot,
    });
    expect(assessment).toMatchObject({
      reusable: true,
      reason: 'reusable',
      latestSignedVersionId: 105,
      selectedDraft: { id: 104 },
    });
    expect(calls.some(call => /^(UPDATE|INSERT|DELETE)\b/.test(call.sql))).toBe(false);

    await expect(prepareReusableApplicationScopedCfaDraft(connection, assessment))
      .resolves.toMatchObject({
      id: 104,
      supersedes_version_id: 105,
      reused: true,
    });

    const withdrawal = calls.find(call => call.sql.startsWith('UPDATE cfa_version SET status'));
    expect(withdrawal.params).toEqual([102]);
    const cancellations = calls.filter(call => call.sql.startsWith('UPDATE signing_request'));
    expect(cancellations.map(call => call.params)).toEqual([['102']]);
    expect(calls.some(call => (
      call.params.includes(103) || call.params.includes('103') ||
      call.params.includes(106) || call.params.includes('106') ||
      call.params.includes(107) || call.params.includes('107')
    ))).toBe(false);
    expect(calls.some(call => call.params.includes(100) || call.params.includes('100'))).toBe(false);
    expect(calls.some(call => call.sql.includes('SET supersedes_version_id'))).toBe(false);
  });

  test('an older exact draft is not reused when a newer exact unsigned version exists', async () => {
    const freshSnapshot = {
      case: { id: 76, applicationId: 123, applicantUserId: 200 },
      client: { name: 'Applicant One' },
      plan: { id: 184, name: 'Application 123 plan' },
      interventions: [{ id: 900, code: '110', costTotal: 500 }],
      totalsByFundingStream: { EI: 500 },
    };
    const storedSnapshot = {
      ...freshSnapshot,
      case: {
        ...freshSnapshot.case,
        assignedStaffProfileId: 54,
        caseManagerName: 'Regional Manager One',
      },
    };
    const storedHash = computeCfaSnapshotSignature(storedSnapshot).hash;
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql.startsWith('SELECT id FROM cfa_series')) {
          return [[{ id: 7 }], []];
        }
        if (normalizedSql.includes('FROM cfa_version v')) {
          return [[
            {
              id: 106,
              series_id: 7,
              version_number: 6,
              status: 'sent',
              application_id: 123,
              action_plan_id: 184,
              metadata_json: JSON.stringify(freshSnapshot),
              snapshot_hash: computeCfaSnapshotSignature(freshSnapshot).hash,
              supersedes_version_id: 101,
            },
            {
              id: 104,
              series_id: 7,
              version_number: 4,
              status: 'draft',
              application_id: 123,
              action_plan_id: 184,
              metadata_json: JSON.stringify(storedSnapshot),
              snapshot_hash: storedHash,
              supersedes_version_id: 101,
            },
            {
              id: 101,
              series_id: 7,
              case_id: 76,
              version_number: 1,
              status: 'signed',
              signed_by_participant_id: 200,
              application_id: 123,
              action_plan_id: 184,
              metadata_json: JSON.stringify(freshSnapshot),
              snapshot_hash: computeCfaSnapshotSignature(freshSnapshot).hash,
              supersedes_version_id: null,
            },
          ], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    const assessment = await assessApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      freshSnapshot,
    });
    expect(assessment).toMatchObject({
      reusable: false,
      reason: 'draft_not_latest_unsigned',
      selectedDraft: { id: 104 },
      latestUnsignedVersionId: 106,
      latestSignedVersionId: 101,
    });
    await expect(prepareReusableApplicationScopedCfaDraft(connection, assessment))
      .rejects.toThrow('cfa_draft_not_reusable');
    expect(calls.some(call => /^(UPDATE|INSERT|DELETE)\b/.test(call.sql))).toBe(false);
  });

  test('a draft whose latest signed baseline belongs to stale submitter S is never reused or mutated', async () => {
    const freshSnapshot = {
      case: { id: 76, applicationId: 123, applicantUserId: 200 },
      client: { name: 'Applicant One' },
      plan: { id: 184, name: 'Application 123 plan' },
      interventions: [{ id: 900, code: '110', costTotal: 500 }],
      totalsByFundingStream: { EI: 500 },
    };
    const storedSnapshot = {
      ...freshSnapshot,
      case: {
        ...freshSnapshot.case,
        assignedStaffProfileId: 54,
        caseManagerName: 'Regional Manager One',
      },
    };
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql.startsWith('SELECT id FROM cfa_series')) {
          return [[{ id: 7 }], []];
        }
        if (normalizedSql.includes('FROM cfa_version v')) {
          return [[
            {
              id: 105,
              series_id: 7,
              case_id: 76,
              version_number: 5,
              status: 'signed',
              signed_by_participant_id: 901,
              application_id: 999,
              action_plan_id: 900,
              metadata_json: JSON.stringify({
                case: { id: 76, applicationId: 999, applicantUserId: 901 },
                plan: { id: 900 },
              }),
              supersedes_version_id: null,
            },
            {
              id: 104,
              series_id: 7,
              case_id: 76,
              version_number: 4,
              status: 'draft',
              application_id: 123,
              action_plan_id: 184,
              metadata_json: JSON.stringify(storedSnapshot),
              snapshot_hash: computeCfaSnapshotSignature(storedSnapshot).hash,
              supersedes_version_id: 105,
            },
          ], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    await expect(assessApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      freshSnapshot,
    })).rejects.toMatchObject({
      code: 'cfa_signed_baseline_scope_conflict',
      baselineReason: 'baseline_signed_participant_mismatch',
    });
    expect(calls.some(call => /^(UPDATE|INSERT|DELETE)\b/.test(call.sql))).toBe(false);
  });

  test('draft material comparison ignores only stored case-manager signer fields', () => {
    const fresh = {
      case: { id: 76, applicationId: 123 },
      client: { name: 'Applicant One' },
      plan: { id: 184, name: 'Application 123 plan' },
      interventions: [{ id: 900, costTotal: 500 }],
    };
    const stored = {
      ...fresh,
      case: {
        ...fresh.case,
        assignedStaffProfileId: 54,
        caseManagerName: 'Regional Manager One',
      },
    };
    expect(cfaDraftSnapshotMateriallyMatches(stored, fresh)).toBe(true);
    expect(cfaDraftSnapshotMateriallyMatches({
      ...stored,
      plan: { ...stored.plan, name: 'Stale plan title' },
    }, fresh)).toBe(false);
  });

  test.each([
    ['snapshot_hash_mismatch', ({ storedHash }) => (
      storedHash === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64)
    ), null],
    ['snapshot_stale', ({ storedHash }) => storedHash, snapshot => ({
      ...snapshot,
      plan: { ...snapshot.plan, name: 'Changed plan title' },
    })],
    ['signed_baseline_changed', ({ storedHash }) => storedHash, null, 101],
  ])('stale draft assessment returns %s without mutating or rebasing the draft', async (
    expectedReason,
    hashBuilder,
    freshBuilder,
    supersedesVersionId = 105
  ) => {
    const storedSnapshot = {
      case: { id: 76, applicationId: 123, applicantUserId: 200, caseManagerName: 'Regional Manager One' },
      client: { name: 'Applicant One' },
      plan: { id: 184, name: 'Application 123 plan' },
      interventions: [{ id: 900, costTotal: 500 }],
    };
    const materialFreshSnapshot = {
      ...storedSnapshot,
      case: { id: 76, applicationId: 123, applicantUserId: 200 },
    };
    const freshSnapshot = freshBuilder
      ? freshBuilder(materialFreshSnapshot)
      : materialFreshSnapshot;
    const storedHash = computeCfaSnapshotSignature(storedSnapshot).hash;
    const selectedHash = hashBuilder({ storedHash });
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql.startsWith('SELECT id FROM cfa_series')) {
          return [[{ id: 7 }], []];
        }
        if (normalizedSql.includes('FROM cfa_version v')) {
          return [[
            {
              id: 105,
              series_id: 7,
              case_id: 76,
              version_number: 5,
              status: 'signed',
              signed_by_participant_id: 200,
              application_id: 999,
              action_plan_id: 900,
              metadata_json: JSON.stringify({
                case: { id: 76, applicationId: 999, applicantUserId: 200 },
                plan: { id: 900 },
              }),
              snapshot_hash: 'signed-hash',
              supersedes_version_id: null,
            },
            {
              id: 104,
              series_id: 7,
              version_number: 4,
              status: 'draft',
              application_id: 123,
              action_plan_id: 184,
              metadata_json: JSON.stringify(storedSnapshot),
              snapshot_hash: selectedHash,
              supersedes_version_id: supersedesVersionId,
            },
          ], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    await expect(assessApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      freshSnapshot,
    })).resolves.toMatchObject({
      reusable: false,
      reason: expectedReason,
      selectedDraft: { id: 104 },
      latestSignedVersionId: 105,
    });
    expect(calls.some(call => /^(UPDATE|INSERT|DELETE)\b/.test(call.sql))).toBe(false);
    expect(calls.some(call => call.sql.includes('SET supersedes_version_id'))).toBe(false);
  });

  test('duplicate case/template CFA series fail closed for the CFA operation', async () => {
    const connection = {
      query: jest.fn(async () => [[
        { id: 7 },
        { id: 8 },
      ], []]),
    };
    await expect(assessApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      freshSnapshot: { case: { applicationId: 123 }, plan: { id: 184 } },
    })).rejects.toThrow('cfa_series_ambiguous');
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('an unsigned legacy CFA remains independent and does not block a later application', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
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
    await expect(assessApplicationScopedCfaDraft(connection, {
      caseId: 76,
      applicationId: 123,
      actionPlanId: 184,
      freshSnapshot: { case: { applicationId: 123 }, plan: { id: 184 } },
    })).resolves.toMatchObject({
      reusable: false,
      reason: 'draft_missing',
    });
    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(calls.some(call => /^(UPDATE|INSERT|DELETE)\b/.test(call.sql))).toBe(false);
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
      messageSendOperationId: 800,
      clientOperationId: 'stable-key-01',
      requestSha256: 'c'.repeat(64),
      responseStatus: 201,
      responseBody: { message: 'Message sent', messageId: 701, replyToMessageId: null },
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
      query: jest.fn(async sql => {
        if (String(sql).includes('FROM messages')) return [[messageRow], []];
        if (String(sql).includes('FROM message_send_operation')) {
          return [[{
            id: 800,
            client_operation_id: identity.clientOperationId,
            request_sha256: identity.requestSha256,
            sender_user_id: 41,
            case_id: 76,
            application_id: 123,
            message_id: 701,
            response_status: 201,
            response_json: JSON.stringify(identity.responseBody),
            completed_at: '2026-08-25T12:00:00.000Z',
          }], []];
        }
        return [[
              { signing_request_id: 901, case_id: 76, participant_user_id: 88, status: 'pending' },
              { signing_request_id: 902, case_id: 76, participant_user_id: 88, status: 'pending' },
            ], []];
      }),
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
    'cfa_supersession_conflict',
    'funding_overview_supersession_conflict',
  ])('maps retryable mutation race %s to a stable public response', code => {
    const mapped = mapCaseMessagePublicError(new Error(code));
    expect(mapped).toMatchObject({
      httpStatus: 409,
      publicError: 'signing_message_state_conflict',
      retrySafe: true,
      manualReviewRequired: false,
    });
    expect(mapped.publicMessage).not.toContain(code);
  });

  test.each([
    'cfa_application_scope_conflict',
    'cfa_participant_scope_conflict',
    'cfa_signed_baseline_scope_conflict',
    'cfa_series_ambiguous',
    'funding_overview_application_scope_conflict',
    'funding_overview_participant_scope_conflict',
    'funding_overview_signed_baseline_scope_conflict',
    'funding_overview_series_ambiguous',
  ])('maps persistent lineage defect %s to a non-retryable public response', code => {
    const mapped = mapCaseMessagePublicError(new Error(code));
    expect(mapped).toMatchObject({
      httpStatus: 409,
      publicError: 'signing_lineage_repair_required',
      retrySafe: false,
      manualReviewRequired: true,
    });
    expect(mapped.publicMessage).not.toMatch(/reload|try again/i);
    expect(mapped.publicMessage).not.toContain(code);
  });

  test.each([
    [
      'cfa_action_plan_scope_conflict',
      'The selected Action Plan does not belong to this application. Select the intended Action Plan and try again.',
    ],
    [
      'cfa_action_plan_selection_required',
      'Choose the intended Action Plan for this application before sending the funding agreement.',
    ],
    [
      'cfa_action_plan_missing',
      'This application has no current Action Plan available for a funding agreement.',
    ],
    [
      'cfa_action_plan_unavailable',
      'The selected Action Plan is no longer open for a funding agreement.',
    ],
  ])('maps operation prerequisite %s without claiming a lineage repair is required', (code, message) => {
    expect(mapCaseMessagePublicError(new Error(code))).toMatchObject({
      httpStatus: 422,
      publicError: code,
      publicMessage: message,
      retrySafe: false,
      manualReviewRequired: false,
    });
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
