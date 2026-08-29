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

const compactSql = value => String(value || '').replace(/\s+/gu, ' ').trim();
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'isetadminserver.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Unable to find source boundary: ${startMarker} -> ${endMarker}`);
  }
  return serverSource.slice(start, end);
}

function createLockingDocumentStore() {
  const state = {
    document: {
      id: 7,
      checksum_sha256: 'a'.repeat(64),
      client_id: 70,
      case_id: 71,
      application_id: null,
      action_plan_id: null,
      applicant_user_id: 72,
      document_category: 'financial_evidence',
      metadata: '{}',
      created_at: '2026-08-24T12:00:00.000Z',
      status: 'active',
    },
    relationship: null,
    lockOwner: null,
    waiters: [],
  };

  const acquire = owner => {
    if (!state.lockOwner) {
      state.lockOwner = owner;
      return Promise.resolve();
    }
    return new Promise(resolve => state.waiters.push({ owner, resolve }));
  };

  const release = owner => {
    if (state.lockOwner !== owner) return;
    const next = state.waiters.shift();
    if (!next) {
      state.lockOwner = null;
      return;
    }
    state.lockOwner = next.owner;
    next.resolve();
  };

  const connection = owner => {
    let holdsDocumentLock = false;
    return {
      beginTransaction: jest.fn(async () => {}),
      query: jest.fn(async (statement, params = []) => {
        const sql = compactSql(statement);
        if (sql.includes('FROM iset_document') && sql.includes('FOR UPDATE')) {
          await acquire(owner);
          holdsDocumentLock = true;
          const id = Number(params[0]);
          const row = id === state.document.id && state.document.status === 'active'
            ? { ...state.document }
            : null;
          return [[row].filter(Boolean), []];
        }
        throw new Error(`Unexpected concurrency-fixture SQL: ${sql}`);
      }),
      commit: jest.fn(async () => {
        if (holdsDocumentLock) release(owner);
        holdsDocumentLock = false;
      }),
      rollback: jest.fn(async () => {
        if (holdsDocumentLock) release(owner);
        holdsDocumentLock = false;
      }),
    };
  };

  return { state, connection };
}

let exported;
let previousRepairExports;
let previousTestEnvironmentFile;
let syntheticTestEnvironment;

beforeAll(() => {
  previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
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
  if (syntheticTestEnvironment) expect(syntheticTestEnvironment.cleanup()).toBe(true);
});

