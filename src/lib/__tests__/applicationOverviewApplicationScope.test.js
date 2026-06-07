const fs = require('fs');
const path = require('path');

const widgetSource = fs.readFileSync(
  path.join(process.cwd(), 'src/widgets/ApplicationOverviewWidget.js'),
  'utf8'
);
const applicationFormSource = fs.readFileSync(
  path.join(process.cwd(), 'src/widgets/IsetApplicationFormWidget.js'),
  'utf8'
);
const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);

function extractFunctionBlock(name) {
  const marker = `const ${name} =`;
  const start = widgetSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = widgetSource.indexOf('\n  const ', start + marker.length);
  return widgetSource.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe('Application overview selected-application updates', () => {
  test('withdrawn reporting alerts point to Case Workspace instead of the retired ESDC participant workspace', () => {
    expect(widgetSource).toContain('caseWorkspaceCorrectionPath');
    expect(widgetSource).toContain('Open Case Workspace');
    expect(widgetSource).toContain('showReportingCorrectionAlert');
    expect(widgetSource).not.toContain('Open ESDC participant workspace');
    expect(widgetSource).not.toMatch(/\/esdc\/participants\/\$\{caseData\.esdc_submission_id\}/);
  });

  test('withdrawn reporting records do not show the duplicate Application Form reporting banner', () => {
    expect(applicationFormSource).toContain('suppressReportingStatusBanner');
    expect(applicationFormSource).toContain('reportingCorrectionAllowed && !suppressReportingStatusBanner');
    expect(applicationFormSource).not.toContain('without opening Case Workspace');
  });

  test('authorized staff can reopen closed withdrawn or archived applications without using the ordinary terminal edit path', () => {
    expect(serverSource).toContain('canStaffReopenApplication');
    expect(serverSource).toContain("APPLICATION_REOPEN_TARGET_STATUSES = new Set(['in_review'])");
    expect(serverSource).toContain("REOPENABLE_APPLICATION_STATUS_KEYS = new Set(['closed', 'withdrawn', 'archived'])");
    expect(serverSource).toContain('staffApplicationReopenRequested');
    expect(serverSource).toContain('clearWithdrawnReportingCaseContext(existingCaseContext, applicationId)');
    expect(serverSource).toContain('allowedTerminalStatusChange');
    expect(serverSource).toContain('staffApplicationReopenRequested;');
  });

  test('withdraw and reopen quick actions are available to any role with file access', () => {
    expect(widgetSource).toContain('const quickActionStatusRaw =');
    expect(widgetSource).toContain('caseData?.applicationStatusRaw');
    expect(widgetSource).toContain('caseData?.application_status_raw');
    expect(widgetSource).toContain('const quickActionStatusKey =');
    expect(widgetSource).toContain(
      'const canWithdrawApplication = hasCaseId && WITHDRAW_ALLOWED_STATUSES.has(quickActionStatusKey);'
    );
    expect(widgetSource).toContain(
      'const canReopenApplication = hasCaseId && REOPEN_ALLOWED_STATUSES.has(quickActionStatusKey);'
    );
    expect(widgetSource).toContain("const REOPEN_ALLOWED_STATUSES = new Set(['closed', 'archived']);");
    expect(widgetSource).not.toContain(
      'const canWithdrawApplication = hasCaseId && WITHDRAW_ALLOWED_STATUSES.has(normalizedStatusKey);'
    );
    expect(widgetSource).not.toContain(
      'const canWithdrawApplication = hasCaseId && WITHDRAW_ALLOWED_STATUSES.has(normalizedStatusKey) && (isAdminRole || isRegionalCoordinatorRole);'
    );
    expect(widgetSource).not.toContain('const canReopenArchived = hasCaseId && normalizedStatusKey === \'archived\' && isSystemAdministratorRole;');
  });

  test('withdrawal resolves open escalations through the status update route', () => {
    expect(widgetSource).not.toContain('resolveEscalationIfNeeded');
    expect(widgetSource).toContain('payload.resolveOpenEscalation = true;');
    expect(widgetSource).toContain('payload.statusActionNote = note || null;');
    expect(serverSource).toContain('resolveOpenApplicationEscalationsForStatusChange');
    expect(serverSource).toContain("disposition: 'withdraw_application'");
  });

  test('case row-version hints are ignored when they are not for the selected application', () => {
    expect(widgetSource).toContain('caseRowVersionIsForSelectedApplication');
    expect(widgetSource).toContain('if (!caseRowVersionIsForSelectedApplication) return;');
  });

  test('selected application refresh replaces the optimistic row-version token', () => {
    const source = extractFunctionBlock('fetchLatestApplication');

    expect(source).toContain('setRowVersion(incomingVersion);');
    expect(source).not.toContain('incomingVersion > prev ? incomingVersion : prev');
  });

  test('manual status updates send selected application scope to the case update route', () => {
    const source = extractFunctionBlock('runStatusUpdate');
    const payloadStart = source.indexOf('const payload = {');
    const saveStart = source.indexOf('const response = await apiFetch');

    expect(payloadStart).toBeGreaterThanOrEqual(0);
    expect(saveStart).toBeGreaterThan(payloadStart);
    expect(source.slice(payloadStart, saveStart)).toContain(
      'applicationId: application?.id || application_id || caseData?.application_id || null'
    );
    expect(source).toMatch(/apiFetch\(`\/api\/cases\/\$\{caseData\.id\}`/);
  });

  test('document-request updates send selected application scope to the case update route', () => {
    const source = extractFunctionBlock('runDocsRequestedUpdate');
    const payloadStart = source.indexOf('const payload = {');
    const saveStart = source.indexOf('const response = await apiFetch');

    expect(payloadStart).toBeGreaterThanOrEqual(0);
    expect(saveStart).toBeGreaterThan(payloadStart);
    expect(source.slice(payloadStart, saveStart)).toContain(
      'applicationId: application?.id || application_id || caseData?.application_id || null'
    );
    expect(source).toMatch(/apiFetch\(`\/api\/cases\/\$\{caseData\.id\}`/);
  });
});
