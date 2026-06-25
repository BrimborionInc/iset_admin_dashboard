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

describe('application assessment high-value decision guard', () => {
  const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');

  test('blocks only high-value approval, not deny or request-changes commits', () => {
    expect(source).toContain('const selectedDecisionRequiresHighValueApprover =');
    expect(source).toContain("assessment.nwacReviewStatus === 'approve' && Boolean(approvalBlockMessage)");

    const handleApproveClick = extractBetween(
      source,
      'const handleApproveClick = async () => {',
      'const updateApplicationStatus = useCallback'
    );

    expect(handleApproveClick).toContain('if (selectedDecisionRequiresHighValueApprover)');
    expect(handleApproveClick).not.toContain('if (approvalBlockMessage)');
  });

  test('high-value warning tells non-Shelley users other outcomes remain available', () => {
    expect(source).toContain('Other Decision Maker outcomes can still be recorded.');
  });

  test('regional managers can edit only in-review draft assessments', () => {
    expect(source).toContain('const canEditDraftAssessmentAsRegionalManager =');
    expect(source).toContain('isRegionalManager &&');
    expect(source).toContain("normalizedApplicationStatus === 'in_review'");
    expect(source).toContain('!hasReviewWorkflow');
    expect(source).toContain(
      "const canEditAssessmentBody = isAssessor || roleKey === 'systemadministrator' || canEditDraftAssessmentAsRegionalManager;"
    );
    expect(source).toContain('Submitted assessments must move through the review actions instead.');
  });
});
