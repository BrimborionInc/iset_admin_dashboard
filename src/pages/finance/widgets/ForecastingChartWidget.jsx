import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  LineChart,
  Box,
  Toggle,
  Select,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useForecastingData } from "./ForecastingDataContext.jsx";

const ForecastingChartWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    horizonKey,
    setHorizonKey,
    horizonOptions,
    horizonMonths,
    actualSeries,
    forecastSeries,
    activeScenario,
  } = useForecastingData();

  const [showActuals, setShowActuals] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showScenario, setShowScenario] = useState(true);

  const infoLink =
    toggleHelpPanel && metadata.helpComponent ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Forecast vs. budget",
            metadata.aiContext ?? ""
          );
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

  const chartSeries = useMemo(() => {
    const series = [];
    if (showActuals) {
      series.push({
        title: "Actual spend",
        type: "line",
        data: actualSeries,
        valueFormatter: value => `$${value.toLocaleString("en-CA")}`,
      });
    }
    if (showForecast) {
      series.push({
        title: "Baseline forecast",
        type: "line",
        data: forecastSeries,
        valueFormatter: value => `$${value.toLocaleString("en-CA")}`,
      });
    }
    if (showScenario && activeScenario) {
      const scenarioData = forecastSeries.map((point, index) => ({
        x: point.x,
        y: point.y + Math.round((activeScenario.total - forecastSeries[forecastSeries.length - 1].y) / forecastSeries.length),
      }));
      series.push({
        title: `${activeScenario.name}`,
        type: "line",
        data: scenarioData,
        valueFormatter: value => `$${value.toLocaleString("en-CA")}`,
      });
    }
    return series;
  }, [showActuals, showForecast, showScenario, actualSeries, forecastSeries, activeScenario]);

  const combinedDomain = useMemo(() => {
    const values = chartSeries.flatMap(series => series.data.map(point => point.y));
    const max = Math.max(...values, 1);
    return [0, Math.ceil(max / 100) * 100];
  }, [chartSeries]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Analyse forecasted spend versus budget with optional scenario overlay."
          actions={
            <Select
              options={horizonOptions}
              selectedOption={horizonOptions.find(option => option.value === horizonKey)}
              onChange={({ detail }) => setHorizonKey(detail.selectedOption.value)}
              selectedAriaLabel="Forecast horizon"
            />
          }
        >
          Forecast vs. budget
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Forecast vs. budget settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <SpaceBetween size="xxs" direction="horizontal">
          <Toggle
            checked={showActuals}
            onChange={({ detail }) => setShowActuals(detail.checked)}
          >
            Actuals
          </Toggle>
          <Toggle
            checked={showForecast}
            onChange={({ detail }) => setShowForecast(detail.checked)}
          >
            Baseline forecast
          </Toggle>
          <Toggle
            checked={showScenario}
            onChange={({ detail }) => setShowScenario(detail.checked)}
            disabled={!activeScenario}
          >
            Active scenario
          </Toggle>
        </SpaceBetween>
        <LineChart
          series={chartSeries}
          height={320}
          detailPopoverDismissAriaLabel="Dismiss"
          xTitle="Month"
          yTitle="Cumulative spend (CAD)"
          legendTitle="Data sets"
          xDomain={horizonMonths}
          yDomain={combinedDomain}
          xScaleType="categorical"
          ariaLabel="Forecast versus budget chart"
          i18nStrings={{
            detailsValue: "Value",
            detailsNone: "No forecast data",
            chartAriaRoleDescription: "line chart",
            xAxisAriaRoleDescription: "month axis",
          }}
          empty={
            <Box padding="m">No forecast series selected. Enable at least one toggle.</Box>
          }
        />
        {activeScenario ? (
          <Box variant="awsui-key-label">
            Active scenario: {activeScenario.name} ({activeScenario.status}) – total forecast $
            {activeScenario.total.toLocaleString("en-CA")}
          </Box>
        ) : (
          <Box variant="awsui-key-label">No scenario selected.</Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ForecastingChartWidget;
