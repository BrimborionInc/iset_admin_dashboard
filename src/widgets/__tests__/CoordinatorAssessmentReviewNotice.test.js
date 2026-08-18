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

  test('allows an authorised returned submitter to navigate legacy validation while retaining submit validation', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const navigationBlock = extractBetween(
      source,
      'const handleWizardNavigate = async ({ detail }) => {',
      'const canRecallAssessmentSubmission ='
    );
    const submitBlock = extractBetween(
      source,
      'const handleSubmit = async () => {',
      'const handleLetterBodyChange ='
    );

    expect(source).toContain(
      'twoStepReviewEnabled && reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToSubmitter'
    );
    expect(navigationBlock).toContain(
      'isReturnedToSubmitterStage && canEditAssessmentBody'
    );
    expect(navigationBlock).toContain(
      'if (!valid && !canNavigateReturnedCorrection)'
    );
    expect(submitBlock).toContain('const errors = denyFundingFlowActive');
    expect(submitBlock).toContain(': validateAssessment(assessment);');
    expect(submitBlock).toContain('if (Object.keys(errors).length > 0)');
    expect(submitBlock).toContain('...buildAssessmentPayload()');
    expect(submitBlock).toContain('assessment_submit_action: true');
    expect(submitBlock).not.toContain('includeDecisionFields: true');
    expect(source).toContain('!preserveReturnedAssessmentEligibility');
  });

  test('refreshes the exact Application Workspace record before submit and labels only real version conflicts as concurrent edits', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const workspaceSource = readSource('src/pages/applicationCaseDashboard.js');
    const submitBlock = extractBetween(
      source,
      'const handleSubmit = async () => {',
      'const handleLetterBodyChange ='
    );

    expect(workspaceSource).toContain('refreshCaseData={refreshCaseData}');
    expect(source).toContain('onRowVersionUpdate, refreshCaseData, workspaceEntry');
    expect(submitBlock).toContain("typeof refreshCaseData === 'function'");
    expect(submitBlock).toContain('const latest = refreshCurrentCase ? await refreshCurrentCase() : null;');
    expect(submitBlock).toContain("if (res.status === 409 && result?.error === 'row_version_conflict')");
    expect(submitBlock).toContain("result?.message || result?.error || 'Failed to save assessment.'");
    expect(submitBlock).not.toContain('if (res.status === 409)');
  });

  test('keeps staff assessment saves separate from Decision Maker fields and context', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const payloadBuilder = extractBetween(
      source,
      'const buildAssessmentPayload = useCallback',
      'const handlePostingContextErrors = useCallback'
    );
    const saveBlock = extractBetween(
      source,
      'const handleSave = async',
      '// Lock editing state if final decision has been recorded'
    );
    const decisionBlock = extractBetween(
      source,
      'const handleComplete = async',
      'const handleApproveClick = async'
    );

    expect(payloadBuilder).toContain('if (includeDecisionFields)');
    expect(payloadBuilder).toContain('buildApplicationAssessmentCaseContext(null, applicationId');
    expect(payloadBuilder).not.toContain('assessmentOtherFunding: normalizedOtherFunding,\n        ...');
    expect(saveBlock).toContain('const payload = buildAssessmentPayload();');
    expect(saveBlock).toContain('isReturnedAssessmentEligibilityChangeUnverified({');
    expect(saveBlock).toContain("reason: 'ei_verification_required'");
    expect(saveBlock).not.toContain('includeDecisionFields: true');
    expect(decisionBlock).toContain('buildAssessmentPayload({ includeDecisionFields: true })');
  });

  test('keeps legitimate post-decision letter work reachable and surfaces the server message', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const persistenceBlock = extractBetween(
      source,
      'const persistLetterContext = useCallback',
      'const persistLetterDraft = useCallback'
    );
    const sendBlock = extractBetween(
      source,
      'const handleSendDecisionLetter = async () => {',
      'const handleSave = async'
    );
    const draftSaveIndex = sendBlock.indexOf('await persistLetterDraft({');
    const messageSendIndex = sendBlock.indexOf('apiFetch(`/api/cases/');

    expect(source).toContain('const showCommunicationStep = isPostDecisionStatus;');
    expect(source).toContain(
      'const isLetterEditingDisabled = lockedByAnotherUser || isCompletedStatus || letterAlreadySent;'
    );
    expect(persistenceBlock).toContain('decisionLetterDrafts: effectiveLetterDrafts');
    expect(persistenceBlock).toContain(
      "content: result?.message || result?.error || 'Failed to save the letter draft.'"
    );
    expect(draftSaveIndex).toBeGreaterThanOrEqual(0);
    expect(messageSendIndex).toBeGreaterThan(draftSaveIndex);
    expect(sendBlock).toContain("if (!saved.ok) {");
    expect(sendBlock).toContain("throw new Error('Save the letter draft before sending.');");
  });
});
