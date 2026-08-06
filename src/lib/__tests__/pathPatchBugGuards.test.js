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

const secureMessagingWidgetSource = fs.readFileSync(
  path.join(process.cwd(), 'src/widgets/SecureMessagingWidget.js'),
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
  test('participant signing has one completion writer in the public portal', () => {
    const adminRoute = extractRoute(adminServerSource, 'post', '/api/signing-requests/:id/sign');
    const portalRoute = extractRoute(portalServerSource, 'post', '/api/signing-requests/:id/sign');

    expect(adminRoute).toContain("res.status(404).json({ error: 'not_found' })");
    expect(adminRoute).not.toContain("UPDATE signing_request");
    expect(adminRoute).not.toContain('finalizeSignedFundingOverviewSubmission');

    const portalAlreadySigned = portalRoute.indexOf("row.status === 'signed'");
    const portalPdfWork = portalRoute.indexOf('// Generate PDF');
    expect(portalAlreadySigned).toBeGreaterThanOrEqual(0);
    expect(portalAlreadySigned).toBeLessThan(portalPdfWork);
    expect(portalRoute).toContain('alreadySigned: true');
  });

  test('form message creation atomically persists signing scope and document-request activation', () => {
    const handlerStart = adminServerSource.indexOf('const handlePostCaseSecureMessage = async (req, res) => {');
    const handlerEnd = adminServerSource.indexOf(
      "app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);",
      handlerStart
    );
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const routeSource = adminServerSource.slice(handlerStart, handlerEnd);
    const beginIndex = routeSource.indexOf('await messageWriteConnection.beginTransaction()');
    const messageInsertIndex = routeSource.indexOf('INSERT INTO messages');
    const signingInsertIndex = routeSource.indexOf('INSERT INTO signing_request');
    const activationIndex = routeSource.indexOf('await setDocsRequestedFromSecureMessage({');
    const commitIndex = routeSource.indexOf('await messageWriteConnection.commit()');

    expect(routeSource).toContain('application_id_required_for_signing_request');
    expect(routeSource).toContain('connection: messageWriteConnection');
    expect(routeSource).toContain('syncSideEffects: false');
    expect(routeSource).toContain('await messageWriteConnection.rollback()');
    expect(beginIndex).toBeGreaterThanOrEqual(0);
    expect(messageInsertIndex).toBeGreaterThan(beginIndex);
    expect(signingInsertIndex).toBeGreaterThan(messageInsertIndex);
    expect(activationIndex).toBeGreaterThan(signingInsertIndex);
    expect(commitIndex).toBeGreaterThan(activationIndex);
    expect(routeSource).not.toContain('failed to set docs requested from secure message');
  });

  test('application review queue is exact-application and workflow-stage driven', () => {
    const routeSource = extractRoute(
      adminServerSource,
      'get',
      '/api/dashboard/awaiting-approval-items'
    );

    expect(routeSource).toContain('FROM iset_application a');
    expect(routeSource).toContain('JOIN iset_case c ON c.id = a.case_id');
    expect(routeSource).not.toContain("buildCasePrimaryApplicationJoinSql('c', 'a'");
    expect(routeSource).toContain('rw.current_stage IN (?, ?)');
    expect(routeSource).toContain('rw.current_stage = ?');
  });

  test('application assessment recall and review actions fail closed without exact application scope', () => {
    const recallRoute = extractRoute(adminServerSource, 'post', '/api/cases/:id/assessment/recall');
    const actionRoute = extractRoute(
      adminServerSource,
      'post',
      '/api/cases/:id/assessment/review-workflow/action'
    );

    for (const routeSource of [recallRoute, actionRoute]) {
      expect(routeSource).toContain('application_id_required_for_assessment');
      expect(routeSource).toContain('JOIN iset_application a ON a.case_id = c.id AND a.id = ?');
      expect(routeSource).not.toContain("buildCasePrimaryApplicationJoinSql('c', 'a')");
    }
  });

  test('secure-message display does not write application lifecycle from aggregate case attachments', () => {
    expect(secureMessagingWidgetSource).not.toContain('updateStatusToInReview');
    expect(secureMessagingWidgetSource).not.toContain('allSigned');
  });

  test('document-request jobs ignore terminal applications', () => {
    const pollSource = extractAdminFunction('pollDocsRequestedThresholds');
    const fetchReminderSource = extractAdminFunction('fetchDocRequestReminders');
    const upsertSource = extractAdminFunction('upsertDocRequestReminders');
    const cancelSource = extractAdminFunction('cancelDocRequestReminders');

    expect(pollSource).toContain("AND ${buildApplicationTerminalRankSql('a')} = 0");
    expect(pollSource).toContain("JSON_EXTRACT(e_reminder.payload_json, '$.application_id')");
    expect(pollSource).toContain("JSON_EXTRACT(e_closure.payload_json, '$.application_id')");
    expect(fetchReminderSource).toContain('AND application_id = ?');
    expect(upsertSource).toContain("SELECT ${buildApplicationTerminalRankSql('a')} AS terminal_rank");
    expect(upsertSource).toContain("if (Number(applicationRow?.terminal_rank || 0) === 1) return [];");
    expect(cancelSource).toContain('AND application_id = ?');
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
