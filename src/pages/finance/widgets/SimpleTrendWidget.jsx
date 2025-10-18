import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  Box,
  ButtonDropdown,
  SpaceBetween,
  LineChart,
  Select,
  Toggle,
  Link,
  ColumnLayout,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const monthIndex = months.reduce((acc, month, index) => {
  acc[month] = index;
  return acc;
}, {});

const timeframeOptions = [
  { label: "FY2024-25", value: "fy24" },
  { label: "FY2024-25 Q1", value: "fy24-q1" },
  { label: "FY2024-25 Q2", value: "fy24-q2" },
  { label: "FY2024-25 Q3", value: "fy24-q3" },
  { label: "FY2024-25 Q4", value: "fy24-q4" },
  { label: "FY2023-24", value: "fy23" },
  { label: "FY2023-24 Q1", value: "fy23-q1" },
  { label: "FY2023-24 Q2", value: "fy23-q2" },
  { label: "FY2023-24 Q3", value: "fy23-q3" },
  { label: "FY2023-24 Q4", value: "fy23-q4" },
];

const regionOptions = [
  { label: "All Canada", value: "canada" },
  { label: "Alberta", value: "ab" },
  { label: "British Columbia", value: "bc" },
  { label: "Manitoba", value: "mb" },
  { label: "New Brunswick", value: "nb" },
  { label: "Newfoundland and Labrador", value: "nl" },
  { label: "Nova Scotia", value: "ns" },
  { label: "Ontario", value: "on" },
  { label: "Prince Edward Island", value: "pei" },
  { label: "Quebec", value: "qc" },
  { label: "Saskatchewan", value: "sk" },
  { label: "Northwest Territories", value: "nt" },
  { label: "Nunavut", value: "nu" },
  { label: "Yukon", value: "yt" },
];

const programOptions = [
  { label: "ISET", value: "iset" },
  { label: "Jordan's Principle", value: "jordan" },
];

const regionFactors = {
  canada: 1,
  ab: 0.9,
  bc: 1.05,
  mb: 0.85,
  nb: 0.6,
  nl: 0.55,
  ns: 0.65,
  on: 1.2,
  pei: 0.4,
  qc: 1.1,
  sk: 0.7,
  nt: 0.3,
  nu: 0.25,
  yt: 0.28,
};

const programFactors = {
  iset: 1,
  jordan: 0.6,
};

const baseDatasets = {
  fy24: {
    actual: [
      { x: "Apr", y: 220000 },
      { x: "May", y: 410000 },
      { x: "Jun", y: 640000 },
      { x: "Jul", y: 910000 },
      { x: "Aug", y: 1180000 },
      { x: "Sep", y: 1390000 },
    ],
    plan: [
      { x: "Apr", y: 200000 },
      { x: "May", y: 400000 },
      { x: "Jun", y: 600000 },
      { x: "Jul", y: 820000 },
      { x: "Aug", y: 1040000 },
      { x: "Sep", y: 1240000 },
      { x: "Oct", y: 1440000 },
      { x: "Nov", y: 1660000 },
      { x: "Dec", y: 1900000 },
      { x: "Jan", y: 2140000 },
      { x: "Feb", y: 2380000 },
      { x: "Mar", y: 2620000 },
    ],
    forecast: [
      { x: "Oct", y: 1600000 },
      { x: "Nov", y: 1850000 },
      { x: "Dec", y: 2100000 },
      { x: "Jan", y: 2350000 },
      { x: "Feb", y: 2600000 },
      { x: "Mar", y: 2850000 },
    ],
    xDomain: months,
    yDomain: [0, 3500000],
  },
  fy23: {
    actual: [
      { x: "Apr", y: 180000 },
      { x: "May", y: 360000 },
      { x: "Jun", y: 540000 },
      { x: "Jul", y: 750000 },
      { x: "Aug", y: 960000 },
      { x: "Sep", y: 1180000 },
      { x: "Oct", y: 1400000 },
      { x: "Nov", y: 1625000 },
      { x: "Dec", y: 1850000 },
      { x: "Jan", y: 2070000 },
      { x: "Feb", y: 2290000 },
      { x: "Mar", y: 2500000 },
    ],
    plan: [
      { x: "Apr", y: 200000 },
      { x: "May", y: 400000 },
      { x: "Jun", y: 600000 },
      { x: "Jul", y: 800000 },
      { x: "Aug", y: 1000000 },
      { x: "Sep", y: 1200000 },
      { x: "Oct", y: 1400000 },
      { x: "Nov", y: 1600000 },
      { x: "Dec", y: 1800000 },
      { x: "Jan", y: 2000000 },
      { x: "Feb", y: 2200000 },
      { x: "Mar", y: 2400000 },
    ],
    forecast: [],
    xDomain: months,
    yDomain: [0, 3000000],
  },
};

const cloneSeries = series => series.map(point => ({ ...point }));

const buildFullDataset = dataset => ({
  actual: cloneSeries(dataset.actual),
  plan: cloneSeries(dataset.plan),
  forecast: cloneSeries(dataset.forecast),
  xDomain: [...dataset.xDomain],
  yDomain: [...dataset.yDomain],
});

const sliceSeries = (series, start, end) =>
  series.filter(point => {
    const idx = monthIndex[point.x];
    return idx >= start && idx < end;
  });

const buildQuarterDataset = (dataset, start, end) => ({
  actual: sliceSeries(dataset.actual, start, end),
  plan: sliceSeries(dataset.plan, start, end),
  forecast: sliceSeries(dataset.forecast, start, end),
  xDomain: months.slice(start, end),
  yDomain: [...dataset.yDomain],
});

