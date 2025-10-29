import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  BarChart,
  Button,
  ButtonDropdown,
  Header,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { usePortfolioCases } from "../PortfolioCaseContext.jsx";

const currencyFormatter = value =>
  typeof value === "number" ? `$${value.toLocaleString("en-CA")}` : "$0";

const chartI18nStrings = {
  filterLabel: "Filter data",
  filterPlaceholder: "Find agreement",
  filterSelectedAriaLabel: "selected",
  detailPopoverDismissAriaLabel: "Dismiss",
  legendAriaLabel: "Finance overview legend",
  chartAriaRoleDescription: "Stacked bar chart comparing allocation and spend",
  xAxisAriaRoleDescription: "Agreement identifier",
  yAxisAriaRoleDescription: "Funding amounts",
};

const FinanceOverviewWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    searchFilteredCases,
    selectedAgreements,
    toggleAgreementFilter,
    clearAgreementFilters,
  } = usePortfolioCases();

  const { series, xDomain, yDomain } = useMemo(() => {
    const totals = new Map();
    searchFilteredCases.forEach(item => {
      const record = totals.get(item.agreementNumber) || {
        x: item.agreementNumber,
        allocated: 0,
        actual: 0,
        committed: 0,
      };
      record.allocated += Number(item.allocated || 0);
      record.actual += Number(item.fyActuals || 0);
      record.committed += Number(item.committed || 0);
      totals.set(item.agreementNumber, record);
    });

    const points = Array.from(totals.values()).map(entry => {
      const actualCommitted = entry.actual + entry.committed;
      const remaining = Math.max(entry.allocated - actualCommitted, 0);
      return {
        ...entry,
        actualCommitted,
        remaining,
        variance: entry.allocated - entry.actual,
      };
    });

    const data = points.sort((a, b) => a.x.localeCompare(b.x));
    const max = data.reduce((acc, item) => Math.max(acc, item.allocated), 0);

    const series = [
      {
        title: "Actual + Committed",
        type: "bar",
        data: data.map(point => ({
          x: point.x,
          y: Math.min(point.actualCommitted, point.allocated),
          allocated: point.allocated,
          actual: point.actual,
          committed: point.committed,
          variance: point.variance,
        })),
        valueFormatter: currencyFormatter,
      },
      {
        title: "Remaining allocation",
        type: "bar",
        data: data.map(point => ({
          x: point.x,
          y: point.remaining,
          allocated: point.allocated,
          actual: point.actual,
          committed: point.committed,
          variance: point.variance,
        })),
        valueFormatter: currencyFormatter,
      },
    ];

    return {
      series,
      xDomain: data.map(point => point.x),
      yDomain: [0, max ? max * 1.05 : 1],
    };
  }, [searchFilteredCases]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Finance overview",
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

  const selectedAgreement = selectedAgreements?.[0] || null;
  const headerActions = selectedAgreement ? (
    <Button onClick={clearAgreementFilters} iconName="close">
      Clear filter
    </Button>
  ) : undefined;

  const description = metadata.description ?? "Allocated funding versus actual and committed costs per agreement.";
  const effectiveDescription = selectedAgreement
    ? `${description} Currently filtered to ${selectedAgreement}.`
    : description;

  const handleSelectionChange = ({ detail }) => {
    const agreement = detail?.datum?.x;
    if (agreement) {
      toggleAgreementFilter(agreement);
    }
  };

  const detailPopoverContent = ({ datum }) => (
    <div style={{ display: "grid", gap: "0.25rem" }}>
      <div><strong>Agreement</strong>: {datum.x}</div>
      <div><strong>Allocated</strong>: {currencyFormatter(datum.allocated)}</div>
      <div><strong>Actual</strong>: {currencyFormatter(datum.actual)}</div>
      <div><strong>Committed</strong>: {currencyFormatter(datum.committed)}</div>
      <div><strong>Total spend</strong>: {currencyFormatter(datum.actual + datum.committed)}</div>
      <div><strong>Variance</strong>: {currencyFormatter(datum.variance)}</div>
    </div>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={effectiveDescription}
          actions={headerActions}
        >
          {metadata.title ?? "Finance overview"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Finance overview settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <BarChart
        series={series}
        stackedBars
        xDomain={xDomain}
        yDomain={yDomain}
        i18nStrings={chartI18nStrings}
        height={320}
        detailPopoverContent={detailPopoverContent}
        onSelectionChange={handleSelectionChange}
        ariaLabel="Finance overview by agreement"
      />
    </BoardItem>
  );
};

export default FinanceOverviewWidget;
