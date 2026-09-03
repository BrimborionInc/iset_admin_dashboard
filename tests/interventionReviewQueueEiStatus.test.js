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

jest.setTimeout(30000);

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

async function invokeRoute(handler) {
  let status = 200;
  let body = null;
  const req = {
    auth: {
      subjectType: 'staff',
      sub: 'intervention-queue-ei-test',
      email: 'intervention-queue-ei@example.invalid',
      role: 'NWAC Administrator',
      staffProfileId: 54,
      regionId: 9,
      regionIds: [9],
    },
    staffProfile: {
      id: 54,
      email: 'intervention-queue-ei@example.invalid',
      primary_role: 'NWAC Administrator',
      region_id: 9,
      regionIds: [9],
    },
  };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    set() {
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  await handler(req, res);
  return { status, body };
}

describe('GET /api/dashboard/intervention-approval-items EI source', () => {
  let routeHandler;
  let dependencyStore;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);

      if (sql.includes('FROM ( SELECT p.id AS proposal_id')) {
        expect(sql.match(/ap\.EIClaimant AS action_plan_ei_claimant/g)).toHaveLength(2);
        expect(params).toContain('nwac_review');
        return [[
          {
            proposal_id: 401,
            proposal_kind: 'new',
            intervention_id: 501,
            case_id: 601,
            application_id: 901,
            action_plan_id: 701,
            metadata_json: JSON.stringify({ review: { eiStatus: 'EI Reach Back' } }),
            intervention_status: 'submitted',
            intervention_review_status: 'submitted',
            submitted_at: '2026-08-09 10:00:00',
            assessment_esdc_eligibility: 'CRF',
            action_plan_ei_claimant: 1,
            review_workflow_id: 801,
            review_workflow_stage: 'nwac_review',
          },
          {
            proposal_id: 402,
            proposal_kind: 'revision',
            intervention_id: 502,
            case_id: 602,
            application_id: 902,
            action_plan_id: 702,
            revision_source_intervention_id: 499,
            metadata_json: JSON.stringify({
              review: { eiStatus: '' },
              revision: { sourceInterventionId: 499, sourceActionPlanId: 702 },
            }),
            intervention_status: 'submitted',
            intervention_review_status: 'submitted',
            submitted_at: '2026-08-09 09:00:00',
            assessment_esdc_eligibility: 'EI Active Claim',
            action_plan_ei_claimant: 3,
            review_workflow_id: 802,
            review_workflow_stage: 'nwac_review',
          },
          {
            proposal_id: 403,
            proposal_kind: 'new',
            intervention_id: 503,
            case_id: 603,
            application_id: 903,
            action_plan_id: 703,
            metadata_json: JSON.stringify({ review: { eiStatus: '' } }),
            intervention_status: 'submitted',
            intervention_review_status: 'submitted',
            submitted_at: '2026-08-09 08:00:00',
            assessment_esdc_eligibility: 'EI Reach Back',
            action_plan_ei_claimant: 1,
            review_workflow_id: 803,
            review_workflow_stage: 'nwac_review',
          },
        ], []];
      }

      return [[], []];
    });

    const fakePool = {
      query,
      execute: query,
      getConnection: async () => ({
        query,
        execute: query,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      }),
    };

    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (req, _res, next) => {
        const role = String(req.headers['x-test-role'] || 'NWAC Administrator');
        req.auth = {
          subjectType: 'staff',
          sub: 'intervention-queue-ei-test',
          email: 'intervention-queue-ei@example.invalid',
          role,
          staffProfileId: 54,
          regionId: 9,
          regionIds: [9],
        };
        req.staffProfile = {
          id: 54,
          email: 'intervention-queue-ei@example.invalid',
          primary_role: role,
          region_id: 9,
          regionIds: [9],
        };
        next();
      },
    });

    const { app } = require('../isetadminserver');
    const stack = app?._router?.stack || app?.router?.stack || [];
    const routeLayer = stack.find(layer => layer?.route?.path === '/api/dashboard/intervention-approval-items');
    routeHandler = routeLayer?.route?.stack?.[0]?.handle || null;
    expect(typeof routeHandler).toBe('function');
  });

  afterAll(async () => {
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
  });

  test('returns proposal EI, revision-only plan fallback, and no application-assessment fallback', async () => {
    const response = await invokeRoute(routeHandler);

    expect(response.status).toBe(200);
    expect(response.body.items.map(item => ({
      proposalId: item.proposalId,
      applicationAssessmentEi: item.assessment_esdc_eligibility,
      interventionEi: item.intervention_ei_status,
    }))).toEqual([
      {
        proposalId: 401,
        applicationAssessmentEi: 'CRF',
        interventionEi: 'EI Reach Back',
      },
      {
        proposalId: 402,
        applicationAssessmentEi: 'EI Active Claim',
        interventionEi: 'CRF',
      },
      {
        proposalId: 403,
        applicationAssessmentEi: 'EI Reach Back',
        interventionEi: null,
      },
    ]);
  });
});
