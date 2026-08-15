const fs = require('fs');
const path = require('path');

const {
  collectDeniedReportingEiAlignmentIssues,
  normalizeEiClaimantCode,
  resolveEiFundingClassification,
} = require('../deniedReportingEiAlignment');

const serverSource = fs.readFileSync(
  path.resolve(__dirname, '../../../isetadminserver.js'),
  'utf8'
);

function sourceSlice(startMarker, endMarker) {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

function deniedReportingContext({
  eligibility = 'EI Reach Back',
  applicationId = 9102,
  planApplicationId = applicationId,
  claimantCode = '2',
  planFundingStream = 'EI',
  interventionFundingStream = 'EI',
} = {}) {
  return {
    applicationId,
    caseAssessmentRow: { esdc_eligibility: eligibility },
    caseActionPlans: [
      {
        id: 9201,
        applicationId: planApplicationId,
        metadata: { source: 'denied_reporting' },
        eiClaimant: claimantCode,
        storedFundingStream: planFundingStream,
        fundingStream: planFundingStream,
        interventions: [
          {
            id: 9301,
            fundingStream: planFundingStream,
            fundingStreamDecision: interventionFundingStream,
          },
        ],
      },
    ],
  };
}

describe('denied reporting EI alignment', () => {
  test.each([
    ['EI Active Claim', '1', 'EI'],
    ['EI Reach Back', '2', 'EI'],
    ['CRF', '3', 'CRF'],
    ['ei_reach_back', '2', 'EI'],
    ['reach-back / former claimant', '2', 'EI'],
    ['reach-back client/former claimant', '2', 'EI'],
  ])('maps %s to claimant %s and funding stream %s', (value, claimantCode, fundingStream) => {
    expect(normalizeEiClaimantCode(value)).toBe(claimantCode);
    expect(resolveEiFundingClassification(value)).toEqual({ claimantCode, fundingStream });
  });

  test('accepts an application-scoped Reach Back plan with an explicit EI intervention decision', () => {
    expect(collectDeniedReportingEiAlignmentIssues(deniedReportingContext())).toEqual([]);
  });

  test('reports application, plan claimant, plan funding, and stored intervention funding mismatches', () => {
    const issues = collectDeniedReportingEiAlignmentIssues(
      deniedReportingContext({
        planApplicationId: 9101,
        claimantCode: '3',
        planFundingStream: 'CRF',
        interventionFundingStream: null,
      })
    );

    expect(issues.map(issue => issue.type)).toEqual([
      'application_scope_mismatch',
      'plan_claimant_mismatch',
      'plan_funding_stream_mismatch',
      'intervention_funding_stream_mismatch',
    ]);
    expect(issues.at(-1)).toMatchObject({
      interventionId: 9301,
      expectedFundingStream: 'EI',
      actualFundingStream: null,
    });
  });

  test('fails closed when the application assessment has no recognized eligibility', () => {
    const issues = collectDeniedReportingEiAlignmentIssues(
      deniedReportingContext({ eligibility: 'unknown' })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'assessment_eligibility_required',
      planId: 9201,
    });
  });

  test('does not apply denial-only validation to ordinary action plans', () => {
    const context = deniedReportingContext();
    context.caseActionPlans[0].metadata.source = 'auto_assessment';
    expect(collectDeniedReportingEiAlignmentIssues(context)).toEqual([]);
  });
});

describe('denied reporting server integration guards', () => {
  test('reuses denial artifacts only within the exact application', () => {
    const syncSource = sourceSlice(
      'async function syncDeniedReportingArtifacts',
      'async function syncDeniedReportingForApplicationIfNeeded'
    );
    const lookupStart = syncSource.indexOf('const [[existingPlan]] = await connection.query(');
    const lookupEnd = syncSource.indexOf('let planId = existingPlan?.id || null;', lookupStart);
    expect(lookupStart).toBeGreaterThanOrEqual(0);
    expect(lookupEnd).toBeGreaterThan(lookupStart);
    const existingPlanLookup = syncSource.slice(lookupStart, lookupEnd);

    expect(syncSource).toContain('AND application_id = ?');
    expect(existingPlanLookup).toContain('[numericCaseId, numericApplicationId, ...planSourceKeys]');
    expect(existingPlanLookup).not.toContain("normalizedReportingTrigger === 'withdrawal'");
    expect(syncSource).toContain('await findEsdcSubmissionIdForActionPlan(connection, planId)');
    expect(syncSource).not.toContain('await findEsdcSubmissionIdForCase(connection, numericCaseId)');
    expect(syncSource).toContain("'denied_reporting_submission_scope_failed'");
  });

  test('requires assessment eligibility and persists the resolved stream on plan and intervention', () => {
    const syncSource = sourceSlice(
      'async function syncDeniedReportingArtifacts',
      'async function syncDeniedReportingForApplicationIfNeeded'
    );

    expect(syncSource).toContain("'denied_reporting_ei_eligibility_required'");
    expect(syncSource).toContain('assessmentEiFundingClassification');
    expect(syncSource).toContain('funding_stream = ?');
    expect(syncSource).toContain('funding_stream_decision = ?');
  });

  test('submission validation uses the explicit stored intervention decision', () => {
    expect(serverSource).toContain('collectDeniedReportingEiAlignmentIssues(context).forEach(issue => {');
    expect(serverSource).toContain('fundingStreamDecision:');
    expect(serverSource).toContain('row.funding_stream_decision || row.fundingStreamDecision || null');
  });

  test('repeat intake callers explicitly reopen a reused case for the new application', () => {
    const manualIntakeSource = sourceSlice(
      "app.post('/api/applications/manual-intake'",
      "app.get('/api/applications/:id/versions'"
    );
    expect(manualIntakeSource).toContain('reopenForNewApplication: true');

    const minimalCaseCreateSource = sourceSlice(
      "app.post('/api/cases'",
      "app.get('/api/cases'"
    );
    expect(minimalCaseCreateSource).toContain(
      'reopenForNewApplication: Boolean(pendingApplicationSubmissionId)'
    );
  });

  test('workspace validation and export send and resolve the selected application scope', () => {
    const workspaceSource = fs.readFileSync(
      path.resolve(__dirname, '../../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx'),
      'utf8'
    );
    expect(workspaceSource).toContain('`?applicationId=${encodeURIComponent(applicationId)}`');
    expect(serverSource).toContain('findEsdcSubmissionIdForApplication(pool, caseId, row.application_id)');
    expect(serverSource).toContain('findPreferredActionPlanIdForApplication(pool, caseId, targetApplicationId)');
  });
});
