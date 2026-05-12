const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../../../..");

const readRepoFile = relativePath =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("payments workflow safety rails", () => {
  const serverSource = readRepoFile("isetadminserver.js");
  const followUpMigration = readRepoFile("sql/migrations/20260511_0001_add_payment_followup_model.sql");
  const dataContextSource = readRepoFile("src/pages/finance/widgets/PaymentsDataContext.jsx");
  const detailWidgetSource = readRepoFile("src/pages/finance/widgets/PaymentDetailWidget.jsx");
  const communicationWidgetSource = readRepoFile("src/pages/finance/widgets/PaymentCommunicationWidget.jsx");
  const programPaymentsPageSource = readRepoFile("src/pages/Caseworking/ProgramPaymentsPage.jsx");
  const caseWorkspacePageSource = readRepoFile("src/pages/Caseworking/CaseWorkspacePage.jsx");
  const financeReportsPageSource = readRepoFile("src/pages/finance/FinanceReportsPage.jsx");
  const financeReportExportSource = readRepoFile("src/pages/finance/financeInterventionReportExport.js");
  const financePanelSource = readRepoFile("src/pages/Caseworking/caseWorkspace/widgets/FinancePanelWidget.jsx");
  const budgetHierarchySource = readRepoFile("src/pages/finance/widgets/BudgetHierarchyWidget.jsx");

  test("legacy simple paid workflow is disabled", () => {
    expect(serverSource).toContain("const SIMPLE_PAYMENT_WORKFLOW = false;");
  });

  test("direct payment email endpoint is retired", () => {
    const route = extractBetween(
      serverSource,
      "app.post('/api/finance/payment-packets/:id/send-email'",
      "app.get('/api/finance/payment-communications'"
    );

    expect(route).toContain("res.status(410)");
    expect(route).toContain("payment_email_endpoint_retired");
    expect(route).not.toContain("submitPaymentPacketExternally");
  });

  test("packet creation cannot seed submitted packets or paid lines", () => {
    const route = extractBetween(
      serverSource,
      "app.post('/api/finance/payment-packets'",
      "app.put('/api/finance/payment-packets/:id'"
    );

    expect(route).toContain("payment_packet_create_requires_draft");
    expect(route).toContain("create_requires_draft_line");
  });

  test("frontend submit helpers use the canonical status transition", () => {
    const sendPacketEmail = extractBetween(
      dataContextSource,
      "const sendPacketEmail = useCallback",
      "const selectedRequest = useMemo"
    );

    expect(sendPacketEmail).toContain('updatePacketStatus(packetId, "submitted"');
    expect(sendPacketEmail).not.toContain("/send-email");
  });

  test("old operational Mark paid action is hidden until follow-up replaces it", () => {
    expect(detailWidgetSource).toContain("const canMarkLinePaid = false;");
  });

  test("payment follow-up is first-class schema and API, not line paid fallback", () => {
    expect(followUpMigration).toContain("CREATE TABLE payment_followup_event");
    expect(followUpMigration).toContain("follow_up_status");
    expect(serverSource).toContain("PAYMENT_FOLLOW_UP_STATUSES");
    expect(serverSource).toContain("app.post('/api/finance/payment-packets/:id/follow-up'");
    expect(dataContextSource).toContain("const logPaymentFollowUp = useCallback");
    expect(detailWidgetSource).toContain("Log follow-up");
  });

  test("cross-client payments dashboard is an operational surface, not the old scaffold", () => {
    expect(programPaymentsPageSource).toContain("PaymentRequestsWidget");
    expect(programPaymentsPageSource).toContain("PaymentDetailWidget");
    expect(programPaymentsPageSource).toContain("PaymentCommunicationWidget");
    expect(programPaymentsPageSource).toContain('mode: "program"');
    expect(programPaymentsPageSource).toContain("<PaymentsDataProvider autoSelectFirst={false}>");
    expect(programPaymentsPageSource).not.toContain("Program payments now live in the case workspace");
  });

  test("payment communications are selected-packet scoped and do not create placeholder logs", () => {
    expect(caseWorkspacePageSource).toContain('"payments-comms"');
    expect(dataContextSource).toContain("/api/finance/payment-communications?packetId=");
    expect(communicationWidgetSource).toContain("Log payment email");
    expect(communicationWidgetSource).not.toContain("finance@nwac.org");
    expect(communicationWidgetSource).not.toContain("subject: \"Follow-up note\"");
  });

  test("line-level payment evidence attach is supported by API and UI", () => {
    const attachRoute = extractBetween(
      serverSource,
      "app.post('/api/finance/payment-packets/:id/documents'",
      "app.put('/api/finance/payment-documents/:id'"
    );

    expect(attachRoute).not.toContain("line_level_documents_not_supported");
    expect(attachRoute).toContain("payment_line_packet_mismatch");
    expect(attachRoute).toContain("lineRow?.id || null");
    expect(detailWidgetSource).toContain("lineId: activeEvidenceRow.lineId || null");
  });

  test("budget and reporting labels use PATH operational payment semantics", () => {
    expect(serverSource).toContain("operationalFollowUpStatus");
    expect(serverSource).toContain("follow_up_status,");
    expect(serverSource).toContain("Recorded paid in full");
    expect(serverSource).toContain("Confirmed by evidence");
    expect(financeReportsPageSource).toContain("PATH follow-up state");
    expect(financeReportsPageSource).toContain("Recorded paid");
    expect(financeReportExportSource).toContain("Recorded paid amount");
    expect(financePanelSource).toContain("Recorded actual");
    expect(budgetHierarchySource).toContain("Recorded actual");
  });
});
