import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  Table,
  SpaceBetween,
  ButtonDropdown,
  Select,
  CollectionPreferences,
  Pagination,
  TextFilter,
  StatusIndicator,
  Box,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-payments-requests-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-payments-requests-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;

const statusMeta = {
  draft: { label: "Draft", indicator: "pending" },
  awaiting_finance: { label: "Awaiting Finance", indicator: "info" },
  awaiting_confirmation: { label: "Awaiting Confirmation", indicator: "warning" },
  completed: { label: "Completed", indicator: "success" },
};

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "awaiting_finance", label: "Awaiting finance" },
  { value: "awaiting_confirmation", label: "Awaiting confirmation" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Draft" },
];

const columnDefinitions = [
  {
    id: "id",
    header: "Packet",
    cell: item => (
      <Link href="#" onFollow={event => event.preventDefault()}>
        {item.id}
      </Link>
    ),
  },
  {
    id: "ptmaRegion",
    header: "PTMA / Region",
    cell: item => item.ptmaRegion,
  },
  {
    id: "amount",
    header: "Amount",
    cell: item => `$${item.amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}`,
  },
  {
    id: "status",
    header: "Status",
    cell: item => {
      const meta = statusMeta[item.status] ?? { label: item.status, indicator: "info" };
      return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
    },
  },
  {
    id: "submittedOn",
    header: "Submitted",
    cell: item => item.submittedOn,
  },
  {
    id: "dueBy",
    header: "Due by",
    cell: item => item.dueBy,
  },
  {
    id: "tags",
    header: "Tags",
    cell: item => (item.tags?.length ? item.tags.join(", ") : "—"),
  },
];

const defaultPreferences = {
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: columnDefinitions.map(column => column.id),
};

const loadColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[Payments] failed to parse request column widths", error);
    return [];
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaultPreferences;
    }
    const { pageSize, visibleColumns } = parsed;
    return {
      pageSize: Number.isFinite(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
      visibleColumns: Array.isArray(visibleColumns)
        ? visibleColumns.filter(id => columnDefinitions.some(column => column.id === id))
        : defaultPreferences.visibleColumns,
    };
  } catch (error) {
    console.error("[Payments] failed to parse request preferences", error);
    return defaultPreferences;
  }
};

const PaymentRequestsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    requests,
    selectedRequestId,
    selectRequest,
  } = usePaymentsData();

  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [filteringText, setFilteringText] = useState("");
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths());
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const visibleColumns = useMemo(() => {
    const set = new Set(preferences.visibleColumns ?? columnDefinitions.map(column => column.id));
    return columnDefinitions.filter(column => set.has(column.id));
  }, [preferences.visibleColumns]);

  const filteredItems = useMemo(() => {
    return requests.filter(item => {
      if (statusFilter.value !== "all" && item.status !== statusFilter.value) {
        return false;
      }
      if (filteringText) {
        const lower = filteringText.toLowerCase();
        return (
          item.id.toLowerCase().includes(lower) ||
          item.ptmaRegion.toLowerCase().includes(lower) ||
          (item.tags ?? []).some(tag => tag.toLowerCase().includes(lower))
        );
      }
      return true;
    });
  }, [requests, statusFilter, filteringText]);

  const pageSize = preferences.pageSize ?? DEFAULT_PAGE_SIZE;
  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPageIndex, pageSize]);

  const selectedItems = useMemo(() => {
    if (!selectedRequestId) {
      return [];
    }
    return pagedItems.filter(item => item.id === selectedRequestId);
  }, [selectedRequestId, pagedItems]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Payment requests", metadata.aiContext ?? "");
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

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") return;
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          next.push({ id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = columnDefinitions[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          next.push({ id: column.id, width: numeric });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      try {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("[Payments] failed to persist request column widths", error);
      }
    }
  };

  const handleSelectionChange = ({ detail }) => {
    const id = detail.selectedItems?.[0]?.id ?? null;
    if (id !== selectedRequestId) {
      selectRequest(id);
    }
  };

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: columnDefinitions.map(column => ({
          id: column.id,
          visible: visibleColumns.some(visibleColumn => visibleColumn.id === column.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Page size",
        options: [5, 10, 20].map(value => ({ label: `${value} rows`, value })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: columnDefinitions.map(column => ({
          id: column.id,
          label: column.header,
          alwaysVisible: column.id === "id",
        })),
      }}
      onConfirm={({ detail }) => {
        const nextPreferences = {
          pageSize: detail.pageSize ?? pageSize,
          visibleColumns: detail.contentDisplay
            ? detail.contentDisplay.filter(entry => entry.visible).map(entry => entry.id)
            : preferences.visibleColumns,
        };
        setPreferences(nextPreferences);
        try {
          window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
        } catch (error) {
          console.error("[Payments] failed to persist request preferences", error);
        }
        if (Array.isArray(detail.columnWidths)) {
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
            try {
              window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
            } catch (error) {
              console.error("[Payments] failed to persist widths", error);
            }
          }
        }
        setCurrentPageIndex(1);
      }}
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

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={statusFilter}
                options={statusOptions}
                onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
              />
            </SpaceBetween>
          }
        >
          Payment request queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment request queue settings"
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
          items={pagedItems}
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={handleSelectionChange}
          columnDefinitions={visibleColumns.map(column => {
            const width = columnWidths.find(entry => entry.id === column.id)?.width;
            return width ? { ...column, width } : column;
          })}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Requests
            </Header>
          }
          filter={
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Find by packet ID, region, or tag"
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                setCurrentPageIndex(1);
              }}
              countText={`${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}`}
            />
          }
          preferences={preferencesComponent}
          pagination={pagination}
          empty={<Box padding="m">No payment packets match the current filters.</Box>}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default PaymentRequestsWidget;
