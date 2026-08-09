const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);

function extractFunctionBlock(name) {
  const marker = `async function ${name}`;
  const start = serverSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = serverSource.indexOf('\nfunction ', start + marker.length);
  const nextAsyncFunction = serverSource.indexOf('\nasync function ', start + marker.length);
  const candidates = [nextFunction, nextAsyncFunction].filter(index => index > start);
  const end = candidates.length ? Math.min(...candidates) : undefined;
  return serverSource.slice(start, end);
}

function extractRouteBlock(method, route) {
  const marker = `app.${method}('${route}'`;
  const start = serverSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextRoute = serverSource.indexOf('\napp.', start + marker.length);
  return serverSource.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

describe('Document checklist route', () => {
  test('uses decision outcome before treating completed/closed applications as funding-stage files', () => {
    const answersSource = extractFunctionBlock('loadApplicationAnswers');
    const routeSource = extractRouteBlock('get', '/api/applicants/:id/document-checklist');

    expect(answersSource).toContain('a.decision_outcome');
    expect(answersSource).toContain('decisionOutcome: row.decision_outcome || null');

    expect(routeSource).toContain(
      'const applicationDecisionOutcome = normaliseApplicationDecisionOutcomeValue(applicationAnswerMeta.decisionOutcome);'
    );
    expect(routeSource).toContain("const decisionOutcomeDenied = applicationDecisionOutcome === 'denied';");
    expect(routeSource).toContain('!decisionOutcomeDenied &&');
    expect(routeSource).toContain('decisionOutcomeDenied ||');
  });

  test('denied applications cannot be forced into the approval checklist by explicit stage requests', () => {
    const routeSource = extractRouteBlock('get', '/api/applicants/:id/document-checklist');
    const explicitStageBranch = routeSource.indexOf('if (stageRaw)');
    const denialOverride = routeSource.indexOf("decisionDenied && normaliseChecklistId(stageRaw) !== 'deny'", explicitStageBranch);
    const requestedStagePayload = routeSource.indexOf('return res.json(buildGatePayload(stageRaw));', explicitStageBranch);

    expect(explicitStageBranch).toBeGreaterThanOrEqual(0);
    expect(denialOverride).toBeGreaterThan(explicitStageBranch);
    expect(requestedStagePayload).toBeGreaterThan(denialOverride);
  });

  test('intervention checklists use proposal and Action Plan application lineage without a case-primary fallback', () => {
    const routeSource = extractRouteBlock('get', '/api/applicants/:id/document-checklist');

    expect(routeSource).toContain('p.application_id AS proposal_application_id');
    expect(routeSource).toContain('ap.application_id AS action_plan_application_id');
    expect(routeSource).toContain('resolveInterventionApplicationScopeId(interventionRow');
    expect(routeSource).toContain('applicationId: isIntervention ? interventionApplicationId : applicationId');
    expect(routeSource).toContain('? normalisePositiveInteger(interventionApplicationId)');
    expect(routeSource).toContain('return Number(d.action_plan_application_id) === Number(resolvedApplicationId);');
    expect(routeSource).toContain('!normalisePositiveInteger(d.action_plan_application_id)');
    expect(routeSource).not.toContain('buildCasePrimaryApplicationIdSql');
  });

  test('signed checklist forms require the exact selected application and cannot match by case OR application', () => {
    const routeSource = extractRouteBlock('get', '/api/applicants/:id/document-checklist');
    const signedCountStart = routeSource.indexOf("const scopePredicates = ['linked_message.application_id = ?']");
    const signedCountEnd = routeSource.indexOf('const normalizedDocs =', signedCountStart);
    const signedCountSource = routeSource.slice(signedCountStart, signedCountEnd);

    expect(signedCountStart).toBeGreaterThanOrEqual(0);
    expect(signedCountSource).toContain('JOIN message_signing_request msr');
    expect(signedCountSource).toContain('JOIN messages linked_message');
    expect(signedCountSource).toContain("scopePredicates.join('\\n              AND ')");
    expect(signedCountSource).not.toContain("scopePredicates.join(' OR ')");
    expect(signedCountSource).not.toContain('buildCasePrimaryApplicationIdSql');
  });
});
