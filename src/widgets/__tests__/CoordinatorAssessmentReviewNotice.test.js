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
});
