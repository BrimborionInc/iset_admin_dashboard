const fs = require('fs');
const path = require('path');

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

describe('approved application isolation from historical case plans', () => {
  test('auto-plan duplicate guards are scoped to the selected application', () => {
    const autoPlan = sourceSlice(
      'async function ensureAutoPlanAndInterventionFromAssessment',
      'function escapeXml'
    );

    expect(autoPlan).toContain('AND application_id = ?');
    expect(autoPlan).toContain('[caseId, actionPlanApplicationId, AUTO_PLAN_METADATA_SOURCE]');
    expect(autoPlan).toContain('[caseId, actionPlanApplicationId]');
    expect(autoPlan).toContain("AND status IN ('draft','active','closed')");
    expect(autoPlan).toContain('(case_id, application_id, name, status');
  });

  test('assessment CFA fallback cannot substitute interventions from another application plan', () => {
    const snapshot = sourceSlice(
      'async function buildCfaSnapshotFromAssessment',
      'async function fetchAssignedCaseManagerForFundingAgreement'
    );

    expect(snapshot).toContain('JOIN iset_case_action_plan ap ON ap.id = i.action_plan_id');
    expect(snapshot).toContain('AND ap.application_id = ?');
    expect(snapshot).toContain('[caseId, normalizedApplicationId]');
  });

  test('plan-based CFA snapshots retain the action plan application lineage', () => {
    const snapshot = sourceSlice(
      'async function buildCfaSnapshot({',
      'async function buildCfaSnapshotFromAssessment'
    );

    expect(snapshot).toContain('SELECT id, application_id, name, funding_stream');
    expect(snapshot).toContain('const planApplicationId = normalisePositiveInteger(planRow.application_id)');
    expect(snapshot).toContain("'JOIN iset_application a ON a.case_id = c.id AND a.id = ?'");
    expect(snapshot).toContain("'LEFT JOIN iset_application a ON 1 = 0'");
    expect(snapshot).not.toContain("buildCasePrimaryApplicationJoinSql('c', 'a')");
    expect(snapshot).toContain('planApplicationId ? [planApplicationId, caseId] : [caseId]');
  });

  test('CFA snapshots include only funded interventions and exclude applied revision evidence', () => {
    const snapshotSource = sourceSlice(
      'function sanitizeInterventionForCfa',
      'async function fetchAssignedCaseManagerForFundingAgreement'
    );

    expect(snapshotSource).toContain('function interventionHasCfaFunding');
    expect(snapshotSource).toContain('.filter(interventionHasCfaFunding)');
    expect(snapshotSource).toContain("revisionApplicationStatus === 'applied'");
    expect(snapshotSource).toContain('if (!row || isAppliedRevisionEvidenceIntervention(row)) return null;');
  });

  test('zero-funded CFA creation exits before series lookup or draft supersession', () => {
    const planVersion = sourceSlice(
      'async function createCfaVersionForPlan',
      'async function createCfaVersionFromAssessment'
    );
    const assessmentVersion = sourceSlice(
      'async function createCfaVersionFromAssessment',
      'const normalizeProposedIntervention'
    );

    for (const versionSource of [planVersion, assessmentVersion]) {
      const noInterventionsGuard = versionSource.indexOf('if (!snapshot?.interventions?.length)');
      const noFundingGuard = versionSource.indexOf('if (!cfaSnapshotHasFunding(snapshot))');
      const ensureSeries = versionSource.indexOf('const seriesId = await ensureCfaSeries');
      const supersessionWrite = versionSource.indexOf("SET status = 'withdrawn'");

      expect(noInterventionsGuard).toBeGreaterThanOrEqual(0);
      expect(noFundingGuard).toBeGreaterThan(noInterventionsGuard);
      expect(ensureSeries).toBeGreaterThan(noFundingGuard);
      expect(supersessionWrite).toBeGreaterThan(ensureSeries);
    }
  });

  test('automatic CFA triggers require funded rows and suppress zero-funded final approvals', () => {
    const createRoute = sourceSlice(
      "app.post('/api/action-plans/:id/interventions'",
      "app.patch('/api/interventions/:id'"
    );
    const patchRoute = sourceSlice(
      "app.patch('/api/interventions/:id'",
      "app.post('/api/interventions/:id/close'"
    );

    expect(createRoute).toContain('shouldIncludeFundedInterventionForCfa(\n        createInterventionState');
    expect(createRoute).not.toContain('shouldIncludeInterventionForCfa(createInterventionState)');
    expect(patchRoute).toContain('const wasIncludedInCfa = shouldIncludeFundedInterventionForCfa(');
    expect(patchRoute).toContain('const isIncludedInCfa = shouldIncludeFundedInterventionForCfa(');

    const zeroFundedGuard = patchRoute.indexOf('const isZeroFundedFinalApproval =');
    const targetList = patchRoute.indexOf('const cfaTargets = [];', zeroFundedGuard);
    const targetSuppression = patchRoute.indexOf('if (isZeroFundedFinalApproval)', targetList);
    const cfaWrite = patchRoute.indexOf('await createCfaVersionForPlan({', targetSuppression);

    expect(zeroFundedGuard).toBeGreaterThanOrEqual(0);
    expect(targetList).toBeGreaterThan(zeroFundedGuard);
    expect(targetSuppression).toBeGreaterThan(targetList);
    expect(cfaWrite).toBeGreaterThan(targetSuppression);
  });

  test('every newly materialized application plan creates the next CFA version', () => {
    const postCommit = sourceSlice(
      'if (autoPlanSuggestion?.createdIntervention && autoPlanSuggestion?.planId)',
      'const [[caseRow]] = await pool.query'
    );

    expect(postCommit).toContain('await createCfaVersionForPlan({');
    expect(postCommit).toContain('actionPlanId: autoPlanSuggestion.planId');
    expect(postCommit).not.toContain('existingCfaRow');
  });
});
