const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('application assessment EI correction', () => {
  const assessmentWidgetSource = readSource('src/widgets/CoordinatorAssessmentWidget.js');
  const serverSource = readSource('isetadminserver.js');

  test('keeps the existing EI dropdown editable for authorized users after submission workflow starts', () => {
    const permissionBlock = extractBetween(
      assessmentWidgetSource,
      'const canManageEligibilityDuringAssessment =',
      'const isAssessmentDisabled ='
    );

    expect(permissionBlock).toContain('canManageEiEligibility');
    expect(permissionBlock).toContain('!baseAssessmentLocked');
    expect(permissionBlock).toContain('!isDeclarationGateActive');
    expect(permissionBlock).not.toContain('!isPendingApprovalStatus');
    expect(permissionBlock).not.toContain('!hasReviewWorkflow');
    expect(assessmentWidgetSource).toContain('readOnly={isEligibilityDisabled}');
    expect(assessmentWidgetSource).toContain("res.status === 409 && result?.error === 'row_version_conflict'");
  });

  test('backend blocks changed EI eligibility once plan or intervention dependencies exist', () => {
    const guardBlock = extractBetween(
      serverSource,
      'if (eligibilityUpdateRequested) {',
      "if (Object.prototype.hasOwnProperty.call(body, 'status')) {"
    );

    expect(guardBlock).toContain('const eligibilityRoleAllowlist = new Set');
    expect(guardBlock).toContain('const eligibilityChanged = existingKey !== incomingKey;');
    expect(guardBlock).toContain('FROM iset_case_action_plan');
    expect(guardBlock).toContain('FROM iset_case_intervention');
    expect(guardBlock).toContain("error: 'ei_eligibility_dependency_blocked'");
    expect(guardBlock).toContain('EI status cannot be changed here because an action plan or intervention already exists.');
  });

  test('eligibility-only corrections bypass the submitted-assessment body lock and write an audit row', () => {
    expect(serverSource).toContain('eligibilityOnlyAssessmentPayload =');
    expect(serverSource).toContain('!eligibilityOnlyAssessmentPayload');
    expect(serverSource).toContain("INSERT INTO iset_case_event");
    expect(serverSource).toContain("'Corrected EI eligibility.'");
    expect(serverSource).toContain('Authorized EI eligibility correction before action-plan/intervention dependencies existed.');
  });
});
