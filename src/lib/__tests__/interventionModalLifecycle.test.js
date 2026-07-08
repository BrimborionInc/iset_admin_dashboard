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
