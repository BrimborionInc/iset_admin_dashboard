const fs = require('fs');
const crypto = require('crypto');
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

const mockS3State = {
  checksum: null,
  size: null,
  key: 'uploads/2026/08/06/admin/route-proof.pdf',
  versionId: 'route-version-1',
};

const mockS3Provider = {
  DRIVER: 's3',
  OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
  generateKey: jest.fn(() => mockS3State.key),
  presignPut: jest.fn(async ({ metadata }) => {
    mockS3State.checksum = metadata?.['path-sha256'] || null;
    return {
      url: 'https://object-store.invalid/route-proof',
      headers: { 'If-None-Match': '*' },
    };
  }),
  headObject: jest.fn(async ({ key, versionId }) => ({
    exists: key === mockS3State.key,
    size: mockS3State.size,
    metadata: { 'path-sha256': mockS3State.checksum },
    versionId: versionId || mockS3State.versionId,
  })),
  deleteObject: jest.fn(async ({ versionId }) => ({ deleted: true, versionId })),
};

jest.mock('../../ISET-intake/s3Provider', () => mockS3Provider);
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(async (_url, stream) => {
    if (stream && typeof stream.on === 'function') {
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
        stream.resume();
      });
    }
    return {
      headers: mockS3State.versionId
        ? { 'x-amz-version-id': mockS3State.versionId }
        : {},
    };
  }),
}));

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

function buildManifest(overrides = {}) {
  return {
    caseId: 76,
    applicationId: 123,
    actionPlanId: null,
    clientId: 9,
    applicantUserId: null,
    uploaderUserId: 44,
    source: 'manual_upload',
    fileName: 'proof.pdf',
    filePath: 'uploads/2026/08/06/admin/proof.pdf',
    mimeType: 'application/pdf',
    label: 'Proof',
    metadata: JSON.stringify({ label: 'Proof', document_type: 'ei_verification' }),
    sizeBytes: 12,
    checksumSha256: 'abc123',
    documentCategory: 'ei_verification',
    documentTypeScope: 'application',
    interventionIds: [],
    assessment: null,
    ...overrides,
  };
}

function buildDocumentRow(manifest, overrides = {}) {
  return {
    id: 500,
    case_id: manifest.caseId,
    application_id: manifest.applicationId,
    action_plan_id: manifest.actionPlanId,
    client_id: manifest.clientId,
    applicant_user_id: manifest.applicantUserId,
    user_id: manifest.uploaderUserId,
    source: manifest.source,
    file_name: manifest.fileName,
    file_path: manifest.filePath,
    mime_type: manifest.mimeType,
    label: manifest.label,
    metadata: manifest.metadata,
    size_bytes: manifest.sizeBytes,
    checksum_sha256: manifest.checksumSha256,
    status: 'active',
    document_category: manifest.documentCategory,
    created_at: '2026-08-06 12:00:00',
    updated_at: '2026-08-06 12:00:00',
    ...overrides,
  };
}

function createTransactionConnection({ commit = async () => {} } = {}) {
  return {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(commit),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
    destroy: jest.fn(),
  };
}

