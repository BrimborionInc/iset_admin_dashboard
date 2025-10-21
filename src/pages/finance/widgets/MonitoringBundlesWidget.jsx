import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  StatusIndicator,
  FormField,
  Input,
  DatePicker,
  Button,
  Link,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useMonitoringData } from "./MonitoringDataContext.jsx";

const statusLabels = {
  building: { label: "Building", type: "in-progress" },
  delivered: { label: "Delivered", type: "success" },
  requested: { label: "Requested", type: "info" },
};

const COLUMN_WIDTHS_STORAGE_KEY = "finance-monitoring-bundles-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-monitoring-bundles-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
];
const ALL_COLUMN_IDS = ["label", "status", "documentCount", "targetDelivery", "requestedBy"];

const loadColumnWidths = () => {
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
    console.error("[FinanceMonitoring] failed to parse bundle column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("[FinanceMonitoring] failed to persist bundle column widths", error);
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
    }
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : 10;
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
      : ALL_COLUMN_IDS;
    return { pageSize, visibleColumns };
  } catch (error) {
    console.error("[FinanceMonitoring] failed to parse bundle preferences", error);
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
};

const MonitoringBundlesWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    bundles,
    selectedBundle,
    setSelectedBundleId,
    addBundle,
    updateBundleStatus,
  } = useMonitoringData();
  const [newBundleLabel, setNewBundleLabel] = useState("");
  const [newBundleRequestor, setNewBundleRequestor] = useState("");
  const [newBundleDue, setNewBundleDue] = useState("");

  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef({
    pageSize: initialPreferences.pageSize,
    visibleColumns: initialPreferences.visibleColumns,
  });

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Evidence bundles",
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

  const widthMap = useMemo(
    () => new Map(columnWidths.map(entry => [entry.id, entry.width])),
    [columnWidths]
  );

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "label",
        header: "Bundle",
        width: widthMap.get("label"),
        cell: item => item.label,
      },
      {
        id: "status",
        header: "Status",
        width: widthMap.get("status"),
        cell: item => {
          const status = statusLabels[item.status] ?? statusLabels.building;
          return <StatusIndicator type={status.type}>{status.label}</StatusIndicator>;
        },
      },
      {
        id: "documentCount",
        header: "Documents",
        width: widthMap.get("documentCount"),
        cell: item => item.documentCount,
      },
      {
        id: "targetDelivery",
        header: "Target delivery",
        width: widthMap.get("targetDelivery"),
        cell: item => item.targetDelivery,
      },
      {
        id: "requestedBy",
        header: "Requested by",
        width: widthMap.get("requestedBy"),
        cell: item => item.requestedBy,
      },
    ],
    [widthMap]
  );

  const columnDefinitions = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    return baseColumnDefinitions.filter(column => visibleSet.has(column.id));
  }, [baseColumnDefinitions, visibleColumns]);

  const pagesCount = Math.max(1, Math.ceil(bundles.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return bundles.slice(start, start + pageSize);
  }, [bundles, currentPageIndex, pageSize]);

  useEffect(() => {
    const currentPrefs = preferencesRef.current;
    if (
      currentPrefs.pageSize !== pageSize ||
      JSON.stringify(currentPrefs.visibleColumns) !== JSON.stringify(visibleColumns)
    ) {
      preferencesRef.current = { pageSize, visibleColumns };
      try {
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify({ pageSize, visibleColumns })
        );
      } catch (error) {
        console.error("[FinanceMonitoring] failed to persist bundle preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "label"
            ? "Bundle"
            : id === "status"
              ? "Status"
              : id === "documentCount"
                ? "Documents"
                : id === "targetDelivery"
                  ? "Target delivery"
                  : "Requested by",
      })),
    []
  );

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: columnPreferenceOptions.map(option => ({
          id: option.id,
          visible: visibleColumns.includes(option.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Rows per page",
        options: PAGE_SIZE_OPTIONS.map(option => ({ value: option.value, label: option.label })),
      }}
      contentDisplayPreference={{
        title: "Visible columns",
        options: columnPreferenceOptions,
      }}
      onConfirm={({ detail }) => {
        if (detail.pageSize && detail.pageSize !== pageSize) {
          setPageSize(detail.pageSize);
        }
        if (Array.isArray(detail.contentDisplay)) {
          const nextVisible = detail.contentDisplay
            .filter(entry => entry.visible)
            .map(entry => entry.id)
            .filter(id => ALL_COLUMN_IDS.includes(id));
          const visibleSet = new Set(nextVisible);
          visibleSet.add("label");
          const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
          setVisibleColumns(ordered);
        }
        if (Array.isArray(detail.columnWidths)) {
          const next = detail.columnWidths
            .map(entry => {
              if (!entry || typeof entry !== "object") return null;
              const numeric = Number(entry.width);
              if (typeof entry.id === "string" && Number.isFinite(numeric)) {
                return { id: entry.id, width: numeric };
              }
              return null;
            })
            .filter(Boolean);
          if (next.length) {
            setColumnWidths(next);
            persistColumnWidths(next);
          }
        }
        setCurrentPageIndex(1);
      }}
    />
  );

  const paginationComponent = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
      disabled={pagesCount <= 1}
    />
  );

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
      persistColumnWidths(next);
    }
  };

  const selectedRow = selectedBundle
    ? pagedItems.find(item => item.id === selectedBundle.id) ?? null
    : null;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Organise evidence bundles for audits and monitoring requests."
        >
          Evidence bundles
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Evidence bundles settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <Table
          items={pagedItems}
          trackBy="id"
          selectionType="single"
          selectedItems={selectedRow ? [selectedRow] : []}
          onSelectionChange={({ detail }) => setSelectedBundleId(detail.selectedItems?.[0]?.id ?? null)}
          columnDefinitions={columnDefinitions}
          variant="embedded"
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          preferences={preferencesComponent}
          pagination={paginationComponent}
          empty={<Box padding="m">No evidence bundles recorded yet.</Box>}
          header={
            <Header variant="h3" counter={`(${bundles.length})`}>
              Bundle tracker
            </Header>
          }
        />
        {selectedBundle ? (
          <SpaceBetween size="s">
            <Box variant="awsui-key-label">Selected bundle</Box>
            <Box variant="strong">{selectedBundle.label}</Box>
            <Box variant="p">
              Last updated:{" "}
              {selectedBundle.lastUpdated
                ? new Date(selectedBundle.lastUpdated).toLocaleString()
                : "Unknown"}
            </Box>
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => updateBundleStatus(selectedBundle.id, "building")}
                disabled={selectedBundle.status === "building"}
              >
                Mark building
              </Button>
              <Button
                onClick={() => updateBundleStatus(selectedBundle.id, "delivered")}
                disabled={selectedBundle.status === "delivered"}
              >
                Mark delivered
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        ) : (
          <Box variant="awsui-key-label">Select a bundle to update status.</Box>
        )}
        <SpaceBetween size="m">
          <Box variant="awsui-key-label">Create new bundle</Box>
          <FormField label="Bundle label">
            <Input
              value={newBundleLabel}
              onChange={({ detail }) => setNewBundleLabel(detail.value)}
              placeholder="e.g., Q4 Evidence Pull"
            />
          </FormField>
          <FormField label="Requested by">
            <Input
              value={newBundleRequestor}
              onChange={({ detail }) => setNewBundleRequestor(detail.value)}
              placeholder="e.g., ESDC Monitoring"
            />
          </FormField>
          <FormField label="Target delivery date">
            <DatePicker
              value={newBundleDue}
              onChange={({ detail }) => setNewBundleDue(detail.value)}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <Button
            iconName="add-plus"
            onClick={() => {
              addBundle({
                label: newBundleLabel || "Untitled bundle",
                requestedBy: newBundleRequestor || "Finance",
                targetDelivery: newBundleDue || new Date().toISOString().slice(0, 10),
              });
              setNewBundleLabel("");
              setNewBundleRequestor("");
              setNewBundleDue("");
              setCurrentPageIndex(1);
            }}
          >
            Create bundle
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default MonitoringBundlesWidget;

