import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  ColumnLayout,
  Link,
  StatusIndicator,
  Button,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";

const PaymentDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { selectedRequest, markRequestStatus } = usePaymentsData();

  const statusMeta = useMemo(() => {
    if (!selectedRequest) {
      return { label: "No packet selected", indicator: "pending" };
    }
    switch (selectedRequest.status) {
      case "awaiting_finance":
        return { label: "Awaiting Finance", indicator: "info" };
      case "awaiting_confirmation":
        return { label: "Awaiting Confirmation", indicator: "warning" };
      case "completed":
        return { label: "Completed", indicator: "success" };
      case "draft":
      default:
        return { label: "Draft", indicator: "pending" };
    }
  }, [selectedRequest]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Payment detail", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const handleMarkComplete = () => {
    if (!selectedRequest) return;
    markRequestStatus(selectedRequest.id, "completed", {
      id: `DOC-${Math.floor(Math.random() * 9000 + 8000)}`,
      name: `Payment-confirmation-${selectedRequest.id}.png`,
    });
  };

  const handleRequestInfo = () => {
    if (!selectedRequest) return;
    markRequestStatus(selectedRequest.id, "awaiting_confirmation");
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Review documents, tags, and actions for the selected payment packet."
        >
          Payment packet detail
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment detail settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {selectedRequest ? (
        <SpaceBetween size="m">
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Payment packet</Box>
              <SpaceBetween size="xxs">
                <Box variant="strong">{selectedRequest.id}</Box>
                <Box variant="p">{selectedRequest.ptmaRegion}</Box>
                <Box variant="p">{selectedRequest.requester} · {selectedRequest.requesterRole}</Box>
              </SpaceBetween>
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Status</Box>
              <StatusIndicator type={statusMeta.indicator}>{statusMeta.label}</StatusIndicator>
              <Box variant="awsui-key-label">Amount</Box>
              <Box variant="strong">
                ${selectedRequest.amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}
              </Box>
            </SpaceBetween>
          </ColumnLayout>

          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Timeline</Box>
              <Box variant="p">Submitted: {selectedRequest.submittedOn}</Box>
              <Box variant="p">Due by: {selectedRequest.dueBy}</Box>
              <Box variant="p">Tags: {(selectedRequest.tags ?? []).length ? selectedRequest.tags.join(", ") : "—"}</Box>
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Notes</Box>
              <Box variant="p">{selectedRequest.notes || "No additional notes supplied."}</Box>
            </SpaceBetween>
          </ColumnLayout>

          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">Documents</Box>
            {(selectedRequest.documents ?? []).length ? (
              selectedRequest.documents.map(document => (
                <Link key={document.id} href="#">
                  {document.name}
                </Link>
              ))
            ) : (
              <Box variant="p">No documents attached.</Box>
            )}
          </SpaceBetween>

          <SpaceBetween direction="horizontal" size="xs">
            <Button
              iconName="status-positive"
              onClick={handleMarkComplete}
              disabled={selectedRequest.status === "completed"}
            >
              Mark payment complete
            </Button>
            <Button onClick={handleRequestInfo} disabled={selectedRequest.status === "awaiting_confirmation"}>
              Request banking confirmation
            </Button>
            <Button variant="link" href="#">
              Open allocation history
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      ) : (
        <Box variant="p">Select a payment packet from the queue to view its detail.</Box>
      )}
    </BoardItem>
  );
};

export default PaymentDetailWidget;