describe('admin manual supporting-document upload atomicity', () => {
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  let dependencyStore;
  let routePool;
  let routeState;
  let routeEvents;
  let adminDocumentUploadRowMatchesManifest;
  let inspectAdminDocumentUploadManifest;
  let writeAdminDocumentUploadManifest;
  let inspectAdminDocumentUploadedObject;
  let lockAdminDocumentUploadManifestContext;
  let persistAdminDocumentUploadTransaction;
  let handleAdminDocumentUpload;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    routeState = {
      documentRow: null,
      interventionLinks: [],
      failDocumentInsert: false,
      commitMode: 'ok',
    };
    routeEvents = [];

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      routeEvents.push({ type: 'query', sql, params });

      if (sql.includes('FROM iset_application a') && sql.includes('JOIN iset_case c')) {
        return [[{ id: 76 }], []];
      }
      if (sql === 'SELECT client_id FROM iset_application WHERE id = ? LIMIT 1') {
        return [[{ client_id: 9 }], []];
      }
      if (sql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
        return [[{ client_id: 9 }], []];
      }
      if (sql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 44 }], []];
      }
      if (sql.startsWith('SELECT id, case_id, client_id FROM iset_application')) {
        return [[{ id: 123, case_id: 76, client_id: 9 }], []];
      }
      if (sql.startsWith('SELECT id, client_id FROM iset_case')) {
        return [[{ id: 76, client_id: 9 }], []];
      }
      if (sql.startsWith('SELECT id, applicant_cognito_sub FROM client')) {
        return [[{ id: 9, applicant_cognito_sub: null }], []];
      }
      if (sql.startsWith('SELECT id, cognito_sub FROM user')) {
        return [[{ id: 44, cognito_sub: 'route-staff-subject' }], []];
      }
      if (sql.startsWith('INSERT INTO iset_document ')) {
        if (routeState.failDocumentInsert) {
          throw new Error('route document insert rejected');
        }
        const manifest = buildManifest({
          caseId: params[0],
          applicationId: params[1],
          actionPlanId: params[2],
          clientId: params[3],
          applicantUserId: params[4],
          uploaderUserId: params[5],
          source: params[6],
          fileName: params[7],
          filePath: params[8],
          mimeType: params[9],
          label: params[10],
          metadata: params[11],
          sizeBytes: params[12],
          checksumSha256: params[13],
          documentCategory: params[14],
        });
        routeState.documentRow = buildDocumentRow(manifest);
        return [{ insertId: 500, affectedRows: 1 }, []];
      }
      if (sql.includes('FROM iset_document') && sql.includes('WHERE file_path = ?')) {
        return [[routeState.documentRow].filter(Boolean), []];
      }
      if (sql.startsWith('DELETE FROM iset_document_intervention')) {
        routeState.interventionLinks = [];
        return [{ affectedRows: 0 }, []];
      }
      if (sql.includes('FROM iset_document_intervention')) {
        return [routeState.interventionLinks, []];
      }
      return [[], []];
    });

    routePool = {
      query,
      execute: query,
      getConnection: jest.fn(async () => ({
        query,
        execute: query,
        beginTransaction: jest.fn(async () => routeEvents.push({ type: 'begin' })),
        commit: jest.fn(async () => {
          routeEvents.push({ type: 'commit' });
          if (routeState.commitMode === 'reject_absent') {
            routeState.documentRow = null;
            throw new Error('route commit acknowledgement lost');
          }
          if (routeState.commitMode === 'reject_committed') {
            throw new Error('route commit acknowledgement lost');
          }
        }),
        rollback: jest.fn(async () => routeEvents.push({ type: 'rollback' })),
        release: jest.fn(() => routeEvents.push({ type: 'release' })),
        destroy: jest.fn(() => routeEvents.push({ type: 'destroy' })),
      })),
    };

    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: routePool,
      authnMiddlewareFactory: () => (_req, _res, next) => next(),
    });

    ({
      adminDocumentUploadRowMatchesManifest,
      inspectAdminDocumentUploadManifest,
      writeAdminDocumentUploadManifest,
      inspectAdminDocumentUploadedObject,
      lockAdminDocumentUploadManifestContext,
      persistAdminDocumentUploadTransaction,
      handleAdminDocumentUpload,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
  });

  beforeEach(() => {
    routeState.documentRow = null;
    routeState.interventionLinks = [];
    routeState.failDocumentInsert = false;
    routeState.commitMode = 'ok';
    routeEvents.length = 0;
    mockS3State.checksum = null;
    mockS3State.size = null;
    mockS3State.versionId = 'route-version-1';
    jest.clearAllMocks();
  });

  async function invokeParsedRoute(suffix) {
    const filePath = `/tmp/path-admin-upload-route-${process.pid}-${suffix}.pdf`;
    const contents = Buffer.from(`route upload ${suffix}`);
    fs.writeFileSync(filePath, contents);
    mockS3State.size = contents.length;
    const req = {
      params: { id: '76' },
      body: { applicationId: '123', label: 'Route proof' },
      file: {
        path: filePath,
        originalname: 'route-proof.pdf',
        filename: 'route-proof-temp.pdf',
        mimetype: 'application/pdf',
        size: contents.length,
      },
      auth: {
        subjectType: 'staff',
        sub: 'route-staff-subject',
        email: 'route-staff@example.invalid',
        role: 'System Administrator',
        staffProfileId: 54,
      },
      staffProfile: {
        id: 54,
        display_name: 'Route Staff',
        primary_role: 'System Administrator',
      },
    };

    try {
      const response = await new Promise((resolve, reject) => {
        const res = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(body) {
            resolve({ status: this.statusCode, body });
            return this;
          },
        };
        const handler = handleAdminDocumentUpload(
          { requireApplicant: false },
          { uploadSingle: (_request, _response, callback) => callback(null) }
        );
        try {
          handler(req, res);
        } catch (error) {
          reject(error);
        }
      });
      return { response, contents };
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  test('compares the exact live iset_document result shape and canonical JSON metadata', () => {
    const manifest = buildManifest();
    const row = buildDocumentRow(manifest, {
      metadata: JSON.stringify({ document_type: 'ei_verification', label: 'Proof' }),
    });
    expect(adminDocumentUploadRowMatchesManifest(row, manifest)).toBe(true);
    expect(adminDocumentUploadRowMatchesManifest({ ...row, client_id: 10 }, manifest)).toBe(false);
    expect(adminDocumentUploadRowMatchesManifest({ ...row, file_path: 'other-key' }, manifest)).toBe(false);
  });

  test('verifies the document, assessment update, and exact intervention links as one manifest', async () => {
    const manifest = buildManifest({
      actionPlanId: 88,
      interventionIds: [91, 92],
      assessment: {
        caseId: 76,
        applicationId: 123,
        esdcEligibility: 'crf',
      },
    });
    const row = buildDocumentRow(manifest);
    const connection = {
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        if (sql.includes('FROM iset_document ')) return [[row], []];
        if (sql.includes('FROM iset_application_assessment')) {
          return [[{
            case_id: 76,
            application_id: 123,
            esdc_eligibility: 'crf',
          }], []];
        }
        if (sql.includes('FROM iset_document_intervention')) {
          return [[
            { document_id: 500, intervention_id: 92 },
            { document_id: 500, intervention_id: 91 },
          ], []];
        }
        throw new Error(`unexpected SQL: ${sql}`);
      }),
    };

    await expect(inspectAdminDocumentUploadManifest(connection, manifest)).resolves.toMatchObject({
      state: 'committed',
      documentRow: row,
    });
  });

  test('locks and validates exact application, case, client, applicant, plan, intervention, and type rows', async () => {
    const manifest = buildManifest({
      actionPlanId: 88,
      applicantUserId: 31,
      interventionIds: [91],
    });
    const connection = {
      query: jest.fn(),
    };
    connection.query.mockImplementation(async (sqlValue, params) => {
      const sql = compactSql(sqlValue);
      if (sql.includes('FROM iset_application ')) return [[{ id: 123, case_id: 76, client_id: 9 }], []];
      if (sql.includes('FROM iset_case ')) return [[{ id: 76, client_id: 9 }], []];
      if (sql.includes('FROM iset_case_action_plan')) return [[{ id: 88, case_id: 76, application_id: 123 }], []];
      if (sql.includes('FROM iset_case_intervention')) return [[{ id: 91, case_id: 76, action_plan_id: 88 }], []];
      if (sql.includes('FROM client')) return [[{ id: 9, applicant_cognito_sub: 'participant-subject' }], []];
      if (sql.includes('FROM user')) {
        return [[{
          id: params[0],
          cognito_sub: params[0] === 31 ? 'participant-subject' : 'staff-subject',
        }], []];
      }
      if (sql.includes('FROM document_type')) {
        return [[{ code: 'ei_verification', scope: 'application', is_active: 1 }], []];
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    await expect(lockAdminDocumentUploadManifestContext(connection, manifest)).resolves.toMatchObject({
      interventionIds: [91],
      clientRow: { id: 9 },
    });
    for (const [sqlValue] of connection.query.mock.calls) {
      expect(compactSql(sqlValue)).toContain('FOR UPDATE');
    }
  });

  test('does not swallow an intervention-link failure inside the document transaction', async () => {
    const manifest = buildManifest({ actionPlanId: 88, interventionIds: [91] });
    const row = buildDocumentRow(manifest);
    const connection = {
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        if (sql.startsWith('INSERT INTO iset_document ')) return [{ insertId: 500 }, []];
        if (sql.includes('FROM iset_document ')) return [[row], []];
        if (sql.startsWith('DELETE FROM iset_document_intervention')) return [{ affectedRows: 0 }, []];
        if (sql.startsWith('INSERT INTO iset_document_intervention')) {
          throw new Error('link write rejected');
        }
        throw new Error(`unexpected SQL: ${sql}`);
      }),
    };

    await expect(writeAdminDocumentUploadManifest(connection, manifest)).rejects.toThrow('link write rejected');
  });

  test('writes the document, EI assessment value, and links before accepting the in-transaction manifest', async () => {
    const manifest = buildManifest({
      actionPlanId: 88,
      interventionIds: [91, 92],
      assessment: {
        caseId: 76,
        applicationId: 123,
        esdcEligibility: 'crf',
      },
    });
    const row = buildDocumentRow(manifest);
    let assessmentRow = null;
    let linkRows = [];
    const connection = {
      query: jest.fn(async (sqlValue, params = []) => {
        const sql = compactSql(sqlValue);
        if (sql.startsWith('INSERT INTO iset_document ')) return [{ insertId: 500 }, []];
        if (sql.includes('FROM iset_document ')) return [[row], []];
        if (sql.startsWith('INSERT INTO iset_application_assessment')) {
          assessmentRow = {
            case_id: params[0],
            application_id: params[1],
            esdc_eligibility: params[2],
          };
          return [{ affectedRows: 1 }, []];
        }
        if (sql.startsWith('DELETE FROM iset_document_intervention')) {
          linkRows = [];
          return [{ affectedRows: 0 }, []];
        }
        if (sql.startsWith('INSERT INTO iset_document_intervention')) {
          linkRows = params[0].map(([documentId, interventionId]) => ({
            document_id: documentId,
            intervention_id: interventionId,
          }));
          return [{ affectedRows: linkRows.length }, []];
        }
        if (sql.includes('FROM iset_application_assessment')) return [[assessmentRow], []];
        if (sql.includes('FROM iset_document_intervention')) return [linkRows, []];
        throw new Error(`unexpected SQL: ${sql}`);
      }),
    };

    await expect(writeAdminDocumentUploadManifest(connection, manifest)).resolves.toEqual(row);
    expect(assessmentRow).toEqual({
      case_id: 76,
      application_id: 123,
      esdc_eligibility: 'crf',
    });
    expect(linkRows).toEqual([
      { document_id: 500, intervention_id: 91 },
      { document_id: 500, intervention_id: 92 },
    ]);
  });

  test('commits, then verifies the exact manifest before returning success', async () => {
    const manifest = buildManifest();
    const row = buildDocumentRow(manifest);
    const connection = createTransactionConnection();
    const compensateObject = jest.fn();
    const authorizeManifestContext = jest.fn(async () => {});

    await expect(persistAdminDocumentUploadTransaction(
      {
        manifest,
        uploadedObject: { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true },
      },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => {}),
        authorizeManifestContext,
        writeManifest: jest.fn(async () => row),
        reconcileCommit: jest.fn(async () => ({ state: 'committed', documentRow: row })),
        compensateObject,
      }
    )).resolves.toEqual({ documentRow: row, recoveredCommit: false });
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(compensateObject).not.toHaveBeenCalled();
    expect(authorizeManifestContext).toHaveBeenCalledWith(connection, manifest);
  });

  test('rolls back and deletes only the exact S3 version after a pre-commit failure', async () => {
    const manifest = buildManifest();
    const uploadedObject = { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true };
    const connection = createTransactionConnection();
    const writeError = new Error('document insert rejected');
    const compensateObject = jest.fn(async object => {
      expect(object).toEqual(uploadedObject);
    });

    await expect(persistAdminDocumentUploadTransaction(
      { manifest, uploadedObject },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => {}),
        writeManifest: jest.fn(async () => { throw writeError; }),
        compensateObject,
      }
    )).rejects.toMatchObject({
      message: 'document insert rejected',
      commitOutcome: 'not_attempted',
      objectCompensated: true,
      retrySafe: true,
    });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(compensateObject).toHaveBeenCalledTimes(1);
  });

  test('fails closed when exact pre-commit object compensation cannot be verified', async () => {
    const manifest = buildManifest();
    const connection = createTransactionConnection();
    await expect(persistAdminDocumentUploadTransaction(
      {
        manifest,
        uploadedObject: { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true },
      },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => { throw new Error('context changed'); }),
        compensateObject: jest.fn(async () => { throw new Error('delete not acknowledged'); }),
      }
    )).rejects.toMatchObject({
      code: 'document_upload_compensation_failed',
      commitOutcome: 'not_attempted',
      retrySafe: false,
      manualReviewRequired: true,
    });
  });

  test('retains the exact object when the database rollback outcome is uncertain', async () => {
    const manifest = buildManifest();
    const connection = createTransactionConnection();
    connection.rollback.mockRejectedValueOnce(new Error('rollback acknowledgement lost'));
    const compensateObject = jest.fn();

    await expect(persistAdminDocumentUploadTransaction(
      {
        manifest,
        uploadedObject: { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true },
      },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => {}),
        writeManifest: jest.fn(async () => { throw new Error('document insert rejected'); }),
        compensateObject,
      }
    )).rejects.toMatchObject({
      code: 'document_upload_rollback_outcome_uncertain',
      commitOutcome: 'uncertain',
      retrySafe: false,
      manualReviewRequired: true,
    });
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(compensateObject).not.toHaveBeenCalled();
  });

  test('recovers a rejected COMMIT only when a fresh exact manifest is present', async () => {
    const manifest = buildManifest();
    const row = buildDocumentRow(manifest);
    const connection = createTransactionConnection({
      commit: async () => { throw new Error('acknowledgement lost'); },
    });
    const compensateObject = jest.fn();

    await expect(persistAdminDocumentUploadTransaction(
      {
        manifest,
        uploadedObject: { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true },
      },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => {}),
        writeManifest: jest.fn(async () => row),
        reconcileCommit: jest.fn(async () => ({ state: 'committed', documentRow: row })),
        compensateObject,
      }
    )).resolves.toEqual({ documentRow: row, recoveredCommit: true });
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(compensateObject).not.toHaveBeenCalled();
  });

  test('treats absence after a rejected COMMIT as uncertain and retains the object', async () => {
    const manifest = buildManifest();
    const row = buildDocumentRow(manifest);
    const connection = createTransactionConnection({
      commit: async () => { throw new Error('acknowledgement lost'); },
    });
    const compensateObject = jest.fn();

    await expect(persistAdminDocumentUploadTransaction(
      {
        manifest,
        uploadedObject: { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true },
      },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => {}),
        writeManifest: jest.fn(async () => row),
        reconcileCommit: jest.fn(async () => ({ state: 'absent', documentRow: null })),
        compensateObject,
      }
    )).rejects.toMatchObject({
      code: 'document_upload_commit_outcome_uncertain',
      commitOutcome: 'uncertain',
      reconciliationState: 'absent',
      retrySafe: false,
      manualReviewRequired: true,
    });
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(compensateObject).not.toHaveBeenCalled();
  });

  test('retains the object when the acknowledged commit cannot be verified exactly', async () => {
    const manifest = buildManifest();
    const row = buildDocumentRow(manifest);
    const connection = createTransactionConnection();
    const compensateObject = jest.fn();

    await expect(persistAdminDocumentUploadTransaction(
      {
        manifest,
        uploadedObject: { key: manifest.filePath, versionId: 'v1', versionIdentityVerified: true },
      },
      {
        getConnection: async () => connection,
        lockManifestContext: jest.fn(async () => {}),
        writeManifest: jest.fn(async () => row),
        reconcileCommit: jest.fn(async () => ({ state: 'partial', documentRow: row })),
        compensateObject,
      }
    )).rejects.toMatchObject({
      code: 'document_upload_post_commit_unverified',
      commitOutcome: 'committed_unverified',
      retrySafe: false,
      manualReviewRequired: true,
    });
    expect(compensateObject).not.toHaveBeenCalled();
  });

  test('verifies S3 size, checksum metadata, and exact version identity', async () => {
    const provider = {
      OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
      deleteObject: jest.fn(),
      headObject: jest.fn(async () => ({
        exists: true,
        size: 12,
        metadata: { 'path-sha256': 'abc123' },
        versionId: 'v1',
      })),
    };
    await expect(inspectAdminDocumentUploadedObject({
      provider,
      key: 'uploads/proof.pdf',
      responseHeaders: { 'x-amz-version-id': 'v1' },
      sizeBytes: 12,
      checksumSha256: 'abc123',
    })).resolves.toMatchObject({
      key: 'uploads/proof.pdf',
      versionId: 'v1',
      versionIdentityVerified: true,
      objectIdentityVerified: true,
      identityMode: 'version',
    });
  });

  test('does not claim safe retry when an acknowledged unversioned upload is absent on verification', async () => {
    const provider = {
      OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
      deleteObject: jest.fn(),
      headObject: jest.fn(async () => ({ exists: false })),
    };
    await expect(inspectAdminDocumentUploadedObject({
      provider,
      key: 'uploads/proof.pdf',
      responseHeaders: {},
      sizeBytes: 12,
      checksumSha256: 'abc123',
      putAcknowledged: true,
    })).rejects.toMatchObject({
      code: 's3_upload_outcome_ambiguous',
      uploadedObject: {
        key: 'uploads/proof.pdf',
        versionId: null,
        versionIdentityVerified: false,
      },
    });
  });

  test('rejects a present upload when S3 cannot provide exact version identity', async () => {
    const provider = {
      OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
      deleteObject: jest.fn(),
      headObject: jest.fn(async () => ({
        exists: true,
        size: 12,
        metadata: { 'path-sha256': 'abc123' },
        versionId: null,
      })),
    };
    await expect(inspectAdminDocumentUploadedObject({
      provider,
      key: 'uploads/proof.pdf',
      responseHeaders: {},
      sizeBytes: 12,
      checksumSha256: 'abc123',
      putAcknowledged: true,
    })).rejects.toMatchObject({
      code: 's3_upload_outcome_ambiguous',
      uploadedObject: {
        key: 'uploads/proof.pdf',
        versionId: null,
        versionIdentityVerified: false,
      },
    });
  });

  test('accepts an acknowledged request-owned unversioned upload after checksum and size verification', async () => {
    const provider = {
      OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
      deleteObject: jest.fn(),
      headObject: jest.fn(async () => ({
        exists: true,
        size: 12,
        metadata: { 'path-sha256': 'abc123' },
        versionId: null,
      })),
    };
    await expect(inspectAdminDocumentUploadedObject({
      provider,
      key: 'uploads/proof.pdf',
      responseHeaders: {},
      sizeBytes: 12,
      checksumSha256: 'abc123',
      putAcknowledged: true,
      requestOwnedKey: true,
    })).resolves.toMatchObject({
      key: 'uploads/proof.pdf',
      versionId: null,
      versionIdentityVerified: false,
      objectIdentityVerified: true,
      identityMode: 'request_owned_key_checksum',
      requestOwnedKey: true,
      sizeBytes: 12,
      checksumSha256: 'abc123',
    });
  });

  test('executes the real parsed route boundary through S3, transaction, reconciliation, and response', async () => {
    const { response, contents } = await invokeParsedRoute('success');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
        ok: true,
        message: 'uploaded',
        document: {
          id: 500,
          case_id: 76,
          application_id: 123,
          client_id: 9,
          file_path: mockS3State.key,
          status: 'active',
        },
      });
    expect(mockS3Provider.presignPut).toHaveBeenCalledWith(expect.objectContaining({
      ifNoneMatch: '*',
      metadata: {
        'path-sha256': crypto.createHash('sha256').update(contents).digest('hex'),
      },
    }));
    expect(mockS3Provider.headObject).toHaveBeenCalledWith({
      key: mockS3State.key,
      versionId: 'route-version-1',
    });
    expect(mockS3Provider.deleteObject).not.toHaveBeenCalled();
    expect(routeEvents.some(event => event.type === 'begin')).toBe(true);
    expect(routeEvents.some(event => event.type === 'commit')).toBe(true);
    expect(routePool.getConnection).toHaveBeenCalledTimes(2);
    const documentInsert = routeEvents.find(event => (
      event.type === 'query' && event.sql.startsWith('INSERT INTO iset_document ')
    ));
    expect(documentInsert.sql).not.toContain('ON DUPLICATE KEY UPDATE');
  });

  test('the real parsed route rolls back and exactly compensates a pre-commit database failure', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    routeState.failDocumentInsert = true;
    try {
      const { response } = await invokeParsedRoute('precommit-failure');
      expect(response).toEqual({
        status: 500,
        body: {
          error: 'document_store_failed',
          retrySafe: true,
        },
      });
      expect(routeEvents.some(event => event.type === 'rollback')).toBe(true);
      expect(routeEvents.some(event => event.type === 'commit')).toBe(false);
      expect(mockS3Provider.deleteObject).toHaveBeenCalledWith({
        key: mockS3State.key,
        versionId: 'route-version-1',
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  test('the real parsed route accepts an unversioned request-owned upload and key-compensates a confirmed rollback', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockS3State.versionId = null;
    routeState.failDocumentInsert = true;
    try {
      const { response } = await invokeParsedRoute('unversioned-precommit-failure');
      expect(response).toEqual({
        status: 500,
        body: {
          error: 'document_store_failed',
          retrySafe: true,
        },
      });
      expect(routeEvents.some(event => event.type === 'rollback')).toBe(true);
      expect(mockS3Provider.headObject).toHaveBeenCalledWith({
        key: mockS3State.key,
        versionId: null,
      });
      expect(mockS3Provider.headObject).toHaveBeenCalledWith({ key: mockS3State.key });
      expect(mockS3Provider.deleteObject).toHaveBeenCalledWith({
        key: mockS3State.key,
        versionId: null,
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  test('the real parsed route retains the object and forbids retry when rejected COMMIT reconciles absent', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    routeState.commitMode = 'reject_absent';
    try {
      const { response } = await invokeParsedRoute('uncertain-commit');
      expect(response).toEqual({
        status: 503,
        body: {
          error: 'document_upload_commit_outcome_uncertain',
          retrySafe: false,
          manualReviewRequired: true,
        },
      });
      expect(routeEvents.some(event => event.type === 'commit')).toBe(true);
      expect(routeEvents.some(event => event.type === 'rollback')).toBe(false);
      expect(routeEvents.some(event => event.type === 'destroy')).toBe(true);
      expect(mockS3Provider.deleteObject).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
