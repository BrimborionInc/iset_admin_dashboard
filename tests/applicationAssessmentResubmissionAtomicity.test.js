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

const objectState = {
  key: 'uploads/2026/08/06/44/assessment-v2.pdf',
  versionId: 'assessment-version-2',
  size: 0,
  checksum: null,
  exists: true,
};

const mockS3Provider = {
  DRIVER: 's3',
  OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
  generateKey: jest.fn(() => objectState.key),
  presignPut: jest.fn(async ({ metadata }) => {
    objectState.checksum = metadata?.['path-sha256'] || null;
    return {
      url: 'https://object-store.invalid/assessment-v2',
      headers: { 'If-None-Match': '*' },
    };
  }),
  headObject: jest.fn(async ({ key, versionId }) => ({
    exists: objectState.exists && key === objectState.key,
    versionId: versionId || objectState.versionId,
    size: objectState.size,
    metadata: { 'path-sha256': objectState.checksum },
  })),
  deleteObject: jest.fn(async ({ key, versionId }) => {
    if (key !== objectState.key || versionId !== objectState.versionId) {
      throw new Error('wrong object version');
    }
    objectState.exists = false;
    return { deleted: true, versionId };
  }),
};

const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(async () => ({
    headers: objectState.versionId
      ? { 'x-amz-version-id': objectState.versionId }
      : {},
  })),
};

jest.mock('../../ISET-intake/s3Provider', () => mockS3Provider);
jest.mock('axios', () => mockAxios);

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

