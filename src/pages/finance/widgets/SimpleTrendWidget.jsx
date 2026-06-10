import React, { useMemo, useState, useEffect } from "react";
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
import { apiFetch } from "../../../auth/apiClient";

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const fiscalMonthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

const buildTimeframeOptionsFromYears = fiscalYears => {
  if (!Array.isArray(fiscalYears) || !fiscalYears.length) return [];
  const formatLabel = start => `FY${start}-${(start + 1).toString().slice(-2)}`;
  const optionsForYear = startYear => ([
    { label: formatLabel(startYear), value: `fy${startYear}`, fiscalYear: `${startYear}-${startYear + 1}`, quarter: null },
    { label: `${formatLabel(startYear)} Q1`, value: `fy${startYear}-q1`, fiscalYear: `${startYear}-${startYear + 1}`, quarter: "q1" },
    { label: `${formatLabel(startYear)} Q2`, value: `fy${startYear}-q2`, fiscalYear: `${startYear}-${startYear + 1}`, quarter: "q2" },
    { label: `${formatLabel(startYear)} Q3`, value: `fy${startYear}-q3`, fiscalYear: `${startYear}-${startYear + 1}`, quarter: "q3" },
    { label: `${formatLabel(startYear)} Q4`, value: `fy${startYear}-q4`, fiscalYear: `${startYear}-${startYear + 1}`, quarter: "q4" },
  ]);
  const years = fiscalYears
    .map(fy => {
      const parts = fy.split("-");
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end !== start + 1) return null;
      return start;
    })
    .filter((v, idx, arr) => v !== null && arr.indexOf(v) === idx)
    .sort((a, b) => b - a);
  return years.flatMap(optionsForYear);
};

const programOptions = [
  { label: "ISET", value: "iset" },
];

