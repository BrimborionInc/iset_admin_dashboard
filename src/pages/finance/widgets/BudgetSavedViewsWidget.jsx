import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  Button,
  Link,
  Select,
  Multiselect,
  FormField,
  Input,
  Textarea,
  Toggle,
  StatusIndicator,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { apiFetch } from "../../../auth/apiClient";
import { useBudgetsData } from "./BudgetsDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-budget-saved-views-widths-v1";

const exportOptions = [
  { label: "CSV snapshot", value: "csv" },
  { label: "PDF board pack", value: "pdf" },
  { label: "JSON API payload", value: "json" },
];

const viewModeOptions = [
  { label: "Tree", value: "tree" },
  { label: "Flat", value: "flat" },
];

const riskOptions = [
  { label: "All", value: "" },
  { label: "Overrun", value: "overrun" },
  { label: "Underspend", value: "underspend" },
  { label: "Steady", value: "steady" },
];

const BudgetSavedViewsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { activeVersion } = useBudgetsData();
  const [views, setViews] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [exportFormat, setExportFormat] = useState(exportOptions[0]);
  const [columnWidths, setColumnWidths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    audience: "",
    viewMode: "tree",
    riskFilter: "",
    region: "",
    owner: "",
    timeframe: "",
    exportFormats: [exportOptions[0]],
    isShared: false,
  });
  const hasDispatchedInitial = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${COLUMN_WIDTHS_STORAGE_KEY}:${activeVersion?.id || "default"}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setColumnWidths(parsed);
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }, [activeVersion?.id]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Saved views", metadata.aiContext ?? "");
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

  const handleViewLoad = view => {
    if (!view) return;
    setSelectedItems([view]);
    window.dispatchEvent(
      new CustomEvent("financeBudgets:viewLoaded", {
        detail: {
          viewId: view.id,
          viewName: view.name,
          description: view.description,
          presets: view.filters || {},
          activeVersionId: activeVersion?.id,
        },
      })
    );
  };

  const loadViews = useCallback(async () => {
    if (!activeVersion?.id) return;
    setLoading(true);
    setErrorText(null);
    try {
      const resp = await apiFetch(`/api/finance/saved-views?budgetVersionId=${encodeURIComponent(activeVersion.id)}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load saved views (${resp.status})`);
      }
      const data = await resp.json();
      const list = Array.isArray(data) ? data : [];
      setViews(list);
      if (!hasDispatchedInitial.current && list.length) {
        hasDispatchedInitial.current = true;
        handleViewLoad(list[0]);
      } else if (!list.length) {
        setSelectedItems([]);
      }
    } catch (err) {
      setErrorText(err?.message || "Failed to load saved views.");
    } finally {
      setLoading(false);
    }
  }, [activeVersion]);

  useEffect(() => {
    hasDispatchedInitial.current = false;
    loadViews();
  }, [loadViews]);

  const handleExport = async () => {
    const view = selectedItems[0];
    if (!view) return;
    try {
      const resp = await apiFetch(`/api/finance/saved-views/${view.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat.value }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Export failed (${resp.status})`);
      }
    } catch (err) {
      setErrorText(err?.message || "Failed to trigger export.");
    }
  };

  const handleCreateView = async () => {
    if (!activeVersion?.id) return;
    if (!formState.name.trim()) {
      setErrorText("Name is required.");
      return;
    }
    setCreating(true);
    setErrorText(null);
    try {
      const payload = {
        budgetVersionId: activeVersion.id,
        name: formState.name.trim(),
        description: formState.description || "",
        audience: formState.audience || "",
        isShared: !!formState.isShared,
        filters: {
          viewMode: formState.viewMode,
          riskFilter: formState.riskFilter || null,
          region: formState.region || null,
          owner: formState.owner || null,
          timeframe: formState.timeframe || null,
        },
        exportFormats: (formState.exportFormats || []).map(opt => opt.value),
      };
      const resp = await apiFetch("/api/finance/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to create view (${resp.status})`);
      }
      const created = await resp.json();
      setViews(prev => [created, ...prev]);
      handleViewLoad(created);
      setFormState({
        name: "",
        description: "",
        audience: "",
        viewMode: "tree",
        riskFilter: "",
        region: "",
        owner: "",
        timeframe: "",
        exportFormats: [exportOptions[0]],
        isShared: false,
      });
    } catch (err) {
      setErrorText(err?.message || "Failed to create saved view.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    const view = selectedItems[0];
    if (!view) return;
    setDeleting(true);
    setErrorText(null);
    try {
      const resp = await apiFetch(`/api/finance/saved-views/${view.id}`, { method: "DELETE" });
      if (!resp.ok && resp.status !== 204) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to delete view (${resp.status})`);
      }
      setViews(prev => prev.filter(v => v.id !== view.id));
      setSelectedItems([]);
    } catch (err) {
      setErrorText(err?.message || "Failed to delete saved view.");
    } finally {
      setDeleting(false);
    }
  };

  const columnDefinitions = useMemo(() => {
    const widthMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    return [
      {
        id: "name",
        header: "View",
        width: widthMap.get("name"),
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.name}</Box>
            <Box variant="awsui-key-label">{item.audience || "—"}</Box>
            <Box variant="p">{item.description || "—"}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "filters",
        header: "Filters",
        width: widthMap.get("filters"),
        cell: item => {
          const f = item.filters || {};
          const parts = [];
          if (f.viewMode) parts.push(f.viewMode);
          if (f.riskFilter) parts.push(f.riskFilter);
          if (f.region) parts.push(f.region);
          if (f.owner) parts.push(f.owner);
          if (f.timeframe) parts.push(f.timeframe);
          return parts.join(" · ") || "—";
        },
      },
      {
        id: "exports",
        header: "Exports",
        width: widthMap.get("exports"),
        cell: item =>
          Array.isArray(item.exportFormats) && item.exportFormats.length
            ? item.exportFormats.join(", ")
            : "—",
      },
      {
        id: "shared",
        header: "Shared",
        width: widthMap.get("shared"),
        cell: item => (item.isShared ? "Yes" : "No"),
      },
    ];
  }, [columnWidths]);

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    const widthEntries = detail?.columnWidths || detail?.widths || [];
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
        const key = `${COLUMN_WIDTHS_STORAGE_KEY}:${activeVersion?.id || "default"}`;
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        console.error("[Budgets] failed to persist saved view column widths", error);
      }
    }
  };

  const actionsArea = (
    <SpaceBetween direction="horizontal" size="s">
      <Select
        selectedOption={exportFormat}
        onChange={({ detail }) => setExportFormat(detail.selectedOption)}
        options={exportOptions}
        selectedAriaLabel="Export format"
      />
      <Button iconName="download" disabled={!selectedItems.length} onClick={handleExport}>
        Export
      </Button>
      <Button iconName="trash" disabled={!selectedItems.length || deleting} loading={deleting} onClick={handleDelete}>
        Delete
      </Button>
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} actions={actionsArea}>
          Saved views &amp; exports
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Saved views settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {errorText ? <Box color="text-status-danger">{errorText}</Box> : null}
        <Box variant="awsui-key-label">
          Active budget version: {activeVersion?.label || activeVersion?.id || "Not set"}
        </Box>
        <Table
          items={views}
          trackBy="id"
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => {
            const view = detail.selectedItems?.[0];
            if (view) {
              handleViewLoad(view);
            } else {
              setSelectedItems([]);
            }
          }}
          columnDefinitions={columnDefinitions}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          loading={loading}
          header={
            <Header
              variant="h3"
              counter={`(${views.length})`}
              actions={
                selectedItems[0] ? (
                  <StatusIndicator type="success">Loaded: {selectedItems[0].name}</StatusIndicator>
                ) : (
                  <StatusIndicator type="info">No view loaded</StatusIndicator>
                )
              }
            >
              Saved configurations
            </Header>
          }
        />
        <Header variant="h3">Create saved view</Header>
        <SpaceBetween size="s">
          <FormField label="Name" stretch>
            <Input
              value={formState.name}
              placeholder="e.g., Executive roll-up"
              onChange={({ detail }) => setFormState(prev => ({ ...prev, name: detail.value }))}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={formState.description}
              rows={2}
              onChange={({ detail }) => setFormState(prev => ({ ...prev, description: detail.value }))}
            />
          </FormField>
          <FormField label="Audience">
            <Input
              value={formState.audience}
              placeholder="e.g., Executive, Regional finance"
              onChange={({ detail }) => setFormState(prev => ({ ...prev, audience: detail.value }))}
            />
          </FormField>
          <FormField label="View mode">
            <Select
              selectedOption={viewModeOptions.find(opt => opt.value === formState.viewMode) || viewModeOptions[0]}
              onChange={({ detail }) =>
                setFormState(prev => ({ ...prev, viewMode: detail.selectedOption?.value || "tree" }))
              }
              options={viewModeOptions}
            />
          </FormField>
          <FormField label="Risk filter">
            <Select
              selectedOption={riskOptions.find(opt => opt.value === formState.riskFilter) || riskOptions[0]}
              onChange={({ detail }) =>
                setFormState(prev => ({ ...prev, riskFilter: detail.selectedOption?.value || "" }))
              }
              options={riskOptions}
            />
          </FormField>
          <FormField label="Region (optional)">
            <Input
              value={formState.region}
              onChange={({ detail }) => setFormState(prev => ({ ...prev, region: detail.value }))}
            />
          </FormField>
          <FormField label="Owner (optional)">
            <Input
              value={formState.owner}
              onChange={({ detail }) => setFormState(prev => ({ ...prev, owner: detail.value }))}
            />
          </FormField>
          <FormField label="Timeframe (optional)">
            <Input
              value={formState.timeframe}
              placeholder="e.g., FY2025 or FY2025-Q2"
              onChange={({ detail }) => setFormState(prev => ({ ...prev, timeframe: detail.value }))}
            />
          </FormField>
          <FormField label="Allowed export formats">
            <Multiselect
              selectedOptions={formState.exportFormats}
              onChange={({ detail }) => setFormState(prev => ({ ...prev, exportFormats: detail.selectedOptions }))}
              options={exportOptions}
              placeholder="Select formats"
            />
          </FormField>
          <Toggle
            checked={formState.isShared}
            onChange={({ detail }) => setFormState(prev => ({ ...prev, isShared: detail.checked }))}
          >
            Shared view (visible to finance users)
          </Toggle>
          <Button variant="primary" iconName="add-plus" loading={creating} onClick={handleCreateView}>
            Save view
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default BudgetSavedViewsWidget;
