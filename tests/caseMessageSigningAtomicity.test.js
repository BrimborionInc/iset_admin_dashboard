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
  let validateAutoFundingWorkflowAttachmentResolution;
  let assertUniqueVersionedSigningWorkflowAttachments;
  let resolveEligibleSigningWorkflowRows;
  let buildRequiredSigningWorkflowSchemas;
  let filterApplicationScopedVersionRows;
  let resolveApplicationScopedCfaDraft;
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
      validateAutoFundingWorkflowAttachmentResolution,
      assertUniqueVersionedSigningWorkflowAttachments,
      resolveEligibleSigningWorkflowRows,
      buildRequiredSigningWorkflowSchemas,
      filterApplicationScopedVersionRows,
      resolveApplicationScopedCfaDraft,
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
    const record = trackGeneratedObjectUploadAttempt(uploads, 'generated/a.pdf');
    const headObjectFn = jest.fn();
    expect(resolveS3UploadVersionId({ 'x-amz-version-id': 'version-a' }))
      .toBe('version-a');

    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: record,
      uploadResponse: { headers: { 'x-amz-version-id': 'version-a' } },
      headObjectFn,
      versionCompensationSupported: true,
    })).resolves.toBe(record);

    expect(record).toEqual({
      key: 'generated/a.pdf',
      versionId: 'version-a',
      versionIdentityVerified: true,
    });
    expect(headObjectFn).not.toHaveBeenCalled();
  });

  test('missing PUT version headers are resolved through version-aware HeadObject or fail closed', async () => {
    const record = trackGeneratedObjectUploadAttempt([], 'generated/b.pdf');
    const headObjectFn = jest.fn(async () => ({
      exists: true,
      versionId: 'version-b',
    }));
    await expect(verifyGeneratedObjectUploadIdentity({
      uploadRecord: record,
      uploadResponse: { headers: {} },
      headObjectFn,
      versionCompensationSupported: true,
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
