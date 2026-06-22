const fs = require('fs');
const path = require('path');

const adminServerSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);

const portalServerSource = fs.readFileSync(
  path.join(process.cwd(), '..', 'ISET-intake', 'server.js'),
  'utf8'
);

function extractAdminFunction(name) {
  const marker = `function ${name}`;
  const asyncMarker = `async function ${name}`;
  const constAsyncMarker = `const ${name} = async`;
  const constFunctionMarker = `const ${name} =`;
  const starts = [
    adminServerSource.indexOf(asyncMarker),
    adminServerSource.indexOf(marker),
    adminServerSource.indexOf(constAsyncMarker),
    adminServerSource.indexOf(constFunctionMarker),
  ].filter(index => index >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = adminServerSource.indexOf('\nfunction ', start + 1);
  const nextAsyncFunction = adminServerSource.indexOf('\nasync function ', start + 1);
  const nextConst = adminServerSource.indexOf('\nconst ', start + 1);
  const candidates = [nextFunction, nextAsyncFunction, nextConst].filter(index => index > start);
  const end = candidates.length ? Math.min(...candidates) : undefined;
  return adminServerSource.slice(start, end);
}

function extractRoute(source, method, route) {
  const marker = `app.${method}('${route}'`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextRoute = source.indexOf('\napp.', start + marker.length);
  return source.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

describe('PATH patch bug guards', () => {
  test('signed Financial Overview signing requests are idempotent in admin and portal APIs', () => {
    const adminRoute = extractRoute(adminServerSource, 'post', '/api/signing-requests/:id/sign');
    const portalRoute = extractRoute(portalServerSource, 'post', '/api/signing-requests/:id/sign');

    const adminAlreadySigned = adminRoute.indexOf("row.status === 'signed'");
    const adminPdfWork = adminRoute.indexOf('const resolvedSchema = safeJsonParse');
    expect(adminAlreadySigned).toBeGreaterThanOrEqual(0);
    expect(adminAlreadySigned).toBeLessThan(adminPdfWork);
    expect(adminRoute).toContain('alreadySigned: true');

    const portalAlreadySigned = portalRoute.indexOf("row.status === 'signed'");
    const portalPdfWork = portalRoute.indexOf('// Generate PDF');
    expect(portalAlreadySigned).toBeGreaterThanOrEqual(0);
    expect(portalAlreadySigned).toBeLessThan(portalPdfWork);
    expect(portalRoute).toContain('alreadySigned: true');
  });

  test('document-request jobs ignore terminal applications', () => {
    const pollSource = extractAdminFunction('pollDocsRequestedThresholds');
    const upsertSource = extractAdminFunction('upsertDocRequestReminders');

    expect(pollSource).toContain("AND ${buildApplicationTerminalRankSql('a')} = 0");
    expect(upsertSource).toContain("SELECT ${buildApplicationTerminalRankSql('a')} AS terminal_rank");
    expect(upsertSource).toContain("if (Number(applicationRow?.terminal_rank || 0) === 1) return [];");
  });

  test('terminal case transitions cancel open reminders and reminder polling skips terminal cases', () => {
    const recomputeSource = extractAdminFunction('recomputeCaseStatus');
    const reminderPollSource = extractAdminFunction('pollRemindersForDue');

    expect(adminServerSource).toContain('async function cancelOpenRemindersForTerminalCase');
    expect(recomputeSource).toContain('await cancelOpenRemindersForTerminalCase(conn, numericCaseId);');
    expect(reminderPollSource).toContain('LEFT JOIN iset_case c ON c.id = r.case_id');
    expect(reminderPollSource).toContain("AND ${buildReminderActiveCaseScopeSql('r', 'c')}");
  });

  test('completed terminal applications can infer approved decision outcome from assessment agreement', () => {
    const routeSource = extractRoute(adminServerSource, 'put', '/api/cases/:id');

    expect(adminServerSource).toContain('function deriveDecisionOutcomeFromAssessmentRow');
    expect(routeSource).toContain('deriveDecisionOutcomeFromAssessmentRow(assessmentRowForDecision) || null');
    expect(routeSource).toContain('isTerminalApplicationState(applicationStatusToPersist, applicationLifecycleStatusToPersist)');
  });
});
