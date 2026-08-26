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

describe("case message CFA draft fallback", () => {
  test("funding agreement sends reuse only a verified immutable exact-plan draft and otherwise rebuild", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const route = extractBetween(
      serverSource,
      "const handlePostCaseSecureMessage = async (req, res) => {",
      "app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);"
    );

    const planResolutionIndex = route.indexOf("await resolveCfaActionPlanForApplication(");
    const freshSnapshotIndex = route.indexOf("const freshPlanSnapshot = await buildCfaSnapshot({");
    const draftAssessmentIndex = route.indexOf("await assessApplicationScopedCfaDraft(");
    const reusablePrepareIndex = route.indexOf("await prepareReusableApplicationScopedCfaDraft(");
    const planCreateIndex = route.indexOf("created = await createCfaVersionForPlan({");

    expect(route).toContain("let requestedInterventionLetterEligibility = null;");
    expect(route).toContain("await resolveApprovedInterventionProposalLetterEligibility({");
    expect(route).toContain("selectedApplicationId: caseApplicationId");
    expect(route).toContain("i.action_plan_id");
    expect(route).toContain("hasAppliedInterventionRevisionMetadata(sourceMetadata)");
    expect(route).toContain("changeReason: isInterventionRevisionCfaDraft ? 'INTERVENTION_CHANGED' : 'NEW_INTERVENTION_APPROVED'");
    expect(planResolutionIndex).toBeGreaterThanOrEqual(0);
    expect(freshSnapshotIndex).toBeGreaterThan(planResolutionIndex);
    expect(draftAssessmentIndex).toBeGreaterThan(freshSnapshotIndex);
    expect(reusablePrepareIndex).toBeGreaterThan(draftAssessmentIndex);
    expect(planCreateIndex).toBeGreaterThanOrEqual(0);
    expect(planCreateIndex).toBeGreaterThan(draftAssessmentIndex);
    expect(serverSource).toContain("cfaActionPlanId: fundingAgreementDraft.actionPlanId");
    expect(route).not.toContain("created = await createCfaVersionFromAssessment({");
    expect(route).toContain("cfaSnapshot = created.snapshot || null;");
    expect(serverSource).toContain("storedHash.toLowerCase() !== computedStoredHash");
    expect(serverSource).toContain("cfaDraftSnapshotMateriallyMatches(storedSnapshot, freshSnapshot)");
    expect(serverSource).toContain("storedBaselineId !== latestSignedVersionId");
    expect(serverSource).not.toContain("SET supersedes_version_id = ?");
    expect(route).toContain(
      "normalisePositiveInteger(messageInterventionEligibility?.actionPlanId) ||\n            normalisePositiveInteger(cfaActionPlanId) ||"
    );
  });

  test("manual backload edits still do not auto-create CFA side effects", () => {
    const serverSource = readRepoFile("isetadminserver.js");

    expect(serverSource).toContain("const isManualBackloadRecord = parsedInterventionMetadata?.source === 'manual_backload';");
    expect(serverSource).toContain("if (!isManualBackloadRecord && cfaTargets.length) {");
    expect(serverSource).toContain("if (wasIncludedInCfa && !isManualBackloadRecord && interventionRow.action_plan_id) {");
  });

  test("every application decision letter is revalidated against the locked final review decision", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const route = extractBetween(
      serverSource,
      "const handlePostCaseSecureMessage = async (req, res) => {",
      "app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);"
    );
    const transactionStart = route.indexOf("await messageWriteConnection.beginTransaction();");
    const lockedLetterCheck = route.indexOf("const lockedDecisionLetterAttachments", transactionStart);
    const lockedWorkflowFetch = route.indexOf("await fetchApplicationAssessmentReviewWorkflow(", lockedLetterCheck);
    const lockedAuthorization = route.indexOf("assertCaseMessageApplicationDecisionLetters({", lockedWorkflowFetch);
    const messageInsert = route.indexOf("INSERT INTO messages", transactionStart);

    expect(transactionStart).toBeGreaterThanOrEqual(0);
    expect(lockedLetterCheck).toBeGreaterThan(transactionStart);
    expect(lockedWorkflowFetch).toBeGreaterThan(lockedLetterCheck);
    expect(route.slice(lockedWorkflowFetch, lockedAuthorization)).toContain("{ forUpdate: true }");
    expect(lockedAuthorization).toBeGreaterThan(lockedWorkflowFetch);
    expect(messageInsert).toBeGreaterThan(lockedAuthorization);
  });
});