const chartSeriesByTimeframe = {
  fy24: buildFullDataset(baseDatasets.fy24),
  fy23: buildFullDataset(baseDatasets.fy23),
};

[
  { value: "fy24-q1", base: "fy24", start: 0, end: 3 },
  { value: "fy24-q2", base: "fy24", start: 3, end: 6 },
  { value: "fy24-q3", base: "fy24", start: 6, end: 9 },
  { value: "fy24-q4", base: "fy24", start: 9, end: 12 },
  { value: "fy23-q1", base: "fy23", start: 0, end: 3 },
  { value: "fy23-q2", base: "fy23", start: 3, end: 6 },
  { value: "fy23-q3", base: "fy23", start: 6, end: 9 },
  { value: "fy23-q4", base: "fy23", start: 9, end: 12 },
].forEach(({ value, base, start, end }) => {
  chartSeriesByTimeframe[value] = buildQuarterDataset(baseDatasets[base], start, end);
});

const formatCurrency = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toLocaleString("en-CA")}` : "";
};

const lineChartI18nStrings = {
  detailPopoverDismissAriaLabel: "Dismiss",
  legendAriaLabel: "Spend trend legend",
  xAxisAriaRoleDescription: "Months on the fiscal calendar",
  yAxisAriaRoleDescription: "Spend amounts in Canadian dollars",
  xTickFormatter: label => label,
  yTickFormatter: value => formatCurrency(value),
  xTickFormatterLabel: label => `Month ${label}`,
  yTickFormatterLabel: value => formatCurrency(value),
};

const SimpleTrendWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframeOptions[0]);
  const [showForecast, setShowForecast] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(regionOptions[0]);
  const [selectedProgram, setSelectedProgram] = useState(programOptions[0]);

  const { chartSeries, xDomain, yDomain } = useMemo(() => {
    const baseDataset = chartSeriesByTimeframe[selectedTimeframe.value] ?? { actual: [], plan: [], forecast: [], xDomain: [], yDomain: [] };
    const regionFactor = regionFactors[selectedRegion.value] ?? 1;
    const programFactor = programFactors[selectedProgram.value] ?? 1;
    const adjustment = regionFactor * programFactor;

    const scaleSeries = series =>
      series.map(point => ({
        ...point,
        y: typeof point.y === "number" ? Math.round(point.y * adjustment) : point.y,
      }));

    const scaledActual = scaleSeries(baseDataset.actual);
    const scaledPlan = scaleSeries(baseDataset.plan);
    const scaledForecast = scaleSeries(baseDataset.forecast ?? []);

    const valueFormatter = ({ y }) => (typeof y === "number" ? formatCurrency(y) : "-");

    const scaledSeries = [
      {
        title: "Actual spend",
        type: "line",
        data: scaledActual,
        valueFormatter,
      },
      {
        title: "Planned spend",
        type: "line",
        data: scaledPlan,
        valueFormatter,
      },
    ];

    if (showForecast && scaledForecast.length) {
      scaledSeries.push({
        title: "Forecast (auto)",
        type: "line",
        data: scaledForecast,
        valueFormatter,
      });
    }

    const scaledYDomain = Array.isArray(baseDataset.yDomain) && baseDataset.yDomain.length === 2
      ? [baseDataset.yDomain[0] * adjustment, baseDataset.yDomain[1] * adjustment]
      : baseDataset.yDomain;

    return {
      chartSeries: scaledSeries,
      xDomain: baseDataset.xDomain,
      yDomain: scaledYDomain,
    };
  }, [selectedTimeframe, selectedRegion, selectedProgram, showForecast]);

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
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Spend trend",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const headerActions = (
    <SpaceBetween size="xs" direction="horizontal">
      <Toggle
        onChange={({ detail }) => setShowForecast(detail.checked)}
        checked={showForecast}
        ariaLabel="Show forecast overlay"
      >
        Show forecast overlay
      </Toggle>
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink} actions={headerActions}>Spend trend</Header>}
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Spend trend settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={3} variant="text-grid" borders="vertical">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Reporting period</Box>
            <Select
              selectedOption={selectedTimeframe}
              options={timeframeOptions}
              onChange={({ detail }) => setSelectedTimeframe(detail.selectedOption)}
              ariaLabel="Reporting period"
            />
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Region</Box>
            <Select
              selectedOption={selectedRegion}
              options={regionOptions}
              onChange={({ detail }) => setSelectedRegion(detail.selectedOption)}
              ariaLabel="Region"
            />
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Program</Box>
            <Select
              selectedOption={selectedProgram}
              options={programOptions}
              onChange={({ detail }) => setSelectedProgram(detail.selectedOption)}
              ariaLabel="Program"
            />
          </SpaceBetween>
        </ColumnLayout>
        <LineChart
          series={chartSeries}
          height={280}
          xTitle="Month"
          yTitle="Cumulative spend (CAD)"
          legendTitle="Data sets"
          ariaLabel="Spend vs plan chart"
          i18nStrings={lineChartI18nStrings}
          detailPopoverSeriesContent={({ series, y }) => ({
            key: series.title,
            value: formatCurrency(y),
          })}
          xDomain={xDomain}
          yDomain={yDomain}
          xScaleType="categorical"
          empty={
            <Box padding="m">
              No spend data for the selected period.
            </Box>
          }
        />
        <Box variant="awsui-key-label">
          Chart will source actuals from the transaction ledger and forecast from scenario engine once wired.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SimpleTrendWidget;