describe('application assessment resubmission atomicity', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let storeAssessmentPdfDocument;
  let storeFundingOverviewPdfDocument;
  let storeFundingAgreementPdfDocument;
  let inspectAssessmentGeneratedObjectUpload;
  let compensateAssessmentGeneratedObjects;
  let lockAssessmentApplicationThenCase;
  let buildAssessmentResubmissionCommitManifest;
  let inspectAssessmentResubmissionCommitOutcome;
  let commitAssessmentResubmissionTransaction;
  let recoverAssessmentResubmissionFailure;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      storeAssessmentPdfDocument,
      storeFundingOverviewPdfDocument,
      storeFundingAgreementPdfDocument,
      inspectAssessmentGeneratedObjectUpload,
      compensateAssessmentGeneratedObjects,
      lockAssessmentApplicationThenCase,
      buildAssessmentResubmissionCommitManifest,
      inspectAssessmentResubmissionCommitOutcome,
      commitAssessmentResubmissionTransaction,
      recoverAssessmentResubmissionFailure,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  beforeEach(() => {
    objectState.versionId = 'assessment-version-2';
    objectState.size = 0;
    objectState.checksum = null;
    objectState.exists = true;
    jest.clearAllMocks();
  });

  test('the real assessment PDF writer tracks the exact verified S3 version and database document identity', async () => {
    const pdfBuffer = Buffer.from('corrected assessment v2');
    objectState.size = pdfBuffer.length;
    const uploads = [];
    const connection = {
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        if (sql.startsWith('INSERT INTO iset_document')) {
          return [{ insertId: 8802, affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(storeAssessmentPdfDocument({
      applicationId: 123,
      caseId: 76,
      clientId: 9,
      applicantUserId: 44,
      actorUserId: 71,
      trackingId: 'PATH-123',
      pdfBuffer,
      documentType: 'case_assessment',
      versionNumber: 2,
      archivePreviousActive: false,
      replaceExistingVersion: false,
      connection,
      uploadedObjectKeys: uploads,
    })).resolves.toBe(8802);

    expect(mockS3Provider.presignPut).toHaveBeenCalledWith(expect.objectContaining({
      key: objectState.key,
      ifNoneMatch: '*',
      metadata: { 'path-sha256': expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
    expect(mockS3Provider.headObject).toHaveBeenCalledWith({
      key: objectState.key,
      versionId: objectState.versionId,
    });
    expect(uploads).toEqual([expect.objectContaining({
      key: objectState.key,
      versionId: objectState.versionId,
      versionIdentityVerified: true,
      documentId: 8802,
      caseId: 76,
      applicationId: 123,
      documentCategory: 'case_assessment',
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })]);
  });

  test('an acknowledged upload without a version header is accepted only after exact HEAD verification', async () => {
    const uploadRecord = {
      key: objectState.key,
      versionId: null,
      versionIdentityVerified: false,
      requestOwnedKey: true,
    };
    objectState.size = 12;
    objectState.checksum = 'checksum-12';
    await expect(inspectAssessmentGeneratedObjectUpload({
      provider: mockS3Provider,
      uploadRecord,
      responseHeaders: {},
      sizeBytes: 12,
      checksumSha256: 'checksum-12',
      putAcknowledged: true,
    })).resolves.toMatchObject({
      versionId: objectState.versionId,
      versionIdentityVerified: true,
    });
    expect(mockS3Provider.headObject).toHaveBeenCalledWith({
      key: objectState.key,
      versionId: null,
    });
  });

  test('the real assessment PDF writer accepts a checksum-verified request-owned key in an unversioned bucket', async () => {
    const pdfBuffer = Buffer.from('corrected assessment unversioned');
    objectState.versionId = null;
    objectState.size = pdfBuffer.length;
    const uploads = [];
    const connection = {
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        if (sql.startsWith('INSERT INTO iset_document')) {
          return [{ insertId: 8804, affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(storeAssessmentPdfDocument({
      applicationId: 123,
      caseId: 76,
      clientId: 9,
      applicantUserId: 44,
      actorUserId: 71,
      trackingId: 'PATH-123',
      pdfBuffer,
      documentType: 'case_assessment',
      versionNumber: 2,
      archivePreviousActive: false,
      replaceExistingVersion: false,
      connection,
      uploadedObjectKeys: uploads,
    })).resolves.toBe(8804);

    expect(uploads).toEqual([expect.objectContaining({
      key: objectState.key,
      versionId: null,
      versionIdentityVerified: false,
      objectIdentityVerified: true,
      identityMode: 'request_owned_key_checksum',
      requestOwnedKey: true,
      sizeBytes: pdfBuffer.length,
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      documentId: 8804,
    })]);
  });

  test.each([
    ['Financial Overview', async ({ pdfBuffer, uploads, connection }) => storeFundingOverviewPdfDocument({
      caseId: 76,
      applicationId: 123,
      actionPlanId: 88,
      clientId: 9,
      applicantUserId: 44,
      actorUserId: 71,
      versionNumber: 2,
      trackingId: 'PATH-123',
      fundingOverviewVersionId: 902,
      pdfBuffer,
      connection,
      uploadedObjectKeys: uploads,
    })],
    ['CFA', async ({ pdfBuffer, uploads, connection }) => storeFundingAgreementPdfDocument({
      caseId: 76,
      applicationId: 123,
      actionPlanId: 88,
      clientId: 9,
      applicantUserId: 44,
      actorUserId: 71,
      versionNumber: 2,
      trackingId: 'PATH-123',
      cfaVersionId: 903,
      pdfBuffer,
      connection,
      uploadedObjectKeys: uploads,
    })],
  ])('the real %s writer signs and verifies unversioned rollback identity', async (_label, writeDocument) => {
    const pdfBuffer = Buffer.from(`generated ${_label} unversioned`);
    objectState.versionId = null;
    objectState.size = pdfBuffer.length;
    const uploads = [];
    const connection = {
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        if (sql.startsWith('INSERT INTO iset_document')) {
          return [{ insertId: 8810, affectedRows: 1 }, []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(writeDocument({ pdfBuffer, uploads, connection })).resolves.toBe(8810);
    const checksumSha256 = uploads[0]?.checksumSha256;
    expect(mockS3Provider.presignPut).toHaveBeenCalledWith(expect.objectContaining({
      key: objectState.key,
      ifNoneMatch: '*',
      metadata: { 'path-sha256': checksumSha256 },
    }));
    expect(uploads).toEqual([expect.objectContaining({
      key: objectState.key,
      versionId: null,
      versionIdentityVerified: false,
      objectIdentityVerified: true,
      identityMode: 'request_owned_key_checksum',
      requestOwnedKey: true,
      sizeBytes: pdfBuffer.length,
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })]);
  });

  test('confirmed rollback compensates only the exact uploaded version and remains safely retryable', async () => {
    const connection = {
      rollback: jest.fn(async () => {}),
      release: jest.fn(),
      destroy: jest.fn(),
    };
    const originalError = new Error('document insert failed');
    const uploads = [{
      key: objectState.key,
      versionId: objectState.versionId,
      versionIdentityVerified: true,
    }];

    const responseError = await recoverAssessmentResubmissionFailure({
      connection,
      transactionStarted: true,
      commitAttempted: false,
      uploadedObjects: uploads,
      originalError,
    });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.destroy).not.toHaveBeenCalled();
    expect(mockS3Provider.deleteObject).toHaveBeenCalledWith({
      key: objectState.key,
      versionId: objectState.versionId,
    });
    expect(responseError).toBe(originalError);
    expect(responseError).toMatchObject({
      retrySafe: true,
      manualReviewRequired: false,
      objectCompensated: true,
      commitOutcome: 'not_attempted',
    });
  });

  test('confirmed rollback rechecks and removes only its request-owned unversioned object', async () => {
    objectState.versionId = null;
    objectState.size = 12;
    objectState.checksum = 'checksum-12';
    const connection = {
      rollback: jest.fn(async () => {}),
      release: jest.fn(),
      destroy: jest.fn(),
    };
    const originalError = new Error('document insert failed');
    const uploads = [{
      key: objectState.key,
      versionId: null,
      versionIdentityVerified: false,
      objectIdentityVerified: true,
      identityMode: 'request_owned_key_checksum',
      requestOwnedKey: true,
      sizeBytes: 12,
      checksumSha256: 'checksum-12',
    }];

    const responseError = await recoverAssessmentResubmissionFailure({
      connection,
      transactionStarted: true,
      commitAttempted: false,
      uploadedObjects: uploads,
      originalError,
    });

    expect(mockS3Provider.headObject).toHaveBeenCalledWith({ key: objectState.key });
    expect(mockS3Provider.deleteObject).toHaveBeenCalledWith({
      key: objectState.key,
      versionId: null,
    });
    expect(responseError).toMatchObject({
      retrySafe: true,
      manualReviewRequired: false,
      objectCompensated: true,
      commitOutcome: 'not_attempted',
    });
  });

  test('rollback acknowledgement loss destroys the unsafe connection, retains the object, and requires manual review', async () => {
    const connection = {
      rollback: jest.fn(async () => { throw new Error('socket closed during rollback'); }),
      release: jest.fn(),
      destroy: jest.fn(),
    };
    const responseError = await recoverAssessmentResubmissionFailure({
      connection,
      transactionStarted: true,
      uploadedObjects: [{
        key: objectState.key,
        versionId: objectState.versionId,
        versionIdentityVerified: true,
      }],
      originalError: new Error('write failed'),
    });

    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.release).not.toHaveBeenCalled();
    expect(mockS3Provider.deleteObject).not.toHaveBeenCalled();
    expect(responseError).toMatchObject({
      code: 'assessment_resubmit_rollback_outcome_uncertain',
      retrySafe: false,
      manualReviewRequired: true,
      commitOutcome: 'uncertain',
    });
  });

  test('COMMIT acknowledgement loss reconciles an exact committed manifest and destroys the original connection', async () => {
    const connection = {
      commit: jest.fn(async () => { throw new Error('commit response lost'); }),
      destroy: jest.fn(),
      release: jest.fn(),
    };
    const inspectCommitFn = jest.fn(async () => ({ outcome: 'committed' }));
    await expect(commitAssessmentResubmissionTransaction({
      connection,
      manifest: { caseId: 76, applicationId: 123, documents: [{ id: 8802 }] },
      inspectCommitFn,
    })).resolves.toMatchObject({
      outcome: 'committed',
      recovered: true,
      connectionDestroyed: true,
    });
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.release).not.toHaveBeenCalled();
    expect(inspectCommitFn).toHaveBeenCalledTimes(1);
  });

  test('unreconciled COMMIT acknowledgement loss is non-retryable and retains generated objects', async () => {
    const connection = {
      commit: jest.fn(async () => { throw new Error('commit response lost'); }),
      destroy: jest.fn(),
    };
    await expect(commitAssessmentResubmissionTransaction({
      connection,
      manifest: { caseId: 76, applicationId: 123, documents: [{ id: 8802 }] },
      inspectCommitFn: async () => ({ outcome: 'uncertain', reason: 'not observed' }),
    })).rejects.toMatchObject({
      code: 'assessment_resubmit_commit_outcome_uncertain',
      commitOutcome: 'uncertain',
      retrySafe: false,
      manualReviewRequired: true,
      connectionDestroyed: true,
    });
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(mockS3Provider.deleteObject).not.toHaveBeenCalled();
  });

  test('failed exact compensation is non-retryable and requires manual review', async () => {
    const connection = {
      rollback: jest.fn(async () => {}),
      release: jest.fn(),
      destroy: jest.fn(),
    };
    const responseError = await recoverAssessmentResubmissionFailure({
      connection,
      transactionStarted: true,
      uploadedObjects: [{
        key: objectState.key,
        versionId: objectState.versionId,
        versionIdentityVerified: true,
      }],
      originalError: new Error('insert failed'),
      cleanupFn: async () => ({ attempted: 1, deleted: 0, failed: 1 }),
    });
    expect(responseError).toMatchObject({
      code: 'assessment_resubmit_cleanup_incomplete',
      retrySafe: false,
      manualReviewRequired: true,
    });
  });

  test('commit reconciliation requires every exact live-schema-faithful document identity', async () => {
    const manifest = {
      caseId: 76,
      applicationId: 123,
      documents: [
        {
          id: 8802,
          caseId: 76,
          applicationId: 123,
          filePath: 'uploads/assessment-v2.pdf',
          checksumSha256: 'sum-v2',
          documentCategory: 'case_assessment',
        },
        {
          id: 8803,
          caseId: 76,
          applicationId: 123,
          filePath: 'uploads/application-form.pdf',
          checksumSha256: 'sum-form',
          documentCategory: 'application_form',
        },
      ],
    };
    const exactRows = manifest.documents.map(document => ({
      id: document.id,
      case_id: document.caseId,
      application_id: document.applicationId,
      file_path: document.filePath,
      checksum_sha256: document.checksumSha256,
      status: 'active',
      document_category: document.documentCategory,
    }));
    const exactConnection = { query: jest.fn(async () => [exactRows, []]) };
    await expect(inspectAssessmentResubmissionCommitOutcome({
      manifest,
      connection: exactConnection,
    })).resolves.toMatchObject({ outcome: 'committed', documentIds: [8802, 8803] });

    const mismatchConnection = {
      query: jest.fn(async () => [[exactRows[0], { ...exactRows[1], application_id: 999 }], []]),
    };
    await expect(inspectAssessmentResubmissionCommitOutcome({
      manifest,
      connection: mismatchConnection,
    })).resolves.toMatchObject({
      outcome: 'uncertain',
      reason: 'assessment_commit_manifest_not_observed',
    });
  });

  test('application-scoped mutations acquire the application before the case and reject cross-case scope', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        calls.push(sql);
        if (sql.startsWith('SELECT id, case_id FROM iset_application')) {
          return [[{ id: 123, case_id: 76 }], []];
        }
        if (sql.startsWith('SELECT id FROM iset_case')) {
          return [[{ id: 76 }], []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };
    await expect(lockAssessmentApplicationThenCase(connection, {
      applicationId: 123,
      caseId: 76,
    })).resolves.toMatchObject({
      applicationRow: { id: 123, case_id: 76 },
      caseRow: { id: 76 },
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^SELECT id, case_id FROM iset_application/);
    expect(calls[1]).toMatch(/^SELECT id FROM iset_case/);

    const mismatchConnection = {
      query: jest.fn(async () => [[{ id: 123, case_id: 77 }], []]),
    };
    await expect(lockAssessmentApplicationThenCase(mismatchConnection, {
      applicationId: 123,
      caseId: 76,
    })).rejects.toMatchObject({ code: 'application_case_mismatch' });
    expect(mismatchConnection.query).toHaveBeenCalledTimes(1);
  });

  test('two concurrent application-scoped submissions serialize on the application lock', async () => {
    const waiters = [];
    let applicationLocked = false;
    const owners = [];
    const releaseApplication = () => {
      applicationLocked = false;
      const next = waiters.shift();
      if (next) next();
    };
    const makeConnection = name => ({
      query: jest.fn(async sqlValue => {
        const sql = compactSql(sqlValue);
        if (sql.startsWith('SELECT id, case_id FROM iset_application')) {
          if (applicationLocked) {
            await new Promise(resolve => waiters.push(resolve));
          }
          applicationLocked = true;
          owners.push(name);
          return [[{ id: 123, case_id: 76 }], []];
        }
        if (sql.startsWith('SELECT id FROM iset_case')) {
          return [[{ id: 76 }], []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    });

    const first = lockAssessmentApplicationThenCase(makeConnection('first'), {
      applicationId: 123,
      caseId: 76,
    });
    await first;
    let secondResolved = false;
    const second = lockAssessmentApplicationThenCase(makeConnection('second'), {
      applicationId: 123,
      caseId: 76,
    }).then(value => {
      secondResolved = true;
      return value;
    });
    await Promise.resolve();
    expect(secondResolved).toBe(false);
    expect(owners).toEqual(['first']);
    releaseApplication();
    await second;
    expect(owners).toEqual(['first', 'second']);
    releaseApplication();
  });

  test('the commit manifest contains one identity for every inserted generated document', () => {
    expect(buildAssessmentResubmissionCommitManifest({
      caseId: 76,
      applicationId: 123,
      uploadedObjects: [
        {
          key: 'uploads/assessment.pdf',
          versionId: 'v1',
          versionIdentityVerified: true,
          documentId: 8802,
          caseId: 76,
          applicationId: 123,
          documentCategory: 'case_assessment',
          checksumSha256: 'sum-1',
        },
        {
          key: 'uploads/form.pdf',
          versionId: 'v2',
          versionIdentityVerified: true,
          documentId: 8803,
          caseId: 76,
          applicationId: 123,
          documentCategory: 'application_form',
          checksumSha256: 'sum-2',
        },
      ],
    })).toEqual({
      caseId: 76,
      applicationId: 123,
      documents: [
        {
          id: 8802,
          caseId: 76,
          applicationId: 123,
          filePath: 'uploads/assessment.pdf',
          checksumSha256: 'sum-1',
          documentCategory: 'case_assessment',
        },
        {
          id: 8803,
          caseId: 76,
          applicationId: 123,
          filePath: 'uploads/form.pdf',
          checksumSha256: 'sum-2',
          documentCategory: 'application_form',
        },
      ],
    });
  });

  test('exact compensation rejects unresolved versions instead of deleting a key blindly', async () => {
    await expect(compensateAssessmentGeneratedObjects([{
      key: objectState.key,
      versionId: null,
      versionIdentityVerified: false,
    }], { provider: mockS3Provider })).resolves.toEqual({
      attempted: 1,
      deleted: 0,
      failed: 1,
    });
    expect(mockS3Provider.deleteObject).not.toHaveBeenCalled();
  });
});
