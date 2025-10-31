import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const toAmount = value => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.round(numeric * 100) / 100;
  }
  return 0;
};

const formatCurrency = value => {
  const numeric = toAmount(value);
  const sign = numeric < 0 ? "-$" : "$";
  const absolute = Math.abs(numeric);
  return `${sign}${absolute.toLocaleString("en-CA")}`;
};

const formatDate = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};

const COLUMN_WIDTHS_STORAGE_KEY = "caseworking-finance-panel-column-widths-v1";
const ALL_COLUMN_IDS = ["name", "allocated", "committed", "actual", "status"];

const loadStoredColumnWidths = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") return null;
        const id = typeof entry.id === "string" ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) return null;
        return { id, width };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("[FinancePanelWidget] failed to read stored column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") return;
  try {
    if (!Array.isArray(widths) || !widths.length) {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    }
  } catch (error) {
    console.warn("[FinancePanelWidget] failed to persist column widths", error);
  }
};

const FinancePanelWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData, refresh } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Finance overview", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const financeSummary = caseData?.finance;
  const rows = useMemo(() => {
    if (!financeSummary || !Array.isArray(financeSummary.pots)) {
      return [];
    }
    return financeSummary.pots
      .map(pot => {
        const allocated = toAmount(pot.allocated);
        const committed = toAmount(pot.committed);
        const actual = toAmount(pot.actual);
        return {
          id: pot.id || pot.name || "",
          name: pot.name || "Budget pot",
          allocated,
          committed,
          actual,
          variance: allocated - actual,
        };
      })
      .filter(item => item.name);
  }, [financeSummary]);

  const totals = useMemo(() => {
    if (!financeSummary && !rows.length) return null;
    const sum = (list, key) =>
      list.reduce((acc, item) => acc + (Number.isFinite(Number(item[key])) ? Number(item[key]) : 0), 0);

    const pickSummaryValue = (...candidates) => {
      const candidate = candidates.find(value => Number.isFinite(Number(value)));
      if (candidate === undefined) return undefined;
      return toAmount(candidate);
    };

    const allocatedFromSummary = pickSummaryValue(financeSummary?.allocated);
    const committedFromSummary = pickSummaryValue(financeSummary?.committed);
    const actualFromSummary = pickSummaryValue(
      financeSummary?.actuals,
      financeSummary?.actual,
      financeSummary?.spent
    );

    const allocated = allocatedFromSummary ?? sum(rows, "allocated");
    const committed = committedFromSummary ?? sum(rows, "committed");
    const actual = actualFromSummary ?? sum(rows, "actual");
    const variance = toAmount(allocated - actual);

    const hasValues = rows.length > 0 || allocated !== 0 || committed !== 0 || actual !== 0 || variance !== 0;

    if (!hasValues) return null;

    return { allocated, committed, actual, variance };
  }, [financeSummary, rows]);

  const tableItems = useMemo(() => {
    if (!totals) {
      return rows;
    }
    const shouldRenderTotals = rows.length > 0 || totals.allocated || totals.committed || totals.actual;
    if (!shouldRenderTotals) {
      return rows;
    }
    return [
      ...rows,
      {
        id: "__totals",
        name: "Totals",
        allocated: totals.allocated,
        committed: totals.committed,
        actual: totals.actual,
        variance: totals.variance,
        isTotals: true,
      },
    ];
  }, [rows, totals]);

  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    persistColumnWidths(columnWidths);
  }, [columnWidths]);

  const columnWidthsMap = useMemo(() => {
    const map = new Map();
    columnWidths.forEach(entry => {
      if (!entry || typeof entry !== "object") return;
      const { id, width } = entry;
      if (ALL_COLUMN_IDS.includes(id) && Number.isFinite(Number(width))) {
        map.set(id, Number(width));
      }
    });
    return map;
  }, [columnWidths]);

  const asOfDate = financeSummary?.asOfDate || financeSummary?.as_of_date || null;

  const baseColumns = useMemo(
    () => [
      {
        id: "name",
        header: "Budget pot",
        isRowHeader: true,
        cell: item => (item.isTotals ? <strong>{item.name || "Totals"}</strong> : item.name || "Budget pot"),
      },
      {
        id: "allocated",
        header: "Allocated",
        cell: item => (item.isTotals ? <strong>{formatCurrency(item.allocated)}</strong> : formatCurrency(item.allocated)),
      },
      {
        id: "committed",
        header: "Committed",
        cell: item => (item.isTotals ? <strong>{formatCurrency(item.committed)}</strong> : formatCurrency(item.committed)),
      },
      {
        id: "actual",
        header: "Actual",
        cell: item => (item.isTotals ? <strong>{formatCurrency(item.actual)}</strong> : formatCurrency(item.actual)),
      },
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={item.variance >= 0 ? "success" : "error"}>
            {item.variance >= 0 ? "Within allocation" : "Overspend"}
          </StatusIndicator>
        ),
      },
    ],
    []
  );

  const tableColumns = useMemo(
    () =>
      baseColumns.map(column =>
        columnWidthsMap.has(column.id)
          ? { ...column, width: columnWidthsMap.get(column.id) }
          : column
      ),
    [baseColumns, columnWidthsMap]
  );

  const visibleColumnDefinitions = useMemo(() => tableColumns, [tableColumns]);

  const applyColumnWidthUpdates = useCallback(entries => {
    if (!Array.isArray(entries) || entries.length === 0) {
      setColumnWidths([]);
      return;
    }
    setColumnWidths(prev => {
      const map = new Map();
      prev.forEach(item => {
        if (item && ALL_COLUMN_IDS.includes(item.id) && Number.isFinite(Number(item.width))) {
          map.set(item.id, Number(item.width));
        }
      });
      entries.forEach(entry => {
        if (!entry || typeof entry !== "object") return;
        const { id, width } = entry;
        if (ALL_COLUMN_IDS.includes(id) && Number.isFinite(Number(width))) {
          map.set(id, Number(width));
        }
      });
      return ALL_COLUMN_IDS.filter(id => map.has(id)).map(id => ({ id, width: map.get(id) }));
    });
  }, []);

  const handleColumnWidthsChange = useCallback(
    ({ detail }) => {
      if (!detail) return;
      const next = [];
      if (Array.isArray(detail.columnWidths)) {
        detail.columnWidths.forEach(entry => {
          if (!entry || typeof entry !== "object") return;
          const { id, width } = entry;
          if (ALL_COLUMN_IDS.includes(id) && Number.isFinite(Number(width))) {
            next.push({ id, width: Number(width) });
          }
        });
      } else if (Array.isArray(detail.widths)) {
        detail.widths.forEach((width, index) => {
          const column = visibleColumnDefinitions[index];
          if (!column) return;
          if (Number.isFinite(Number(width))) {
            next.push({ id: column.id, width: Number(width) });
          }
        });
      }
      if (next.length) {
        applyColumnWidthUpdates(next);
      }
    },
    [visibleColumnDefinitions, applyColumnWidthUpdates]
  );

  const defaultDescription = typeof metadata.description === "string" ? metadata.description.trim() : "";

  const headerDescription = useMemo(() => {
    const parts = [];
    if (defaultDescription) {
      parts.push(
        <Box key="description">
          {defaultDescription}
        </Box>
      );
    }
    if (asOfDate) {
      parts.push(
        <Box key="as-of" fontSize="body-s" color="text-body-secondary">
          As of {formatDate(asOfDate)}
        </Box>
      );
    }
    if (!parts.length) return undefined;
    if (parts.length === 1) return parts[0];
    return (
      <SpaceBetween size="xs">
        {parts}
      </SpaceBetween>
    );
  }, [defaultDescription, asOfDate]);

  const handleRefresh = useCallback(async () => {
    if (refreshing || typeof refresh !== "function") {
      return;
    }
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.warn("[FinancePanelWidget] failed to refresh case data", error);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

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
          description={headerDescription}
          actions={
            <Button
              variant="icon"
              iconName="refresh"
              ariaLabel="Refresh finance data"
              onClick={handleRefresh}
              disabled={refreshing || typeof refresh !== "function"}
            />
          }
        >
          {metadata.title ?? "Finance panel"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Finance panel settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Table
          trackBy="id"
          variant="embedded"
          wrapLines
          stickyHeader
          resizableColumns
          columnDefinitions={visibleColumnDefinitions}
          items={tableItems}
          onColumnWidthsChange={handleColumnWidthsChange}
          empty={<Box padding="m">No finance data recorded yet.</Box>}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default FinancePanelWidget;
