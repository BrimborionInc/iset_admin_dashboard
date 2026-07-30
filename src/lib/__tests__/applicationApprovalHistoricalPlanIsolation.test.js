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
    expect(snapshot).toContain('planApplicationId ? [planApplicationId, caseId] : [caseId]');
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
