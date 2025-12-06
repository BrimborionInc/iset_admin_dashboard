import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Select,
  Table,
  Badge,
  Box,
  SegmentedControl,
  StatusIndicator,
  Link,
  TextFilter,
  CollectionPreferences,
  Pagination,
  Button,
  Tabs,
  Modal,
  FormField,
  Input,
  Textarea,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useBudgetsData } from "./BudgetsDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-budget-hierarchy-column-widths-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
  { label: "50 rows", value: 50 },
];

const viewModeOptions = [
  { label: "Tree view", value: "tree" },
  { label: "Flat list", value: "flat" },
];

const riskFilterOptions = [
  { label: "All pots", value: "all" },
  { label: "Overrun risk", value: "overrun" },
  { label: "Underspend opportunity", value: "underspend" },
  { label: "Admin allocation > 15%", value: "admin" },
];

const formatCurrency = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toLocaleString("en-CA")}` : "-";
};

const loadStoredColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const id = typeof entry.id === "string" ? entry.id : null;
        const numericWidth = Number(entry.width);
        if (!id || !Number.isFinite(numericWidth)) {
          return null;
        }
        return { id, width: numericWidth };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[Budgets] failed to read stored column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!Array.isArray(widths) || widths.length === 0) {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    }
  } catch (error) {
    console.error("[Budgets] failed to persist column widths", error);
  }
};

const enrichMetrics = pot => {
  const remaining = pot.adjusted - pot.actual;
  const variance = pot.forecast - pot.adjusted;
  const burnRate = pot.adjusted > 0 ? pot.actual / pot.adjusted : 0;
  const target = pot.adminTargetPct;
  let adminPct = pot.adjusted > 0 ? pot.adminShare / pot.adjusted : 0;
  if (target !== null && target !== undefined) {
    const numeric = Number(target);
    if (Number.isFinite(numeric)) {
      adminPct = numeric > 1 ? numeric / 100 : numeric;
    }
  }
  let risk = "steady";
  if (variance > 0.05 * pot.adjusted) {
    risk = "overrun";
  } else if (remaining > 0.2 * pot.adjusted) {
    risk = "underspend";
  }
  if (adminPct > 0.15) {
    risk = risk === "overrun" ? "overrun-admin" : "admin";
  }
  return {
    ...pot,
    remaining,
    variance,
    burnRate,
    adminPct,
    risk,
  };
};

const buildTree = data => {
  const nodes = data.map(item => ({ ...item, children: [] }));
  const map = new Map(nodes.map(node => [node.id, node]));
  const roots = [];
  nodes.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const matchesRisk = (item, filterValue) => {
  switch (filterValue) {
    case "overrun":
      return item.risk === "overrun" || item.risk === "overrun-admin";
    case "underspend":
      return item.risk === "underspend";
    case "admin":
      return item.adminPct > 0.15 || item.risk === "admin" || item.risk === "overrun-admin";
    default:
      return true;
  }
};

const matchesText = (item, filterText) => {
  if (!filterText) {
    return true;
  }
  const target = filterText.toLowerCase();
  return [item.name, item.code, item.nodeType]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(target));
};

const filterTree = (nodes, filterValue, filterText) =>
  nodes
    .map(node => {
      const filteredChildren = node.children ? filterTree(node.children, filterValue, filterText) : [];
      const includeNode =
        matchesRisk(node, filterValue) && matchesText(node, filterText);
      if (includeNode || filteredChildren.length) {
        return { ...node, children: filteredChildren };
      }
      return null;
    })
    .filter(Boolean);

const flattenTree = nodes => {
  const result = [];
  const walk = items => {
    items.forEach(item => {
      const { children = [], ...rest } = item;
      result.push(rest);
      if (children.length) {
        walk(children);
      }
    });
  };
  walk(nodes);
  return result;
};

const findItemById = (items, id) => {
  const target = id != null ? String(id) : null;
  for (const item of items) {
    if (target !== null && String(item.id) === target) {
      return item;
    }
    if (item.children?.length) {
      const match = findItemById(item.children, target);
      if (match) {
        return match;
      }
    }
  }
  return null;
};

const ALL_COLUMN_IDS = [
  "pot",
  "approved",
  "adjusted",
  "committed",
  "actual",
  "remaining",
  "variance",
  "admin",
  "lifecycle",
  "risk",
];
const DRAFT_COLUMN_IDS = ["pot", "approved", "adjusted"];

const PREFERENCES_STORAGE_KEY = "finance-budget-hierarchy-preferences-v1";
const defaultPreferences = {
  viewMode: "flat",
  riskFilter: "all",
  filteringText: "",
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: ALL_COLUMN_IDS,
};

const loadStoredPreferences = () => {
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
    const result = { ...defaultPreferences };
    if (parsed.viewMode === "tree" || parsed.viewMode === "flat") {
      result.viewMode = parsed.viewMode;
    }
    if (typeof parsed.riskFilter === "string" && riskFilterOptions.some(option => option.value === parsed.riskFilter)) {
      result.riskFilter = parsed.riskFilter;
    }
    if (typeof parsed.filteringText === "string") {
      result.filteringText = parsed.filteringText;
    }
    const numericPageSize = Number(parsed.pageSize);
    if (PAGE_SIZE_OPTIONS.some(option => option.value === numericPageSize)) {
      result.pageSize = numericPageSize;
    }
    if (Array.isArray(parsed.visibleColumns)) {
      const sanitized = parsed.visibleColumns
        .map(value => (typeof value === "string" ? value : null))
        .filter(value => !!value && ALL_COLUMN_IDS.includes(value));
      if (sanitized.length) {
        const visibleSet = new Set(sanitized);
        visibleSet.add("pot");
        result.visibleColumns = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
      }
    }
    return result;
  } catch (error) {
    console.error("[Budgets] failed to read stored preferences", error);
    return defaultPreferences;
  }
};

const persistPreferences = preferences => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = {
      ...defaultPreferences,
      ...preferences,
      visibleColumns: Array.isArray(preferences.visibleColumns)
        ? Array.from(new Set(preferences.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))))
        : defaultPreferences.visibleColumns,
    };
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("[Budgets] failed to persist table preferences", error);
  }
};

const BudgetHierarchyWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    pots,
    drafts,
    selectedPotId,
    selectPot,
    selectedDraftId,
    setSelectedDraftId,
    createDraft,
    publishDraft,
  } = useBudgetsData();
  const [activeTab, setActiveTab] = useState("active");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftModalLabel, setDraftModalLabel] = useState("");
  const [draftModalNotes, setDraftModalNotes] = useState("");
  const [draftCreateSubmitting, setDraftCreateSubmitting] = useState(false);

  const draftOptions = useMemo(
    () =>
      (drafts || []).map(d => ({
        label: d.label,
        value: d.id,
        description: d.notes || "",
      })),
    [drafts]
  );

  useEffect(() => {
    if (activeTab === "drafts" && draftOptions.length && !selectedDraftId) {
      setSelectedDraftId(draftOptions[0].value);
    }
  }, [activeTab, draftOptions, selectedDraftId]);

  const selectedDraft = useMemo(
    () => (drafts || []).find(d => d.id === selectedDraftId) || null,
    [drafts, selectedDraftId]
  );

  const draftPots = useMemo(() => {
    if (!selectedDraft) return [];
    let payload = selectedDraft.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }
    const potsFromPayload = payload?.pots;
    if (!Array.isArray(potsFromPayload)) return [];
    return potsFromPayload.map(p => ({
      ...p,
      status: p.status || "draft",
    }));
  }, [selectedDraft]);

  const sourceData = activeTab === "drafts" ? draftPots : pots;
  const enrichedData = useMemo(() => sourceData.map(enrichMetrics), [sourceData]);
  const activeData = useMemo(
    () => enrichedData.filter(item => item.status !== "archived"),
    [enrichedData]
  );

  const initialPreferencesRef = useRef(loadStoredPreferences());
  const initialPrefs = initialPreferencesRef.current;

  const [viewMode, setViewMode] = useState(initialPrefs.viewMode);
  const [riskFilter, setRiskFilter] = useState(initialPrefs.riskFilter);
  const [expandedItems, setExpandedItems] = useState([]);
  const lastPresetRef = useRef({ viewMode: initialPrefs.viewMode, riskFilter: initialPrefs.riskFilter });
  const [filteringText, setFilteringText] = useState(initialPrefs.filteringText);
  const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const visibleSet = new Set(
      (initialPrefs.visibleColumns || []).filter(id => ALL_COLUMN_IDS.includes(id))
    );
    visibleSet.add("pot");
    const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
    return ordered.length ? ordered : ALL_COLUMN_IDS;
  });
  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());

const baseTree = useMemo(() => buildTree(activeData), [activeData]);
  const normalizedFilterText = filteringText.trim().toLowerCase();

  const filteredTree = useMemo(
    () => filterTree(baseTree, riskFilter, normalizedFilterText),
    [baseTree, riskFilter, normalizedFilterText]
  );
  const flattenedTree = useMemo(() => flattenTree(filteredTree), [filteredTree]);
  const flatItems = useMemo(() => {
    const items = [...flattenedTree];
    items.sort((a, b) => b.variance - a.variance);
    return items;
  }, [flattenedTree]);

  const totalMatches = viewMode === "tree" ? flattenedTree.length : flatItems.length;
  const pagedFlatItems = useMemo(() => {
    if (viewMode !== "flat") {
      return flatItems;
    }
    const start = (currentPageIndex - 1) * pageSize;
    return flatItems.slice(start, start + pageSize);
  }, [flatItems, currentPageIndex, pageSize, viewMode]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [viewMode, riskFilter, filteringText, pageSize]);

  useEffect(() => {
    if (activeTab !== "active") {
      return;
    }
    if (!flattenedTree.length) {
      if (selectedPotId !== null) {
        console.log("[Budgets] clearing selection; no items in active view");
        selectPot(null);
      }
      return;
    }
    const match = flattenedTree.some(item => String(item.id) === String(selectedPotId));
    if (!match) {
      console.log("[Budgets] active selection not found; defaulting to first item");
      selectPot(flattenedTree[0].id);
    }
  }, [flattenedTree, selectedPotId, selectPot, activeTab]);

  useEffect(() => {
    const listener = event => {
      const { viewId, presets } = event.detail || {};
      if (!viewId) {
        return;
      }
      const nextRisk = presets?.riskFilter;
      const nextView = presets?.viewMode;
      const alreadyApplied =
        (!nextRisk || nextRisk === lastPresetRef.current.riskFilter) &&
        (!nextView || nextView === lastPresetRef.current.viewMode);
      if (alreadyApplied) {
        return;
      }
      if (nextRisk && riskFilterOptions.some(option => option.value === nextRisk)) {
        setRiskFilter(nextRisk);
      }
      if (nextView && viewModeOptions.some(option => option.value === nextView)) {
        setViewMode(nextView);
      }
    };
    window.addEventListener("financeBudgets:viewLoaded", listener);
    return () => window.removeEventListener("financeBudgets:viewLoaded", listener);
  }, []);

  useEffect(() => {
    if (viewMode !== "tree") {
      return;
    }
    const availableIds = new Set(flattenedTree.map(item => item.id));
    setExpandedItems(prev => {
      const filtered = (prev ?? []).filter(entry => availableIds.has(entry.id));
      const baseline = filtered.length
        ? filtered
        : filteredTree.map(node => ({ id: node.id }));
      const prevIds = (prev ?? []).map(entry => entry.id);
      const nextIds = baseline.map(entry => entry.id);
      const isSame =
        prevIds.length === nextIds.length &&
        prevIds.every((id, index) => id === nextIds[index]);
      return isSame ? prev : baseline;
    });
  }, [viewMode, filteredTree, flattenedTree]);

useEffect(() => {
  lastPresetRef.current = { viewMode, riskFilter };
}, [viewMode, riskFilter]);

useEffect(() => {
  persistPreferences({ viewMode, riskFilter, filteringText, pageSize, visibleColumns });
}, [viewMode, riskFilter, filteringText, pageSize, visibleColumns]);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Budget hierarchy",
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

  const handleSelectionChange = ({ detail }) => {
    const next = detail.selectedItems?.[0];
    if (next?.id) {
      console.log("[Budgets] selecting pot", next.id, "in tab", activeTab);
      selectPot(next.id);
    }
  };

  const headerActions = (
    <SpaceBetween direction="horizontal" size="s">
      <SegmentedControl
        selectedId={viewMode}
        onChange={({ detail }) => {
          if (detail.selectedId) {
            setViewMode(detail.selectedId);
          }
        }}
        options={viewModeOptions.map(option => ({ id: option.value, text: option.label }))}
      />
      <Select
        selectedOption={riskFilterOptions.find(option => option.value === riskFilter)}
        onChange={({ detail }) => setRiskFilter(detail.selectedOption?.value ?? "all")}
        options={riskFilterOptions}
        placeholder="Filter pots"
        selectedAriaLabel="Risk filter"
      />
    </SpaceBetween>
  );

  const baseColumnDefinitions = useMemo(() => [
    {
      id: "pot",
      header: "Pot",
      cell: item => (
        <SpaceBetween size="xxs">
          <span>{item.name}</span>
          <Badge color="blue">{item.code}</Badge>
          <Box variant="awsui-key-label">{item.nodeType}</Box>
        </SpaceBetween>
      ),
    },
    {
      id: "approved",
      header: "Approved",
      cell: item => formatCurrency(item.approved),
    },
    {
      id: "adjusted",
      header: "Adjusted",
      cell: item => formatCurrency(item.adjusted),
    },
    {
      id: "committed",
      header: "Committed",
      cell: item => formatCurrency(item.committed),
    },
    {
      id: "actual",
      header: "Actual",
      cell: item => formatCurrency(item.actual),
    },
    {
      id: "remaining",
      header: "Remaining",
      cell: item => formatCurrency(item.remaining),
    },
    {
      id: "variance",
      header: "Forecast variance",
      cell: item => formatCurrency(item.variance),
    },
    {
      id: "admin",
      header: "Admin %",
      cell: item => `${Math.round(item.adminPct * 1000) / 10}%`,
    },
    {
      id: "lifecycle",
      header: "Status",
      cell: item => {
        const type =
          item.status === "draft"
            ? "warning"
            : item.status === "pending"
              ? "info"
              : item.status === "archived"
                ? "stopped"
                : "success";
        const label =
          item.status === "draft"
            ? "Draft"
            : item.status === "pending"
              ? "Pending publish"
              : item.status === "archived"
                ? "Archived"
                : "Published";
        return <StatusIndicator type={type}>{label}</StatusIndicator>;
      },
    },
    {
      id: "risk",
      header: "Pacing",
      cell: item => {
        const type =
          item.risk === "overrun" || item.risk === "overrun-admin"
            ? "error"
            : item.risk === "underspend"
              ? "warning"
              : item.risk === "admin"
                ? "info"
                : "success";
        const text =
          item.risk === "overrun-admin"
            ? "Overrun & admin review"
            : item.risk === "overrun"
              ? "Overrun risk"
              : item.risk === "underspend"
                ? "Underspend"
                : item.risk === "admin"
                  ? "Admin review"
                  : "On track";
        return <StatusIndicator type={type}>{text}</StatusIndicator>;
      },
    },
  ], []);

  const mergedColumnDefinitions = useMemo(() => {
    return baseColumnDefinitions.map(column => {
      const stored = columnWidths.find(entry => entry.id === column.id);
      if (stored?.width) {
        return { ...column, width: stored.width };
      }
      return column;
    });
  }, [baseColumnDefinitions, columnWidths]);

  const applyColumnWidthUpdates = useCallback(
    updates => {
      if (!Array.isArray(updates)) {
        setColumnWidths([]);
        persistColumnWidths([]);
        return;
      }
      const allowedIds = new Set(mergedColumnDefinitions.map(column => column.id));
      const tempMap = new Map();
      updates.forEach(entry => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const { id, width } = entry;
        if (!allowedIds.has(id)) {
          return;
        }
        const numericWidth = Number(width);
        if (Number.isFinite(numericWidth)) {
          tempMap.set(id, numericWidth);
        }
      });
      const ordered = [];
      mergedColumnDefinitions.forEach(column => {
        if (tempMap.has(column.id)) {
          ordered.push({ id: column.id, width: tempMap.get(column.id) });
        }
      });
      setColumnWidths(ordered);
      persistColumnWidths(ordered);
    },
    [mergedColumnDefinitions]
  );

  const columnDefinitionsForTable = useMemo(() => {
    const allowedIds =
      activeTab === "drafts" ? DRAFT_COLUMN_IDS : visibleColumns;
    const allowed = new Set(allowedIds);
    allowed.add("pot");
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns, activeTab]);

  const preferencesState = useMemo(
    () => ({
      pageSize,
      contentDisplay: mergedColumnDefinitions.map(column => ({
        id: column.id,
        visible: visibleColumns.includes(column.id),
      })),
      columnWidths,
    }),
    [pageSize, mergedColumnDefinitions, visibleColumns, columnWidths]
  );

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : column.id,
        alwaysVisible: column.id === "pot",
      })),
    [mergedColumnDefinitions]
  );

  const tableItems = viewMode === "tree" ? filteredTree : pagedFlatItems;
  const pagesCount =
    viewMode === "flat" ? Math.max(1, Math.ceil(flatItems.length / pageSize)) : 1;

  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(1);
    }
  }, [currentPageIndex, pagesCount]);

  const selectedItems = useMemo(() => {
    if (!selectedPotId) {
      return [];
    }
    const target = String(selectedPotId);
    if (viewMode === "tree") {
      const match = findItemById(tableItems, target);
      return match ? [match] : [];
    }
    const match = pagedFlatItems.find(item => String(item.id) === target);
    return match ? [match] : [];
  }, [selectedPotId, viewMode, tableItems, pagedFlatItems]);

  const expandableRows =
    viewMode === "tree"
      ? {
          getItemChildren: item => item.children ?? [],
          isItemExpandable: item => Boolean(item.children?.length),
          expandedItems,
          onExpandableItemToggle: ({ detail }) =>
            setExpandedItems(prev => {
              const set = new Set((prev ?? []).map(entry => entry.id));
              if (detail.expanded) {
                set.add(detail.item.id);
              } else {
                set.delete(detail.item.id);
              }
              return Array.from(set).map(id => ({ id }));
            }),
        }
      : undefined;

  const filterComponent = (
    <TextFilter
      filteringText={filteringText}
      onChange={({ detail }) => {
        setFilteringText(detail.filteringText);
        setCurrentPageIndex(1);
      }}
      filteringPlaceholder="Search budgets"
      countText={`${totalMatches} match${totalMatches === 1 ? "" : "es"}`}
    />
  );

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferencesState}
      pageSizePreference={{
        title: "Page size",
        options: PAGE_SIZE_OPTIONS.map(option => ({ value: option.value, label: option.label })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
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
          visibleSet.add("pot");
          const orderedVisible = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
          setVisibleColumns(orderedVisible);
        }
        if (Array.isArray(detail.columnWidths)) {
          applyColumnWidthUpdates(detail.columnWidths);
        }
        setCurrentPageIndex(1);
      }}
    />
  );

  const paginationComponent = (
    <Pagination
      currentPageIndex={viewMode === "flat" ? currentPageIndex : 1}
      pagesCount={pagesCount}
      disabled={viewMode !== "flat" || pagesCount <= 1}
      onChange={({ detail }) => {
        if (viewMode === "flat") {
          setCurrentPageIndex(detail.currentPageIndex);
        }
      }}
    />
  );

  const handleColumnWidthsChange = useCallback(
    ({ detail }) => {
      if (!detail) {
        return;
      }
      const next = [];
      if (Array.isArray(detail.columnWidths)) {
        detail.columnWidths.forEach(entry => {
          if (!entry || typeof entry !== "object") {
            return;
          }
          const { id, width } = entry;
          if (typeof id === "string" && Number.isFinite(Number(width))) {
            next.push({ id, width: Number(width) });
          }
        });
      } else if (Array.isArray(detail.widths)) {
        detail.widths.forEach((width, index) => {
          const column = columnDefinitionsForTable[index];
          if (!column) {
            return;
          }
          if (Number.isFinite(Number(width))) {
            next.push({ id: column.id, width: Number(width) });
          }
        });
      }
      if (next.length) {
        applyColumnWidthUpdates(next);
      }
    },
    [columnDefinitionsForTable, applyColumnWidthUpdates]
  );

  const handleCreateDraft = async () => {
    setDraftCreateSubmitting(true);
    try {
      const fallbackLabel = `Draft ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
      const label = draftModalLabel.trim() || fallbackLabel;
      const notes = draftModalNotes.trim() || "";
      const newId = await createDraft({ label, notes });
      if (newId) {
        setSelectedDraftId(newId);
      }
      setDraftModalOpen(false);
      setDraftModalLabel("");
      setDraftModalNotes("");
    } catch (err) {
      console.error("Failed to create draft", err);
    } finally {
      setDraftCreateSubmitting(false);
    }
  };

  const draftHeaderActions =
    activeTab === "drafts" ? (
      <SpaceBetween direction="horizontal" size="xs">
        <Select
          selectedOption={
            selectedDraftId ? draftOptions.find(option => option.value === selectedDraftId) || null : null
          }
          onChange={({ detail }) => setSelectedDraftId(detail.selectedOption?.value ?? null)}
          options={draftOptions}
          placeholder="View draft"
          empty="No drafts saved yet"
        />
        <Button
          iconName="add-plus"
          onClick={() => {
            setDraftModalOpen(true);
            setDraftModalLabel("");
            setDraftModalNotes("");
          }}
        >
          New draft
        </Button>
        <Button
          iconName="upload"
          disabled={!selectedDraftId}
          onClick={() => setPublishOpen(true)}
        >
          Publish
        </Button>
      </SpaceBetween>
    ) : null;

  const tableHeader = (
    <Header
      variant="h3"
      counter={`(${totalMatches})`}
      actions={draftHeaderActions}
      description={
        activeTab === "drafts"
          ? "View a saved draft hierarchy. Edits happen in Structure manager > Drafts & versions, then publish to replace the live hierarchy."
          : "View the live budget hierarchy. To change it, work in a draft and publish."
      }
    >
      {activeTab === "drafts"
        ? `Draft Budget Structure${selectedDraft ? `: ${selectedDraft.label}` : ""}`
        : "Budget pots"}
    </Header>
  );

  const handlePublishDraft = async () => {
    if (!selectedDraftId) return;
    setPublishSubmitting(true);
    try {
      await publishDraft(selectedDraftId);
      setPublishOpen(false);
    } catch (err) {
      console.error("Failed to publish draft", err);
    } finally {
      setPublishSubmitting(false);
    }
  };

  const tableContent = (
    <SpaceBetween size="m">
      <Table
        trackBy="id"
        items={tableItems}
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={handleSelectionChange}
        columnDefinitions={columnDefinitionsForTable}
        expandableRows={expandableRows}
        stickyHeader
        resizableColumns
        onColumnWidthsChange={handleColumnWidthsChange}
        enableKeyboardNavigation
        variant="embedded"
        filter={filterComponent}
        preferences={preferencesComponent}
        pagination={paginationComponent}
        empty={
          activeTab === "drafts" ? (
            <Box variant="p">
              No draft budget structure yet. Create a draft here (New draft) or copy Active via Structure manager &gt; Drafts and Snapshots, then return to edit and publish.
            </Box>
          ) : (
            <Box variant="p">No pots to display.</Box>
          )
        }
        header={tableHeader}
      />
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={headerActions}
          description="Active Budget shows the live hierarchy. Draft Budgets is the staging area: select or create a draft, edit it in Structure manager, then publish to replace Active (a safety snapshot is taken first)."
        >
          Budget hierarchy
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Budget hierarchy settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          { id: "active", label: "Active Budget", content: tableContent },
          { id: "drafts", label: "Draft Budgets", content: tableContent },
        ]}
      />
      <Modal
        visible={draftModalOpen}
        onDismiss={() => setDraftModalOpen(false)}
        header="New draft"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setDraftModalOpen(false)} disabled={draftCreateSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" loading={draftCreateSubmitting} onClick={handleCreateDraft}>
              Create draft
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <FormField label="Draft name" description="Label to identify this draft version.">
            <Input
              value={draftModalLabel}
              placeholder="e.g., FY2026 Refresh"
              onChange={({ detail }) => setDraftModalLabel(detail.value)}
            />
          </FormField>
          <FormField label="Notes" description="Optional context for this draft (scope, approvals, timing).">
            <Textarea
              value={draftModalNotes}
              placeholder="Why this draft exists and when to publish it."
              rows={3}
              onChange={({ detail }) => setDraftModalNotes(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={publishOpen}
        onDismiss={() => setPublishOpen(false)}
        header="Publish draft"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setPublishOpen(false)} disabled={publishSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" loading={publishSubmitting} onClick={handlePublishDraft}>
              Publish now
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <StatusIndicator type="warning">
            Publishing replaces the live budget hierarchy with the selected draft and archives any live pots not in the draft. A safety snapshot is taken first.
          </StatusIndicator>
          <Box variant="p">
            Continue to publish the selected draft to production? Existing spend stays on the same pot IDs; new pot IDs will start fresh.
          </Box>
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default BudgetHierarchyWidget;
