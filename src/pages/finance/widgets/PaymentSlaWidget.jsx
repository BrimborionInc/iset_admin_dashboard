import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  ColumnLayout,
  StatusIndicator,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";

const PaymentSlaWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { slaSnapshot } = usePaymentsData();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "SLA snapshot", metadata.aiContext ?? "");
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

  const cards = [
    {
      label: "Ready for finance review",
      value: slaSnapshot.readyForFinance,
      indicator: slaSnapshot.readyForFinance > 0 ? "warning" : "success",
      helper: "Packets waiting for finance review.",
    },
    {
      label: "Ready for batching",
      value: slaSnapshot.readyForBatching,
      indicator: slaSnapshot.readyForBatching > 0 ? "warning" : "success",
      helper: "Finance-approved packets ready for batch creation.",
    },
    {
      label: "On hold",
      value: slaSnapshot.onHold,
      indicator: slaSnapshot.onHold > 0 ? "error" : "success",
      helper: "Packets paused due to missing evidence or risk flags.",
    },
    {
      label: "Sent awaiting confirmation",
      value: slaSnapshot.sentAwaitingConfirmation,
      indicator: slaSnapshot.sentAwaitingConfirmation > 0 ? "warning" : "success",
      helper: "Packets sent to Finance but not yet confirmed.",
    },
    {
      label: "Confirmed / closed",
      value: slaSnapshot.confirmed,
      indicator: "success",
      helper: "Recently confirmed packets.",
    },
    {
      label: "Overdue evidence tasks",
      value: slaSnapshot.overdueEvidence,
      indicator: slaSnapshot.overdueEvidence > 0 ? "error" : "success",
      helper: "Lines past receipt or evidence deadlines.",
    },
    {
      label: "Avg. turnaround (days)",
      value: slaSnapshot.avgTurnaroundDays.toFixed(1),
      indicator: "info",
      helper: "Average days from submission to confirmation.",
    },
  ];

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Monitor SLA performance for the payments workflow."
        >
          SLA snapshot
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="SLA snapshot settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <ColumnLayout columns={3} variant="text-grid">
          {cards.map(card => (
            <SpaceBetween key={card.label} size="xxs">
              <Box variant="awsui-key-label">{card.label}</Box>
              <StatusIndicator type={card.indicator}>{card.value}</StatusIndicator>
              <Box variant="p">{card.helper}</Box>
            </SpaceBetween>
          ))}
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default PaymentSlaWidget;
