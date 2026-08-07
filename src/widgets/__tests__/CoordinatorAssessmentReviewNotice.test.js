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

describe('application assessment reviewer-stage notice', () => {
  test('uses the active review workflow even when document lifecycle fields have drifted', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const noticeBlock = extractBetween(
      source,
      'const reviewWorkflowNotice = (() => {',
      'const reviewWorkflowStageAlert ='
    );

    expect(noticeBlock).toContain('!twoStepReviewEnabled || !hasReviewWorkflow');
    expect(noticeBlock).not.toContain('!isPendingApprovalStatus');
    expect(noticeBlock).toContain("header: 'Ready for Decision Maker'");
    expect(noticeBlock).toContain('reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm');
  });

  test('exposes a stable assessment-wizard boundary for deployed workflow acceptance', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    expect(source).toContain('data-path-assessment-wizard="true"');
    expect(source).toContain('data-path-assessment-step={currentStep}');
    expect(source).toContain("data-path-assessment-editable={isAssessmentDisabled ? 'false' : 'true'}");

    const smokeSource = readSource('scripts/two-step-review-test-smoke.js');
    expect(smokeSource).toContain("const selector = '[data-path-assessment-wizard=\"true\"]';");
    expect(smokeSource).toContain("await clickAssessmentWizardButton(page, 'Next');");
    expect(smokeSource).toContain("await waitForAssessmentWizardStep(page, 'framing');");
    expect(smokeSource).toContain("await waitForAssessmentWizardStep(page, 'rationale');");
  });
});
