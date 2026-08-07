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

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

describe('application assessment review queue routing', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  let buildApplicationAssessmentReviewQueueSqlFilter;
  let countProgramAdminAwaitingDecision;
  let countRegionalPendingApproval;
  let isApplicationAssessmentReviewQueueMember;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    ({
      buildApplicationAssessmentReviewQueueSqlFilter,
      countProgramAdminAwaitingDecision,
      countRegionalPendingApproval,
      isApplicationAssessmentReviewQueueMember,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
  });

  test.each([
    ['rm_review', 'pending_decision', true, false],
    ['returned_to_rm', 'pending_decision', true, false],
    ['returned_to_rm', 'awaiting_applicant', true, false],
    ['nwac_review', 'pending_decision', false, true],
    ['returned_to_submitter', 'in_review', false, false],
    ['final_decision_recorded', 'pending_decision', false, false],
  ])(
    'routes active stage %s only to its owner queue',
    (reviewWorkflowStage, applicationLifecycleStatus, expectedRm, expectedNwac) => {
      const fixture = {
        reviewWorkflowId: 700,
        reviewWorkflowStage,
        applicationLifecycleStatus,
      };
      expect(isApplicationAssessmentReviewQueueMember({
        ...fixture,
        bucket: 'awaiting-my-approval',
      })).toBe(expectedRm);
      expect(isApplicationAssessmentReviewQueueMember({
        ...fixture,
        bucket: 'awaiting-decision',
      })).toBe(expectedNwac);
    }
  );

  test('keeps the no-workflow legacy fallback only in the Decision Maker queue', () => {
    const legacyFixture = {
      reviewWorkflowId: null,
      reviewWorkflowStage: null,
      applicationLifecycleStatus: 'pending_decision',
    };
    expect(isApplicationAssessmentReviewQueueMember({
      ...legacyFixture,
      bucket: 'awaiting-decision',
    })).toBe(true);
    expect(isApplicationAssessmentReviewQueueMember({
      ...legacyFixture,
      bucket: 'awaiting-my-approval',
    })).toBe(false);
  });

  test('NWAC count uses the same stage-aware predicate as the awaiting-decision list', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue([[{ total: 2 }], []]),
    };
    const expectedFilter = buildApplicationAssessmentReviewQueueSqlFilter({
      bucket: 'awaiting-decision',
    });

    await expect(countProgramAdminAwaitingDecision(pool)).resolves.toBe(2);

    const [sql, params] = pool.query.mock.calls[0];
    expect(compactSql(sql)).toContain(compactSql(expectedFilter.clause));
    expect(params).toEqual(expectedFilter.params);
    expect(params).toEqual(['nwac_review', 'pending_decision']);
    expect(compactSql(sql)).toContain('LEFT JOIN iset_review_workflow rw');
  });

  test('RM count uses the same RM/returned-stage predicate and counts every exact application', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue([[{ total: 2 }], []]),
    };
    const expectedFilter = buildApplicationAssessmentReviewQueueSqlFilter({
      bucket: 'awaiting-my-approval',
    });

    await expect(countRegionalPendingApproval(pool, [54, 55])).resolves.toBe(2);

    const [sql, params] = pool.query.mock.calls[0];
    expect(compactSql(sql)).toContain(compactSql(expectedFilter.clause));
    expect(params).toEqual([54, 55, ...expectedFilter.params]);
    expect(expectedFilter.params).toEqual(['rm_review', 'returned_to_rm']);
    expect(compactSql(sql)).toContain('COUNT(DISTINCT a.id) AS total');
    expect(compactSql(sql)).toContain('JOIN iset_application a ON c.id = a.case_id');
    expect(compactSql(sql)).not.toContain('SELECT a_case.id');
  });
});
