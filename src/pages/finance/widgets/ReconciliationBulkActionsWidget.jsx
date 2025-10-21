import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  Select,
  Textarea,
  Button,
  StatusIndicator,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReconciliationData } from "./ReconciliationDataContext.jsx";
import FinanceReconciliationBulkHelp from "../../../helpPanelContents/financeReconciliationBulkHelp.js";

const ReconciliationBulkActionsWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
}) => {
  const {
    transactions,
    selectedTransactionIds,
    resolveTransactions,
    requestEvidence,
    bulkTemplates,
    selectedBulkTemplate,
    setSelectedBulkTemplate,
    bulkMessage,
    setBulkMessage,
  } = useReconciliationData();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const selectedItems = useMemo(
    () => transactions.filter(tx => selectedTransactionIds.includes(tx.id)),
    [transactions, selectedTransactionIds]
  );

  const infoHelper = metadata.helpComponent
    ? metadata
    : {
        helpComponent: FinanceReconciliationBulkHelp,
        helpTitle: "Bulk actions",
        aiContext: FinanceReconciliationBulkHelp.aiContext,
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

  const handleTemplateChange = ({ detail }) => {
    setSelectedBulkTemplate(detail.selectedOption);
    setBulkMessage(detail.selectedOption?.defaultMessage ?? "");
  };

  const commitAction = (type, message) => {
    if (!selectedItems.length) {
      return;
    }
    switch (type) {
      case "approve":
        resolveTransactions(selectedTransactionIds, "resolved", message);
        break;
      case "nonclaimable":
        resolveTransactions(selectedTransactionIds, "resolved", message ?? "Marked non-claimable.");
        break;
      case "request":
        requestEvidence(selectedTransactionIds, message);
        break;
      default:
        break;
    }
    setLastAction({ type, count: selectedItems.length, timestamp: new Date().toISOString() });
    setShowConfirmation(true);
    setBulkMessage("");
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Apply actions to multiple selected transactions and record audit notes."
        >
          Bulk actions
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Bulk actions settings"
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
      <SpaceBetween size="m">
        <Box variant="awsui-key-label">
          {selectedItems.length
            ? `${selectedItems.length} transaction${selectedItems.length === 1 ? "" : "s"} selected`
            : "No transactions selected"}
        </Box>

        <Select
          disabled={!selectedItems.length}
          selectedOption={selectedBulkTemplate}
          options={bulkTemplates}
          onChange={handleTemplateChange}
          placeholder="Select bulk action template"
        />

        <Textarea
          disabled={!selectedItems.length}
          placeholder="Message to include with the bulk action (not persisted)."
          rows={4}
          value={bulkMessage}
          onChange={({ detail }) => setBulkMessage(detail.value)}
        />

        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            disabled={!selectedItems.length}
            onClick={() => commitAction("approve", bulkMessage || "Approved via bulk action.")}
          >
            Approve selected
          </Button>
          <Button
            disabled={!selectedItems.length}
            onClick={() =>
              commitAction(
                "request",
                bulkMessage || "Please upload required documentation for these transactions."
              )
            }
          >
            Request evidence
          </Button>
          <Button
            variant="link"
            disabled={!selectedItems.length}
            onClick={() => commitAction("nonclaimable", bulkMessage)}
          >
            Mark non-claimable
          </Button>
        </SpaceBetween>

        {showConfirmation && lastAction ? (
          <StatusIndicator type="success">
            {`Bulk action '${lastAction.type}' applied to ${lastAction.count} transaction${
              lastAction.count === 1 ? "" : "s"
            } at ${new Date(lastAction.timestamp).toLocaleString()}.`}
          </StatusIndicator>
        ) : (
          <Box variant="p">
            Bulk actions will update the queue immediately. Changes will be wired to backend APIs in
            a future phase.
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ReconciliationBulkActionsWidget;
