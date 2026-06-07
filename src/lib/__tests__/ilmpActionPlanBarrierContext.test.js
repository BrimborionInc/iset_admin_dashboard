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

describe("ILMP action plan barrier context", () => {
  test("participant validation context carries saved action-plan barrier codes", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const contextLoader = extractBetween(
      serverSource,
      "async function loadEsdcParticipantSubmissionContext",
      "async function validateEsdcParticipantSubmission"
    );

    expect(contextLoader).toContain("const esdc = safeJsonParse(planRow.esdc_action_plan_json");
    expect(contextLoader).toContain("barriers: Array.isArray(esdc.BarrierToEmployment)");
    expect(contextLoader).toContain("? esdc.BarrierToEmployment");
    expect(contextLoader).toContain(": Array.isArray(esdc.barrierToEmployment)");
    expect(contextLoader).toContain(": Array.isArray(metadata.BarrierToEmployment)");
  });

  test("ILMP validation falls back to action-plan barrier codes when participant barriers are blank", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const validation = extractBetween(
      serverSource,
      "function runIlmpValidation",
      "function buildIlmpParticipantPayload"
    );

    expect(validation).toContain("const actionPlanBarrierCodes = Array.from(new Set(");
    expect(validation).toContain("flatMap(plan => mapIlmpBarrierCodes(extractActionPlanBarrierValues(plan))");
    expect(validation).toContain("const reportingBarrierCodes = barrierCodes.length ? Array.from(new Set(barrierCodes)) : actionPlanBarrierCodes;");
  });

  test("ILMP validation and XML use saved action-plan social assistance values", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const contextLoader = extractBetween(
      serverSource,
      "async function loadEsdcParticipantSubmissionContext",
      "async function validateEsdcParticipantSubmission"
    );
    const validation = extractBetween(
      serverSource,
      "function runIlmpValidation",
      "function buildIlmpParticipantPayload"
    );
    const payloadBuilder = extractBetween(
      serverSource,
      "function buildIlmpParticipantPayload",
      "async function loadEsdcParticipantSubmissionContext"
    );

    expect(serverSource).toContain("function firstNonBlankValue(...values)");
    expect(contextLoader).toContain("socialAssistanceRecipient:");
    expect(contextLoader).toContain("firstNonBlankValue(");
    expect(contextLoader).toContain("esdc.socialAssistanceRecipient");
    expect(contextLoader).toContain("esdc.SocialAssistanceRecipient");
    expect(validation).toContain("primaryDerivedPlan?.socialAssistanceRecipient");
    expect(validation).toContain("participantSocialAssistanceStatus");
    expect(validation).toContain("isMissingIlmpValue(socialAssistanceStatus)");
    expect(payloadBuilder).toContain("primaryPlan?.socialAssistanceRecipient");
    expect(payloadBuilder).toContain("const resolvedSocialAssistanceCode");
    expect(payloadBuilder).toContain("add(indent + 1, 'socialAssistanceRecipient', resolvedSocialAssistanceCode);");
  });

  test("EI claimant validation treats blank null-like values as missing with staff-friendly wording", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const validation = extractBetween(
      serverSource,
      "function runIlmpValidation",
      "function buildIlmpParticipantPayload"
    );

    expect(validation).toContain("const isMissingIlmpValue = value =>");
    expect(validation).toContain("String(value).trim().toLowerCase() === 'null'");
    expect(validation).toContain("if (isMissingIlmpValue(eiClaimantStatus))");
    expect(validation).toContain("EI claimant status is required for ILMP action plan reporting. Select Claimant, Reach-back, or Non-insured.");
    expect(validation).toContain("EI claimant status is not valid. Select Claimant, Reach-back, or Non-insured.");
  });

  test("valid zero-valued action-plan fields are not dropped by mappers", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const actionPlanMapper = extractBetween(
      serverSource,
      "function mapActionPlanRow",
      "const CANONICAL_INTERVENTION_STATUSES"
    );
    const actionPlanEditRoute = extractBetween(
      serverSource,
      "app.patch('/api/action-plans/:id'",
      "app.get('/api/cases/:id'"
    );
    const workspaceContext = readRepoFile("src/pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx");

    expect(actionPlanMapper).toContain("firstNonBlankValue(plan.social_assistance_recipient, esdc.socialAssistanceRecipient");
    expect(actionPlanMapper).toContain("firstNonBlankValue(");
    expect(actionPlanMapper).toContain("esdc.actionPlanChildCareNeed");
    expect(actionPlanEditRoute).toContain("firstNonBlankValue(esdcExisting.socialAssistanceRecipient");
    expect(actionPlanEditRoute).toContain("firstNonBlankValue(esdcExisting.actionPlanChildcareNeed");
    expect(workspaceContext).toContain("const firstNonBlankValue = (...values) =>");
    expect(workspaceContext).toContain("socialAssistanceRecipient: firstNonBlankValue(plan.socialAssistanceRecipient, plan.social_assistance_recipient)");
    expect(workspaceContext).toContain("childcareNeed: firstNonBlankValue(plan.childcareNeed, plan.childcare_need)");
  });

  test("batch XML regeneration skips blockers but includes warning-only clients", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const groupedPayloadBuilder = extractBetween(
      serverSource,
      "async function buildGroupedIlmpClientPayload",
      "async function collectReadyEsdcBatchParticipants"
    );
    const batchCollector = extractBetween(
      serverSource,
      "async function collectReadyEsdcBatchParticipants",
      "esdcRouter.post('/participants/batch-prepare'"
    );

    expect(groupedPayloadBuilder).toContain("const evaluation = runIlmpValidation(combinedContext);");
    expect(groupedPayloadBuilder).toContain("const snapshot = buildIlmpParticipantPayload(combinedContext);");
    expect(groupedPayloadBuilder).toContain("warnings.length > 0 && !ignoreWarnings");
    expect(batchCollector).toContain("buildGroupedIlmpClientPayload(clientRows, { ignoreWarnings: true })");
    expect(batchCollector).toContain("if (blockingIssues.length > 0 || readiness === 'blocked')");
    expect(batchCollector).toContain("readiness_status: warningList.length ? 'needs_review' : 'ready'");
  });

  test("historical action-plan and intervention saves seed blank participant details", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const createActionPlanRoute = extractBetween(
      serverSource,
      "app.post('/api/cases/:id/action-plans'",
      "app.get('/api/cases/:id/cfa-versions'"
    );
    const updateActionPlanRoute = extractBetween(
      serverSource,
      "app.patch('/api/action-plans/:id'",
      "app.get('/api/cases/:id'"
    );
    const createInterventionRoute = extractBetween(
      serverSource,
      "app.post('/api/action-plans/:id/interventions'",
      "app.post('/api/interventions/:id/revise'"
    );

    expect(serverSource).toContain("mergeBackloadActionPlanParticipantDetails");
    expect(serverSource).toContain("mergeBackloadInterventionParticipantDetails");
    expect(createActionPlanRoute).toContain("seedParticipantDetailsFromBackloadActionPlan");
    expect(updateActionPlanRoute).toContain("shouldSeedParticipantDetailsForActionPlan");
    expect(updateActionPlanRoute).toContain("seedParticipantDetailsFromBackloadActionPlan");
    expect(createInterventionRoute).toContain("seedParticipantDetailsFromBackloadIntervention");
  });

  test("Appendix A mandatory nodes are checked against generated XML before export readiness", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const validation = extractBetween(
      serverSource,
      "function runIlmpValidation",
      "function buildIlmpParticipantPayload"
    );

    [
      "agreementHolderName",
      "socialInsuranceNumber",
      "lastName",
      "firstName",
      "dateOfBirth",
      "gender",
      "aboriginalGroup",
      "maritalStatus",
      "numberOfDependantChildren",
      "languageSpoken",
      "disability",
      "streetAddress",
      "municipality",
      "province",
      "postalZIPCode",
      "agreementNumber",
      "educationLevel",
      "socialAssistanceRecipient",
      "EIClaimant",
      "barrierToEmployment",
      "actionPlanPreviousEmployment",
      "actionPlanStartDate",
      "interventionCode",
      "interventionStartDate",
    ].forEach(elementName => {
      expect(validation).toContain(elementName);
    });
  });
});
