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
      label: "Awaiting finance review",
      value: slaSnapshot.awaitingFinance,
      indicator: slaSnapshot.awaitingFinance > 0 ? "warning" : "success",
      helper: "Packets sitting in the finance queue.",
    },
    {
      label: "Awaiting confirmation",
      value: slaSnapshot.awaitingConfirmation,
      indicator: slaSnapshot.awaitingConfirmation > 0 ? "warning" : "success",
      helper: "Packets waiting for payment proof.",
    },
    {
      label: "Completed this week",
      value: slaSnapshot.completed,
      indicator: "success",
      helper: "Packets completed within SLA window.",
    },
    {
      label: "Draft packets",
      value: slaSnapshot.draft,
      indicator: "info",
      helper: "Drafts saved by program staff but not submitted.",
    },
    {
      label: "Overdue packets",
      value: slaSnapshot.overdue,
      indicator: slaSnapshot.overdue > 0 ? "error" : "success",
      helper: "Packets past due-by date.",
    },
    {
      label: "Avg. turnaround (days)",
      value: slaSnapshot.avgTurnaroundDays.toFixed(1),
      indicator: "info",
      helper: "Rolling 30-day average from submission to completion.",
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

