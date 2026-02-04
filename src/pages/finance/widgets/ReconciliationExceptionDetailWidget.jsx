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
  Button,
  Textarea,
  FormField,
  Alert,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReconciliationData } from "./ReconciliationDataContext.jsx";
import FinanceReconciliationDetailHelp from "../../../helpPanelContents/financeReconciliationDetailHelp.js";

const exceptionLabels = {
  missing_evidence: "Missing evidence",
  out_of_period: "Out of period",
  ineligible_vendor: "Ineligible vendor",
  duplicate_claim: "Duplicate claim",
  policy_review: "Policy review",
};

const statusLabels = {
  open: "Open",
  in_review: "In review",
  pending: "Pending",
  resolved: "Resolved",
};

const priorityLabels = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const formatExceptionLabel = exception =>
  exceptionLabels[exception] ?? String(exception || "").replace(/_/g, " ").trim();

const formatStatusLabel = status =>
  statusLabels[status] ?? String(status || "").replace(/_/g, " ").trim();

const formatPriorityLabel = priority =>
  priorityLabels[priority] ?? priorityLabels.low;

const ReconciliationExceptionDetailWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
}) => {
  const {
    transactions,
    selectedTransactionId,
    resolveTransactions,
    requestEvidence,
    loading,
    actionError,
  } = useReconciliationData();

  const transaction = useMemo(
    () => transactions.find(item => item.id === selectedTransactionId) ?? null,
    [transactions, selectedTransactionId]
  );

  const infoHelper = metadata.helpComponent
    ? metadata
    : {
        helpComponent: FinanceReconciliationDetailHelp,
        helpTitle: "Exception detail",
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

  const statusType =
    transaction?.status === "resolved"
      ? "success"
      : transaction?.priority === "critical"
        ? "error"
        : transaction?.priority === "high"
          ? "warning"
          : "info";
  const statusLabel = transaction
    ? transaction.status === "resolved"
      ? "Resolved"
      : `${formatStatusLabel(transaction.status)} - ${formatPriorityLabel(transaction.priority)}`
    : "";
  const proposedPotLabel = transaction?.proposedPotName || transaction?.proposedPotId || "—";

  const handleApprove = () => {
    if (transaction) {
      resolveTransactions([transaction.id], "approved", "Approved after manual review.");
    }
  };

  const handleMarkNonClaimable = () => {
    if (transaction) {
      resolveTransactions([transaction.id], "nonclaimable", "Marked non-claimable.");
    }
  };

  const handleRequestInfo = () => {
    if (transaction) {
      requestEvidence([transaction.id], "Please provide supporting documents for review.");
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Detailed context for the selected transaction, including evidence and actions."
        >
          Exception detail
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Exception detail settings"
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
      {transaction ? (
        <SpaceBetween size="l">
          <Box variant="p">
            Reviewing a single case-management transaction that failed reconciliation checks.
            Confirm the exception, validate evidence, and decide the next step.
          </Box>
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Transaction</Box>
              <SpaceBetween size="xxs">
                <Box variant="strong">{transaction.displayId || transaction.id}</Box>
                <Box variant="p">Case ID: {transaction.caseId}</Box>
                <Box variant="p">Vendor: {transaction.vendor}</Box>
                <Box variant="p">Date: {transaction.date}</Box>
                <Box variant="p">Amount: ${transaction.amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</Box>
              </SpaceBetween>
            </SpaceBetween>
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Status</Box>
              <StatusIndicator type={statusType}>{statusLabel}</StatusIndicator>
              <Box variant="awsui-key-label">Priority</Box>
              <Box variant="p">{formatPriorityLabel(transaction.priority)}</Box>
              <Box variant="awsui-key-label">Last updated</Box>
              <Box variant="p">
                {transaction.lastUpdated ? new Date(transaction.lastUpdated).toLocaleString() : "Unknown"}
              </Box>
            </SpaceBetween>
          </ColumnLayout>

          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Exception details</Box>
              <SpaceBetween size="xxs">
                <Box variant="p">Type: {formatExceptionLabel(transaction.exceptionType)}</Box>
                <Box variant="p">Current pot: {transaction.potName}</Box>
                <Box variant="p">
                  Proposed pot: {proposedPotLabel}
                </Box>
                <Box variant="p">{transaction.notes}</Box>
              </SpaceBetween>
            </SpaceBetween>
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Evidence</Box>
              {transaction.attachments?.length ? (
                <SpaceBetween size="xxs">
                  {transaction.attachments.map(attachment => (
                    <Link
                      key={attachment.id}
                      href="#"
                      onFollow={event => event.preventDefault()}
                      ariaLabel={`Open attachment ${attachment.name}`}
                    >
                      {attachment.name}
                    </Link>
                  ))}
                </SpaceBetween>
              ) : (
                <Box variant="p">No evidence attached.</Box>
              )}
              <Box variant="awsui-key-label">Latest request</Box>
              <Box variant="p">
                {transaction.latestRequestMessage
                  ? transaction.latestRequestMessage
                  : transaction.hasRequestedInfo
                    ? "Evidence requested; awaiting response."
                    : "No requests sent."}
              </Box>
            </SpaceBetween>
          </ColumnLayout>

          <FormField
            label="Reviewer notes"
            description="Capture the rationale for your decision. Notes are stored locally for now (persistence coming with the audit log upgrade)."
          >
            <Textarea
              placeholder="Add optional notes for audit history."
              rows={3}
            />
          </FormField>

          <SpaceBetween size="xs">
            <Box variant="p">
              Choose the resolution that best aligns with policy: approve and keep the current pot,
              request missing evidence, or mark the transaction non-claimable.
            </Box>
            {actionError ? (
              <Alert type="error" header="Action failed">
                {actionError}
              </Alert>
            ) : null}
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="primary" onClick={handleApprove}>
                Approve
              </Button>
              <Button onClick={handleRequestInfo}>Request evidence</Button>
              <Button variant="link" onClick={handleMarkNonClaimable}>
                Mark non-claimable
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </SpaceBetween>
      ) : (
        <Box variant="p">
          {loading
            ? "Loading transaction detail..."
            : "Select a transaction from the queue to review its details and resolve the exception."}
        </Box>
      )}
    </BoardItem>
  );
};

export default ReconciliationExceptionDetailWidget;
