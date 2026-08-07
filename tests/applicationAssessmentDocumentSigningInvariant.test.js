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

describe('application assessment document-signing invariant', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let reconcileApplicationDocumentRequestAfterSigning;
  let resolveSigningRequestMessageScope;
  let isDocsRequestedSigningDocumentType;
  let setDocsRequestedFromSecureMessage;
  let normalizeCaseMessageSigningAttachments;
  let resolveAuthoritativeSigningRequestDocumentType;
  let resolveWorkflowDecisionLetterDocumentType;
  let requestHasApplicationScopedCaseMutation;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      reconcileApplicationDocumentRequestAfterSigning,
      resolveSigningRequestMessageScope,
      isDocsRequestedSigningDocumentType,
      setDocsRequestedFromSecureMessage,
      normalizeCaseMessageSigningAttachments,
      resolveAuthoritativeSigningRequestDocumentType,
      resolveWorkflowDecisionLetterDocumentType,
      requestHasApplicationScopedCaseMutation,
    } = require('../isetadminserver'));
  });

  test('only participant-input forms activate document-request lifecycle state', () => {
    expect(isDocsRequestedSigningDocumentType('financial_overview')).toBe(true);
    expect(isDocsRequestedSigningDocumentType('assessment_approval_letter')).toBe(false);
    expect(isDocsRequestedSigningDocumentType('assessment_denial_letter')).toBe(false);
    expect(isDocsRequestedSigningDocumentType('')).toBe(false);
  });

  test('caller document-type labels cannot override the workflow catalogue', () => {
    expect(normalizeCaseMessageSigningAttachments([{
      workflow_id: '52',
      due_at: '2026-08-20',
      checklist_doc_type: 'assessment_approval_letter',
      financial_overview_mode: 'blank',
    }])).toEqual([{
      workflow_id: 52,
      due_at: '2026-08-20',
      financial_overview_mode: 'blank',
    }]);

    expect(resolveAuthoritativeSigningRequestDocumentType({
      workflowDocumentType: 'financial_overview',
      serverFallbackDocumentType: 'EFT_form',
      workflowName: 'Financial Overview',
      workflowType: 'consent-cm-prefill',
      checklistDocType: 'assessment_approval_letter',
    })).toBe('financial_overview');
    expect(resolveWorkflowDecisionLetterDocumentType('financial_overview')).toBeNull();
    expect(resolveWorkflowDecisionLetterDocumentType('assessment_approval_letter'))
      .toBe('assessment_approval_letter');
  });

  test('only a private server fallback can classify a catalogue-untyped EFT workflow', () => {
    expect(resolveAuthoritativeSigningRequestDocumentType({
      workflowDocumentType: null,
      serverFallbackDocumentType: 'EFT_form',
      workflowName: 'Electronic funds transfer',
      workflowType: 'consent-no-prefill',
    })).toBe('EFT_form');
  });

  test('direct application-owned case mutations require an exact application id', () => {
    expect(requestHasApplicationScopedCaseMutation({ applicationStatus: 'completed' })).toBe(true);
    expect(requestHasApplicationScopedCaseMutation({ docsRequested: true })).toBe(true);
    expect(requestHasApplicationScopedCaseMutation({ assessment_recommendation: 'recommend' })).toBe(true);
    expect(requestHasApplicationScopedCaseMutation({ caseContext: { decisionLetterDrafts: {} } })).toBe(true);
    expect(requestHasApplicationScopedCaseMutation({ expectedRowVersion: 9 })).toBe(true);
    expect(requestHasApplicationScopedCaseMutation({ status: 'active' })).toBe(false);
  });

  test('request activation locks application then workflow and derives from the fresh workflow stage', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql.includes('FROM iset_application') && normalizedSql.endsWith('LIMIT 1 FOR UPDATE')) {
          return [[{
            status: 'pending_approval',
            docs_requested_active: 0,
            docs_requested_at: null,
            docs_requested_cleared_at: null,
            docs_requested_source: null,
          }], []];
        }
        if (normalizedSql.includes('FROM iset_review_workflow') && normalizedSql.endsWith('LIMIT 1 FOR UPDATE')) {
          return [[{
            id: 56,
            workflow_type: 'application_assessment',
            application_id: 123,
            current_stage: 'returned_to_submitter',
            archived_at: null,
          }], []];
        }
        if (normalizedSql.startsWith('UPDATE iset_application')) {
          return [{ affectedRows: 1 }, []];
        }
        if (normalizedSql.includes('FROM iset_application') && normalizedSql.endsWith('LIMIT 1')) {
          return [[{
            status: 'in_review',
            docs_requested_active: 1,
            docs_requested_at: '2026-08-06 18:30:00',
            docs_requested_cleared_at: null,
            docs_requested_source: 'secure_message',
          }], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    await expect(setDocsRequestedFromSecureMessage({
      caseId: 76,
      applicationId: 123,
      connection,
      syncSideEffects: false,
    })).resolves.toMatchObject({
      updated: true,
      status: 'in_review',
      source: 'secure_message',
    });

    expect(calls[0].sql).toContain('FROM iset_application');
    expect(calls[0].sql).toMatch(/FOR UPDATE$/);
    expect(calls[1].sql).toContain('FROM iset_review_workflow');
    expect(calls[1].sql).toMatch(/FOR UPDATE$/);
    const updateCall = calls.find(call => call.sql.startsWith('UPDATE iset_application'));
    expect(updateCall.params.slice(0, 5)).toEqual([
      'in_review',
      'in_review',
      null,
      'none',
      null,
    ]);
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  test('signing completion repairs the exact returned-to-RM application and clears only its reminder', async () => {
    const updates = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql.includes('FROM message_signing_request msr') && normalizedSql.includes('SELECT DISTINCT')) {
          return [[{
            message_case_id: 76,
            application_id: 123,
            application_case_id: 76,
          }], []];
        }
        if (normalizedSql.includes('FROM iset_application a') && normalizedSql.includes('AS tracking_id')) {
          return [[{
            application_id: 123,
            application_status: 'in_review',
            application_lifecycle_status: 'awaiting_applicant',
            application_decision_outcome: null,
            application_awaiting_reason: 'documents',
            application_closure_reason: null,
            docs_requested_active: 1,
            docs_requested_at: '2026-08-05 13:32:06',
            docs_requested_cleared_at: null,
            docs_requested_source: 'secure_message',
            tracking_id: 'ISET-2026-00123',
          }], []];
        }
        if (normalizedSql.includes('FROM iset_review_workflow') && normalizedSql.includes('subject_key = ?')) {
          return [[{
            id: 56,
            workflow_type: 'application_assessment',
            subject_key: 'application_assessment:application:123',
            application_id: 123,
            case_id: 76,
            current_stage: 'returned_to_rm',
            archived_at: null,
          }], []];
        }
        if (normalizedSql.includes('COUNT(DISTINCT sr.id) AS pending_count')) {
          return [[{ pending_count: 0 }], []];
        }
        if (normalizedSql.startsWith('UPDATE iset_application')) {
          updates.push({ sql: normalizedSql, params });
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };
    const captureCaseEventFn = jest.fn(async () => {});
    const cancelDocRequestRemindersFn = jest.fn(async () => {});

    const result = await reconcileApplicationDocumentRequestAfterSigning({
      signingRequestId: 164,
      caseId: 76,
      actorUserId: 510,
      connection,
      captureCaseEventFn,
      cancelDocRequestRemindersFn,
    });

    expect(result).toMatchObject({
      updated: true,
      applicationId: 123,
      pendingCount: 0,
      docsRequestedCleared: true,
      reviewStage: 'returned_to_rm',
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].params).toEqual([
      'pending_approval',
      'pending_decision',
      null,
      'none',
      null,
      123,
      76,
    ]);
    expect(captureCaseEventFn).toHaveBeenCalledWith(expect.objectContaining({
      caseId: 76,
      actorId: 510,
      payload: expect.objectContaining({ application_id: 123, case_id: 76 }),
    }));
    expect(cancelDocRequestRemindersFn).toHaveBeenCalledWith(expect.objectContaining({
      caseId: 76,
      applicationId: 123,
      connection,
    }));
  });

  test('message/application ambiguity fails closed instead of selecting a case-primary application', async () => {
    const connection = {
      query: jest.fn(async () => [[
        { message_case_id: 76, application_id: 123, application_case_id: 76 },
        { message_case_id: 76, application_id: 124, application_case_id: 76 },
      ], []]),
    };

    await expect(resolveSigningRequestMessageScope(connection, 164)).rejects.toMatchObject({
      code: 'signing_request_message_scope_conflict',
    });
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('an already-canonical review with another pending form does not churn row version on retry', async () => {
    const connection = {
      query: jest.fn(async sql => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql.includes('FROM message_signing_request msr') && normalizedSql.includes('SELECT DISTINCT')) {
          return [[{
            message_case_id: 76,
            application_id: 123,
            application_case_id: 76,
          }], []];
        }
        if (normalizedSql.includes('FROM iset_application a') && normalizedSql.includes('AS tracking_id')) {
          return [[{
            application_id: 123,
            application_status: 'pending_approval',
            application_lifecycle_status: 'pending_decision',
            application_decision_outcome: null,
            application_awaiting_reason: 'none',
            application_closure_reason: null,
            docs_requested_active: 1,
            docs_requested_at: '2026-08-05 13:32:06',
            docs_requested_cleared_at: null,
            docs_requested_source: 'secure_message',
            tracking_id: 'ISET-2026-00123',
          }], []];
        }
        if (normalizedSql.includes('FROM iset_review_workflow') && normalizedSql.includes('subject_key = ?')) {
          return [[{
            id: 56,
            workflow_type: 'application_assessment',
            subject_key: 'application_assessment:application:123',
            application_id: 123,
            case_id: 76,
            current_stage: 'returned_to_rm',
            archived_at: null,
          }], []];
        }
        if (normalizedSql.includes('COUNT(DISTINCT sr.id) AS pending_count')) {
          return [[{ pending_count: 1 }], []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };
    const captureCaseEventFn = jest.fn(async () => {});
    const cancelDocRequestRemindersFn = jest.fn(async () => {});

    await expect(reconcileApplicationDocumentRequestAfterSigning({
      signingRequestId: 164,
      caseId: 76,
      actorUserId: 510,
      connection,
      captureCaseEventFn,
      cancelDocRequestRemindersFn,
    })).resolves.toMatchObject({
      updated: false,
      applicationId: 123,
      pendingCount: 1,
      docsRequestedCleared: false,
      reviewStage: 'returned_to_rm',
    });
    expect(connection.query).toHaveBeenCalledTimes(4);
    expect(captureCaseEventFn).not.toHaveBeenCalled();
    expect(cancelDocRequestRemindersFn).not.toHaveBeenCalled();
  });

  test('concurrent last-form reconciliation has one guarded clear, event, and reminder cancellation', async () => {
    let docsRequestedActive = true;
    let pendingReaders = 0;
    const pendingWaiters = [];
    const transactionalConnections = [];
    const connection = {
      query: jest.fn(async sql => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (normalizedSql.includes('FROM message_signing_request msr') && normalizedSql.includes('SELECT DISTINCT')) {
          return [[{
            message_case_id: 76,
            application_id: 123,
            application_case_id: 76,
          }], []];
        }
        if (normalizedSql.includes('FROM iset_application a') && normalizedSql.includes('AS tracking_id')) {
          return [[{
            application_id: 123,
            application_status: 'in_review',
            application_lifecycle_status: 'awaiting_applicant',
            application_decision_outcome: null,
            application_awaiting_reason: 'documents',
            application_closure_reason: null,
            docs_requested_active: 1,
            docs_requested_at: '2026-08-05 13:32:06',
            docs_requested_cleared_at: null,
            docs_requested_source: 'secure_message',
            tracking_id: 'ISET-2026-00123',
          }], []];
        }
        if (normalizedSql.includes('FROM iset_review_workflow') && normalizedSql.includes('subject_key = ?')) {
          return [[{
            id: 56,
            workflow_type: 'application_assessment',
            subject_key: 'application_assessment:application:123',
            application_id: 123,
            case_id: 76,
            current_stage: 'returned_to_rm',
            archived_at: null,
          }], []];
        }
        if (normalizedSql.includes('COUNT(DISTINCT sr.id) AS pending_count')) {
          pendingReaders += 1;
          return new Promise(resolve => {
            pendingWaiters.push(() => resolve([[{ pending_count: 0 }], []]));
            if (pendingReaders === 2) pendingWaiters.splice(0).forEach(release => release());
          });
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
      getConnection: jest.fn(async () => {
        const transactionalConnection = {
          beginTransaction: jest.fn(async () => {}),
          commit: jest.fn(async () => {}),
          rollback: jest.fn(async () => {}),
          release: jest.fn(),
          query: jest.fn(async sql => {
            const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
            if (!normalizedSql.startsWith('UPDATE iset_application')) {
              throw new Error(`unexpected_transaction_query:${normalizedSql}`);
            }
            expect(normalizedSql).toContain('AND case_id = ?');
            expect(normalizedSql).toContain('AND docs_requested_active = 1');
            expect(normalizedSql).toContain("AND docs_requested_source = 'secure_message'");
            if (!docsRequestedActive) return [{ affectedRows: 0 }, []];
            docsRequestedActive = false;
            return [{ affectedRows: 1 }, []];
          }),
        };
        transactionalConnections.push(transactionalConnection);
        return transactionalConnection;
      }),
    };
    const captureCaseEventFn = jest.fn(async () => {});
    const cancelDocRequestRemindersFn = jest.fn(async () => {});

    const results = await Promise.all([
      reconcileApplicationDocumentRequestAfterSigning({
        signingRequestId: 164,
        caseId: 76,
        actorUserId: 510,
        connection,
        captureCaseEventFn,
        cancelDocRequestRemindersFn,
      }),
      reconcileApplicationDocumentRequestAfterSigning({
        signingRequestId: 165,
        caseId: 76,
        actorUserId: 510,
        connection,
        captureCaseEventFn,
        cancelDocRequestRemindersFn,
      }),
    ]);

    expect(results.filter(result => result.docsRequestedCleared)).toHaveLength(1);
    expect(results.filter(result => result.updated)).toHaveLength(1);
    expect(captureCaseEventFn).toHaveBeenCalledTimes(1);
    expect(cancelDocRequestRemindersFn).toHaveBeenCalledTimes(1);
    expect(transactionalConnections).toHaveLength(2);
    expect(transactionalConnections.every(conn => conn.commit.mock.calls.length === 1)).toBe(true);
    expect(transactionalConnections.every(conn => conn.release.mock.calls.length === 1)).toBe(true);
  });
});
