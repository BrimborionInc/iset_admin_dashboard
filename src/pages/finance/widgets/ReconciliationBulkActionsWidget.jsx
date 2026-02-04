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
  FormField,
  Alert,
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
    actionError,
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

  const commitAction = async (type, message) => {
    if (!selectedItems.length) {
      return;
    }
    let ok = false;
    switch (type) {
      case "approve":
        ok = await resolveTransactions(selectedTransactionIds, "approved", message);
        break;
      case "nonclaimable":
        ok = await resolveTransactions(
          selectedTransactionIds,
          "nonclaimable",
          message ?? "Marked non-claimable."
        );
        break;
      case "request":
        ok = await requestEvidence(selectedTransactionIds, message);
        break;
      default:
        break;
    }
    if (ok) {
      setLastAction({ type, count: selectedItems.length, timestamp: new Date().toISOString() });
      setShowConfirmation(true);
      setBulkMessage("");
    }
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

        <Box variant="p">
          Selections come from the Transactions queue. Use bulk actions to resolve groups of
          similar exceptions with consistent messaging.
        </Box>

        <FormField
          label="Bulk action template"
          description="Pick the intended outcome and a default message. You can edit the message before applying."
        >
          <Select
            disabled={!selectedItems.length}
            selectedOption={selectedBulkTemplate}
            options={bulkTemplates}
            onChange={handleTemplateChange}
            placeholder="Select bulk action template"
          />
        </FormField>

        <FormField
          label="Message to record"
          description="Used for audit notes or program follow-up. Saved with the action in transaction metadata; audit log integration is planned."
        >
          <Textarea
            disabled={!selectedItems.length}
            placeholder="Add the message that will accompany this action."
            rows={4}
            value={bulkMessage}
            onChange={({ detail }) => setBulkMessage(detail.value)}
          />
        </FormField>

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

        {actionError ? (
          <Alert type="error" header="Bulk action failed">
            {actionError}
          </Alert>
        ) : null}

        {showConfirmation && lastAction ? (
          <StatusIndicator type="success">
            {`Bulk action '${lastAction.type}' applied to ${lastAction.count} transaction${
              lastAction.count === 1 ? "" : "s"
            } at ${new Date(lastAction.timestamp).toLocaleString()}.`}
          </StatusIndicator>
        ) : (
          <Box variant="p">
            Bulk actions update the queue immediately and store notes in transaction metadata.
            Audit log and notification workflows will be added in a later phase.
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ReconciliationBulkActionsWidget;
