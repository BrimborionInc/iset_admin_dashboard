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
  test("intervention letter sends can create a missing CFA draft from the action plan", () => {
    const serverSource = readRepoFile("isetadminserver.js");
    const route = extractBetween(
      serverSource,
      "const handlePostCaseSecureMessage = async (req, res) => {",
      "app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);"
    );

    const planCreateIndex = route.indexOf("created = await createCfaVersionForPlan({");
    const assessmentCreateIndex = route.indexOf("created = await createCfaVersionFromAssessment({");

    expect(route).toContain("let requestedInterventionLetterEligibility = null;");
    expect(route).toContain("await resolveApprovedInterventionProposalLetterEligibility({");
    expect(route).toContain("selectedApplicationId: caseApplicationId");
    expect(route).toContain("i.action_plan_id");
    expect(route).toContain("hasAppliedInterventionRevisionMetadata(sourceMetadata)");
    expect(route).toContain("changeReason: isInterventionRevisionCfaDraft ? 'INTERVENTION_CHANGED' : 'NEW_INTERVENTION_APPROVED'");
    expect(planCreateIndex).toBeGreaterThanOrEqual(0);
    expect(assessmentCreateIndex).toBeGreaterThan(planCreateIndex);
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
