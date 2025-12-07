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
import { useBudgetsData } from "./BudgetsDataContext.jsx";

const timeframeOptions = [
  { label: "FY2024-25", value: "fy24" },
  { label: "FY2024-25 Q2", value: "fy24-q2" },
  { label: "FY2024-25 Q3", value: "fy24-q3" },
  { label: "FY2023-24", value: "fy23" },
];

const formatCurrency = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toLocaleString("en-CA")}` : "—";
};

const BudgetBurnRateWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { pots } = useBudgetsData();
  const [timeframe, setTimeframe] = useState(timeframeOptions[0]);
  const [riskFilter, setRiskFilter] = useState("");

  useEffect(() => {
    const handleViewLoaded = event => {
      const risk = event?.detail?.presets?.riskFilter;
      if (risk === "overrun" || risk === "underspend" || risk === "steady" || risk === "") {
        setRiskFilter(risk || "");
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

  const series = useMemo(() => {
    const enriched = (pots || [])
      .map(pot => {
        const adjusted = Number(pot.adjusted) || 0;
        const actual = Number(pot.actual) || 0;
        const burn = adjusted > 0 ? actual / adjusted : 0;
        const remaining = Number(pot.remaining);
        const forecastVariance = Number(pot.forecastVariance);
        const varianceType = forecastVariance > 0 ? "error" : forecastVariance < 0 ? "success" : "info";
        const varianceLabel = forecastVariance > 0 ? "Forecast above budget" : forecastVariance < 0 ? "Forecast below budget" : "On plan";
        const riskTag =
          varianceType === "error" || burn > 1.05
            ? "overrun"
            : burn < 0.7
              ? "underspend"
              : "steady";
        return {
          id: pot.id,
          name: pot.name,
          burn,
          forecastVariance,
          remaining: Number.isFinite(remaining) ? remaining : adjusted - actual,
          varianceType,
          varianceLabel,
          riskTag,
          guardrail: pot.policyNotes || "Guardrails not documented.",
        };
      })
      .filter(item => {
        if (riskFilter === "overrun") return item.riskTag === "overrun";
        if (riskFilter === "underspend") return item.riskTag === "underspend";
        if (riskFilter === "steady") return item.riskTag === "steady";
        return true;
      })
      .sort((a, b) => (b.burn || 0) - (a.burn || 0))
      .slice(0, 4);
    return enriched;
  }, [pots, riskFilter]);

  const cards = useMemo(
    () =>
      series.map(item => {
        return {
          ...item,
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
            detail: { timeframe: detail.selectedOption.value },
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
