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

const eligibilityFor = ({
  interventionId,
  proposalId,
  workflowId,
} = {}) => ({
  eligible: true,
  proposalKind: 'new',
  reason: 'approved_proposal_final_workflow',
  applicationId: 20,
  actionPlanId: 30,
  interventionId,
  proposalId,
  workflowId,
});

function initialLineageState() {
  return {
    applicationApprovalLetterSentAt: '2026-08-01T12:00:00.000Z',
    messages: [],
    signingRequests: [],
    documents: [],
    interventions: [
      {
        id: 101,
        case_id: 10,
        action_plan_id: 30,
        status: 'approved',
        delivery_status: 'planned',
        metadata_json: JSON.stringify({
          approvalLetterFollowUp: { status: 'pending', completed: false, kind: 'new' },
        }),
      },
      {
        id: 102,
        case_id: 10,
        action_plan_id: 30,
        status: 'approved',
        delivery_status: 'planned',
        metadata_json: JSON.stringify({
          approvalLetterFollowUp: { status: 'pending', completed: false, kind: 'new' },
        }),
      },
    ],
    proposals: [
      {
        id: 201,
        case_id: 10,
        action_plan_id: 30,
        application_id: 20,
        legacy_intervention_id: 101,
        source_intervention_id: null,
        proposal_kind: 'new',
        review_status: 'approved',
        metadata_json: JSON.stringify({
          approvalLetterFollowUp: { status: 'pending', completed: false, kind: 'new' },
        }),
      },
      {
        id: 202,
        case_id: 10,
        action_plan_id: 30,
        application_id: 20,
        legacy_intervention_id: 102,
        source_intervention_id: null,
        proposal_kind: 'new',
        review_status: 'approved',
        metadata_json: JSON.stringify({
          approvalLetterFollowUp: { status: 'pending', completed: false, kind: 'new' },
        }),
      },
    ],
    workflows: [
      {
        id: 301,
        workflow_type: 'intervention_proposal',
        case_id: 10,
        application_id: 20,
        action_plan_id: 30,
        intervention_id: 101,
        proposal_id: 201,
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
      {
        id: 302,
        workflow_type: 'intervention_proposal',
        case_id: 10,
        application_id: 20,
        action_plan_id: 30,
        intervention_id: 102,
        proposal_id: 202,
        current_stage: 'final_decision_recorded',
        nwac_decision: 'approved',
      },
    ],
  };
}

function createLineageConnection({ failProposalUpdate = false } = {}) {
  let committed = initialLineageState();
  let working = null;
  const connection = {
    beginTransaction: jest.fn(async () => {
      working = clone(committed);
    }),
    query: jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      if (!working) throw new Error('transaction_not_started');
      if (sql.startsWith('SELECT i.id,') && sql.includes('FROM iset_case_intervention i')) {
        const [interventionId, caseId, actionPlanId] = params.map(Number);
        const row = working.interventions.find(item => (
          item.id === interventionId &&
          item.case_id === caseId &&
          item.action_plan_id === actionPlanId
        ));
        return [[row ? {
          ...row,
          action_plan_case_id: row.case_id,
          action_plan_application_id: 20,
        } : undefined], []];
      }
      if (sql.startsWith('SELECT p.id,') && sql.includes('FROM iset_intervention_proposal p')) {
        const [proposalId, caseId] = params.map(Number);
        const row = working.proposals.find(item => (
          item.id === proposalId && item.case_id === caseId
        ));
        return [[row], []];
      }
      if (sql.startsWith('SELECT rw.id,') && sql.includes('FROM iset_review_workflow rw')) {
        const workflowId = Number(params[0]);
        return [[working.workflows.find(item => item.id === workflowId)], []];
      }
      if (sql.startsWith('UPDATE iset_case_intervention')) {
        const [metadataJson, interventionId, caseId, actionPlanId] = params;
        const row = working.interventions.find(item => (
          item.id === Number(interventionId) &&
          item.case_id === Number(caseId) &&
          item.action_plan_id === Number(actionPlanId)
        ));
        if (!row) return [{ affectedRows: 0 }, []];
        row.metadata_json = metadataJson;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith('UPDATE iset_intervention_proposal')) {
        if (failProposalUpdate) return [{ affectedRows: 0 }, []];
        const [metadataJson, proposalId, caseId, actionPlanId, legacyInterventionId, proposalKind] = params;
        const row = working.proposals.find(item => (
          item.id === Number(proposalId) &&
          item.case_id === Number(caseId) &&
          item.action_plan_id === Number(actionPlanId) &&
          item.legacy_intervention_id === Number(legacyInterventionId) &&
          item.proposal_kind === proposalKind &&
          item.review_status === 'approved'
        ));
        if (!row) return [{ affectedRows: 0 }, []];
        row.metadata_json = metadataJson;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected intervention-letter SQL: ${sql}`);
    }),
    commit: jest.fn(async () => {
      committed = clone(working);
      working = null;
    }),
    rollback: jest.fn(async () => {
      working = null;
    }),
    release: jest.fn(),
    stageMessageArtifacts() {
      working.messages.push({ id: 401 });
      working.signingRequests.push({ id: 501 });
      working.documents.push({ id: 601, owner: 'intervention:101', status: 'active' });
    },
    committedState: () => clone(committed),
  };
  return connection;
}

function createDocumentOwnerConnection() {
  const state = {
    nextDocumentId: 44,
    documents: [
      { id: 40, applicationId: 20, actionPlanId: null, category: 'assessment_approval_letter', status: 'active', owner: null },
      { id: 41, applicationId: 20, actionPlanId: null, category: 'assessment_approval_letter', status: 'active', owner: 'application' },
      { id: 42, applicationId: 20, actionPlanId: 30, category: 'assessment_approval_letter', status: 'active' },
      { id: 43, applicationId: 20, actionPlanId: 30, category: 'assessment_approval_letter', status: 'active' },
    ],
    links: [
      { documentId: 42, interventionId: 101 },
      { documentId: 43, interventionId: 102 },
    ],
  };
  const connection = {
    query: jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      if (sql.startsWith('INSERT INTO iset_document ')) {
        const id = state.nextDocumentId++;
        state.documents.push({
          id,
          applicationId: Number(params[1]),
          actionPlanId: params[2] === null ? null : Number(params[2]),
          category: params[params.length - 1],
          status: 'archived',
          owner: JSON.parse(params[10]).decision_letter_owner,
        });
        return [{ insertId: id, affectedRows: 1 }, []];
      }
      if (sql.startsWith('DELETE FROM iset_document_intervention')) {
        const documentId = Number(params[0]);
        state.links = state.links.filter(link => link.documentId !== documentId);
        return [{ affectedRows: 0 }, []];
      }
      if (sql.startsWith('INSERT INTO iset_document_intervention')) {
        const values = params[0] || [];
        values.forEach(([documentId, interventionId]) => {
          state.links.push({
            documentId: Number(documentId),
            interventionId: Number(interventionId),
          });
        });
        return [{ affectedRows: values.length }, []];
      }
      if (
        sql.startsWith('UPDATE iset_document d JOIN iset_document_intervention di') &&
        sql.includes("SET d.status = 'archived'")
      ) {
        const [interventionId, applicationId, actionPlanId, category, replacementId] = params;
        let affectedRows = 0;
        state.documents.forEach(document => {
          const linked = state.links.some(link => (
            link.documentId === document.id && link.interventionId === Number(interventionId)
          ));
          if (
            linked &&
            document.applicationId === Number(applicationId) &&
            document.actionPlanId === Number(actionPlanId) &&
            document.category === category &&
            document.status === 'active' &&
            document.id !== Number(replacementId)
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
          sql.includes("SET d.status = 'archived'") ||
          sql.includes("SET status = 'archived'")
        )
      ) {
        const [applicationId, category, replacementId] = params;
        let affectedRows = 0;
        state.documents.forEach(document => {
          const linked = state.links.some(link => link.documentId === document.id);
          if (
            !linked &&
            document.owner === 'application' &&
            document.applicationId === Number(applicationId) &&
            document.actionPlanId === null &&
            document.category === category &&
            document.status === 'active' &&
            document.id !== Number(replacementId)
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
        const interventionOwned = sql.includes('iset_document_intervention');
        const [documentId, applicationId] = params;
        const document = state.documents.find(item => item.id === Number(documentId));
        const ownerMatches = interventionOwned
          ? (
              document?.actionPlanId === Number(params[2]) &&
              state.links.some(link => (
                link.documentId === document?.id && link.interventionId === Number(params[4])
              ))
            )
          : document?.actionPlanId === null;
        if (
          !document ||
          document.applicationId !== Number(applicationId) ||
          document.status !== 'archived' ||
          !ownerMatches
        ) {
          return [{ affectedRows: 0 }, []];
        }
        document.status = 'active';
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected decision-letter document SQL: ${sql}`);
    }),
    state,
  };
  return connection;
}

