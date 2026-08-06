const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('application raw status workflow guards', () => {
  test('Application Workspace quick actions use raw status for eligibility', () => {
    const source = readSource('src/widgets/ApplicationOverviewWidget.js');

    expect(source).toContain('const quickActionStatusRaw =');
    expect(source).toContain('caseData?.applicationStatusRaw');
    expect(source).toContain('caseData?.application_status_raw');
    expect(source).toContain('const quickActionStatusKey =');
    expect(source).toContain('WITHDRAW_ALLOWED_STATUSES.has(quickActionStatusKey)');
    expect(source).not.toContain('WITHDRAW_ALLOWED_STATUSES.has(normalizedStatusKey)');
  });

  test('Secure Messaging leaves document-request reconciliation to the signing backend', () => {
    const source = readSource('src/widgets/SecureMessagingWidget.js');
    const portalSource = readSource('../ISET-intake/server.js');

    expect(source).not.toContain('updateStatusToInReview');
    expect(source).not.toContain('allSigned');
    expect(portalSource).toContain('reconcileApplicationDocumentRequestAfterSigning');
    expect(portalSource).toContain('resolveApplicationAssessmentReviewState');
  });

  test('status resolvers prefer raw case status before display-normalized status', () => {
    const composeSource = readSource('src/widgets/SecureMessageComposePanel.jsx');
    const assessmentSource = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const formSource = readSource('src/widgets/IsetApplicationFormWidget.js');

    for (const source of [composeSource, assessmentSource, formSource]) {
      expect(source).toContain('applicationStatusRaw');
      expect(source).toContain('application_status_raw');
    }
  });

  test('New Action Plan prefills use explicit value maps before label fallbacks', () => {
    const source = readSource('src/pages/Caseworking/caseWorkspace/modals/NewActionPlanModal.jsx');
    const employmentStart = source.indexOf('const mapEmploymentStatus = () => {');
    const employmentEnd = source.indexOf('const mapEligibilityToFundingStream = () => {', employmentStart);
    const employmentBlock = source.slice(employmentStart, employmentEnd);

    expect(source).toContain('const EDUCATION_VALUE_TO_ILMP_CODE =');
    expect(source).toContain('const BARRIER_VALUE_TO_ILMP_CODE =');
    expect(source).toContain('if (EDUCATION_OPTIONS.some(opt => opt.value === target)) return target;');
    expect(source).toContain('if (BARRIER_OPTIONS.some(opt => opt.value === normalized)) return normalized;');
    expect(employmentBlock.indexOf('val.includes("unemploy")')).toBeGreaterThanOrEqual(0);
    expect(employmentBlock.indexOf('val.includes("employ")')).toBeGreaterThan(
      employmentBlock.indexOf('val.includes("unemploy")')
    );
  });
});
