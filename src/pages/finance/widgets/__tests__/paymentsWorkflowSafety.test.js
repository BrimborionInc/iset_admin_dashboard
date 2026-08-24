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
  const submissionAttemptMigration = readRepoFile("sql/migrations/20260712_0001_add_payment_submission_attempt.sql");
  const submissionAttemptService = readRepoFile("src/lib/paymentSubmissionAttempt.js");
  const followUpEvidenceService = readRepoFile("src/lib/paymentFollowUpEvidence.js");
  const paymentEvidenceBaselineOpsSql = readRepoFile("sql/ops/update-payment-evidence-baseline-20260523.sql");
  const dataContextSource = readRepoFile("src/pages/finance/widgets/PaymentsDataContext.jsx");
  const detailWidgetSource = readRepoFile("src/pages/finance/widgets/PaymentDetailWidget.jsx");
  const communicationWidgetSource = readRepoFile("src/pages/finance/widgets/PaymentCommunicationWidget.jsx");
  const financeSettingsPageSource = readRepoFile("src/pages/finance/FinanceSettingsPage.jsx");
  const financePacketEmailPreviewWidgetSource = readRepoFile("src/pages/finance/widgets/FinancePacketEmailPreviewWidget.jsx");
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

  test("payment follow-up evidence requires document access and packet containment", () => {
    const route = extractBetween(
      serverSource,
      "async function handleRecordPaymentFollowUp",
      "app.post('/api/finance/payment-packets/:id/follow-up'"
    );

    const documentAccess = route.indexOf("validateDocument: () => validateDocumentAccess(req, docRow");
    const packetContainment = route.indexOf("validatePacketDocument: () => validatePaymentPacketDocumentAccess(req");
    const firstFollowUpWrite = route.indexOf("UPDATE payment_packet_line");
    expect(documentAccess).toBeGreaterThan(0);
    expect(packetContainment).toBeGreaterThan(documentAccess);
    expect(packetContainment).toBeLessThan(firstFollowUpWrite);
    expect(route).toContain("await validatePaymentFollowUpEvidence");
    expect(followUpEvidenceService.indexOf("await validateDocument()")).toBeLessThan(
      followUpEvidenceService.indexOf("await validatePacketDocument()")
    );
  });

  test("external payment handoff is claimed durably before provider dispatch", () => {
    const route = extractBetween(
      serverSource,
      "app.post('/api/finance/payment-packets/:id/status'",
      "app.post('/api/finance/payment-packets/:id/lines'"
    );
    expect(submissionAttemptMigration).toContain("uq_payment_submission_attempt_packet_key");
    expect(submissionAttemptService).toContain("payment_submission_outcome_ambiguous");
    expect(route).toContain("await conn.commit();");
    expect(route).toContain("dispatchPaymentSubmissionWithAttempt");
    expect(route.indexOf("await conn.commit();")).toBeLessThan(
      route.indexOf("dispatchPaymentSubmissionWithAttempt")
    );
    expect(route).toContain("completePaymentSubmissionAttempt");
  });

  test("Intacct success requires the documented result envelope and external object id", () => {
    const sender = extractBetween(
      serverSource,
      "const fetchIntacctVendors = async",
      "async function fetchPaymentCommunicationById"
    );
    expect(sender).toContain("extractIntacctRestCollection");
    expect(sender).toContain("extractIntacctRestObjectId");
    expect(sender).toContain("intacct_rest_invalid_success_response");
    expect(sender).not.toContain("submitPayload?.data?.id");
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

  test("finance packet emails use an expiring simple evidence bundle link", () => {
    const bundleDownloadRoute = extractBetween(
      serverSource,
      "app.get('/api/finance/payment-packets/:id/document-bundle'",
      "// Publish endpoint for workflows"
    );
    const evidenceBundleBuilder = extractBetween(
      serverSource,
      "const buildPaymentPacketEvidenceBundle = async",
      "const buildPaymentPacketBundleLink = async"
    );

    expect(serverSource).toContain("app.get('/api/finance/payment-packets/:id/document-bundle'");
    expect(serverSource).toContain("verifyPaymentPacketBundleToken");
    expect(serverSource).toContain("buildPaymentPacketEvidenceBundle");
    expect(serverSource).toContain("PAYMENT_PACKET_BUNDLE_EXPIRY_DAYS = 7");
    expect(serverSource).toContain("Download packet bundle");
    expect(bundleDownloadRoute).toContain("verifyPaymentPacketBundleToken");
    expect(evidenceBundleBuilder).not.toContain("packet-summary.pdf");
    expect(evidenceBundleBuilder).not.toContain("manifest.json");
  });

  test("finance settings email preview reuses the backend packet email builder", () => {
    const previewRoute = extractBetween(
      serverSource,
      "app.get('/api/config/runtime/finance-packet-email-preview'",
      "app.get('/api/config/runtime/intacct-integration'"
    );
    const previewBuilder = extractBetween(
      serverSource,
      "const buildPaymentPacketEmailPreviewPayload = () =>",
      "const recordPaymentPacketSubmissionMeta = async"
    );

    expect(previewRoute).toContain("requireFinancialManagementAdminAccess");
    expect(previewRoute).toContain("buildPaymentPacketEmailPreviewPayload");
    expect(previewBuilder).toContain("buildPaymentPacketEmail");
    expect(previewBuilder).toContain("bundleLinkIsPlaceholder");
    expect(financeSettingsPageSource).toContain("FinancePacketEmailPreviewWidget");
    expect(financeSettingsPageSource).toContain("packetEmailPreview");
    expect(financePacketEmailPreviewWidgetSource).toContain("/api/config/runtime/finance-packet-email-preview");
    expect(financePacketEmailPreviewWidgetSource).not.toContain("Payment Instructions</strong>");
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

  test("payment evidence baseline is funding agreement plus signed EFT form only", () => {
    expect(serverSource).toContain("required: ['FundingAgreement', 'SignedEftBankingForm']");
    expect(serverSource).toContain("eft_form: ['SignedEftBankingForm']");
    expect(serverSource).toContain("FundingAgreement: 'Client Funding Agreement'");
    expect(serverSource).toContain("SignedEftBankingForm: 'Signed EFT banking form'");
    expect(detailWidgetSource).toContain('SignedEftBankingForm: ["EFT_form"]');
    expect(paymentEvidenceBaselineOpsSql).toContain(
      "JSON_ARRAY('FundingAgreement', 'SignedEftBankingForm')"
    );
    expect(paymentEvidenceBaselineOpsSql).toContain("JSON_EXTRACT(v, '$.paymentTypes')");
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
