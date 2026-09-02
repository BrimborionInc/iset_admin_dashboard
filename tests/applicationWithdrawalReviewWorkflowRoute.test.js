const http = require('http');
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

jest.setTimeout(30000);

const compactSql = value => String(value || '').replace(/\s+/gu, ' ').trim();
const clone = value => JSON.parse(JSON.stringify(value));

const FIXTURE_IDS = Object.freeze({
  caseId: 292,
  clientId: 9700,
  applicationId: 233,
  workflowId: 65,
  staffProfileId: 60,
  regionalManagerId: 55,
  regionId: 9704,
  applicantUserId: 9705,
  actorUserId: 9706,
  escalationId: 9707,
});

function requestJson(server, body) {
  const address = server.address();
  const encodedBody = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: `/api/cases/${FIXTURE_IDS.caseId}`,
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(encodedBody),
      },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: response.statusCode, body: raw ? JSON.parse(raw) : null });
      });
    });
    request.on('error', reject);
    request.write(encodedBody);
    request.end();
  });
}

describe('application withdrawal with an active assessment review', () => {
  let server;
  let dependencyStore;
  let syntheticTestEnvironment;
  let durable;
  let transactionState;
  let queries;
  let transactionEvents;
  let featureEnabled;
  let failReportingSync;
  let syncDeniedReportingArtifacts;
  let connection;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;

  const buildInitialState = ({ workflowStage = 'returned_to_submitter', includeWorkflow = true } = {}) => ({
    case: {
      status: 'intake',
      lifecycle_status: 'intake',
      closure_reason: null,
      closed_at: null,
    },
    application: {
      status: 'in_review',
      lifecycle_status: 'in_review',
      decision_outcome: null,
      awaiting_reason: 'none',
      closure_reason: null,
      row_version: 7,
      has_open_escalation: 1,
      current_escalation_id: FIXTURE_IDS.escalationId,
    },
    workflow: includeWorkflow ? {
      id: FIXTURE_IDS.workflowId,
      workflow_type: 'application_assessment',
      subject_key: `application_assessment:application:${FIXTURE_IDS.applicationId}`,
      case_id: FIXTURE_IDS.caseId,
      application_id: FIXTURE_IDS.applicationId,
      action_plan_id: null,
      intervention_id: null,
      proposal_id: null,
      current_stage: workflowStage,
      current_owner_role: workflowStage === 'withdrawn' ? null : 'Submitter',
      current_owner_staff_profile_id: null,
      submitted_by_staff_profile_id: FIXTURE_IDS.staffProfileId,
      submitted_at: '2026-08-07 12:00:00',
      rm_reviewed_by_staff_profile_id: FIXTURE_IDS.regionalManagerId,
      rm_reviewed_at: '2026-08-07 13:00:00',
      rm_review_note: 'Please confirm the institution.',
      nwac_decided_by_staff_profile_id: null,
      nwac_decided_at: null,
      nwac_decision: null,
      nwac_decision_note: null,
      metadata_json: JSON.stringify({
        source: 'application_assessment_review_action',
        retainedLineage: 'feedback-198',
      }),
      archived_at: null,
      created_at: '2026-08-07 12:00:00',
      updated_at: '2026-08-07 13:00:00',
    } : null,
    workflowEvents: [],
    escalation: {
      id: FIXTURE_IDS.escalationId,
      state: 'open',
      current_owner_role: 'Regional Manager',
      target_role: 'Regional Manager',
      disposition: null,
      last_action_note: null,
    },
    reportingCalls: [],
  });

  const activeState = () => transactionState || durable;

  const buildAccessRow = () => ({
    id: FIXTURE_IDS.caseId,
    client_id: FIXTURE_IDS.clientId,
    application_id: FIXTURE_IDS.applicationId,
    assigned_to_user_id: FIXTURE_IDS.staffProfileId,
    assigned_staff_profile_id: FIXTURE_IDS.staffProfileId,
    portfolio_region_id: FIXTURE_IDS.regionId,
    owner_region_id: FIXTURE_IDS.regionId,
  });

  const buildLockedCaseRow = () => {
    const state = activeState();
    return {
      status: state.case.status,
      lifecycle_status: state.case.lifecycle_status,
      closure_reason: state.case.closure_reason,
      application_id: FIXTURE_IDS.applicationId,
      client_id: FIXTURE_IDS.clientId,
      assigned_to_user_id: FIXTURE_IDS.staffProfileId,
      case_context_json: '{}',
      application_status: state.application.status,
      application_lifecycle_status: state.application.lifecycle_status,
      application_decision_outcome: state.application.decision_outcome,
      application_awaiting_reason: state.application.awaiting_reason,
      application_closure_reason: state.application.closure_reason,
      row_version: state.application.row_version,
      docs_requested_active: 0,
      docs_requested_at: null,
      docs_requested_cleared_at: null,
      docs_requested_source: null,
      lock_owner_user_id: null,
      lock_owner_display_name: null,
      lock_owner_email: null,
      lock_expires_at: null,
    };
  };

  const buildResponseRow = () => {
    const state = activeState();
    return {
      status: state.case.status,
      case_lifecycle_status: state.case.lifecycle_status,
      case_closure_reason: state.case.closure_reason,
      application_id: FIXTURE_IDS.applicationId,
      client_id: FIXTURE_IDS.clientId,
      case_context_json: '{}',
      application_status: state.application.status,
      application_lifecycle_status: state.application.lifecycle_status,
      application_decision_outcome: state.application.decision_outcome,
      application_awaiting_reason: state.application.awaiting_reason,
      application_closure_reason: state.application.closure_reason,
      docs_requested_active: 0,
      docs_requested_at: null,
      docs_requested_cleared_at: null,
      docs_requested_source: null,
      assigned_staff_profile_id: FIXTURE_IDS.staffProfileId,
      applicant_user_id: FIXTURE_IDS.applicantUserId,
      tracking_id: 'ISET-SYNTHETIC-233',
      application_row_version: state.application.row_version,
      assessment_date_of_assessment: null,
      case_summary: null,
      assessment_employment_barriers: null,
      assessment_employment_barriers_other_details: null,
      assessment_local_area_priorities: null,
      assessment_itp: null,
      assessment_wage: null,
      assessment_conflict_declaration_signed: 0,
      assessment_conflict_declaration_signed_at: null,
      assessment_conflict_declaration_signed_by: null,
      assessment_conflict_declaration_choice: null,
      assessment_conflict_declaration_details: null,
      assessment_conflict_declaration_resolution_outcome: null,
      assessment_conflict_declaration_resolved_at: null,
      assessment_conflict_declaration_resolution_note: null,
    };
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;

    queries = [];
    transactionEvents = [];
    durable = buildInitialState();
    transactionState = null;
    featureEnabled = true;
    failReportingSync = false;

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });

      if (sql.includes("scope='admin'") && sql.includes("k='locking'")) return [[], []];
      if (sql.includes('FROM information_schema.columns') && sql.includes("table_name = 'iset_case_assessment'")) {
        return [[{ cnt: 1 }], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('sp.region_id AS owner_region_id')) {
        return [[buildAccessRow()], []];
      }
      if (sql === 'SELECT id, case_id FROM iset_application WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: FIXTURE_IDS.applicationId, case_id: FIXTURE_IDS.caseId }], []];
      }
      if (sql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: FIXTURE_IDS.caseId }], []];
      }
      if (sql.includes('LEFT JOIN application_lock al') && sql.endsWith('LIMIT 1 FOR UPDATE')) {
        return [[buildLockedCaseRow()], []];
      }
      if (sql.includes('FROM iset_application_assessment aa') && sql.includes('aa.application_id = ?')) {
        return [[{
          id: 9708,
          case_id: FIXTURE_IDS.caseId,
          application_id: FIXTURE_IDS.applicationId,
          overview: null,
          intervention_budget_pot_id: null,
          posting_context: null,
          esdc_eligibility: null,
          recommendation: null,
          nwac_review: null,
          _assessment_source: 'application_assessment',
        }], []];
      }
      if (sql.includes('FROM iset_runtime_config WHERE scope = ? AND k = ?')) {
        return [[{ v: JSON.stringify({ enabled: featureEnabled }) }], []];
      }
      if (sql.includes('FROM iset_review_workflow') && sql.includes('subject_key = ?')) {
        return [activeState().workflow ? [clone(activeState().workflow)] : [], []];
      }
      if (sql.startsWith('UPDATE iset_review_workflow SET')) {
        const state = activeState();
        state.workflow.current_stage = params[5];
        state.workflow.current_owner_role = params[6];
        state.workflow.current_owner_staff_profile_id = null;
        state.workflow.metadata_json = params[7];
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'SELECT * FROM iset_review_workflow WHERE id = ? LIMIT 1') {
        return [activeState().workflow ? [clone(activeState().workflow)] : [], []];
      }
      if (sql.startsWith('INSERT INTO iset_review_workflow_event')) {
        activeState().workflowEvents.push({ params: [...params] });
        return [{ insertId: 9709, affectedRows: 1 }, []];
      }
      if (sql.startsWith('UPDATE iset_application SET status = ?')) {
        const state = activeState();
        state.application.status = params[0];
        state.application.lifecycle_status = params[1];
        state.application.decision_outcome = params[2];
        state.application.awaiting_reason = params[3];
        state.application.closure_reason = params[4];
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: FIXTURE_IDS.actorUserId }], []];
      }
      if (sql.includes('FROM iset_application_escalation') && sql.includes('FOR UPDATE')) {
        const escalation = activeState().escalation;
        return escalation && escalation.state !== 'resolved' ? [[clone(escalation)], []] : [[], []];
      }
      if (sql.startsWith('UPDATE iset_application_escalation SET')) {
        const escalation = activeState().escalation;
        escalation.state = params[0];
        escalation.disposition = params[1];
        escalation.last_action_note = params[2];
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'UPDATE iset_application SET has_open_escalation = 0, current_escalation_id = NULL WHERE id = ?') {
        activeState().application.has_open_escalation = 0;
        activeState().application.current_escalation_id = null;
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'UPDATE iset_application SET row_version = row_version + 1 WHERE id = ?') {
        activeState().application.row_version += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('SELECT c.id, c.status, c.lifecycle_status, c.closure_reason') && sql.includes('a.id AS application_id')) {
        const state = activeState();
        return [[{
          id: FIXTURE_IDS.caseId,
          status: state.case.status,
          lifecycle_status: state.case.lifecycle_status,
          closure_reason: state.case.closure_reason,
          application_id: FIXTURE_IDS.applicationId,
        }], []];
      }
      if (sql.includes('FROM iset_case_action_plan ap') && sql.includes('AS active_count')) {
        return [[{ active_count: 0, closed_count: 0, archived_count: 0, draft_count: 0, total_count: 0 }], []];
      }
      if (sql.includes('FROM iset_application a') && sql.includes('AS withdrawn_count')) {
        const withdrawn = activeState().application.status === 'withdrawn';
        return [[{
          total_count: 1,
          open_count: withdrawn ? 0 : 1,
          withdrawn_count: withdrawn ? 1 : 0,
          archived_count: 0,
          denied_count: 0,
        }], []];
      }
      if (sql.startsWith('UPDATE iset_case SET status = ?')) {
        const state = activeState();
        state.case.status = params[0];
        state.case.lifecycle_status = params[1];
        state.case.closure_reason = params[2];
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith('UPDATE iset_case_reminder SET')) return [{ affectedRows: 0 }, []];
      if (sql.includes('ca.date_of_assessment AS assessment_date_of_assessment')) {
        return [[buildResponseRow()], []];
      }
      if (sql.includes('FROM staff_profiles') || sql.includes('FROM `staff_profiles`')) return [[], []];
      if (sql.startsWith('INSERT INTO iset_case_event')) return [{ insertId: 9710, affectedRows: 1 }, []];
      return [[], []];
    });

    connection = {
      query,
      execute: query,
      beginTransaction: async () => {
        transactionEvents.push('begin');
        transactionState = clone(durable);
      },
      commit: async () => {
        transactionEvents.push('commit');
        durable = clone(transactionState);
        transactionState = null;
      },
      rollback: async () => {
        transactionEvents.push('rollback');
        transactionState = null;
      },
      release: () => {
        transactionEvents.push('release');
      },
    };
    const fakePool = {
      query,
      execute: query,
      getConnection: async () => connection,
    };

    syncDeniedReportingArtifacts = jest.fn(async (receivedConnection, options) => {
      if (receivedConnection !== connection) throw new Error('reporting_connection_mismatch');
      if (failReportingSync) throw new Error('simulated_withdrawal_reporting_failure');
      activeState().reportingCalls.push({
        caseId: options.caseId,
        applicationId: options.applicationId,
        reportingTrigger: options.reportingTrigger,
      });
      return {
        planId: 9711,
        interventionIds: [9712, 9713],
        submissionId: 9714,
      };
    });

    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      syncDeniedReportingArtifacts,
      authnMiddlewareFactory: () => (req, _res, next) => {
        req.auth = {
          subjectType: 'staff',
          sub: 'feedback-198-coordinator',
          email: 'feedback-198@example.invalid',
          role: 'ISET Coordinator',
          staffProfileId: FIXTURE_IDS.staffProfileId,
          regionId: FIXTURE_IDS.regionId,
          regionIds: [FIXTURE_IDS.regionId],
        };
        req.staffProfile = {
          id: FIXTURE_IDS.staffProfileId,
          display_name: 'Feedback 198 Coordinator',
          name: 'Feedback 198 Coordinator',
          email: 'feedback-198@example.invalid',
          primary_role: 'ISET Coordinator',
          region_id: FIXTURE_IDS.regionId,
        };
        next();
      },
    });

    const { app } = require('../isetadminserver');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  beforeEach(() => {
    durable = buildInitialState();
    transactionState = null;
    queries.length = 0;
    transactionEvents.length = 0;
    featureEnabled = true;
    failReportingSync = false;
    syncDeniedReportingArtifacts.mockClear();
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) expect(syntheticTestEnvironment.cleanup()).toBe(true);
  });

  const withdrawalBody = overrides => ({
    applicationId: FIXTURE_IDS.applicationId,
    applicationStatus: 'withdrawn',
    expectedRowVersion: 7,
    resolveOpenEscalation: true,
    statusActionNote: 'Applicant requested withdrawal.',
    ...(overrides || {}),
  });

  test('the reporter-role PUT atomically ends returned review and withdraws the exact application', async () => {
    featureEnabled = false;

    const response = await requestJson(server, withdrawalBody());

    expect(response).toMatchObject({
      status: 200,
      body: {
        success: true,
        status: 'closed',
        application_status: 'withdrawn',
        application_lifecycle_status: 'closed',
        application_closure_reason: 'withdrawn',
        application_row_version: 8,
        reviewWorkflow: {
          current_stage: 'withdrawn',
          current_owner_role: null,
          submitted_by_staff_profile_id: FIXTURE_IDS.staffProfileId,
          rm_reviewed_by_staff_profile_id: FIXTURE_IDS.regionalManagerId,
          rm_review_note: 'Please confirm the institution.',
        },
      },
    });
    expect(transactionEvents).toEqual(['begin', 'commit', 'release']);
    expect(durable.application).toMatchObject({
      status: 'withdrawn',
      lifecycle_status: 'closed',
      decision_outcome: null,
      awaiting_reason: 'none',
      closure_reason: 'withdrawn',
      row_version: 8,
      has_open_escalation: 0,
      current_escalation_id: null,
    });
    expect(durable.case).toMatchObject({
      status: 'closed',
      lifecycle_status: 'closed',
      closure_reason: 'withdrawn',
    });
    expect(durable.workflow).toMatchObject({
      current_stage: 'withdrawn',
      current_owner_role: null,
      submitted_by_staff_profile_id: FIXTURE_IDS.staffProfileId,
      rm_reviewed_by_staff_profile_id: FIXTURE_IDS.regionalManagerId,
      rm_review_note: 'Please confirm the institution.',
    });
    expect(JSON.parse(durable.workflow.metadata_json)).toEqual({
      source: 'application_assessment_review_action',
      retainedLineage: 'feedback-198',
      applicationWithdrawal: {
        source: 'application_status_update',
        applicationStatus: 'withdrawn',
      },
    });
    expect(durable.workflowEvents).toHaveLength(1);
    expect(durable.workflowEvents[0].params).toEqual([
      FIXTURE_IDS.workflowId,
      'application_assessment',
      `application_assessment:application:${FIXTURE_IDS.applicationId}`,
      'withdraw_application',
      'returned_to_submitter',
      'withdrawn',
      FIXTURE_IDS.staffProfileId,
      'ISET Coordinator',
      'Applicant requested withdrawal.',
      expect.any(String),
    ]);
    expect(durable.escalation).toMatchObject({
      state: 'resolved',
      disposition: 'withdraw_application',
      last_action_note: 'Applicant requested withdrawal.',
    });
    expect(durable.reportingCalls).toEqual([{
      caseId: FIXTURE_IDS.caseId,
      applicationId: FIXTURE_IDS.applicationId,
      reportingTrigger: 'withdrawal',
    }]);
    expect(syncDeniedReportingArtifacts).toHaveBeenCalledTimes(1);
  });

  test('withdrawal requires its reason and rejects mixed assessment submission before workflow writes', async () => {
    const missingNote = await requestJson(server, withdrawalBody({ statusActionNote: null }));
    expect(missingNote).toMatchObject({
      status: 422,
      body: { error: 'application_withdrawal_note_required' },
    });
    expect(durable.workflow.current_stage).toBe('returned_to_submitter');
    expect(durable.workflowEvents).toHaveLength(0);
    expect(syncDeniedReportingArtifacts).not.toHaveBeenCalled();

    transactionEvents.length = 0;
    const mixed = await requestJson(server, withdrawalBody({
      assessment_recommendation: 'approve',
      assessment_justification: 'mixed request must fail',
      assessment_submit_action: true,
    }));
    expect(mixed).toMatchObject({
      status: 422,
      body: { error: 'application_withdrawal_request_conflict' },
    });
    expect(durable.workflow.current_stage).toBe('returned_to_submitter');
    expect(durable.application.status).toBe('in_review');
    expect(durable.workflowEvents).toHaveLength(0);
    expect(syncDeniedReportingArtifacts).not.toHaveBeenCalled();
    expect(transactionEvents).toEqual(['begin', 'rollback', 'release']);
  });

  test('a recorded final decision blocks withdrawal before any workflow or application write', async () => {
    durable = buildInitialState({ workflowStage: 'final_decision_recorded' });
    durable.workflow.current_owner_role = null;

    const response = await requestJson(server, withdrawalBody());

    expect(response).toMatchObject({
      status: 409,
      body: { error: 'application_withdrawal_review_stage_forbidden' },
    });
    expect(durable.workflow.current_stage).toBe('final_decision_recorded');
    expect(durable.application.status).toBe('in_review');
    expect(durable.workflowEvents).toHaveLength(0);
    expect(syncDeniedReportingArtifacts).not.toHaveBeenCalled();
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_review_workflow SET'))).toBe(false);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_application SET status = ?'))).toBe(false);
    expect(transactionEvents).toEqual(['begin', 'rollback', 'release']);
  });

  test('a downstream reporting failure rolls the workflow and application changes back together', async () => {
    failReportingSync = true;

    const response = await requestJson(server, withdrawalBody());

    expect(response).toMatchObject({
      status: 500,
      body: { error: 'simulated_withdrawal_reporting_failure' },
    });
    expect(durable.workflow).toMatchObject({
      current_stage: 'returned_to_submitter',
      current_owner_role: 'Submitter',
    });
    expect(durable.application).toMatchObject({
      status: 'in_review',
      lifecycle_status: 'in_review',
      row_version: 7,
      has_open_escalation: 1,
      current_escalation_id: FIXTURE_IDS.escalationId,
    });
    expect(durable.escalation.state).toBe('open');
    expect(durable.workflowEvents).toHaveLength(0);
    expect(durable.reportingCalls).toHaveLength(0);
    expect(transactionEvents).toEqual(['begin', 'rollback', 'release']);
  });

  test('an application with no review workflow keeps the existing withdrawal path', async () => {
    durable = buildInitialState({ includeWorkflow: false });

    const response = await requestJson(server, withdrawalBody());

    expect(response).toMatchObject({
      status: 200,
      body: {
        application_status: 'withdrawn',
        reviewWorkflow: null,
      },
    });
    expect(durable.application.status).toBe('withdrawn');
    expect(durable.workflow).toBeNull();
    expect(durable.workflowEvents).toHaveLength(0);
    expect(syncDeniedReportingArtifacts).toHaveBeenCalledTimes(1);
    expect(transactionEvents).toEqual(['begin', 'commit', 'release']);
  });

  test('the reporter role can reopen the withdrawn application without reviving review ownership', async () => {
    durable = buildInitialState({ workflowStage: 'withdrawn' });
    durable.application.status = 'withdrawn';
    durable.application.lifecycle_status = 'closed';
    durable.application.closure_reason = 'withdrawn';
    durable.application.has_open_escalation = 0;
    durable.application.current_escalation_id = null;
    durable.case.status = 'closed';
    durable.case.lifecycle_status = 'closed';
    durable.case.closure_reason = 'withdrawn';

    const response = await requestJson(server, {
      applicationId: FIXTURE_IDS.applicationId,
      applicationStatus: 'in_review',
      expectedRowVersion: 7,
      statusActionNote: 'Applicant asked to reopen the file.',
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        status: 'intake',
        application_status: 'in_review',
        application_lifecycle_status: 'in_review',
        application_closure_reason: null,
        application_row_version: 8,
        reviewWorkflow: {
          current_stage: 'withdrawn',
          current_owner_role: null,
        },
      },
    });
    expect(durable.application).toMatchObject({
      status: 'in_review',
      lifecycle_status: 'in_review',
      closure_reason: null,
      row_version: 8,
    });
    expect(durable.workflow.current_stage).toBe('withdrawn');
    expect(durable.workflowEvents).toHaveLength(0);
    expect(syncDeniedReportingArtifacts).not.toHaveBeenCalled();
    expect(transactionEvents).toEqual(['begin', 'commit', 'release']);
  });
});

