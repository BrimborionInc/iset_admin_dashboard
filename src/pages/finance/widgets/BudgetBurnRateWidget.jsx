import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  ColumnLayout,
  Box,
  StatusIndicator,
  ProgressBar,
  Select,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const timeframeOptions = [
  { label: "FY2024-25", value: "fy24" },
  { label: "FY2024-25 Q2", value: "fy24-q2" },
  { label: "FY2024-25 Q3", value: "fy24-q3" },
  { label: "FY2023-24", value: "fy23" },
];

const baselineData = {
  "nwac-master": [
    {
      id: "nwac-admin",
      name: "NWAC Administration",
      burn: 0.76,
      forecastVariance: 0,
      remaining: 55000,
      guardrail: "Hold flat-rate at 15%. Escalate if headcount changes add more than $25K.",
    },
    {
      id: "ptma-on-client",
      name: "Ontario Client Services",
      burn: 0.74,
      forecastVariance: -2000,
      remaining: 67000,
      guardrail: "Toronto pilot draws down quickly—prep variance narrative if remaining < $40K.",
    },
  ],
  "regional-west": [
    {
      id: "ptma-bc-client",
      name: "BC Client Services",
      burn: 0.81,
      forecastVariance: 3000,
      remaining: 45000,
      guardrail: "Trigger top-up workflow once commitments reach 95% of the adjusted plan.",
    },
    {
      id: "ptma-ab-client",
      name: "Alberta Client Services",
      burn: 0.78,
      forecastVariance: -2000,
      remaining: 51000,
      guardrail: "Monitor stewardship spend; admin should stay inside the $70K envelope.",
    },
  ],
  "northern-equity": [
    {
      id: "ptma-prairies-client",
      name: "Prairies Client Services",
      burn: 0.72,
      forecastVariance: -1000,
      remaining: 49000,
      guardrail: "Mileage reimbursements spike in winter—pre-stage evidence bundles now.",
    },
    {
      id: "ptma-northern-client",
      name: "Northern Client Services",
      burn: 0.78,
      forecastVariance: -1000,
      remaining: 29000,
      guardrail: "Connectivity contracts renewing in Q3—confirm top-up reserve before August.",
    },
  ],
};

const defaultViewId = "nwac-master";

const formatCurrency = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toLocaleString("en-CA")}` : "—";
};

const BudgetBurnRateWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [timeframe, setTimeframe] = useState(timeframeOptions[0]);
  const [viewId, setViewId] = useState(defaultViewId);

  useEffect(() => {
    const handleViewLoaded = event => {
      if (event.detail?.viewId) {
        setViewId(event.detail.viewId);
      }
    };
    window.addEventListener("financeBudgets:viewLoaded", handleViewLoaded);
    return () => window.removeEventListener("financeBudgets:viewLoaded", handleViewLoaded);
  }, []);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Burn-rate insights", metadata.aiContext ?? "");
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

  const series = baselineData[viewId] ?? baselineData[defaultViewId];

  const cards = useMemo(
    () =>
      series.map(item => {
        const varianceType = item.forecastVariance > 0 ? "error" : item.forecastVariance < 0 ? "success" : "info";
        const varianceLabel = item.forecastVariance > 0 ? "Forecast above budget" : "Forecast below budget";
        return {
          ...item,
          varianceType,
          varianceLabel,
        };
      }),
    [series]
  );

  const actionsArea = (
    <Select
      selectedOption={timeframe}
      onChange={({ detail }) => {
        setTimeframe(detail.selectedOption);
        window.dispatchEvent(
          new CustomEvent("financeBudgets:timeframeChange", {
            detail: { timeframe: detail.selectedOption.value, viewId },
          })
        );
      }}
      options={timeframeOptions}
      selectedAriaLabel="Burn-rate timeframe"
    />
  );

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} actions={actionsArea}>
          Burn-rate insights
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Burn-rate insights settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Box variant="awsui-key-label">Timeframe context</Box>
        <ColumnLayout columns={2} variant="text-grid">
          {cards.map(item => (
            <SpaceBetween key={item.id} size="xs">
              <Box variant="strong">{item.name}</Box>
              <ProgressBar
                value={Math.round(item.burn * 100)}
                label="Burn vs. adjusted budget"
                additionalInfo={formatCurrency(item.remaining) + " remaining"}
              />
              <StatusIndicator type={item.varianceType}>
                {item.varianceLabel}: {formatCurrency(Math.abs(item.forecastVariance))}
              </StatusIndicator>
              <Box variant="p">{item.guardrail}</Box>
            </SpaceBetween>
          ))}
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default BudgetBurnRateWidget;