describe('intervention approval-letter ownership and atomicity', () => {
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

  async function markLetter(connection, interventionId, proposalId, workflowId) {
    return exported.markApprovedInterventionProposalLetterSent({
      connection,
      caseId: 10,
      applicationId: 20,
      interventionId,
      eligibility: eligibilityFor({ interventionId, proposalId, workflowId }),
      messageId: 401 + interventionId,
      signingRequestIds: [501 + interventionId],
      actorStaffProfileId: 7,
      actorUserId: 8,
    });
  }

  test('records the exact intervention and proposal without changing an existing application approval marker', async () => {
    const connection = createLineageConnection();
    await connection.beginTransaction();
    const result = await markLetter(connection, 101, 201, 301);
    await connection.commit();

    const state = connection.committedState();
    expect(result).toMatchObject({
      updated: true,
      ownerType: 'intervention',
      applicationId: 20,
      interventionId: 101,
      proposalId: 201,
      workflowId: 301,
    });
    expect(state.applicationApprovalLetterSentAt).toBe('2026-08-01T12:00:00.000Z');
    expect(JSON.parse(state.interventions[0].metadata_json).approvalLetterFollowUp).toMatchObject({
      status: 'sent',
      applicationId: 20,
      actionPlanId: 30,
      interventionId: 101,
      proposalId: 201,
      reviewWorkflowId: 301,
    });
    expect(JSON.parse(state.proposals[0].metadata_json).approvalLetterFollowUp).toMatchObject({
      status: 'sent',
      interventionId: 101,
      proposalId: 201,
    });
    expect(JSON.parse(state.interventions[1].metadata_json).approvalLetterFollowUp.status).toBe('pending');
  });

  test('an exact proposal update conflict rolls back message, signing, PDF, and intervention tracking', async () => {
    const connection = createLineageConnection({ failProposalUpdate: true });
    await connection.beginTransaction();
    connection.stageMessageArtifacts();

    await expect(markLetter(connection, 101, 201, 301)).rejects.toMatchObject({
      publicError: 'intervention_letter_proposal_update_conflict',
      httpStatus: 409,
    });
    await connection.rollback();

    const state = connection.committedState();
    expect(state.messages).toEqual([]);
    expect(state.signingRequests).toEqual([]);
    expect(state.documents).toEqual([]);
    expect(JSON.parse(state.interventions[0].metadata_json).approvalLetterFollowUp.status).toBe('pending');
    expect(JSON.parse(state.proposals[0].metadata_json).approvalLetterFollowUp.status).toBe('pending');
  });

  test('a later intervention under the same already-approved application remains independently sendable', async () => {
    const connection = createLineageConnection();
    await connection.beginTransaction();
    await markLetter(connection, 101, 201, 301);
    await connection.commit();
    await connection.beginTransaction();
    await markLetter(connection, 102, 202, 302);
    await connection.commit();

    const state = connection.committedState();
    expect(state.applicationApprovalLetterSentAt).toBe('2026-08-01T12:00:00.000Z');
    expect(state.interventions.map(item => (
      JSON.parse(item.metadata_json).approvalLetterFollowUp.status
    ))).toEqual(['sent', 'sent']);
    expect(state.proposals.map(item => (
      JSON.parse(item.metadata_json).approvalLetterFollowUp.interventionId
    ))).toEqual([101, 102]);
  });

  test('application, intervention A, and intervention B artifacts replace only within their exact owner stream', async () => {
    const connection = createDocumentOwnerConnection();
    const uploadedObjectKeys = [];
    const store = (suffix, ownerContext) => exported.storeDecisionLetterPdfDocument({
      docType: 'assessment_approval_letter',
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
      actorUserId: 700,
      clientId: 5,
      trackingId: `APP-20-${suffix}`,
      signingRequestId: 900 + connection.state.nextDocumentId,
      pdfBuffer: Buffer.from(`pdf-${suffix}`),
      connection,
      uploadedObjectKeys,
      ownerContext,
      uploadPdfObjectFn: async ({ uploadedObjects }) => {
        const key = `generated/${suffix}.pdf`;
        uploadedObjects.push({ key });
        return key;
      },
    });

    const replacementA = await store('intervention-a', {
      kind: 'intervention',
      ...eligibilityFor({ interventionId: 101, proposalId: 201, workflowId: 301 }),
    });
    expect(connection.state.documents.find(item => item.id === 41).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === 40).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === 42).status).toBe('archived');
    expect(connection.state.documents.find(item => item.id === 43).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === replacementA).status).toBe('active');

    const replacementApplication = await store('application', {
      kind: 'application',
      applicationId: 20,
    });
    expect(connection.state.documents.find(item => item.id === 41).status).toBe('archived');
    expect(connection.state.documents.find(item => item.id === 40).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === replacementA).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === 43).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === replacementApplication).status).toBe('active');

    const replacementB = await store('intervention-b', {
      kind: 'intervention',
      ...eligibilityFor({ interventionId: 102, proposalId: 202, workflowId: 302 }),
    });
    expect(connection.state.documents.find(item => item.id === 43).status).toBe('archived');
    expect(connection.state.documents.find(item => item.id === replacementA).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === replacementApplication).status).toBe('active');
    expect(connection.state.documents.find(item => item.id === replacementB).status).toBe('active');
    expect(connection.state.links).toEqual(expect.arrayContaining([
      { documentId: replacementA, interventionId: 101 },
      { documentId: replacementB, interventionId: 102 },
    ]));
  });

  test('the route performs intervention tracking before commit and never invokes it post-commit', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../isetadminserver.js'), 'utf8');
    const start = source.indexOf('const handlePostCaseSecureMessage = async (req, res) => {');
    const end = source.indexOf("app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);", start);
    const handler = source.slice(start, end);
    const artifactPersistence = handler.indexOf('await persistCaseMessageDecisionLetterArtifacts({');
    const interventionTracking = handler.indexOf('await markApprovedInterventionProposalLetterSent({');
    const applicationTracking = handler.indexOf('await recordApplicationDecisionLetterSent({');
    const commit = handler.indexOf('await commitCaseMessageWriteTransaction({');

    expect(artifactPersistence).toBeGreaterThanOrEqual(0);
    expect(interventionTracking).toBeGreaterThan(artifactPersistence);
    expect(applicationTracking).toBeGreaterThan(interventionTracking);
    expect(commit).toBeGreaterThan(applicationTracking);
    expect(handler.slice(commit)).not.toContain('markApprovedInterventionProposalLetterSent({');
    expect(handler).toContain("kind: 'intervention'");
    expect(handler).toContain('ownerContext: decisionLetterOwnerContext');
    expect(handler).toContain('requestedInterventionId\n        ? await markApprovedInterventionProposalLetterSent({');
    expect(handler).not.toContain('connection: pool,\n          caseId,\n          interventionId: requestedInterventionId');
  });
});
