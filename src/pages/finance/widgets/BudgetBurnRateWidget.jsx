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
  Tabs,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useBudgetsData } from "./BudgetsDataContext.jsx";
import { apiFetch } from "../../../auth/apiClient";

const formatCurrency = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toLocaleString("en-CA")}` : "—";
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const buildTimeframesFromFiscalYear = fiscalYear => {
  if (!fiscalYear) return [];
  const parts = String(fiscalYear).split("-");
  if (parts.length !== 2) return [];
  const start = Number(parts[0]);
  const end = Number(parts[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end !== start + 1) return [];
  const label = `FY${start}-${String(end).slice(-2)}`;
  return [
    { label, value: `fy-${fiscalYear}`, fiscalYear, quarter: null },
    { label: `${label} Q1`, value: `fy-${fiscalYear}-q1`, fiscalYear, quarter: "q1" },
    { label: `${label} Q2`, value: `fy-${fiscalYear}-q2`, fiscalYear, quarter: "q2" },
    { label: `${label} Q3`, value: `fy-${fiscalYear}-q3`, fiscalYear, quarter: "q3" },
    { label: `${label} Q4`, value: `fy-${fiscalYear}-q4`, fiscalYear, quarter: "q4" },
  ];
};

const BudgetBurnRateWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { pots, selectedPotId, activeVersion } = useBudgetsData();
  const [timeframeOptions, setTimeframeOptions] = useState([]);
  const [timeframe, setTimeframe] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState(null);

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

  const activeSelectedPot = useMemo(() => {
    if (!Array.isArray(pots) || !pots.length) return null;
    const activePots = pots.filter(p => p.status !== "archived");
    const match = activePots.find(p => String(p.id) === String(selectedPotId));
    return match || activePots[0] || null;
  }, [pots, selectedPotId]);

  useEffect(() => {
    const fy = activeSelectedPot?.fiscalYear || activeVersion?.label || null;
    if (!fy) {
      setTimeframeOptions([]);
      setTimeframe(null);
      return;
    }
    const options = buildTimeframesFromFiscalYear(fy);
    setTimeframeOptions(options);
    setTimeframe(options[0] ?? null);
  }, [activeSelectedPot, activeVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const loadTx = async () => {
      if (!activeSelectedPot) {
        setTransactions([]);
        return;
      }
      setLoadingTx(true);
      setTxError(null);
      try {
        const resp = await apiFetch(`/api/finance/transactions?potId=${activeSelectedPot.id}&limit=5000`, {
          signal: controller.signal,
        });
        if (!resp.ok) {
          throw new Error(`Transactions load failed (${resp.status})`);
        }
        const txs = await resp.json();
        setTransactions(txs || []);
      } catch (err) {
        console.error("[Finance] burn-rate interventions failed to load tx", err);
        setTxError(err.message || "Failed to load transactions");
        setTransactions([]);
      } finally {
        setLoadingTx(false);
      }
    };
    loadTx();
    return () => controller.abort();
  }, [activeSelectedPot]);

  const overview = useMemo(() => {
    if (!activeSelectedPot) {
      return null;
    }
    const adjusted = Number(activeSelectedPot.adjusted) || 0;
    const actual = Number(activeSelectedPot.actual) || 0;
    const burn = adjusted > 0 ? actual / adjusted : 0;
    const remaining = Number.isFinite(activeSelectedPot.remaining) ? activeSelectedPot.remaining : adjusted - actual;
    const forecastVariance = Number(activeSelectedPot.forecastVariance);
    const varianceType = forecastVariance > 0 ? "error" : forecastVariance < 0 ? "success" : "info";
    const varianceLabel = forecastVariance > 0 ? "Forecast above budget" : forecastVariance < 0 ? "Forecast below budget" : "On plan";
    return {
      name: activeSelectedPot.name,
      burnPct: Math.max(0, Math.min(100, Math.round(burn * 100))),
      remaining,
      varianceType,
      varianceLabel,
      forecastVariance,
      guardrail: activeSelectedPot.policyNotes || "Guardrails not documented.",
    };
  }, [activeSelectedPot]);

  const actionsArea = (
    <Select
      selectedOption={timeframe}
      onChange={({ detail }) => {
        setTimeframe(detail.selectedOption);
      }}
      options={timeframeOptions}
      placeholder="Select period"
      selectedAriaLabel="Burn-rate timeframe"
      disabled={!timeframeOptions.length}
    />
  );

  const filteredTransactions = useMemo(() => {
    if (!timeframe || !transactions.length) return [];
    const startYear = Number(timeframe.fiscalYear.split("-")[0]);
    const fyStart = new Date(`${startYear}-04-01T00:00:00Z`);
    const fyEnd = new Date(`${startYear + 1}-04-01T00:00:00Z`);
    const now = new Date();
    const quarterSlices = {
      q1: [4, 6],
      q2: [7, 9],
      q3: [10, 12],
      q4: [1, 3],
    };
    const allowedMonths = timeframe.quarter
      ? (() => {
          const [start, end] = quarterSlices[timeframe.quarter] || [4, 12];
          const months = [];
          if (start <= end) {
            for (let m = start; m <= end; m += 1) months.push(m);
          } else {
            // Wrap for Q4
            for (let m = start; m <= 12; m += 1) months.push(m);
            for (let m = 1; m <= end; m += 1) months.push(m);
          }
          return new Set(months);
        })()
      : null;
    const includedStatuses = new Set(["submitted", "posted"]);
    return transactions
      .filter(tx => includedStatuses.has(String(tx.status || "").toLowerCase()))
      .filter(tx => {
        const ts = tx.transactionDate || tx.createdAt || tx.updatedAt;
        if (!ts) return false;
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return false;
        if (d < fyStart || d >= fyEnd) return false;
        if (d > now) return false;
        const month = d.getUTCMonth() + 1;
        if (allowedMonths && !allowedMonths.has(month)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.transactionDate || b.createdAt || b.updatedAt) - new Date(a.transactionDate || a.createdAt || a.updatedAt));
  }, [timeframe, transactions]);

  const interventionColumns = [
    {
      id: "date",
      header: "Date",
      cell: item => {
        const ts = item.transactionDate || item.createdAt || item.updatedAt;
        const d = ts ? new Date(ts) : null;
        return d ? d.toLocaleDateString() : "—";
      },
    },
    {
      id: "amount",
      header: "Amount",
      cell: item => formatCurrency(item.amount),
    },
    {
      id: "status",
      header: "Status",
      cell: item => <StatusIndicator type={item.status === "posted" ? "success" : "info"}>{item.status || "unknown"}</StatusIndicator>,
    },
    {
      id: "case",
      header: "Case",
      cell: item => (item.caseId ? <Link href={`/cases/${item.caseId}`}>Open case</Link> : "—"),
    },
    {
      id: "payment",
      header: "Payment",
      cell: item => <Link href={`/finance/payments/${item.id}`}>View payment</Link>,
    },
  ];

  const interventionsTab = (
    <SpaceBetween size="s">
      {txError && <StatusIndicator type="error">{txError}</StatusIndicator>}
      {!txError && filteredTransactions.length === 0 && !loadingTx ? (
        <Box variant="p">No transactions for this pot in the selected period.</Box>
      ) : (
        <Table
          items={filteredTransactions}
          columnDefinitions={interventionColumns}
          trackBy="id"
          variant="embedded"
          loading={loadingTx}
          empty={<Box variant="p">No transactions for this pot in the selected period.</Box>}
        />
      )}
    </SpaceBetween>
  );

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: overview ? (
        <SpaceBetween size="s">
          <Box variant="strong">{overview.name}</Box>
          <Box variant="awsui-key-label">Burn vs. adjusted budget</Box>
          <ProgressBar value={overview.burnPct} label={`${overview.burnPct}%`} additionalInfo={`${formatCurrency(overview.remaining)} remaining`} />
          <StatusIndicator type={overview.varianceType}>
            {overview.varianceLabel}: {formatCurrency(Math.abs(overview.forecastVariance))}
          </StatusIndicator>
          <Box variant="p">{overview.guardrail}</Box>
        </SpaceBetween>
      ) : (
        <Box variant="p">Select an active budget pot to view burn-rate details.</Box>
      ),
    },
    {
      id: "graph",
      label: "Graph",
      content: <Box variant="p">Graph placeholder</Box>,
    },
    {
      id: "interventions",
      label: "Interventions",
      content: interventionsTab,
    },
  ];

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
      <Tabs tabs={tabs} ariaLabel="Burn-rate insights tabs" />
    </BoardItem>
  );
};

export default BudgetBurnRateWidget;
