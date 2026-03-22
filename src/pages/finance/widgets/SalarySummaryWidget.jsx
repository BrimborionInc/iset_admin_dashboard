import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  SpaceBetween,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useSalariesData } from "./SalariesDataContext.jsx";

const formatCurrency = value =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const SalarySummaryWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { summary } = useSalariesData();

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          React.createElement(metadata.helpComponent),
          metadata.helpTitle ?? "Salary summary",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const summaryItems = [
    { label: "Annual total", value: formatCurrency(summary.annualTotal) },
    { label: "Derived monthly total", value: formatCurrency(summary.derivedMonthlyTotal) },
    { label: "Regions entered", value: `${summary.enteredRegionCount} / ${summary.regionCount}` },
    { label: "Pots assigned", value: `${summary.assignedPotCount} / ${summary.regionCount}` },
  ];

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Salary summary</Header>}
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Salary summary settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <ColumnLayout columns={2}>
        {summaryItems.map(item => (
          <Box key={item.label} padding={{ top: "s", bottom: "s" }}>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">{item.label}</Box>
              <Box variant="strong">{item.value}</Box>
            </SpaceBetween>
          </Box>
        ))}
      </ColumnLayout>
    </BoardItem>
  );
};

export default SalarySummaryWidget;