const programFactors = {
  iset: 1,
};

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
  const [timeframeOptions, setTimeframeOptions] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState(null);
  const [showForecast, setShowForecast] = useState(true);
  const [potOptions, setPotOptions] = useState([{ label: "All pots", value: "all" }]);
  const [selectedPot, setSelectedPot] = useState({ label: "All pots", value: "all" });
  const [selectedProgram, setSelectedProgram] = useState(programOptions[0]);
  const [planSeries, setPlanSeries] = useState([]);
  const [planYMax, setPlanYMax] = useState(0);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [actualSeries, setActualSeries] = useState([]);
  const [loadingActuals, setLoadingActuals] = useState(false);
  const [actualError, setActualError] = useState(null);
  const [forecastSeries, setForecastSeries] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState(null);

  // Load budget pots for selector and total calculations
  useEffect(() => {
    const controller = new AbortController();
    const loadPots = async () => {
      try {
        const resp = await apiFetch("/api/finance/budget-pots", { signal: controller.signal });
        if (!resp.ok) {
          throw new Error(`Pots load failed (${resp.status})`);
        }
        const pots = await resp.json();
        const options = [{ label: "All pots", value: "all" }].concat(
          (pots || []).map(p => ({
            label: p.code ? `${p.name} (${p.code})` : p.name,
            value: String(p.id),
            adjusted: Number(p.adjusted ?? p.adjusted_amount ?? 0),
          }))
        );
        setPotOptions(options);
        // Preserve selection if possible
        const match = options.find(opt => opt.value === selectedPot.value);
        if (!match) {
          setSelectedPot(options[0]);
        }
        const fiscalYears = Array.from(
          new Set(
            (pots || [])
              .map(p => p.fiscal_year || p.fiscalYear)
              .filter(Boolean)
          )
        );
        const tf = buildTimeframeOptionsFromYears(fiscalYears);
        setTimeframeOptions(tf);
        if (tf.length) {
          const keep = tf.find(opt => opt.value === selectedTimeframe?.value);
          setSelectedTimeframe(keep || tf[0]);
        } else {
          setSelectedTimeframe(null);
        }
      } catch (err) {
        console.error("[Finance] failed to load pots", err);
      }
    };
    loadPots();
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { chartSeries, xDomain, yDomain } = useMemo(() => {
    if (!selectedTimeframe) {
      return { chartSeries: [], xDomain: months, yDomain: [0, 100000] };
    }
    const actual = actualSeries.length ? actualSeries : [];
    const actualLine = {
      title: "Actual spend",
      type: "line",
      data: actual,
      valueFormatter: ({ y }) => (typeof y === "number" ? formatCurrency(y) : "-"),
    };
    const programFactor = programFactors[selectedProgram.value] ?? 1;
    const adjustment = programFactor;

    const applyAdjustment = series =>
      series.map(point => ({
        ...point,
        y: typeof point.y === "number" ? Math.round(point.y * adjustment) : point.y,
      }));

    const adjustedPlan = applyAdjustment(planSeries);
    const series = [actualLine];
    if (adjustedPlan.length) {
      series.push({
        title: "Planned spend",
        type: "line",
        data: adjustedPlan,
        valueFormatter: ({ y }) => (typeof y === "number" ? formatCurrency(y) : "-"),
      });
    }
    const adjustedForecast = applyAdjustment(forecastSeries);
    if (showForecast && adjustedForecast.length) {
      series.push({
        title: "Forecast (placeholder)",
        type: "line",
        data: adjustedForecast,
        valueFormatter: ({ y }) => (typeof y === "number" ? formatCurrency(y) : "-"),
      });
    }

    const maxY =
      Math.max(
        ...series.flatMap(s => s.data.map(point => (typeof point.y === "number" ? point.y : 0))),
        planYMax
      ) || 0;

    return {
      chartSeries: series,
      xDomain: months,
      yDomain: [0, Math.ceil(maxY / 100000) * 100000 || 100000],
    };
  }, [selectedTimeframe, selectedProgram, planSeries, planYMax, actualSeries, forecastSeries, showForecast]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPlan = async () => {
      setLoadingPlan(true);
      setPlanError(null);
      try {
        if (!selectedTimeframe) {
          setPlanSeries([]);
          setPlanYMax(0);
          setLoadingPlan(false);
          return;
        }
        const fiscalYear = selectedTimeframe.fiscalYear;
        // Load spend curve (fallback to default)
        const curveResp = await apiFetch(`/api/finance/spend-curve?fiscalYear=${encodeURIComponent(fiscalYear)}`, {
          signal: controller.signal,
        });
        if (!curveResp.ok) {
          throw new Error(`Curve load failed (${curveResp.status})`);
        }
        const curveData = await curveResp.json();
        const curve = Array.isArray(curveData.entries) ? curveData.entries : [];
        // Load total adjusted budget for selected pot scope
        let totalAdjusted = 0;
        const potsResp = await apiFetch("/api/finance/budget-pots", { signal: controller.signal });
        if (potsResp.ok) {
          const pots = await potsResp.json();
          const filtered = (pots || []).filter(p => p.is_active !== false);
          const scoped = selectedPot.value === "all" ? filtered : filtered.filter(p => String(p.id) === selectedPot.value);
          totalAdjusted = scoped.reduce((sum, p) => sum + (Number(p.adjusted ?? p.adjusted_amount) || 0), 0);
        }
        if (!Number.isFinite(totalAdjusted) || totalAdjusted <= 0) {
          totalAdjusted = 4200000; // fallback demo total
        }
        const pctByMonth = new Map(curve.map(entry => [Number(entry.month), Number(entry.pct)]));
        let cumulative = 0;
        const planPoints = fiscalMonthOrder.map(month => {
          const pct = pctByMonth.get(month) || 0;
          cumulative += pct;
          const label =
            month === 1 ? "Jan"
              : month === 2 ? "Feb"
              : month === 3 ? "Mar"
                : months[month - 4]; // month 4 -> Apr index 0
          return { x: label, y: Math.round((totalAdjusted * cumulative) / 100) };
        });

        // Quarter slicing if needed
        if (selectedTimeframe.quarter) {
          const quarterMap = {
            q1: planPoints.slice(0, 3),
            q2: planPoints.slice(3, 6),
            q3: planPoints.slice(6, 9),
            q4: planPoints.slice(9, 12),
          };
          const sliced = quarterMap[selectedTimeframe.quarter] || [];
          setPlanSeries(sliced);
          setPlanYMax(Math.max(...sliced.map(p => p.y), 0));
        } else {
          setPlanSeries(planPoints);
          setPlanYMax(Math.max(...planPoints.map(p => p.y), 0));
        }
      } catch (err) {
        console.error("[Finance] failed to load spend plan", err);
        setPlanError(err.message || "Failed to load spend plan");
        setPlanSeries([]);
      } finally {
        setLoadingPlan(false);
      }
    };
    loadPlan();
    return () => controller.abort();
  }, [selectedTimeframe, selectedPot]);

  useEffect(() => {
    const controller = new AbortController();
    const loadActuals = async () => {
      setLoadingActuals(true);
      setActualError(null);
      try {
        if (!selectedTimeframe) {
          setActualSeries([]);
          setLoadingActuals(false);
          return;
        }
        const fiscalYear = selectedTimeframe.fiscalYear;
        const startYear = Number(fiscalYear.slice(0, 4));
        const startDate = new Date(`${startYear}-04-01T00:00:00Z`);
        const endDate = new Date(`${startYear + 1}-04-01T00:00:00Z`);
        const now = new Date();
        const withinYear = now >= startDate && now < endDate;
        const currentMonth = now.getUTCMonth() + 1;
        let allowedMonths = [];
        if (withinYear) {
          if (currentMonth >= 4) {
            allowedMonths = fiscalMonthOrder.filter(m => m >= 4 && m <= currentMonth);
          } else {
            allowedMonths = fiscalMonthOrder.filter(m => (m >= 4 && m <= 12) || (m >= 1 && m <= currentMonth));
          }
        } else if (now >= endDate) {
          allowedMonths = fiscalMonthOrder;
        } else {
          allowedMonths = [];
        }
        const resp = await apiFetch("/api/finance/transactions?limit=5000", { signal: controller.signal });
        if (!resp.ok) {
          throw new Error(`Transactions load failed (${resp.status})`);
        }
        const txs = await resp.json();
        const monthLabel = m =>
          m === 1 ? "Jan" : m === 2 ? "Feb" : m === 3 ? "Mar" : months[m - 4];
        const filtered = (txs || []).filter(tx => {
          if (selectedPot.value !== "all" && String(tx.potId) !== String(selectedPot.value)) {
            return false;
          }
          const ts = tx.transactionDate || tx.createdAt || tx.updatedAt;
          if (!ts) return false;
          const dt = new Date(ts);
          return dt >= startDate && dt < endDate && dt <= now && tx.status === "posted";
        });
        const sums = new Map();
        filtered.forEach(tx => {
          const dt = new Date(tx.transactionDate || tx.createdAt || tx.updatedAt);
          const month = dt.getUTCMonth() + 1; // 1-12
          sums.set(month, (sums.get(month) || 0) + (Number(tx.amount) || 0));
        });
        let cumulative = 0;
        const points = allowedMonths.map(m => {
          cumulative += sums.get(m) || 0;
          return { x: monthLabel(m), y: cumulative };
        });
        // Fallback: if no actuals loaded and not within fiscal year, keep empty; if within fiscal year but allowedMonths empty (e.g., before FY start), keep empty.
        if (!points.length && !filtered.length && withinYear) {
          const month = now.getUTCMonth() + 1;
          const currentLabel = month === 1 ? "Jan" : month === 2 ? "Feb" : month === 3 ? "Mar" : months[month - 4] || "N/A";
          setActualSeries([{ x: currentLabel, y: 0 }]);
          setLoadingActuals(false);
          return;
        }
        if (selectedTimeframe.quarter) {
          const quarterSlices = { q1: [0, 3], q2: [3, 6], q3: [6, 9], q4: [9, 12] };
          const [start, end] = quarterSlices[selectedTimeframe.quarter] || [0, 12];
          setActualSeries(points.slice(start, end));
        } else {
          setActualSeries(points);
        }
      } catch (err) {
        console.error("[Finance] failed to load actuals", err);
        setActualError(err.message || "Failed to load actuals");
        setActualSeries([]);
      } finally {
        setLoadingActuals(false);
      }
    };
    loadActuals();
    return () => controller.abort();
  }, [selectedTimeframe, selectedPot]);

  useEffect(() => {
    const controller = new AbortController();
    const loadForecast = async () => {
      setLoadingForecast(true);
      setForecastError(null);
      try {
        if (!selectedTimeframe) {
          setForecastSeries([]);
          setLoadingForecast(false);
          return;
        }
        // Placeholder forecast mirrors plan for now
        setForecastSeries(planSeries);
        setLoadingForecast(false);
        return;
      } catch (err) {
        console.error("[Finance] failed to load forecast", err);
        setForecastError(err.message || "Failed to load forecast");
        setForecastSeries([]);
      } finally {
        setLoadingForecast(false);
      }
    };
    loadForecast();
    return () => controller.abort();
  }, [planSeries, selectedTimeframe]);

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
              placeholder="Select fiscal year"
              disabled={!timeframeOptions.length}
            />
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Budget pot</Box>
            <Select
              selectedOption={selectedPot}
              options={potOptions}
              onChange={({ detail }) => setSelectedPot(detail.selectedOption)}
              ariaLabel="Budget pot"
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
          empty={<Box padding="m">No spend data for the selected period.</Box>}
        />
        <Box variant="awsui-key-label">
          {loadingPlan
            ? "Loading spend plan..."
            : planError
              ? `Plan load error: ${planError}`
              : loadingActuals
                ? "Loading actuals..."
                : actualError
                  ? `Actuals load error: ${actualError}`
                  : loadingForecast
                    ? "Loading forecast..."
                    : forecastError
                      ? `Forecast load error: ${forecastError}`
                      : ""}
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SimpleTrendWidget;







