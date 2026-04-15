import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  StatusIndicator,
  ProgressBar,
  Select,
  Link,
  Tabs,
  Table,
  LineChart,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useBudgetsData } from "./BudgetsDataContext.jsx";
import { apiFetch } from "../../../auth/apiClient";

const formatCurrency = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toLocaleString("en-CA")}` : "—";
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fiscalMonthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const lineChartI18nStrings = {
  detailPopoverDismissAriaLabel: "Dismiss",
  legendAriaLabel: "Burn-rate graph legend",
  xAxisAriaRoleDescription: "Months on the fiscal calendar",
  yAxisAriaRoleDescription: "Spend amounts in Canadian dollars",
  xTickFormatter: label => label,
  yTickFormatter: value => formatCurrency(value),
  xTickFormatterLabel: label => `Month ${label}`,
  yTickFormatterLabel: value => formatCurrency(value),
};

const labelForMonth = m => monthLabels[(m - 1 + 12) % 12];
const monthsForTimeframe = timeframe => {
  if (!timeframe) return fiscalMonthOrder;
  if (!timeframe.quarter) return fiscalMonthOrder;
  const quarterMap = {
    q1: [4, 5, 6],
    q2: [7, 8, 9],
    q3: [10, 11, 12],
    q4: [1, 2, 3],
  };
  return quarterMap[timeframe.quarter] || fiscalMonthOrder;
};

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
  const { pots, selectedPotId, activeVersion, selectedPotSource } = useBudgetsData();
  const [timeframeOptions, setTimeframeOptions] = useState([]);
  const [timeframe, setTimeframe] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState(null);
  const [planSeries, setPlanSeries] = useState([]);
  const [actualSeries, setActualSeries] = useState([]);
  const [graphError, setGraphError] = useState(null);

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

  const isDraftSelection = useMemo(() => selectedPotSource === "draft", [selectedPotSource]);

  const activeSelectedPot = useMemo(() => {
    if (!Array.isArray(pots) || !pots.length || isDraftSelection) return null;
    if (!selectedPotId) return null;
    const activePots = pots.filter(p => p.status !== "archived");
    const match = activePots.find(p => String(p.id) === String(selectedPotId));
    return match || null;
  }, [pots, selectedPotId, isDraftSelection]);

  const selectedPotAndDescendants = useMemo(() => {
    if (!activeSelectedPot) return [];
    if (!Array.isArray(pots) || !pots.length) return [activeSelectedPot.id];
    const childrenMap = new Map();
    pots.forEach(p => {
      const parent = p.parentId || p.parent_id || null;
      if (!parent) return;
      const list = childrenMap.get(String(parent)) || [];
      list.push(p.id);
      childrenMap.set(String(parent), list);
    });
    const acc = [];
    const stack = [activeSelectedPot.id];
    const seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(String(id))) continue;
      seen.add(String(id));
      acc.push(id);
      const kids = childrenMap.get(String(id)) || [];
      kids.forEach(k => stack.push(k));
    }
    return acc;
  }, [activeSelectedPot, pots]);

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
        const potQuery =
          selectedPotAndDescendants.length > 1
            ? `potIds=${selectedPotAndDescendants.map(id => encodeURIComponent(id)).join(",")}`
            : `potId=${encodeURIComponent(activeSelectedPot.id)}`;
        const resp = await apiFetch(`/api/finance/transactions?${potQuery}&limit=5000`, {
          signal: controller.signal,
        });
        if (!resp.ok) {
          throw new Error(`Transactions load failed (${resp.status})`);
        }
        const txs = await resp.json();
        setTransactions(txs || []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("[Finance] burn-rate interventions failed to load tx", err);
        setTxError(err.message || "Failed to load transactions");
        setTransactions([]);
      } finally {
        setLoadingTx(false);
      }
    };
    loadTx();
    return () => controller.abort();
  }, [activeSelectedPot, selectedPotAndDescendants]);

  const overview = useMemo(() => {
    if (!activeSelectedPot) {
      return null;
    }
    const scopeIds = selectedPotAndDescendants.length ? selectedPotAndDescendants : [activeSelectedPot.id];
    const sums = scopeIds.reduce(
      (acc, id) => {
        const pot = (pots || []).find(p => String(p.id) === String(id));
        if (!pot) return acc;
        acc.adjusted += Number(pot.adjusted ?? pot.adjusted_amount) || 0;
        acc.committed += Number(pot.committed) || 0;
        acc.actual += Number(pot.actual) || 0;
        acc.forecastVariance += Number(pot.forecastVariance) || 0;
        return acc;
      },
      { adjusted: 0, committed: 0, actual: 0, forecastVariance: 0 }
    );
    const burn = sums.adjusted > 0 ? sums.actual / sums.adjusted : 0;
    const remaining = sums.adjusted - sums.committed - sums.actual;
    const overBudget = remaining < 0;
    const varianceType = overBudget ? "error" : sums.forecastVariance > 0 ? "error" : sums.forecastVariance < 0 ? "success" : "info";
    const varianceLabel = overBudget
      ? "Over budget"
      : sums.forecastVariance > 0
        ? "Forecast above budget"
        : sums.forecastVariance < 0
          ? "Forecast below budget"
          : "On plan";
    return {
      name: activeSelectedPot.name,
      scopeCount: scopeIds.length,
      burnPct: Math.max(0, Math.min(100, Math.round(burn * 100))),
      remaining,
      varianceType,
      varianceLabel,
      varianceValue: overBudget ? Math.abs(remaining) : Math.abs(sums.forecastVariance || remaining),
      guardrail: activeSelectedPot.policyNotes || "Guardrails not documented.",
    };
  }, [activeSelectedPot, pots, selectedPotAndDescendants]);

  const planActualDelta = useMemo(() => {
    const lastPlan = planSeries?.[planSeries.length - 1]?.y || 0;
    const lastActual = actualSeries?.[actualSeries.length - 1]?.y || 0;
    return {
      plan: lastPlan,
      actual: lastActual,
      delta: lastActual - lastPlan,
    };
  }, [planSeries, actualSeries]);

  const actionsArea = (
    <Select
      selectedOption={timeframe}
      onChange={({ detail }) => {
        setTimeframe(detail.selectedOption);
      }}
      options={timeframeOptions}
      placeholder="Select period"
      selectedAriaLabel="Burn-rate timeframe"
      disabled={!timeframeOptions.length || isDraftSelection}
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

  useEffect(() => {
    const controller = new AbortController();
    const loadPlan = async () => {
      if (!activeSelectedPot || !timeframe) {
        setPlanSeries([]);
        setGraphError(null);
        return;
      }
      setGraphError(null);
      try {
        const resp = await apiFetch(`/api/finance/spend-curve?fiscalYear=${encodeURIComponent(timeframe.fiscalYear)}`, {
          signal: controller.signal,
        });
        if (!resp.ok) {
          throw new Error(`Plan load failed (${resp.status})`);
        }
        const curveData = await resp.json();
        const entries = Array.isArray(curveData.entries) ? curveData.entries : [];
        const totalAdjusted = selectedPotAndDescendants.reduce((sum, id) => {
          const match = (pots || []).find(p => String(p.id) === String(id));
          return sum + (Number(match?.adjusted ?? match?.adjusted_amount) || 0);
        }, 0);
        const pctByMonth = new Map(entries.map(entry => [Number(entry.month), Number(entry.pct)]));
        let cumulative = 0;
        const months = monthsForTimeframe(timeframe);
        const points = months.map(month => {
          cumulative += pctByMonth.get(month) || 0;
          return { x: labelForMonth(month), y: Math.round((totalAdjusted * cumulative) / 100) };
        });
        setPlanSeries(points);
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("[Finance] burn-rate plan load failed", err);
        setGraphError(err.message || "Failed to load spend plan");
        setPlanSeries([]);
      }
    };
    loadPlan();
    return () => controller.abort();
  }, [activeSelectedPot, timeframe, selectedPotAndDescendants, pots]);

  useEffect(() => {
    if (!timeframe) {
      setActualSeries([]);
      return;
    }
    const months = monthsForTimeframe(timeframe);
    const sums = new Map();
    filteredTransactions.forEach(tx => {
      const ts = tx.transactionDate || tx.createdAt || tx.updatedAt;
      if (!ts) return;
      const dt = new Date(ts);
      const month = dt.getUTCMonth() + 1;
      sums.set(month, (sums.get(month) || 0) + (Number(tx.amount) || 0));
    });
    let cumulative = 0;
    const points = months.map(month => {
      cumulative += sums.get(month) || 0;
      return { x: labelForMonth(month), y: Math.round(cumulative) };
    });
    setActualSeries(points);
  }, [timeframe, filteredTransactions]);

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

  const draftNotice = (
    <Alert type="info" header="Burn-rate is available for active budgets only">
      Select a published pot to view burn-rate insights. Draft pots do not have transactions or burn history until they
      are published.
    </Alert>
  );

  const graphMonths = useMemo(() => (timeframe ? monthsForTimeframe(timeframe) : []), [timeframe]);
  const graphSeries = useMemo(() => {
    const series = [];
    if (planSeries?.length) {
      series.push({
        title: "Plan",
        type: "line",
        data: planSeries,
        valueFormatter: ({ y }) => formatCurrency(y),
      });
    }
    if (actualSeries?.length) {
      series.push({
        title: "Actual",
        type: "line",
        data: actualSeries,
        valueFormatter: ({ y }) => formatCurrency(y),
      });
    }
    return series;
  }, [planSeries, actualSeries]);
  const graphXDomain = useMemo(() => graphMonths.map(labelForMonth), [graphMonths]);
  const graphYDomain = useMemo(() => {
    const maxVal =
      Math.max(
        ...graphSeries.flatMap(s => s.data.map(point => (typeof point.y === "number" ? point.y : Number(point.y) || 0))),
        0
      ) || 0;
    const padded = maxVal > 0 ? Math.ceil(maxVal / 1000) * 1000 : 1000;
    return [0, padded];
  }, [graphSeries]);

  const graphTabContent = isDraftSelection ? (
    draftNotice
  ) : !activeSelectedPot || !timeframe ? (
    <Box variant="p">Select an active budget pot to view burn-rate graph.</Box>
  ) : (
    <SpaceBetween size="s">
      {graphError && <StatusIndicator type="error">{graphError}</StatusIndicator>}
      {!graphSeries.length ? (
        <Box variant="p">{loadingTx ? "Loading transactions..." : "No spend data for this pot in the selected period."}</Box>
      ) : (
        <LineChart
          series={graphSeries}
          height={280}
          xTitle="Month"
          yTitle="Cumulative spend (CAD)"
          legendTitle="Data sets"
          ariaLabel="Burn-rate plan vs. actual"
          i18nStrings={lineChartI18nStrings}
          detailPopoverSeriesContent={({ series, y }) => ({
            key: series.title,
            value: formatCurrency(y),
          })}
          xDomain={graphXDomain}
          yDomain={graphYDomain}
          xScaleType="categorical"
          empty={<Box variant="p">No spend data for this pot in the selected period.</Box>}
        />
      )}
    </SpaceBetween>
  );

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: isDraftSelection ? (
        draftNotice
      ) : overview ? (
        <SpaceBetween size="s">
          <Box variant="strong">{overview.name}</Box>
          {overview.scopeCount > 1 && (
            <Box variant="awsui-key-label">{`Includes ${overview.scopeCount - 1} child pot${overview.scopeCount - 1 === 1 ? "" : "s"}`}</Box>
          )}
          <Box variant="awsui-key-label">Burn vs. adjusted budget</Box>
          <ProgressBar
            value={overview.burnPct}
            label={`${overview.burnPct}%`}
            additionalInfo={`${formatCurrency(overview.remaining)} remaining`}
            variant={overview.remaining < 0 ? "error" : "default"}
          />
          <StatusIndicator type={overview.varianceType}>
            {overview.varianceLabel}: {formatCurrency(overview.varianceValue)}
          </StatusIndicator>
          <Box variant="awsui-key-label">Plan vs. actual (period)</Box>
          <Box variant="p">
            Actual {formatCurrency(planActualDelta.actual)} vs plan {formatCurrency(planActualDelta.plan)} (
            {planActualDelta.delta >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(planActualDelta.delta))})
          </Box>
          <Box variant="p">{overview.guardrail}</Box>
        </SpaceBetween>
      ) : (
        <Box variant="p">Select an active budget pot to view burn-rate details.</Box>
      ),
    },
    {
      id: "graph",
      label: "Graph",
      content: graphTabContent,
    },
    {
      id: "interventions",
      label: "Interventions",
      content: isDraftSelection ? draftNotice : interventionsTab,
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
