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
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReconciliationData } from "./ReconciliationDataContext.jsx";
import FinanceReconciliationDetailHelp from "../../../helpPanelContents/financeReconciliationDetailHelp.js";

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

  const handleApprove = () => {
    if (transaction) {
      resolveTransactions([transaction.id], "resolved", "Approved after manual review.");
    }
  };

  const handleMarkNonClaimable = () => {
    if (transaction) {
      resolveTransactions([transaction.id], "resolved", "Marked non-claimable.");
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
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Transaction</Box>
              <SpaceBetween size="xxs">
                <Box variant="strong">{transaction.id}</Box>
                <Box variant="p">Case ID: {transaction.caseId}</Box>
                <Box variant="p">Vendor: {transaction.vendor}</Box>
                <Box variant="p">Date: {transaction.date}</Box>
                <Box variant="p">Amount: ${transaction.amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</Box>
              </SpaceBetween>
            </SpaceBetween>
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Status</Box>
              <StatusIndicator type={statusType}>{transaction.status.toUpperCase()}</StatusIndicator>
              <Box variant="awsui-key-label">Priority</Box>
              <Box variant="p">{transaction.priority}</Box>
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
                <Box variant="p">Type: {transaction.exceptionType.replace(/_/g, " ")}</Box>
                <Box variant="p">Current pot: {transaction.potName}</Box>
                <Box variant="p">
                  Proposed pot: {transaction.proposedPotId ? transaction.proposedPotId : "—"}
                </Box>
                <Box variant="p">{transaction.notes}</Box>
              </SpaceBetween>
            </SpaceBetween>
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Evidence</Box>
              {transaction.attachments?.length ? (
                <SpaceBetween size="xxs">
                  {transaction.attachments.map(attachment => (
                    <Link key={attachment.id} href="#">
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

          <SpaceBetween size="s">
            <Box variant="awsui-key-label">Reviewer notes</Box>
            <Textarea
              placeholder="Add optional notes for audit history (not persisted yet)."
              rows={3}
            />
          </SpaceBetween>

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
      ) : (
        <Box variant="p">Select a transaction from the queue to review its details.</Box>
      )}
    </BoardItem>
  );
};

export default ReconciliationExceptionDetailWidget;
