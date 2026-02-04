import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  ColumnLayout,
  StatusIndicator,
  Link,
  Alert,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useIntacctSubmissionData } from "./IntacctSubmissionDataContext.jsx";
import FinanceReconciliationDetailHelp from "../../../helpPanelContents/financeReconciliationDetailHelp.js";

const reasonLabels = {
  validation: "Validation error",
  authentication: "Authentication error",
  connectivity: "Connectivity issue",
  submission: "Submission error",
  attachments: "Attachment error",
  unknown: "Unknown",
  success: "Success",
};

const outcomeBadge = outcome => {
  if (outcome === "success") return { type: "success", label: "Success" };
  if (outcome === "partial") return { type: "warning", label: "Partial" };
  if (outcome === "failed") return { type: "error", label: "Failed" };
  return { type: "info", label: "Unknown" };
};

const formatDateTime = value => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const formatCurrency = (value, currency = "CAD") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "—";
  try {
    return amount.toLocaleString("en-CA", { style: "currency", currency });
  } catch (err) {
    return amount.toLocaleString("en-CA", { minimumFractionDigits: 2 });
  }
};

const IntacctSubmissionDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { selectedSubmission, loading, error } = useIntacctSubmissionData();

  const latestAttempt = selectedSubmission?.latestAttempt || null;
  const attempts = useMemo(() => {
    if (!selectedSubmission?.attempts) return [];
    const ordered = [...selectedSubmission.attempts];
    ordered.sort((a, b) => {
      const left = a?.at ? new Date(a.at).getTime() : 0;
      const right = b?.at ? new Date(b.at).getTime() : 0;
      return right - left;
    });
    return ordered.map((attempt, index) => {
      const base =
        attempt.at ||
        attempt.updatedAt ||
        attempt.billId ||
        attempt.error ||
        "attempt";
      return {
        ...attempt,
        _rowId: `${base}-${index}`,
      };
    });
  }, [selectedSubmission]);

  const infoHelper = metadata.helpComponent
    ? metadata
    : {
        helpComponent: FinanceReconciliationDetailHelp,
        helpTitle: "Submission detail",
        aiContext: FinanceReconciliationDetailHelp.aiContext,
      };

  const infoLink =
    toggleHelpPanel && infoHelper.helpComponent
      ? (
          <Link
            variant="info"
            onFollow={event => {
              event.preventDefault();
              const helpContent = React.createElement(infoHelper.helpComponent);
              toggleHelpPanel(helpContent, infoHelper.helpTitle, infoHelper.aiContext);
            }}
          >
            Info
          </Link>
        )
      : undefined;

  const outcome = selectedSubmission?.outcome || latestAttempt?.status || "unknown";
  const badge = outcomeBadge(outcome);
  const reasonLabel = reasonLabels[selectedSubmission?.reason] || reasonLabels.unknown;
  const attachmentErrors = Array.isArray(latestAttempt?.attachmentErrors)
    ? latestAttempt.attachmentErrors
    : [];

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Latest Intacct submission status and error context for the selected packet."
        >
          Submission detail
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Submission detail settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={({ detail }) => {
              if (detail?.id === "remove") {
                actions.removeItem();
              }
            }}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        {error ? (
          <Alert type="error" header="Unable to load submission detail">
            {error}
          </Alert>
        ) : null}
        {!selectedSubmission ? (
          <Box variant="p">
            Select a packet from the Submission queue to review Intacct submission outcomes and
            failure details.
          </Box>
        ) : (
          <>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">Packet</Box>
                <SpaceBetween size="xxs">
                  <Box variant="strong">{selectedSubmission.packetLabel}</Box>
                  <Box variant="p">Case: {selectedSubmission.caseNumber || selectedSubmission.caseId || "—"}</Box>
                  <Box variant="p">Client: {selectedSubmission.clientName || "—"}</Box>
                  <Box variant="p">Intervention: {selectedSubmission.interventionName || "—"}</Box>
                  <Box variant="p">Packet status: {selectedSubmission.status || "—"}</Box>
                  <Box variant="p">Total: {formatCurrency(selectedSubmission.totalAmount, selectedSubmission.currency)}</Box>
                </SpaceBetween>
              </SpaceBetween>
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">Submission status</Box>
                <StatusIndicator type={badge.type}>{badge.label}</StatusIndicator>
                <Box variant="awsui-key-label">Reason</Box>
                <Box variant="p">{reasonLabel}</Box>
                <Box variant="awsui-key-label">Last attempt</Box>
                <Box variant="p">{formatDateTime(selectedSubmission.lastAttemptAt)}</Box>
              </SpaceBetween>
            </ColumnLayout>

            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">Intacct response</Box>
                <SpaceBetween size="xxs">
                  <Box variant="p">Bill ID: {latestAttempt?.billId || "—"}</Box>
                  <Box variant="p">HTTP status: {latestAttempt?.httpStatus || latestAttempt?.statusCode || "—"}</Box>
                  <Box variant="p">Base URL: {latestAttempt?.baseUrl || "—"}</Box>
                </SpaceBetween>
              </SpaceBetween>
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">Attachments</Box>
                <SpaceBetween size="xxs">
                  <Box variant="p">Total sent: {latestAttempt?.attachments ?? 0}</Box>
                  <Box variant="p">Attachment errors: {attachmentErrors.length}</Box>
                </SpaceBetween>
              </SpaceBetween>
            </ColumnLayout>

            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Latest message</Box>
              <Box variant="p">{latestAttempt?.message || latestAttempt?.error || "—"}</Box>
              {Array.isArray(latestAttempt?.details) && latestAttempt.details.length ? (
                <>
                  <Box variant="awsui-key-label">Validation details</Box>
                  <SpaceBetween size="xxs">
                    {latestAttempt.details.map((detail, index) => (
                      <Box key={`${detail.field || "detail"}-${index}`} variant="p">
                        {[detail.field, detail.message || detail.error || detail.code]
                          .filter(Boolean)
                          .join(": ")}
                      </Box>
                    ))}
                  </SpaceBetween>
                </>
              ) : null}
            </SpaceBetween>

            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Attempt history</Box>
              <Table
                items={attempts}
                trackBy="_rowId"
                columnDefinitions={[
                  {
                    id: "time",
                    header: "Attempted",
                    cell: attempt => formatDateTime(attempt.at || attempt.updatedAt),
                  },
                  {
                    id: "outcome",
                    header: "Outcome",
                    cell: attempt => {
                      const badgeValue = outcomeBadge(attempt.status);
                      return (
                        <StatusIndicator type={badgeValue.type}>{badgeValue.label}</StatusIndicator>
                      );
                    },
                  },
                  {
                    id: "reason",
                    header: "Reason",
                    cell: attempt => reasonLabels[attempt.reason] || reasonLabels.unknown,
                  },
                  {
                    id: "message",
                    header: "Message",
                    cell: attempt => attempt.message || attempt.error || "—",
                  },
                ]}
                variant="embedded"
                loading={loading}
                loadingText="Loading submission history"
                empty={<Box padding="m">No submission history recorded.</Box>}
              />
            </SpaceBetween>
            <Box variant="p">
              Resolve submission issues in the payment packet screens.{" "}
              <Link href="/finance/payments">Open Payments</Link>
            </Box>
          </>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default IntacctSubmissionDetailWidget;
