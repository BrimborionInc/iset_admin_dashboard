import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Badge,
  Box,
  Button,
  ButtonDropdown,
  CollectionPreferences,
  Header,
  Icon,
  Link,
  Pagination,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { usePortfolioCases } from "../PortfolioCaseContext.jsx";

const COLUMN_WIDTHS_KEY = "iset-portfolio-cases-table-widths-v1";
const PREFERENCES_KEY = "iset-portfolio-cases-table-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;

const financeStatusMeta = {
  ok: {
    icon: "status-positive",
    color: "green",
    label: "Costs mapped",
    tooltip: "All interventions mapped to active pots",
  },
  "needs-mapping": {
    icon: "status-info",
    color: "blue",
    label: "Needs mapping",
    tooltip: "At least one intervention lacks a pot mapping",
  },
  overspend: {
    icon: "status-negative",
    color: "red",
    label: "Overspend",
    tooltip: "One or more pots exceeded allocation",
  },
};

const formatCurrency = value =>
  typeof value === "number" ? `$${value.toLocaleString("en-CA")}` : "$0";

const baseColumns = [
  {
    id: "client",
    header: "Client",
    cell: item => (
      <Link href={item.caseHref} onFollow={event => event.preventDefault()}>
        {item.clientName}
      </Link>
    ),
    minWidth: 180,
    isRowHeader: true,
  },
  {
    id: "owner",
    header: "Owner",
    cell: item => item.ownerName ?? "Unassigned",
    minWidth: 160,
  },
  {
    id: "agreementNumber",
    header: "Agreement #",
    cell: item => item.agreementNumber,
    minWidth: 140,
  },
  {
    id: "actionPlanStart",
    header: "Action Plan Start",
    cell: item => new Date(item.actionPlanStart).toLocaleDateString(),
    minWidth: 150,
  },
  {
    id: "interventions",
    header: "Interventions",
    cell: item => `${item.openInterventions} / ${item.totalInterventions}`,
    minWidth: 130,
  },
  {
    id: "financeStatus",
    header: "Finance Status",
    cell: item => {
      const meta = financeStatusMeta[item.financeStatus] ?? financeStatusMeta.ok;
      return (
        <Badge color={meta.color} title={meta.tooltip}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <Icon name={meta.icon} />
            {meta.label}
          </span>
        </Badge>
      );
    },
    minWidth: 190,
  },
  {
    id: "fyActuals",
    header: "FY Actuals",
    cell: item => formatCurrency(item.fyActuals),
    minWidth: 140,
  },
  {
    id: "fyVariance",
    header: "FY Variance",
    cell: item => {
      const value = Number(item.fyVariance || 0);
      const positive = value >= 0;
      return (
        <Badge color={positive ? "green" : "red"}>
          {positive ? "+" : "-"}${Math.abs(value).toLocaleString("en-CA")}
        </Badge>
      );
    },
    minWidth: 140,
  },
];

const baseColumnIds = baseColumns.map(column => column.id);

const loadColumnWidths = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") return null;
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          return { id, width: numeric };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return {
      pageSize: DEFAULT_PAGE_SIZE,
      visibleColumns: [...baseColumnIds],
    };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return {
        pageSize: DEFAULT_PAGE_SIZE,
        visibleColumns: [...baseColumnIds],
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {
        pageSize: DEFAULT_PAGE_SIZE,
        visibleColumns: [...baseColumnIds],
      };
    }
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => baseColumnIds.includes(id))
      : [...baseColumnIds];
    const pageSize = Number.isFinite(parsed.pageSize) ? parsed.pageSize : DEFAULT_PAGE_SIZE;
    return {
      pageSize,
      visibleColumns: visibleColumns.length ? visibleColumns : [...baseColumnIds],
    };
  } catch {
    return {
      pageSize: DEFAULT_PAGE_SIZE,
      visibleColumns: [...baseColumnIds],
    };
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_KEY);
    }
  } catch {
    // ignore persistence issues in scaffold mode
  }
};

const persistPreferences = preferences => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // ignore persistence issues in scaffold mode
  }
};

const CasesTableWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const history = useHistory();
  const {
    filteredCases,
    searchText,
    setSearchText,
    selectedAgreements,
    clearAgreementFilters,
  } = usePortfolioCases();

  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths());
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef(preferences);

  const columnsToRender = useMemo(() => {
    const visibleSet = new Set(preferences.visibleColumns);
    return baseColumns
      .filter(column => visibleSet.has(column.id))
      .map(column => {
        const storedWidth = columnWidths.find(entry => entry.id === column.id);
        return storedWidth ? { ...column, width: storedWidth.width } : column;
      });
  }, [preferences.visibleColumns, columnWidths]);

  const pageSize = preferences.pageSize ?? DEFAULT_PAGE_SIZE;
  const pagesCount = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPageIndex, pageSize]);

  useEffect(() => {
    setCurrentPageIndex(previous => {
      const maxPage = Math.max(1, Math.ceil(filteredCases.length / pageSize));
      return previous > maxPage ? maxPage : previous;
    });
  }, [filteredCases, pageSize]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Portfolio cases table",
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

  const handlePreferencesConfirm = ({ detail }) => {
    const nextVisible = detail.contentDisplay
      ? detail.contentDisplay.filter(entry => entry.visible).map(entry => entry.id)
      : preferences.visibleColumns;
    const normalisedVisible = baseColumnIds.filter(id => nextVisible.includes(id));
    const nextPreferences = {
      pageSize: detail.pageSize ?? pageSize,
      visibleColumns: normalisedVisible.length ? normalisedVisible : [...baseColumnIds],
    };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    persistPreferences(nextPreferences);

    if (Array.isArray(detail.columnWidths) && detail.columnWidths.length) {
      const widths = detail.columnWidths
        .map(entry => {
          const numeric = Number(entry.width);
          return typeof entry.id === "string" && Number.isFinite(numeric)
            ? { id: entry.id, width: numeric }
            : null;
        })
        .filter(Boolean);
      if (widths.length) {
        setColumnWidths(widths);
        persistColumnWidths(widths);
      }
    }
    setCurrentPageIndex(1);
  };

  const handleColumnWidthsChange = ({ detail }) => {
    const resolved = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        const numeric = Number(entry?.width);
        if (typeof entry?.id === "string" && Number.isFinite(numeric)) {
          resolved.push({ id: entry.id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = baseColumns[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          resolved.push({ id: column.id, width: numeric });
        }
      });
    }
    if (resolved.length) {
      setColumnWidths(resolved);
      persistColumnWidths(resolved);
    }
  };

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: baseColumns.map(column => ({
          id: column.id,
          visible: preferences.visibleColumns.includes(column.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Page size",
        options: [5, 10, 20].map(value => ({ value, label: `${value} rows` })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: baseColumns.map(column => ({
          id: column.id,
          label: column.header,
          alwaysVisible: column.id === "client",
        })),
      }}
      onConfirm={handlePreferencesConfirm}
    />
  );

  const pagination = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
      disabled={pagesCount <= 1}
    />
  );

  const description = metadata.description ?? "Review and open ISET cases that match your filters.";
  const selectedAgreement = selectedAgreements?.[0] || null;
  const effectiveDescription = selectedAgreement
    ? `${description} Filtered to agreement ${selectedAgreement}.`
    : description;
  const headerActions = selectedAgreement ? (
    <Button iconName="close" onClick={clearAgreementFilters}>
      Clear filter
    </Button>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={effectiveDescription}
          actions={headerActions}
        >
          {metadata.title ?? "Cases"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Cases table settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <TextFilter
          filteringText={searchText}
          filteringPlaceholder="Search by client, owner, or agreement"
          onChange={({ detail }) => {
            setSearchText(detail.filteringText);
            setCurrentPageIndex(1);
          }}
          countText={`${filteredCases.length} match${filteredCases.length === 1 ? "" : "es"}`}
        />
        <Table
          trackBy="id"
          columnDefinitions={columnsToRender}
          items={pagedItems}
          resizableColumns
          variant="embedded"
          header={<Header variant="h3" counter={`(${filteredCases.length})`}>ISET Cases</Header>}
          empty={<Box padding="m">No cases match the current filters.</Box>}
          pagination={pagination}
          preferences={preferencesComponent}
          onColumnWidthsChange={handleColumnWidthsChange}
          onRowClick={({ detail }) => {
            const caseId = detail?.item?.id;
            if (caseId) {
              history.push(`/cases/${caseId}`);
            }
          }}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default CasesTableWidget;
