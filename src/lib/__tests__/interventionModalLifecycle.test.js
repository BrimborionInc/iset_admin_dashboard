const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");

const readRepoFile = relativePath =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("intervention and action plan modal lifecycle persistence", () => {
  const serverSource = readRepoFile("isetadminserver.js");

  test("open intervention create/edit paths do not persist outcome codes", () => {
    const createRoute = extractBetween(
      serverSource,
      "app.post('/api/action-plans/:id/interventions'",
      "app.get('/api/interventions/:id/payment-lines'"
    );
    const updateRoute = extractBetween(
      serverSource,
      "app.patch('/api/interventions/:id'",
      "app.post('/api/interventions/:id/close'"
    );

    expect(createRoute).toContain("error: 'outcome_requires_closed_status'");
    expect(createRoute).toContain("const trimmedOutcomeCreate = isClosedStatusCreate ? requestedOutcomeCreate : '';");
    expect(updateRoute).toContain("error: 'outcome_requires_closed_status'");
    expect(updateRoute).toContain("const shouldPersistOutcomeUpdate = outcomeProvided || (!isClosedStatusUpdate && existingOutcome);");
    expect(updateRoute).toContain("const trimmedOutcomeUpdate = isClosedStatusUpdate ? requestedOutcomeUpdate : '';");
    expect(updateRoute).toContain("esdcPayload.interventionOutcome = trimmedOutcomeUpdate || null;");
  });

  test("manual backloaded interventions use start date as inferred approval date", () => {
    const createRoute = extractBetween(
      serverSource,
      "app.post('/api/action-plans/:id/interventions'",
      "app.get('/api/interventions/:id/payment-lines'"
    );

    expect(createRoute).toContain("const manualBackloadReviewedAtValue =");
    expect(createRoute).toContain("isBackloadMode && startDateValue ? `${startDateValue} 00:00:00` : null");
    expect(createRoute).toContain("const reviewedAtInsertExpression = shouldStampReviewDecision");
    expect(createRoute).toContain("manualBackloadReviewedAtValue");
    expect(createRoute).toContain("...reviewedAtInsertParams");
  });

  test("ordinary creates cannot synthesize an in-review, returned, or denied decision state", () => {
    const createRoute = extractBetween(
      serverSource,
      "app.post('/api/action-plans/:id/interventions'",
      "app.get('/api/interventions/:id/payment-lines'"
    );

    expect(createRoute).toContain("new Set(['draft', 'submitted', 'approved'])");
    expect(createRoute).toContain("error: 'intervention_review_context_required'");
    expect(createRoute).toContain("error: 'approved_intervention_review_context_required'");
  });

  test("close endpoint blocks open interventions on closed or archived plans", () => {
    const closeRoute = extractBetween(
      serverSource,
      "app.post('/api/interventions/:id/close'",
      "app.post('/api/interventions/:id/delete'"
    );

    const idempotentClosedIndex = closeRoute.indexOf("isInterventionClosedStatus(currentInterventionState)");
    const parentGuardIndex = closeRoute.indexOf("Cannot close interventions on a closed or archived plan.");
    expect(idempotentClosedIndex).toBeGreaterThanOrEqual(0);
    expect(parentGuardIndex).toBeGreaterThan(idempotentClosedIndex);
  });

  test("frontend intervention mapping keeps budget pot and funding stream separate", () => {
    const contextSource = readRepoFile("src/pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx");

    expect(contextSource).toContain("payload.budgetPotId");
    expect(contextSource).toContain("payload.budget_pot_id");
    expect(contextSource).not.toContain("potId: payload.potId || payload.fundingStream || null");
  });

  test("viewing an exact final-workflow intervention locks proposal facts without blocking legacy operational edits", () => {
    const widgetSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx");
    const openView = extractBetween(
      widgetSource,
      "const openWizardView = useCallback(",
      "const openCloseModal = useCallback("
    );

    expect(openView).toContain(
      "setForceReadOnly(!canModify || isInterventionFinalDecisionRecorded(target));"
    );
    expect(openView).not.toContain("setForceReadOnly(true);");
  });

  test("ordinary delete controls are limited to an owner-editable draft", () => {
    const widgetSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx");
    const statusSource = readRepoFile("src/utils/interventionStatus.js");

    expect(statusSource).toContain('INTERVENTION_DELETABLE_STATUSES = new Set(["draft"])');
    expect(widgetSource).toContain("const canEditDraft = canEditInterventionAssessmentBody({");
    expect(widgetSource).toContain('return [{ id: "view", text: "View intervention" }];');
  });

  test("a successful wizard autosave advances the dirty baseline for the next step", () => {
    const widgetSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx");
    expect(widgetSource).toContain(
      "const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);"
    );
    expect(widgetSource).not.toContain("const isDirty = useMemo(");
  });

  test("approved revision evidence is removed from the operational client list immediately", () => {
    const widgetSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx");
    const revisionCompletionStart = widgetSource.indexOf('header: "Revision workflow complete"');
    expect(revisionCompletionStart).toBeGreaterThanOrEqual(0);
    const nextBranch = widgetSource.indexOf('} else {', revisionCompletionStart);
    const revisionCompletion = widgetSource.slice(revisionCompletionStart, nextBranch);

    expect(revisionCompletion).toContain("await refresh().catch(() => {});");
    expect(revisionCompletion).toContain("partitioned out of operational intervention rows");
  });

  test("editing an intervention resolves Paid from independently from its parent plan", () => {
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx");

    expect(modalSource).toContain("resolveInterventionPostingContextForForm({");
    expect(modalSource).toContain("mode,");
    expect(modalSource).toContain("intervention,");
    expect(modalSource).toContain("plan,");
    expect(modalSource).not.toContain(
      "draft.postingContext = plan?.postingContext || plan?.posting_context || draft.postingContext"
    );
  });

  test("intervention modal publishes one stable workflow boundary", () => {
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx");

    expect(modalSource).toContain('data-path-intervention-surface="modal"');
    expect(modalSource).toContain("data-path-intervention-state={modalLifecycleState}");
    expect(modalSource).toContain('data-path-posting-context={form.postingContext || "external"}');
    expect(modalSource).toContain('data-path-intervention-field="program-name"');
    expect(modalSource).toContain('data-path-intervention-field="posting-context"');
    expect(modalSource).toContain('data-path-intervention-action="cancel"');
    expect(modalSource).toContain('data-path-intervention-action="edit"');
    expect(modalSource).toContain('data-path-intervention-action="save"');
    expect(modalSource).toContain('? "read-only"');
    expect(modalSource).toContain('? "editing"');
    expect(modalSource).toContain(': "viewing";');
  });

  test("posting-context browser contract uses modal-owned persistent state", () => {
    const smokeSource = readRepoFile("scripts/intervention-posting-context-browser-smoke.js");

    expect(smokeSource).toContain(
      "const INTERVENTION_MODAL_SELECTOR = '[data-path-intervention-surface=\"modal\"]';"
    );
    expect(smokeSource).toContain("if (boundaries.length !== 1)");
    expect(smokeSource).toContain("actionWrappers.length !== 1");
    expect(smokeSource).toContain("dialog.getClientRects().length > 0");
    expect(smokeSource).toContain("style.display === 'none' && dialog.getClientRects().length === 0");
    expect(smokeSource).toContain("evidence.postingContext !== 'internal'");
    expect(smokeSource).toContain("!evidence.dialogVisible");
    expect(smokeSource).toContain("evidence.lifecycleState !== 'read-only'");
    expect(smokeSource).toContain("await waitForInterventionModalState(page, 'editing');");
    expect(smokeSource).toContain("await openIntervention(page, 'read-only');");
    expect(smokeSource).toContain("state.savedPayloads[0].postingContext !== 'internal'");
    expect(smokeSource).toContain("state.savedPayloads.length !== 1");
    expect(smokeSource).toContain("state.finalRecordReadOnlyVerified = true;");
    expect(smokeSource).toContain("finalRecordReadOnlyVerified: state.finalRecordReadOnlyVerified");
    expect(smokeSource).not.toContain("finalRecordReadOnlyVerified: state.savedPayloads.length === 1");
    expect(smokeSource).not.toContain("document.body");
    expect(smokeSource).not.toContain("clickByText");
    expect(smokeSource).not.toContain("innerText");
    expect(smokeSource).not.toContain("textContent");
    expect(smokeSource).not.toContain('input[value="Legal Paraprofessional Diploma"]');
  });

  test("close intervention modal requires explicit outcome selection", () => {
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx");

    expect(modalSource).not.toContain("DEFAULT_CLOSED_OUTCOME");
    expect(modalSource).toContain('placeholder="Select outcome"');
    expect(modalSource).toContain('const resolvedOutcome = intervention?.outcome ? String(intervention.outcome).trim() : "";');
  });

  test("action plan details modal has no invisible agreement-number validator", () => {
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/ActionPlanDetailsModal.jsx");

    expect(modalSource).not.toContain("errors.agreementNumber");
    expect(modalSource).toContain("expanded={planExpanded}");
    expect(modalSource).toContain("expanded={fundingExpanded}");
    expect(modalSource).toContain("expanded={applicantExpanded}");
    expect(modalSource).toContain("expanded={closeoutExpanded}");
  });

  test("long date-derived intervention durations are capped for ILMP instead of blocking revision saves", () => {
    const assessmentSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx");
    const coordinatorAssessmentSource = readRepoFile("src/widgets/CoordinatorAssessmentWidget.js");
    const modalSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx");

    expect(serverSource).toContain("const MAX_INTERVENTION_DURATION_DAYS = 999;");
    expect(serverSource).toContain("const resolveInterventionDurationDaysForStorage = ({");
    expect(serverSource).toContain("return { value: MAX_INTERVENTION_DURATION_DAYS, capped: true };");
    expect(serverSource).not.toContain("durationDaysValueRaw !== undefined && durationDaysValueRaw !== null && durationDaysValueRaw > 999");
    expect(assessmentSource).toContain("clampInterventionDurationDaysForIlmp(");
    expect(assessmentSource).toContain("durationDays: interventionDuration !== null ? String(interventionDuration) : null");
    expect(coordinatorAssessmentSource).toContain("clampInterventionDurationDaysForIlmp(");
    expect(modalSource).toContain("const normaliseDurationFormNumber = value =>");
    expect(modalSource).toContain('next.durationDays = duration !== null ? clampInterventionDurationDaysForIlmp(duration) : "";');
  });

  test("residence costs can be selected when correcting intervention cost lines", () => {
    const assessmentSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx");
    const coordinatorAssessmentSource = readRepoFile("src/widgets/CoordinatorAssessmentWidget.js");
    const paymentRequestsSource = readRepoFile("src/pages/finance/widgets/PaymentRequestsWidget.jsx");
    const financeMappingSource = readRepoFile("src/pages/finance/widgets/FinancePaymentTypeMappingWidget.jsx");
    const existingInterventionSource = readRepoFile("src/pages/Caseworking/caseWorkspace/modals/ExistingInterventionModal.jsx");

    expect(serverSource).toContain("ResidenceCost: 'Residence costs'");
    expect(serverSource).toContain("residencefee: 'ResidenceCost'");
    expect(serverSource).toContain("ResidenceCost: 'intervention_start'");
    expect(assessmentSource).toContain('ResidenceCost: "AccreditedEducationalTrainingInstitution"');
    expect(assessmentSource).toContain("submissionTiming === SUBMISSION_TIMING_RECURRENCE_SCHEDULE && Boolean(prev.draft.recurrence?.enabled)");
    expect(assessmentSource).toContain('{isCostLineEditable ? (');
    expect(coordinatorAssessmentSource).toContain("ResidenceCost: 'AccreditedEducationalTrainingInstitution'");
    expect(coordinatorAssessmentSource).toContain("submissionTiming === SUBMISSION_TIMING_RECURRENCE_SCHEDULE && Boolean(prev.draft.recurrence?.enabled)");
    expect(coordinatorAssessmentSource).toContain("{isCostLineEditable ? (");
    expect(paymentRequestsSource).toContain('ResidenceCost: "Residence costs"');
    expect(financeMappingSource).toContain("ResidenceCost: RECURRENCE_MODE_OPTIONAL");
    expect(existingInterventionSource).toContain('{ value: "ResidenceCost", label: "Residence costs" }');
  });
});
