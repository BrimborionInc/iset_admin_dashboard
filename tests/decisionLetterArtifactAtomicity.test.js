const fs = require('fs');
const path = require('path');
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

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();
const clone = value => JSON.parse(JSON.stringify(value));

function initialState() {
  return {
    messages: [],
    signingRequests: [],
    decisionLetterSent: false,
    application: {
      status: 'decision_ready',
      lifecycleStatus: 'decision_recorded',
      decisionOutcome: null,
    },
    documents: [{
      id: 41,
      applicationId: 20,
      documentCategory: 'assessment_denial_letter',
      status: 'active',
      filePath: 'existing/denial-letter.pdf',
      owner: 'application',
    }],
  };
}

function createTransactionalConnection({
  failDocumentInsert = false,
  failReplacementActivation = false,
} = {}) {
  let committed = initialState();
  let working = null;
  const queries = [];
  let rollbacks = 0;
  let commits = 0;
  let releases = 0;

  const connection = {
    beginTransaction: jest.fn(async () => {
      working = clone(committed);
    }),
    query: jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });
      if (!working) throw new Error('transaction_not_started');

      if (sql.startsWith('INSERT INTO iset_document')) {
        if (failDocumentInsert) throw new Error('injected_document_insert_failure');
        const replacementId = 42;
        const metadata = JSON.parse(params[10]);
        working.documents.push({
          id: replacementId,
          applicationId: Number(params[1]),
          documentCategory: params[params.length - 1],
          status: 'archived',
          filePath: params[8],
          owner: metadata.decision_letter_owner,
          metadata,
        });
        return [{ insertId: replacementId, affectedRows: 1 }, []];
      }
      if (
        sql.startsWith('UPDATE iset_document') &&
        (
          sql.includes("SET d.status = 'archived'") ||
          sql.includes("SET status = 'archived'")
        )
      ) {
        const [applicationId, documentCategory, replacementId] = params.map((value, index) => (
          index === 0 || index === 2 ? Number(value) : value
        ));
        let affectedRows = 0;
        working.documents.forEach(document => {
          if (
            document.applicationId === applicationId &&
            document.owner === 'application' &&
            document.documentCategory === documentCategory &&
            document.status === 'active' &&
            document.id !== replacementId
          ) {
            document.status = 'archived';
            affectedRows += 1;
          }
        });
        return [{ affectedRows }, []];
      }
      if (
        sql.startsWith('UPDATE iset_document') &&
        (
          sql.includes("SET d.status = 'active'") ||
          sql.includes("SET status = 'active'")
        )
      ) {
        if (failReplacementActivation) return [{ affectedRows: 0 }, []];
        const [replacementId, applicationId, documentCategory] = params;
        const replacement = working.documents.find(document => (
          document.id === Number(replacementId) &&
          document.applicationId === Number(applicationId) &&
          document.documentCategory === documentCategory &&
          document.status === 'archived'
        ));
        if (!replacement) return [{ affectedRows: 0 }, []];
        replacement.status = 'active';
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected decision-letter transaction SQL: ${sql}`);
    }),
    commit: jest.fn(async () => {
      committed = clone(working);
      working = null;
      commits += 1;
    }),
    rollback: jest.fn(async () => {
      working = null;
      rollbacks += 1;
    }),
    release: jest.fn(() => {
      releases += 1;
    }),
    seedMessageAndSigningRequest() {
      working.messages.push({ id: 101, status: 'unread' });
      working.signingRequests.push({ id: 201, status: 'pending' });
    },
    recordDenialCompletion() {
      working.decisionLetterSent = true;
      working.application = {
        status: 'completed',
        lifecycleStatus: 'closed',
        decisionOutcome: 'denied',
      };
    },
    committedState: () => clone(committed),
    workingState: () => clone(working),
    queries,
    counters: () => ({ rollbacks, commits, releases }),
  };
  return connection;
}

function verifiedUploadRecord(key) {
  return {
    key,
    versionId: 'decision-letter-version-1',
    versionIdentityVerified: true,
    objectIdentityVerified: true,
    identityMode: 'version',
    requestOwnedKey: true,
    sizeBytes: 8,
    checksumSha256: 'verified-checksum',
  };
}

describe('decision-letter artifact atomicity', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;
  let exported;

  beforeAll(() => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    exported = require('../isetadminserver');
  });

  afterAll(async () => {
    if (exported?.pool && typeof exported.pool.end === 'function') {
      await exported.pool.end();
    }
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
  });

  const decisionLetterDocs = [{
    workflowName: 'Application denial letter',
    docType: 'assessment_denial_letter',
    schema: { steps: [{ id: 'letter', components: [] }] },
    signingRequestId: 201,
  }];

  async function runInjectedFailure(stage, { cleanupFails = false } = {}) {
    const connection = createTransactionalConnection({
      failDocumentInsert: stage === 'document_insert',
      failReplacementActivation: stage === 'activation',
    });
    const uploadedObjects = [];
    const deleteObjectFn = jest.fn(async () => {
      if (cleanupFails) throw new Error('injected_exact_cleanup_failure');
      return { deleted: true };
    });
    const cleanupFn = jest.fn(records => exported.deleteUploadedObjectKeysBestEffort(records, {
      deleteObjectFn,
      headObjectFn: jest.fn(),
      versionCompensationSupported: true,
      driver: 's3',
      logger: { warn: jest.fn(), error: jest.fn() },
    }));
    const recordDecisionLetterSent = jest.fn(async () => {
      connection.recordDenialCompletion();
      if (stage === 'sent_state') throw new Error('injected_sent_state_failure');
      return { updated: true, letterKey: 'denial', applicationCompleted: true };
    });
    const generatePdfBufferFn = jest.fn(async () => {
      if (stage === 'pdf') throw new Error('injected_pdf_generation_failure');
      return Buffer.from('pdf-data');
    });
    const uploadPdfObjectFn = jest.fn(async ({ uploadedObjects: records }) => {
      if (stage === 's3') {
        records.push(verifiedUploadRecord('generated/failed-denial-letter.pdf'));
        throw new Error('injected_s3_failure_after_write');
      }
      records.push(verifiedUploadRecord('generated/denial-letter.pdf'));
      return 'generated/denial-letter.pdf';
    });
    const storePdfDocumentFn = args => exported.storeDecisionLetterPdfDocument({
      ...args,
      uploadPdfObjectFn,
    });

    await connection.beginTransaction();
    connection.seedMessageAndSigningRequest();
    let originalError = null;
    try {
      await exported.persistCaseMessageDecisionLetterArtifacts({
        connection,
        decisionLetterDocs,
        caseId: 10,
        applicationId: 20,
        applicantUserId: 500,
        actorUserId: 700,
        trackingId: 'APP-20',
        uploadedObjectKeys: uploadedObjects,
        resolveClientIdFn: jest.fn(async () => 5),
        generatePdfBufferFn,
        storePdfDocumentFn,
      });
      await recordDecisionLetterSent();
      await connection.commit();
    } catch (error) {
      originalError = error;
    }
    expect(originalError).toBeTruthy();
    const resolvedError = await exported.rollbackCaseMessageWriteTransaction({
      connection,
      transactionStarted: true,
      commitAttempted: false,
      commitOutcome: 'not_attempted',
      uploadedObjectKeys: uploadedObjects,
      originalError,
      cleanupFn,
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    return {
      connection,
      uploadedObjects,
      cleanupFn,
      deleteObjectFn,
      recordDecisionLetterSent,
      resolvedError,
    };
  }

  test.each([
    ['PDF generation', 'pdf', 'decision_letter_pdf_generation_failed', 0],
    ['S3 upload', 's3', 'decision_letter_artifact_storage_failed', 1],
    ['document insert', 'document_insert', 'decision_letter_artifact_storage_failed', 1],
    ['replacement activation', 'activation', 'decision_letter_artifact_storage_failed', 1],
  ])('%s failure rolls back the message and denial lifecycle while preserving the prior letter', async (
    _label,
    stage,
    expectedError,
    expectedCleanupCount
  ) => {
    const result = await runInjectedFailure(stage);
    const state = result.connection.committedState();

    expect(result.resolvedError).toMatchObject({ publicError: expectedError });
    expect(state.messages).toEqual([]);
    expect(state.signingRequests).toEqual([]);
    expect(state.decisionLetterSent).toBe(false);
    expect(state.application).toEqual({
      status: 'decision_ready',
      lifecycleStatus: 'decision_recorded',
      decisionOutcome: null,
    });
    expect(state.documents).toEqual([expect.objectContaining({
      id: 41,
      status: 'active',
      filePath: 'existing/denial-letter.pdf',
    })]);
    expect(result.recordDecisionLetterSent).not.toHaveBeenCalled();
    expect(result.cleanupFn).toHaveBeenCalledTimes(1);
    expect(result.cleanupFn.mock.calls[0][0]).toHaveLength(expectedCleanupCount);
    if (expectedCleanupCount) {
      expect(result.deleteObjectFn).toHaveBeenCalledWith(expect.objectContaining({
        versionId: 'decision-letter-version-1',
      }));
    } else {
      expect(result.deleteObjectFn).not.toHaveBeenCalled();
    }
    expect(result.connection.counters()).toEqual({ rollbacks: 1, commits: 0, releases: 1 });
  });

  test('a sent-state or denial-completion failure rolls back the activated replacement and restores the old artifact', async () => {
    const result = await runInjectedFailure('sent_state');
    const state = result.connection.committedState();

    expect(result.recordDecisionLetterSent).toHaveBeenCalledTimes(1);
    expect(state.messages).toEqual([]);
    expect(state.signingRequests).toEqual([]);
    expect(state.decisionLetterSent).toBe(false);
    expect(state.application).toEqual({
      status: 'decision_ready',
      lifecycleStatus: 'decision_recorded',
      decisionOutcome: null,
    });
    expect(state.documents).toEqual([
      expect.objectContaining({ id: 41, status: 'active' }),
    ]);
    expect(result.deleteObjectFn).toHaveBeenCalledWith({
      key: 'generated/denial-letter.pdf',
      versionId: 'decision-letter-version-1',
    });
  });

  test('replacement insertion precedes prior-letter archival and activates exactly one new artifact', async () => {
    const connection = createTransactionalConnection();
    const uploadedObjects = [];
    await connection.beginTransaction();
    const documentId = await exported.storeDecisionLetterPdfDocument({
      docType: 'assessment_denial_letter',
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
      actorUserId: 700,
      clientId: 5,
      trackingId: 'APP-20',
      signingRequestId: 201,
      pdfBuffer: Buffer.from('pdf-data'),
      connection,
      uploadedObjectKeys: uploadedObjects,
      uploadPdfObjectFn: async ({ uploadedObjects: records }) => {
        records.push(verifiedUploadRecord('generated/denial-letter.pdf'));
        return 'generated/denial-letter.pdf';
      },
    });

    expect(documentId).toBe(42);
    expect(connection.queries.map(call => (
      call.sql.startsWith('INSERT INTO iset_document')
        ? 'insert'
        : (
            call.sql.includes("SET d.status = 'archived'") ||
            call.sql.includes("SET status = 'archived'")
          )
          ? 'archive_previous'
          : 'activate_replacement'
    ))).toEqual(['insert', 'archive_previous', 'activate_replacement']);
    expect(connection.workingState().documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 41, status: 'archived' }),
      expect.objectContaining({
        id: 42,
        status: 'active',
        metadata: expect.objectContaining({
          generated_kind: 'signing_request_source_document',
          signing_request_id: 201,
        }),
      }),
    ]));
    expect(uploadedObjects[0]).toMatchObject({
      documentId: 42,
      applicationId: 20,
      documentCategory: 'assessment_denial_letter',
    });
  });

  test('unverifiable object cleanup blocks retry after the database rollback', async () => {
    const result = await runInjectedFailure('document_insert', { cleanupFails: true });

    expect(result.resolvedError).toMatchObject({
      publicError: 'message_send_cleanup_incomplete',
      retrySafe: false,
      manualReviewRequired: true,
    });
    expect(result.connection.committedState().documents).toEqual([
      expect.objectContaining({ id: 41, status: 'active' }),
    ]);
  });

  test('the real route persists the artifact before sent-state mutation and commit', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../isetadminserver.js'), 'utf8');
    const storeStart = source.indexOf('async function storeDecisionLetterPdfDocument({');
    const storeEnd = source.indexOf('\nasync function storeFundingAgreementPdfDocument({', storeStart);
    const store = source.slice(storeStart, storeEnd);
    const start = source.indexOf('const handlePostCaseSecureMessage = async (req, res) => {');
    const end = source.indexOf("app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);", start);
    const handler = source.slice(start, end);
    const signingLink = handler.indexOf('`INSERT INTO message_signing_request');
    const artifactPersistence = handler.indexOf('await persistCaseMessageDecisionLetterArtifacts({');
    const sentStatePersistence = handler.indexOf('await recordApplicationDecisionLetterSent({');
    const commit = handler.indexOf('await commitCaseMessageWriteTransaction({');

    expect(signingLink).toBeGreaterThanOrEqual(0);
    expect(artifactPersistence).toBeGreaterThan(signingLink);
    expect(sentStatePersistence).toBeGreaterThan(artifactPersistence);
    expect(commit).toBeGreaterThan(sentStatePersistence);
    expect(handler).toContain('connection: messageWriteConnection');
    expect(handler).not.toContain("console.warn('[decision-letter] PDF generation failed'");
    expect(store).toContain('uploadedObjects: uploadedObjectKeys');
    expect(store).toContain('await connection.query(');
    expect(store).not.toContain('await pool.query(');
  });
});
