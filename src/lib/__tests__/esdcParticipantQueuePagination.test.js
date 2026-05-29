const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("ESDC participant queue pagination", () => {
  test("groups client queue rows before paginating grouped results", () => {
    const serverSource = fs.readFileSync(path.join(repoRoot, "isetadminserver.js"), "utf8");
    const route = extractBetween(
      serverSource,
      "esdcRouter.get('/participants'",
      "esdcRouter.post('/participants/validate-all'"
    );

    expect(route).toContain("const rowLimitClause = groupByClient ? '' : 'LIMIT ? OFFSET ?';");
    expect(route).toContain("const rowParams = groupByClient ? params : [...params, pageLimit, pageOffset];");
    expect(route).toContain("const requestedSortField = (normaliseString(sortField) || '').trim();");
    expect(route).toContain("const groupedItems = Array.from(groups.values()).map(group =>");
    expect(route).toContain("const sortedGroupedItems = [...groupedItems].sort(compareGroupedItems);");
    expect(route).toContain("const pagedItems = sortedGroupedItems.slice(pageOffset, pageOffset + pageLimit);");
    expect(route).toContain("const summary = sortedGroupedItems.reduce(");
    expect(route).toContain("res.json({ total: sortedGroupedItems.length, items: pagedItems, grouped: true, summary });");
  });

  test("participant queue widget combines validation summary and sorts server-side before pagination", () => {
    const widgetSource = fs.readFileSync(
      path.join(repoRoot, "src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx"),
      "utf8"
    );

    expect(widgetSource).toContain("Validate all");
    expect(widgetSource).toContain("Generate batch XML");
    expect(widgetSource).toContain("/api/esdc/participants/batch-prepare");
    expect(widgetSource).toContain("/api/esdc/participants/batch-submit");
    expect(widgetSource).toContain("Download XML and mark exported");
    expect(widgetSource).toContain("summary.ready");
    expect(widgetSource).toContain("summary.needsReview");
    expect(widgetSource).toContain("summary.blocked");
    expect(widgetSource).toContain("params.set('sortField', sorting.sortingColumn.sortingField);");
    expect(widgetSource).toContain("params.set('sortDirection', sorting.isDescending ? 'desc' : 'asc');");
    expect(widgetSource).toContain("onSortingChange={({ detail }) =>");
    expect(widgetSource).toContain("item.children.length > 1");
    expect(widgetSource).not.toContain("sortingDisabled");
  });

  test("participant submissions dashboard no longer duplicates the validation summary widget", () => {
    const pageSource = fs.readFileSync(
      path.join(repoRoot, "src/pages/esdc/EsdcParticipantSubmissionsPage.jsx"),
      "utf8"
    );

    expect(pageSource).toContain("esdc-participants-layout-v6");
    expect(pageSource).toContain("defaultColumnSpan: 4");
    expect(pageSource).not.toContain("EsdcParticipantValidationWidget");
    expect(pageSource).not.toContain("id: 'validation'");
    expect(pageSource).not.toContain("EsdcBatchSubmissionWidget");
    expect(pageSource).not.toContain("id: 'batch'");
    expect(pageSource).toContain("{ id: 'queue', rowSpan: 7, columnSpan: 4 }");
  });
});
