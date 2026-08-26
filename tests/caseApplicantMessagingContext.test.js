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

describe('case applicant messaging context ownership', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;
  let resolveCaseApplicantMessagingContext;
  let resolveClientIdFromApplicantUserId;
  let resolveClientIdForDocument;
  let buildCfaSnapshot;
  let buildCfaSnapshotFromAssessment;
  let buildFundingOverviewSnapshot;
  let validateApplicantCaseBinding;
  let validateApplicantDocumentContextAccess;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    ({
      resolveCaseApplicantMessagingContext,
      resolveClientIdFromApplicantUserId,
      resolveClientIdForDocument,
      buildCfaSnapshot,
      buildCfaSnapshotFromAssessment,
      buildFundingOverviewSnapshot,
      validateApplicantCaseBinding,
      validateApplicantDocumentContextAccess,
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

  test('case-only scope resolves the case client account without consulting a newer sibling application', async () => {
    const queries = [];
    const connection = {
      query: jest.fn(async (sqlValue, params) => {
        queries.push({ sql: compactSql(sqlValue), params: [...params] });
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: null,
          applicant_submission_user_id: null,
          applicant_submission_client_id: null,
          applicant_client_sub_user_id: 700,
          client_name: 'Case Participant',
          client_email: 'participant@example.invalid',
          applicant_name: 'Case Participant',
          applicant_email: 'participant@example.invalid',
          case_number: 'CASE-76',
        }], []];
      }),
    };

    const context = await resolveCaseApplicantMessagingContext(76, { connection });

    expect(queries).toHaveLength(1);
    expect(queries[0].params).toEqual([76]);
    expect(queries[0].sql).toContain('NULL AS application_id');
    expect(queries[0].sql).not.toContain('JOIN iset_application ');
    expect(queries[0].sql).not.toContain('iset_application_submission');
    expect(queries[0].sql).not.toContain('applicant_submission.');
    expect(context).toEqual(expect.objectContaining({
      case_id: 76,
      application_id: null,
      applicant_user_id: 700,
      applicant_resolution_source: 'client_cognito_sub',
      applicant_resolution_conflict: false,
    }));
  });

  test('an exact application cannot let a manual submission author veto the case participant', async () => {
    const queries = [];
    const connection = {
      query: jest.fn(async (sqlValue, params) => {
        queries.push({ sql: compactSql(sqlValue), params: [...params] });
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: 123,
          application_client_id: 501,
          applicant_submission_user_id: 701,
          applicant_client_sub_user_id: 700,
          client_name: 'Case Participant',
          client_email: 'participant@example.invalid',
          applicant_name: 'Case Participant',
          applicant_email: 'participant@example.invalid',
          submission_reference: 'APP-123',
          case_number: 'CASE-76',
        }], []];
      }),
    };

    const context = await resolveCaseApplicantMessagingContext(76, {
      applicationId: 123,
      connection,
      forUpdate: true,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].params).toEqual([123, 76]);
    expect(queries[0].sql).toContain('JOIN iset_application a ON a.case_id = c.id AND a.id = ?');
    expect(queries[0].sql).not.toContain('ORDER BY');
    expect(queries[0].sql).toMatch(/LIMIT 1 FOR UPDATE$/);
    expect(context).toEqual(expect.objectContaining({
      case_id: 76,
      application_id: 123,
      applicant_user_id: 700,
      applicant_resolution_source: 'client_cognito_sub',
      applicant_resolution_conflict: false,
      applicant_name: 'Case Participant',
      applicant_email: 'participant@example.invalid',
    }));
  });

  test('blank client account keys are unlinked and cannot override exact submission authority', async () => {
    const connection = {
      query: jest.fn(async (sqlValue, params) => {
        const sql = compactSql(sqlValue);
        const hasNonBlankClientGuard = sql.includes(
          "NULLIF(TRIM(cl.applicant_cognito_sub), '') IS NOT NULL"
        );
        const hasNonBlankUserGuard = sql.includes(
          "NULLIF(TRIM(applicant_client_sub.cognito_sub), '') IS NOT NULL"
        );
        expect(hasNonBlankClientGuard).toBe(true);
        expect(hasNonBlankUserGuard).toBe(true);
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: params.length === 2 ? 123 : null,
          application_client_id: params.length === 2 ? 501 : null,
          applicant_submission_user_id: params.length === 2 ? 701 : null,
          // This models MySQL matching an unrelated blank-sub user if either
          // nonblank predicate is ever removed from the join.
          applicant_client_sub_user_id:
            hasNonBlankClientGuard && hasNonBlankUserGuard ? null : 999,
          client_applicant_cognito_sub: params.length === 2 ? '   ' : '',
          client_name: 'Unlinked Case Participant',
          client_email: 'participant@example.invalid',
          applicant_name: 'Exact Submission Participant',
          applicant_email: 'submission@example.invalid',
          case_number: 'CASE-76',
        }], []];
      }),
    };

    await expect(resolveCaseApplicantMessagingContext(76, {
      applicationId: 123,
      connection,
    })).resolves.toEqual(expect.objectContaining({
      applicant_user_id: 701,
      applicant_resolution_source: 'exact_application_submission_user_id',
      applicant_resolution_conflict: false,
    }));
    await expect(resolveCaseApplicantMessagingContext(76, {
      connection,
    })).resolves.toEqual(expect.objectContaining({
      applicant_user_id: null,
      applicant_resolution_source: null,
      applicant_resolution_conflict: false,
    }));
  });

  test('a populated but unresolved client account link never falls back to the submission user', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        case_id: 76,
        client_id: 501,
        application_id: 123,
        application_client_id: 501,
        applicant_submission_user_id: 701,
        applicant_client_sub_user_id: null,
        client_applicant_cognito_sub: 'current-participant-sub',
        client_name: 'Current Case Participant',
        client_email: 'current@example.invalid',
        applicant_name: 'Historical Submission User',
        applicant_email: 'historical@example.invalid',
        case_number: 'CASE-76',
      }], []]),
    };

    await expect(resolveCaseApplicantMessagingContext(76, {
      applicationId: 123,
      connection,
    })).resolves.toEqual(expect.objectContaining({
      applicant_user_id: null,
      applicant_resolution_source: null,
      applicant_resolution_conflict: true,
      applicant_identity_conflict: true,
      application_scope_conflict: false,
      applicant_name: 'Current Case Participant',
      applicant_email: 'current@example.invalid',
    }));
  });

  test('blank applicant keys add no false document client candidate', async () => {
    const queries = [];
    const connection = {
      query: jest.fn(async (sqlValue, params) => {
        const sql = compactSql(sqlValue);
        queries.push({ sql, params: [...params] });
        if (sql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
          return [[{ client_id: 501 }], []];
        }
        if (sql.includes('FROM user u JOIN client cl')) {
          const guarded =
            sql.includes("NULLIF(TRIM(cl.applicant_cognito_sub), '') IS NOT NULL") &&
            sql.includes("NULLIF(TRIM(u.cognito_sub), '') IS NOT NULL");
          return [guarded ? [] : [{ id: 999 }], []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(resolveClientIdFromApplicantUserId(701, connection)).resolves.toBeNull();
    await expect(resolveClientIdForDocument({
      caseId: 76,
      applicantUserId: 701,
      connection,
    })).resolves.toBe(501);
    expect(queries.filter(({ sql }) => sql.includes('FROM user u JOIN client cl'))).toHaveLength(2);
  });

  test('CFA snapshot joins treat blank client keys as unlinked and retain explicit participant authority', async () => {
    let clientLinkValue = '';
    const connection = {
      query: jest.fn(async (sqlValue) => {
        const sql = compactSql(sqlValue);
        if (sql.includes('FROM iset_case_action_plan')) {
          return [[{
            id: 184,
            application_id: 123,
            name: 'Exact plan',
            funding_stream: 'CRF',
            agreement_number: null,
            effective_date: null,
          }], []];
        }
        if (sql.includes('FROM iset_case c')) {
          const guarded =
            sql.includes("NULLIF(TRIM(cl.applicant_cognito_sub), '') IS NOT NULL") &&
            sql.includes("NULLIF(TRIM(client_applicant.cognito_sub), '') IS NOT NULL");
          return [[{
            id: 76,
            case_number: 'CASE-76',
            application_id: 123,
            application_client_id: 501,
            client_id: 501,
            case_context_json: '{}',
            client_applicant_cognito_sub: clientLinkValue,
            submission_user_id: 701,
            client_applicant_user_id: guarded ? null : 999,
            reference_number: 'APP-123',
            intake_payload: '{}',
          }], []];
        }
        if (sql.includes('FROM iset_case_intervention')) {
          return [[], []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(buildCfaSnapshot({
      connection,
      caseId: 76,
      actionPlanId: 184,
      participantUserId: 701,
    })).resolves.toEqual(expect.objectContaining({
      case: expect.objectContaining({ applicantUserId: 701 }),
    }));

    clientLinkValue = 'current-participant-sub';
    await expect(buildCfaSnapshot({
      connection,
      caseId: 76,
      actionPlanId: 184,
      participantUserId: 701,
    })).rejects.toThrow('cfa_participant_scope_conflict');
  });

  test('every active version snapshot query rejects blank client and user join keys', () => {
    for (const snapshotBuilder of [
      buildCfaSnapshot,
      buildCfaSnapshotFromAssessment,
      buildFundingOverviewSnapshot,
    ]) {
      const source = snapshotBuilder.toString();
      expect(source).toContain("NULLIF(TRIM(cl.applicant_cognito_sub), '') IS NOT NULL");
      expect(source).toContain("NULLIF(TRIM(client_applicant.cognito_sub), '') IS NOT NULL");
      expect(source).toContain(
        'client_applicant.cognito_sub = cl.applicant_cognito_sub'
      );
      expect(source).toContain(
        'clientBoundCognitoSub: caseRow.client_applicant_cognito_sub'
      );
    }
  });

  test('an exact typed application/client contradiction still fails closed', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        case_id: 76,
        client_id: 501,
        application_id: 123,
        application_client_id: 999,
        applicant_submission_user_id: 701,
        applicant_client_sub_user_id: 700,
        client_name: 'Case Participant',
        client_email: 'participant@example.invalid',
        applicant_name: 'Case Participant',
        applicant_email: 'participant@example.invalid',
      }], []]),
    };

    const context = await resolveCaseApplicantMessagingContext(76, {
      applicationId: 123,
      connection,
    });

    expect(context).toEqual(expect.objectContaining({
      application_id: 123,
      application_client_id: 999,
      applicant_user_id: null,
      applicant_resolution_conflict: true,
      application_scope_conflict: true,
    }));
  });

  test('applicant document binding follows the exact case client, not its submission author', async () => {
    const connection = {
      query: jest.fn(async () => [[{
        case_id: 76,
        client_id: 501,
        application_id: 123,
        application_client_id: 501,
        applicant_submission_user_id: 701,
        applicant_client_sub_user_id: 700,
        client_name: 'Case Participant',
        client_email: 'participant@example.invalid',
        applicant_name: 'Case Participant',
        applicant_email: 'participant@example.invalid',
      }], []]),
    };

    await expect(validateApplicantCaseBinding({
      applicantId: 700,
      caseId: 76,
      applicationId: 123,
      connection,
    })).resolves.toBeNull();
    await expect(validateApplicantCaseBinding({
      applicantId: 701,
      caseId: 76,
      applicationId: 123,
      connection,
    })).resolves.toEqual({
      status: 403,
      body: { error: 'forbidden', detail: 'applicant_application_mismatch' },
    });
  });

  test('applicationless Action Plan documents ignore a conflicting ambient application', async () => {
    const queries = [];
    const connection = {
      query: jest.fn(async (sqlValue, params = []) => {
        const sql = compactSql(sqlValue);
        queries.push({ sql, params: [...params] });
        if (sql.includes('FROM iset_case_action_plan ap')) {
          return [[{
            id: 76,
            client_id: 501,
            application_id: null,
            assigned_to_user_id: 1,
            assigned_staff_profile_id: 1,
            portfolio_region_id: 1,
            owner_region_id: 1,
          }], []];
        }
        if (sql.includes('FROM iset_case c')) {
          return [[{
            case_id: 76,
            client_id: 501,
            application_id: null,
            application_client_id: null,
            applicant_submission_user_id: null,
            applicant_client_sub_user_id: 700,
            applicant_name: 'Case Participant',
            applicant_email: 'participant@example.invalid',
          }], []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(validateApplicantDocumentContextAccess(
      { auth: { subjectType: 'staff', role: 'System Administrator' } },
      {
        applicantId: 700,
        actionPlanId: 184,
        applicationId: 999,
        connection,
      }
    )).resolves.toBeNull();

    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain('ap.application_id');
    expect(queries[0].sql).not.toContain('JOIN iset_application');
    expect(queries[0].sql).not.toContain('ORDER BY');
    expect(queries[0].params).toEqual([184]);
    expect(queries[1].sql).toContain('NULL AS application_id');
    expect(queries[1].sql).not.toContain('JOIN iset_application ');
    expect(queries[1].params).toEqual([76]);
  });

  test('an exact Action Plan application/client contradiction blocks only that document scope', async () => {
    const connection = {
      query: jest.fn(async (sqlValue) => {
        const sql = compactSql(sqlValue);
        if (sql.includes('FROM iset_case_action_plan ap')) {
          return [[{
            id: 76,
            client_id: 501,
            application_id: 123,
            assigned_to_user_id: 1,
            assigned_staff_profile_id: 1,
            portfolio_region_id: 1,
            owner_region_id: 1,
          }], []];
        }
        if (sql.includes('FROM iset_case c')) {
          return [[{
            case_id: 76,
            client_id: 501,
            application_id: 123,
            application_client_id: 999,
            applicant_submission_user_id: 701,
            applicant_client_sub_user_id: 700,
            applicant_name: 'Case Participant',
            applicant_email: 'participant@example.invalid',
          }], []];
        }
        throw new Error(`unexpected_query:${sql}`);
      }),
    };

    await expect(validateApplicantDocumentContextAccess(
      { auth: { subjectType: 'staff', role: 'System Administrator' } },
      { applicantId: 700, actionPlanId: 184, connection }
    )).resolves.toEqual({
      status: 403,
      body: { error: 'forbidden', detail: 'applicant_application_scope_conflict' },
    });
  });

  test('an intervention never borrows a primary application and rejects a cross-case plan link', async () => {
    const queries = [];
    const connection = {
      query: jest.fn(async (sqlValue, params = []) => {
        const sql = compactSql(sqlValue);
        queries.push({ sql, params: [...params] });
        return [[{
          id: 76,
          client_id: 501,
          application_id: 123,
          action_plan_id: 184,
          action_plan_case_id: 77,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }),
    };

    await expect(validateApplicantDocumentContextAccess(
      { auth: { subjectType: 'staff', role: 'System Administrator' } },
      { applicantId: 700, interventionId: 555, connection }
    )).resolves.toEqual({
      status: 409,
      body: { error: 'intervention_action_plan_scope_conflict' },
    });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('ap.application_id');
    expect(queries[0].sql).toContain('ap.case_id AS action_plan_case_id');
    expect(queries[0].sql).toContain('JOIN iset_case c ON c.id = i.case_id');
    expect(queries[0].sql).not.toContain('JOIN iset_application');
    expect(queries[0].sql).not.toContain('COALESCE(i.case_id');
    expect(queries[0].params).toEqual([555]);
  });
});
