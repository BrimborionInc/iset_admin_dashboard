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
    expect(widgetSource).toContain("const exportableQueueCount = (Number(summary.ready) || 0) + (Number(summary.needsReview) || 0);");
    expect(widgetSource).toContain("disabled={loading || exportableQueueCount === 0}");
    expect(widgetSource).toContain("Exportable participants");
    expect(widgetSource).not.toContain("sortingDisabled");
  });

  test("batch XML generation is not capped by participant table pagination", () => {
    const serverSource = fs.readFileSync(path.join(repoRoot, "isetadminserver.js"), "utf8");
    const collector = extractBetween(
      serverSource,
      "async function collectReadyEsdcBatchParticipants",
      "esdcRouter.post('/participants/batch-prepare'"
    );
    const prepareRoute = extractBetween(
      serverSource,
      "esdcRouter.post('/participants/batch-prepare'",
      "esdcRouter.post('/participants/batch-submit'"
    );
    const submitRoute = extractBetween(
      serverSource,
      "esdcRouter.post('/participants/batch-submit'",
      "esdcRouter.get('/participants/batches'"
    );
    const widgetSource = fs.readFileSync(
      path.join(repoRoot, "src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx"),
      "utf8"
    );

    expect(widgetSource).toContain("apiFetch('/api/esdc/participants/batch-prepare'");
    expect(widgetSource).toContain("body: JSON.stringify({})");
    expect(widgetSource).toContain("apiFetch('/api/esdc/participants/batch-submit'");
    expect(collector).not.toMatch(/\bLIMIT\b|\bOFFSET\b|pageLimit|pageSize|req\.query|req\.body/);
    expect(prepareRoute).toContain("collectReadyEsdcBatchParticipants()");
    expect(submitRoute).toContain("collectReadyEsdcBatchParticipants()");
  });

  test("recent ILMP exports route limits complete batch groups instead of history rows", () => {
    const serverSource = fs.readFileSync(path.join(repoRoot, "isetadminserver.js"), "utf8");
    const route = extractBetween(
      serverSource,
      "esdcRouter.get('/participants/batches'",
      "esdcRouter.post('/participants/batch-reset'"
    );

    expect(route).toContain("WITH recent_batches AS (");
    expect(route).toContain("GROUP BY batch_id");
    expect(route).toContain("ORDER BY submitted_at DESC, last_history_id DESC");
    expect(route).toContain("FROM recent_batches rb");
    expect(route).toContain("JOIN esdc_participant_submission_history h");
    expect(route).toContain("[limit]");
    expect(route).not.toContain("[limit * 5]");
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
