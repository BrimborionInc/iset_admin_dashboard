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

describe("casework closeout persistence", () => {
  const serverSource = readRepoFile("isetadminserver.js");

  test("closed action plan edits persist all closeout fields", () => {
    const route = extractBetween(
      serverSource,
      "app.patch('/api/action-plans/:id'",
      "app.get('/api/cases/:id'"
    );

    expect(route).toContain("const closedPlanEdit = status === 'closed';");
    expect(route).toContain("actionPlanResultCode: resultCodeValue");
    expect(route).toContain("actionPlanResultDate: resultDateValue");
    expect(route).toContain("actionPlanResultEducationLevel: resultEducationValue");
    expect(route).toContain("actionPlanFutureEducationLevel: futureEducationValue");
    expect(route).toContain("actionPlanResultRelatedNOC: resultNocValue");
    expect(route).toContain("actionPlanResultRelatedNOCVersion: resultNocVersionValue");
    expect(route).toContain("setParts.push('result_code = ?')");
    expect(route).toContain("setParts.push('result_date = ?')");
    expect(route).toContain("setParts.push('outcome_summary = ?')");
    expect(route).toContain("setParts.push('closure_notes = ?')");
    expect(route).toContain("result_date_before_intervention");
  });

  test("reactivating action plans clears stale ESDC closeout keys", () => {
    const route = extractBetween(
      serverSource,
      "app.post('/api/action-plans/:id/activate'",
      "app.post('/api/action-plans/:id/close'"
    );

    expect(route).toContain("actionPlanResultCode: null");
    expect(route).toContain("actionPlanResultDate: null");
    expect(route).toContain("actionPlanResultEducationLevel: null");
    expect(route).toContain("actionPlanFutureEducationLevel: null");
    expect(route).toContain("actionPlanResultRelatedNOC: null");
    expect(route).toContain("actionPlanResultRelatedNOCVersion: null");
    expect(route).toContain("esdc_action_plan_json = ?");
  });

  test("intervention close notes update metadata before response mapping can read it", () => {
    const route = extractBetween(
      serverSource,
      "app.post('/api/interventions/:id/close'",
      "app.post('/api/interventions/:id/delete'"
    );

    const metadataNoteIndex = route.indexOf("metadata.notes = trimmedNotes");
    const metadataSerializeIndex = route.indexOf("params.push(JSON.stringify(metadata))");
    expect(metadataNoteIndex).toBeGreaterThanOrEqual(0);
    expect(metadataSerializeIndex).toBeGreaterThan(metadataNoteIndex);
  });
});
