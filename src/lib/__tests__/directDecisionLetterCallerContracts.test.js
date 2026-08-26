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

describe('direct decision-letter caller contracts', () => {
  test('application approval and denial select only active supported signing workflows', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const workflowBlock = extractBetween(
      source,
      'const loadLetterWorkflows = async () => {',
      'loadLetterWorkflows();'
    );

    expect(source).toContain("from '../lib/signingWorkflowAvailability'");
    expect(workflowBlock).toContain('selectLatestSupportedSigningWorkflow(');
    expect(workflowBlock).toContain("'assessment_approval_letter'");
    expect(workflowBlock).toContain("'assessment_denial_letter'");
    expect(workflowBlock).not.toContain('.sort(');
  });

  test('application letter persistence locks the resolved application identity', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const lockBlock = extractBetween(
      source,
      'const ensureLockForOperation = useCallback(async () => {',
      'const handleSignDeclaration = useCallback'
    );

    expect(source).toContain('useApplicationLock(resolvedApplicationId)');
    expect(lockBlock).toContain('const lockApplicationId = Number(applicationId);');
    expect(lockBlock).toContain('!Number.isInteger(lockApplicationId) || lockApplicationId < 1');
    expect(lockBlock).not.toContain('if (!application_id)');
  });

  test('intervention approval selects only an active supported signing workflow', () => {
    const source = readSource(
      'src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx'
    );
    const workflowBlock = extractBetween(
      source,
      'const loadWorkflows = async () => {',
      'loadWorkflows();'
    );

    expect(source).toContain('from "../../../../lib/signingWorkflowAvailability.js"');
    expect(workflowBlock).toContain('selectLatestSupportedSigningWorkflow(');
    expect(workflowBlock).toContain('"assessment_approval_letter"');
    expect(workflowBlock).not.toContain('.sort(');
  });

  test('intervention approval cannot collapse into an unscoped letter send', () => {
    const source = readSource(
      'src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx'
    );
    const sendBlock = extractBetween(
      source,
      'const handleSendDecisionLetter = useCallback',
      'const buildSentLetterCompletionNote = useCallback'
    );
    const interventionGuardIndex = sendBlock.indexOf('!Number.isInteger(parsedInterventionId)');
    const postIndex = sendBlock.indexOf('const response = await apiFetch');

    expect(interventionGuardIndex).toBeGreaterThanOrEqual(0);
    expect(postIndex).toBeGreaterThan(interventionGuardIndex);
    expect(sendBlock).toContain(
      'Select the exact approved intervention before sending its approval letter.'
    );
    expect(sendBlock).toContain('interventionId: sendIntent.interventionId,');
    expect(sendBlock).not.toContain('Number.parseInt(requestedInterventionId');
    expect(sendBlock).toContain('...(sendIntent.applicationId ? { applicationId: sendIntent.applicationId } : {})');
  });

  test('application approval recovers when the server requires an Action Plan absent from the frontend funding heuristic', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const sendBlock = extractBetween(
      source,
      'const handleSendDecisionLetter = async () => {',
      'const handleSave = async'
    );
    const confirmBlock = extractBetween(
      source,
      'const handleConfirmSendApprovalLetter = async () => {',
      'const handleWizardNavigate = async'
    );
    const modalBlock = extractBetween(
      source,
      'header="Send Client Approval letter?"',
      'header="Checklist incomplete"'
    );

    expect(source).toContain(
      'const fundingActionPlanRequired = approvalHasFundingPackage || serverDemandedFundingActionPlan;'
    );
    expect(sendBlock).toContain("'cfa_action_plan_selection_required'");
    expect(sendBlock).toContain('setServerDemandedFundingActionPlan(true);');
    expect(sendBlock).toContain('await loadFundingActionPlans();');
    expect(sendBlock).toContain("activeLetterKey === 'approval' && selectedFundingActionPlanId");
    expect(sendBlock).toContain('...(sendIntent.actionPlanId ? { actionPlanId: sendIntent.actionPlanId } : {})');
    expect(sendBlock).toContain('setServerDemandedFundingActionPlan(false);');
    expect(confirmBlock).toContain('fundingActionPlanRequired &&');
    expect(confirmBlock).toContain('fundingActionPlans.length > 1');
    expect(confirmBlock).toContain('!selectedFundingActionPlanId');
    expect(modalBlock).toContain('{fundingActionPlanRequired ? (');
    expect(modalBlock).toContain('setSelectedFundingActionPlanId(');
    expect(modalBlock).not.toContain('{approvalHasFundingPackage ? (');
  });

  test('application decision-letter retries freeze one operation and exact POST payload', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
    const sendBlock = extractBetween(
      source,
      'const handleSendDecisionLetter = async () => {',
      'const handleSave = async'
    );

    expect(source).toContain('const decisionLetterSendAttemptRef = useRef(null);');
    expect(sendBlock).toContain('const draftIntentFingerprint = JSON.stringify({');
    expect(sendBlock).toContain('const sendIntentFingerprint = draftIntentFingerprint;');
    expect(sendBlock).toContain('decisionLetterSendAttemptRef.current?.fingerprint === draftIntentFingerprint');
    expect(sendBlock).toContain('clientOperationId: buildUuid(),');
    expect(sendBlock).toContain('payload: { ...payload },');
    expect(sendBlock).toContain('decisionLetterSendAttemptRef.current = null;');
    expect(sendBlock.indexOf('persistLetterDraft(')).toBeLessThan(sendBlock.indexOf('clientOperationId: buildUuid()'));
    expect(sendBlock.indexOf('clientOperationId: buildUuid()')).toBeLessThan(sendBlock.indexOf('const response = await apiFetch'));
  });

  test('intervention decision-letter retries are synchronously single-flight and reuse one operation', () => {
    const source = readSource(
      'src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx'
    );
    const sendBlock = extractBetween(
      source,
      'const handleSendDecisionLetter = useCallback',
      'const buildSentLetterCompletionNote = useCallback'
    );

    expect(source).toContain('const decisionLetterSendInFlightRef = useRef(false);');
    expect(source).toContain('const decisionLetterSendAttemptRef = useRef(null);');
    expect(source).toContain('export const beginRetainedSecureMessageSendAttempt = ({');
    expect(sendBlock).toContain('const sendAttempt = beginRetainedSecureMessageSendAttempt({');
    expect(sendBlock).toContain('inFlightRef: decisionLetterSendInFlightRef,');
    expect(sendBlock).toContain('attemptRef: decisionLetterSendAttemptRef,');
    expect(sendBlock).toContain('fingerprint: sendIntentFingerprint,');
    expect(sendBlock).toContain('clientOperationId: buildUuid(),');
    expect(sendBlock).toContain('sendAttempt.finish({ committed: true });');
    expect(sendBlock).toContain('sendAttempt.finish();');
  });
});