describe('Supporting Document deletion/payment relationship concurrency', () => {
  test('the shared guard takes a current active-row lock and refuses non-transactional callers', async () => {
    const row = { id: 7, status: 'active' };
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(async () => [[row], []]),
    };

    await expect(exported.lockActivePaymentEvidenceDocument({
      documentId: 7,
      connection,
    })).resolves.toBe(row);

    expect(connection.query).toHaveBeenCalledTimes(1);
    const [statement, params] = connection.query.mock.calls[0];
    expect(compactSql(statement)).toContain("WHERE id = ? AND status = 'active' LIMIT 1 FOR UPDATE");
    expect(params).toEqual([7]);

    await expect(exported.lockActivePaymentEvidenceDocument({
      documentId: 7,
      connection: { query: jest.fn() },
    })).rejects.toMatchObject({ code: 'payment_document_transaction_required' });
  });

  test.each([
    'payment_packet_document',
    'payment_packet_line.payment_proof_document_id',
    'payment_followup_event',
  ])('if a %s link wins, a waiting archive sees the relationship and refuses', async relationship => {
    const store = createLockingDocumentStore();
    const linkConnection = store.connection('link');
    const archiveConnection = store.connection('archive');

    const linkedDocument = await exported.lockActivePaymentEvidenceDocument({
      documentId: 7,
      connection: linkConnection,
    });
    expect(linkedDocument).toMatchObject({ id: 7, status: 'active' });

    let archiveFinished = false;
    const archiveAttempt = (async () => {
      const document = await exported.lockActivePaymentEvidenceDocument({
        documentId: 7,
        connection: archiveConnection,
      });
      if (!document) return 'already_deleted';
      if (store.state.relationship) {
        await archiveConnection.rollback();
        return 'relationship_blocked';
      }
      store.state.document.status = 'deleted';
      await archiveConnection.commit();
      return 'deleted';
    })().finally(() => {
      archiveFinished = true;
    });

    await Promise.resolve();
    expect(archiveFinished).toBe(false);
    store.state.relationship = relationship;
    await linkConnection.commit();

    await expect(archiveAttempt).resolves.toBe('relationship_blocked');
    expect(store.state.document.status).toBe('active');
  });

  test.each([
    'payment_packet_document',
    'payment_packet_line.payment_proof_document_id',
    'payment_followup_event',
  ])('if archive wins, a waiting %s writer cannot lock the document as active', async relationship => {
    const store = createLockingDocumentStore();
    const archiveConnection = store.connection('archive');
    const linkConnection = store.connection('link');

    const archivedDocument = await exported.lockActivePaymentEvidenceDocument({
      documentId: 7,
      connection: archiveConnection,
    });
    expect(archivedDocument).toMatchObject({ id: 7, status: 'active' });

    let linkFinished = false;
    const linkAttempt = exported.lockActivePaymentEvidenceDocument({
      documentId: 7,
      connection: linkConnection,
    }).finally(() => {
      linkFinished = true;
    });

    await Promise.resolve();
    expect(linkFinished).toBe(false);
    store.state.document.status = 'deleted';
    await archiveConnection.commit();

    const linkDocument = await linkAttempt;
    expect(linkDocument).toBeNull();
    if (linkDocument) store.state.relationship = relationship;
    await linkConnection.rollback();
    expect(store.state.relationship).toBeNull();
  });

  test('auto-attachment drops a candidate that is no longer active when its row lock is acquired', async () => {
    const queries = [];
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(async (statement) => {
        const sql = compactSql(statement);
        queries.push(sql);
        if (sql.includes('FROM iset_document d') && sql.includes("d.status = 'active'")) {
          return [[{
            id: 7,
            document_category: 'financial_evidence',
            metadata: '{}',
            case_id: 71,
            application_id: null,
            action_plan_id: null,
            client_id: 70,
            created_at: '2026-08-24T12:00:00.000Z',
            checksum_sha256: 'a'.repeat(64),
          }], []];
        }
        if (sql.includes('FROM iset_document') && sql.includes('FOR UPDATE')) {
          return [[], []];
        }
        throw new Error(`Unexpected auto-attach SQL: ${sql}`);
      }),
    };

    await expect(exported.attachSupportingDocumentsToPaymentPacket({
      packetId: 80,
      caseId: 71,
      clientId: 70,
      applicationId: 73,
      connection,
    })).resolves.toEqual({ attached: 0 });

    expect(queries.some(sql => sql.includes('FOR UPDATE'))).toBe(true);
    expect(queries.some(sql => sql.startsWith('INSERT INTO payment_packet_document'))).toBe(false);
  });

  test('follow-up event creation fails before insert when its evidence document is no longer active', async () => {
    const queries = [];
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn(async (statement) => {
        const sql = compactSql(statement);
        queries.push(sql);
        if (sql.includes('FROM iset_document') && sql.includes('FOR UPDATE')) {
          return [[], []];
        }
        throw new Error(`Unexpected follow-up SQL: ${sql}`);
      }),
    };

    await expect(exported.createPaymentFollowUpEvent({
      packetId: 80,
      toStatus: 'follow_up_logged',
      documentId: 7,
      connection,
    })).rejects.toMatchObject({
      code: 'payment_follow_up_document_not_active',
      status: 409,
    });

    expect(queries.some(sql => sql.includes('FOR UPDATE'))).toBe(true);
    expect(queries.some(sql => sql.startsWith('INSERT INTO payment_followup_event'))).toBe(false);
  });

  test('every current relationship-writing path is wired to the active document lock', () => {
    const autoAttachment = sourceBetween(
      'async function attachSupportingDocumentsToPaymentPacket',
      'const applyEvidenceRulesToPacket'
    );
    const followUpEvent = sourceBetween(
      'async function createPaymentFollowUpEvent',
      'async function recomputePacketFollowUpStatusFromLines'
    );
    const manualFollowUp = sourceBetween(
      'async function handleRecordPaymentFollowUp',
      "app.post('/api/finance/payment-packets/:id/follow-up'"
    );
    const paidProof = sourceBetween(
      "app.post('/api/finance/payment-lines/:id/status'",
      "app.post('/api/finance/payment-packets/:id/documents'"
    );
    const manualAttachment = sourceBetween(
      "app.post('/api/finance/payment-packets/:id/documents'",
      "app.put('/api/finance/payment-documents/:id'"
    );
    const archiveLock = sourceBetween(
      'async function lockGenericDocumentMutationContext',
      'async function fetchCaseAccessRowsForDocument'
    );
    const deleteRoute = sourceBetween(
      "app.delete('/api/documents/:id'",
      "app.post('/api/documents/:id/restore'"
    );

    expect(autoAttachment.indexOf('lockActivePaymentEvidenceDocument'))
      .toBeLessThan(autoAttachment.indexOf('INSERT INTO payment_packet_document'));
    expect(followUpEvent.indexOf('lockActivePaymentEvidenceDocument'))
      .toBeLessThan(followUpEvent.indexOf('INSERT INTO payment_followup_event'));
    expect(manualFollowUp).toContain('lockActivePaymentEvidenceDocument');
    expect(paidProof.indexOf('lockActivePaymentEvidenceDocument'))
      .toBeLessThan(paidProof.indexOf("fields.push('payment_proof_document_id = ?')"));
    expect(paidProof).toContain(
      "      }\n      if (resolvedProofDocumentId) {\n        const docRow = await lockActivePaymentEvidenceDocument"
    );
    expect(manualAttachment).toContain('await connection.beginTransaction()');
    expect(manualAttachment.indexOf('lockActivePaymentEvidenceDocument'))
      .toBeLessThan(manualAttachment.indexOf('INSERT INTO payment_packet_document'));
    expect(manualAttachment).toContain('await connection.commit()');
    expect(archiveLock.indexOf('FOR UPDATE'))
      .toBeLessThan(archiveLock.indexOf('validateGenericDocumentMutationIntegrity'));
    expect(deleteRoute).toContain('requireIntegrityCheck: false');
    const lockedDeleteGuardIndex = deleteRoute.indexOf('const lockedDeleteError');
    expect(deleteRoute.indexOf('lockGenericDocumentMutationContext({'))
      .toBeLessThan(lockedDeleteGuardIndex);
    expect(lockedDeleteGuardIndex)
      .toBeLessThan(deleteRoute.indexOf("SET status = 'deleted'"));

    expect(serverSource.match(/INSERT INTO payment_packet_document/gu)).toHaveLength(3);
    expect(serverSource.match(/INSERT INTO payment_followup_event/gu)).toHaveLength(2);
    expect(serverSource.match(/fields\.push\('payment_proof_document_id = \?'\)/gu)).toHaveLength(1);
  });

  test('payment evidence unlink locks and rechecks the packet before deleting the link', () => {
    const unlinkRoute = sourceBetween(
      "app.delete('/api/finance/payment-documents/:id'",
      "app.get('/api/finance/payment-batches'"
    );
    const packetLockIndex = unlinkRoute.indexOf(
      "'SELECT id, status FROM payment_packet WHERE id = ? LIMIT 1 FOR UPDATE'"
    );
    const statusGuardIndex = unlinkRoute.indexOf(
      'PAYMENT_EVIDENCE_REMOVABLE_PACKET_STATUSES.has(packetStatus)'
    );
    const linkLockIndex = unlinkRoute.indexOf('SELECT id, payment_packet_id');
    const deleteIndex = unlinkRoute.indexOf(
      "'DELETE FROM payment_packet_document WHERE id = ? AND payment_packet_id = ?'"
    );

    expect(serverSource).toContain("const PAYMENT_EVIDENCE_REMOVABLE_PACKET_STATUSES = new Set([\n  'draft',\n  'ready_to_send',");
    expect(packetLockIndex).toBeGreaterThanOrEqual(0);
    expect(packetLockIndex).toBeLessThan(statusGuardIndex);
    expect(statusGuardIndex).toBeLessThan(linkLockIndex);
    expect(linkLockIndex).toBeLessThan(deleteIndex);
    expect(unlinkRoute).toContain('validatePaymentPacketAccess(req, packetId, { connection })');
    expect(unlinkRoute).toContain('clearPaymentPacketValidation({ packetId, connection })');
    expect(unlinkRoute).toContain("error: 'packet_not_editable'");
    expect(unlinkRoute).toContain('await connection.commit()');
    expect(unlinkRoute).toContain('await connection.rollback()');
  });
});
