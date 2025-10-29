import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  StatusIndicator,
  Box,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { usePortfolioCases } from "../PortfolioCaseContext.jsx";

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "$0";
  if (numeric >= 1_000_000) {
    return `$${(numeric / 1_000_000).toFixed(2)} M`;
  }
  if (numeric >= 1_000) {
    return `$${(numeric / 1_000).toFixed(0)} k`;
  }
  return `$${numeric.toLocaleString("en-CA")}`;
};

const formatVariance = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return "$0";
  if (Math.abs(numeric) >= 1_000_000) {
    return `${numeric >= 0 ? "+" : "-"}$${(Math.abs(numeric) / 1_000_000).toFixed(2)} M`;
  }
  if (Math.abs(numeric) >= 1_000) {
    return `${numeric >= 0 ? "+" : "-"}$${(Math.abs(numeric) / 1_000).toFixed(0)} k`;
  }
  return `${numeric >= 0 ? "+" : "-"}$${Math.abs(numeric).toLocaleString("en-CA")}`;
};

const MetricBadge = ({ label, value, description, status }) => (
  <Box
    padding="s"
    background="layer-1"
    borderRadius="medium"
    display="inline-flex"
    alignItems="center"
    justifyContent="space-between"
    width="100%"
  >
    <div>
      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-label)" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{value}</div>
      {description && (
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>{description}</div>
      )}
    </div>
    {status && <StatusIndicator type={status.type}>{status.label}</StatusIndicator>}
  </Box>
);

const SummaryMetricsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { filteredCases } = usePortfolioCases();

  const metrics = useMemo(() => {
    const activeCases = filteredCases.filter(
      item => item.financeStatus !== "closed" && item.openInterventions >= 0
    );
    const readyToClose = filteredCases.filter(
      item => item.financeStatus === "ok" && item.openInterventions === 0
    );
    const overspends = filteredCases.filter(item => item.financeStatus === "overspend");
    const totalActuals = filteredCases.reduce((sum, item) => sum + Number(item.fyActuals || 0), 0);
    const totalVariance = filteredCases.reduce((sum, item) => sum + Number(item.fyVariance || 0), 0);

    return [
      {
        id: "active",
        label: "Active cases",
        value: activeCases.length.toLocaleString("en-CA"),
        description: "Open or in progress",
      },
      {
        id: "readyToClose",
        label: "Ready to close",
        value: readyToClose.length.toLocaleString("en-CA"),
        description: "Finance + ILMP clean",
      },
      {
        id: "overspends",
        label: "Overspends",
        value: overspends.length.toLocaleString("en-CA"),
        status:
          overspends.length > 0
            ? { type: "error", label: "Action needed" }
            : { type: "success", label: "Clear" },
      },
      {
        id: "totalActuals",
        label: "Total FY Actuals",
        value: formatCurrency(totalActuals),
      },
      {
        id: "variance",
        label: "Variance (remaining)",
        value: formatVariance(totalVariance),
        status:
          totalVariance < 0
            ? { type: "error", label: "Over allocation" }
            : { type: "success", label: "Within allocation" },
      },
    ];
  }, [filteredCases]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Portfolio summary metrics",
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

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Snapshot of workload and finance posture for visible cases."}
        >
          {metadata.title ?? "Case summary"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Summary metrics settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <ColumnLayout columns={metrics.length >= 4 ? 4 : metrics.length || 1} variant="text-grid">
        {metrics.map(metric => (
          <MetricBadge key={metric.id} {...metric} />
        ))}
      </ColumnLayout>
    </BoardItem>
  );
};

export default SummaryMetricsWidget;
