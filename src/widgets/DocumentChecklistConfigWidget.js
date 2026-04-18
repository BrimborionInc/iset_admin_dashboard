import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Container,
  FormField,
  Header,
  Input,
  Link,
  Modal,
  Multiselect,
  Select,
  SpaceBetween,
  Spinner,
  Table,
  Tabs,
  Textarea,
  Toggle,
} from "@cloudscape-design/components";
import { apiFetch } from "../auth/apiClient";
import boardItemI18nStrings from "./common";

const SOURCE_OPTIONS = [
  { value: "application_form", label: "Portal application form" },
  { value: "application_submission", label: "Applicant upload" },
  { value: "manual_upload", label: "Staff upload" },
  { value: "secure_message_attachment", label: "Secure message attachment" },
  { value: "system_generated", label: "PATH generated" },
];

const STATUS_SCOPE_LABELS = {
  application: "application",
  case: "case",
  intervention: "intervention",
};

const EMPTY_ITEM = {
  id: "",
  label: "",
  required: true,
  documentTypes: [],
  sources: [],
  minCount: "",
  notes: "",
};

const emptyConfig = () => ({
  id: "checklist",
  label: "Checklist",
  version: "",
  gates: [],
});

const clone = value => JSON.parse(JSON.stringify(value));

const normaliseItem = raw => {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const label = String(raw.label || "").trim();
  if (!id || !label) return null;
  const documentTypes = Array.isArray(raw.documentTypes)
    ? raw.documentTypes.map(String).map(val => val.trim()).filter(Boolean)
    : [];
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map(String).map(val => val.trim()).filter(Boolean)
    : [];
  const minCountValue = Number(raw.minCount);
  const minCount =
    Number.isFinite(minCountValue) && minCountValue > 0 ? minCountValue : undefined;
  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  return {
    id,
    label,
    required: raw.required !== false,
    documentTypes,
    sources,
    ...(minCount ? { minCount } : {}),
    ...(notes ? { notes } : {}),
  };
};

const normaliseGate = raw => {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const label = String(raw.label || "").trim();
  if (!id || !label) return null;
  const statusScope = String(raw.statusScope || "application").trim() || "application";
  const statuses = Array.isArray(raw.statuses)
    ? raw.statuses.map(String).map(val => val.trim()).filter(Boolean)
    : [];
  const items = Array.isArray(raw.items) ? raw.items.map(normaliseItem).filter(Boolean) : [];
  return {
    id,
    label,
    statusScope,
    statuses,
    items,
  };
};

const normaliseConfig = raw => {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const gates = Array.isArray(raw.gates) ? raw.gates.map(normaliseGate).filter(Boolean) : [];
  return {
    id: String(raw.id || "checklist").trim() || "checklist",
    label: String(raw.label || "Checklist").trim() || "Checklist",
    version: typeof raw.version === "string" ? raw.version.trim() : "",
    gates,
  };
};

const slugify = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ensureUniqueId = (base, existingIds) => {
  if (!base) return "";
  let candidate = base;
  let suffix = 1;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
};

const formatStatusLabel = value => String(value || "").trim().replace(/_/g, " ");

const formatGateStatusSummary = gate => {
  const scopeLabel = STATUS_SCOPE_LABELS[gate?.statusScope] || gate?.statusScope || "application";
  const statuses = Array.isArray(gate?.statuses) ? gate.statuses : [];
  if (!statuses.length) {
    return `Applies to ${scopeLabel} status (no specific statuses configured).`;
  }
  return `Applies when ${scopeLabel} status is ${statuses.map(formatStatusLabel).join(", ")}.`;
};

const buildDocTypeLabelMap = options =>
  new Map(
    (options || [])
      .filter(option => option?.value)
      .map(option => [option.value, option.label || option.value]),
  );

const buildSourceLabelMap = options =>
  new Map((options || []).filter(option => option?.value).map(option => [option.value, option.label]));

const formatList = (values, labelMap, formatter) => {
  if (!Array.isArray(values) || values.length === 0) return "None";
  return values
    .map(value => {
      const label = labelMap.get(value) || value;
      return formatter ? formatter(value, label) : label;
    })
    .join(", ");
};

const DocumentChecklistConfigWidget = ({ actions, metadata, toggleHelpPanel }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [config, setConfig] = useState(null);
  const [edit, setEdit] = useState(null);
  const [source, setSource] = useState({ application: null, intervention: null });
  const [activeTabId, setActiveTabId] = useState("application");

  const [docTypeOptions, setDocTypeOptions] = useState([]);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editMode, setEditMode] = useState("add");
  const [editScope, setEditScope] = useState("application");
  const [editGateId, setEditGateId] = useState("");
  const [editOriginalGateId, setEditOriginalGateId] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [formValues, setFormValues] = useState({ ...EMPTY_ITEM });
  const [formErrors, setFormErrors] = useState({});
  const [idTouched, setIdTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const docTypeLabelMap = useMemo(
    () => buildDocTypeLabelMap(docTypeOptions),
    [docTypeOptions],
  );
  const sourceLabelMap = useMemo(() => buildSourceLabelMap(SOURCE_OPTIONS), []);

  const configSignature = useMemo(() => (config ? JSON.stringify(config) : ""), [config]);
  const editSignature = useMemo(() => (edit ? JSON.stringify(edit) : ""), [edit]);
  const dirty = !!configSignature && !!editSignature && configSignature !== editSignature;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch("/api/config/runtime/checklists");
      if (!res.ok) {
        const message = (await res.json().catch(() => ({}))).message || res.statusText;
        throw new Error(message || "Failed to load checklist configuration");
      }
      const data = await res.json().catch(() => ({}));
      const nextConfig = {
        application: normaliseConfig(data?.application),
        intervention: normaliseConfig(data?.intervention),
      };
      setConfig(nextConfig);
      setEdit(clone(nextConfig));
      setSource({
        application: data?.source?.application || null,
        intervention: data?.source?.intervention || null,
      });
    } catch (err) {
      setError(err?.message || "Failed to load checklist configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch("/api/document-types");
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const opts = Array.isArray(data?.items)
          ? data.items
              .filter(item => item && item.code)
              .map(item => ({
                value: item.code,
                label: item.label || item.code,
                description: `${item.code}${item.scope ? ` (${item.scope})` : ""}`,
              }))
          : [];
        setDocTypeOptions(opts);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReset = () => {
    if (!config) return;
    setEdit(clone(config));
    setSuccess(null);
    setError(null);
  };

  const sanitizeItem = item => {
    if (!item || typeof item !== "object") return null;
    const id = String(item.id || "").trim();
    const label = String(item.label || "").trim();
    if (!id || !label) return null;
    const documentTypes = Array.isArray(item.documentTypes)
      ? item.documentTypes.map(String).map(val => val.trim()).filter(Boolean)
      : [];
    const sources = Array.isArray(item.sources)
      ? item.sources.map(String).map(val => val.trim()).filter(Boolean)
      : [];
    const minCountValue = Number(item.minCount);
    const minCount = Number.isFinite(minCountValue) && minCountValue > 0 ? minCountValue : undefined;
    const notes = typeof item.notes === "string" ? item.notes.trim() : "";
    return {
      id,
      label,
      required: item.required !== false,
      documentTypes,
      sources,
      ...(minCount ? { minCount } : {}),
      ...(notes ? { notes } : {}),
    };
  };

  const sanitizeConfig = scopeConfig => {
    if (!scopeConfig || typeof scopeConfig !== "object") return emptyConfig();
    const gates = Array.isArray(scopeConfig.gates)
      ? scopeConfig.gates.map(gate => ({
          id: gate.id,
          label: gate.label,
          statusScope: gate.statusScope || "application",
          statuses: Array.isArray(gate.statuses) ? gate.statuses : [],
          items: Array.isArray(gate.items) ? gate.items.map(sanitizeItem).filter(Boolean) : [],
        }))
      : [];
    return {
      id: scopeConfig.id || "checklist",
      label: scopeConfig.label || "Checklist",
      version: scopeConfig.version || "",
      gates,
    };
  };

  const handleSave = async () => {
    if (!edit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        application: sanitizeConfig(edit.application),
        intervention: sanitizeConfig(edit.intervention),
      };
      const res = await apiFetch("/api/config/runtime/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = (await res.json().catch(() => ({}))).message || res.statusText;
        throw new Error(message || "Failed to save checklist configuration");
      }
      const data = await res.json().catch(() => ({}));
      const nextConfig = {
        application: normaliseConfig(data?.application || payload.application),
        intervention: normaliseConfig(data?.intervention || payload.intervention),
      };
      setConfig(nextConfig);
      setEdit(clone(nextConfig));
      setSource({
        application: "db",
        intervention: "db",
      });
      setSuccess("Checklist configuration saved.");
    } catch (err) {
      setError(err?.message || "Failed to save checklist configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHelp = () => {
    if (!toggleHelpPanel || !metadata?.helpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || "Document checklists";
    const context = metadata?.aiContext || metadata?.helpComponent?.aiContext || "";
    toggleHelpPanel(<metadata.helpComponent />, title, context);
  };

  const infoLink =
    metadata?.helpComponent && toggleHelpPanel ? (
      <Link variant="info" onClick={handleOpenHelp}>
        Info
      </Link>
    ) : undefined;

  const settingsMenu =
    actions && typeof actions.removeItem === "function" ? (
      <ButtonDropdown
        ariaLabel="Document checklist widget settings"
        variant="icon"
        items={[{ id: "remove", text: "Remove widget" }]}
        onItemClick={({ detail }) => {
          if (detail.id === "remove") actions.removeItem();
        }}
      />
    ) : undefined;

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      {dirty && <Badge color="blue">Unsaved</Badge>}
      <Button variant="link" onClick={handleReset} disabled={loading || saving || !dirty}>
        Reset
      </Button>
      <Button
        variant="primary"
        loading={saving}
        disabled={loading || saving || !dirty}
        onClick={handleSave}
      >
        Save
      </Button>
    </SpaceBetween>
  );

  const getScopeConfig = useCallback(
    scope => {
      if (!edit) return emptyConfig();
      return edit[scope] || emptyConfig();
    },
    [edit],
  );

  const gateOptions = useMemo(() => {
    const scopeConfig = edit?.[editScope];
    return (scopeConfig?.gates || []).map(gate => ({ value: gate.id, label: gate.label }));
  }, [edit, editScope]);

  const handleAddItem = useCallback(
    (scope, gate) => {
      const gateItems = Array.isArray(gate?.items) ? gate.items : [];
      setEditMode("add");
      setEditScope(scope);
      setEditGateId(gate.id);
      setEditOriginalGateId(gate.id);
      setEditItemId("");
      setFormValues({
        ...EMPTY_ITEM,
        id: ensureUniqueId("new-item", new Set(gateItems.map(item => item.id))),
      });
      setFormErrors({});
      setIdTouched(false);
      setEditModalVisible(true);
    },
    [],
  );

  const handleEditItem = useCallback((scope, gate, item) => {
    setEditMode("edit");
    setEditScope(scope);
    setEditGateId(gate.id);
    setEditOriginalGateId(gate.id);
    setEditItemId(item.id);
    setFormValues({
      id: item.id || "",
      label: item.label || "",
      required: item.required !== false,
      documentTypes: Array.isArray(item.documentTypes) ? item.documentTypes : [],
      sources: Array.isArray(item.sources) ? item.sources : [],
      minCount: item.minCount ? String(item.minCount) : "",
      notes: item.notes || "",
    });
    setFormErrors({});
    setIdTouched(false);
    setEditModalVisible(true);
  }, []);

  const applyItemChange = useCallback(
    ({ scope, originalGateId, targetGateId, itemId, item, mode }) => {
      setEdit(current => {
        if (!current) return current;
        const scopeConfig = current[scope];
        if (!scopeConfig) return current;
        const gates = (scopeConfig.gates || []).map(gate => {
          if (gate.id === originalGateId) {
            if (mode === "edit" && originalGateId === targetGateId) {
              const items = (gate.items || []).map(existing =>
                existing.id === itemId ? item : existing,
              );
              return { ...gate, items };
            }
            if (mode === "edit" && originalGateId !== targetGateId) {
              const items = (gate.items || []).filter(existing => existing.id !== itemId);
              return { ...gate, items };
            }
          }
          if (gate.id === targetGateId) {
            const items = Array.isArray(gate.items) ? gate.items : [];
            if (mode === "add" || (mode === "edit" && originalGateId !== targetGateId)) {
              return { ...gate, items: [...items, item] };
            }
          }
          return gate;
        });
        return { ...current, [scope]: { ...scopeConfig, gates } };
      });
    },
    [],
  );

  const handleSaveItem = () => {
    const trimmedLabel = String(formValues.label || "").trim();
    const trimmedId = String(formValues.id || "").trim();
    const minCountValue = formValues.minCount ? Number(formValues.minCount) : null;
    const errors = {};
    if (!trimmedLabel) errors.label = "Label is required.";
    if (!trimmedId) errors.id = "System id is required.";
    if (!Array.isArray(formValues.documentTypes) || formValues.documentTypes.length === 0) {
      errors.documentTypes = "Select at least one document type.";
    }
    if (formValues.minCount && (!Number.isFinite(minCountValue) || minCountValue <= 0)) {
      errors.minCount = "Minimum count must be a positive number.";
    }

    const scopeConfig = edit?.[editScope];
    const targetGate = scopeConfig?.gates?.find(gate => gate.id === editGateId);
    const duplicateId =
      targetGate &&
      (targetGate.items || []).some(item => {
        if (editMode === "edit" && editOriginalGateId === editGateId && item.id === editItemId) {
          return false;
        }
        return item.id === trimmedId;
      });
    if (duplicateId) {
      errors.id = "System id must be unique within the gate.";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const cleanItem = sanitizeItem({
      id: trimmedId,
      label: trimmedLabel,
      required: formValues.required,
      documentTypes: formValues.documentTypes,
      sources: formValues.sources,
      minCount: minCountValue,
      notes: formValues.notes,
    });
    if (!cleanItem) return;

    applyItemChange({
      scope: editScope,
      originalGateId: editOriginalGateId,
      targetGateId: editGateId,
      itemId: editItemId,
      item: cleanItem,
      mode: editMode,
    });

    setEditModalVisible(false);
  };

  const handleDeleteItem = useCallback((scope, gate, item) => {
    setDeleteTarget({ scope, gateId: gate.id, itemId: item.id, label: item.label });
  }, []);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setEdit(current => {
      if (!current) return current;
      const scopeConfig = current[deleteTarget.scope];
      if (!scopeConfig) return current;
      const gates = (scopeConfig.gates || []).map(gate => {
        if (gate.id !== deleteTarget.gateId) return gate;
        const items = (gate.items || []).filter(item => item.id !== deleteTarget.itemId);
        return { ...gate, items };
      });
      return { ...current, [deleteTarget.scope]: { ...scopeConfig, gates } };
    });
    setDeleteTarget(null);
  };

  const handleLabelChange = value => {
    setFormValues(current => {
      if (editMode !== "add") return { ...current, label: value };
      if (idTouched) return { ...current, label: value };
      const scopeConfig = edit?.[editScope];
      const gate = scopeConfig?.gates?.find(item => item.id === editGateId);
      const existingIds = new Set((gate?.items || []).map(item => item.id));
      const nextId = ensureUniqueId(slugify(value), existingIds);
      return { ...current, label: value, id: nextId };
    });
  };

  const handleGateChange = ({ detail }) => {
    const nextGateId = detail.selectedOption?.value || "";
    setEditGateId(nextGateId);
    if (editMode === "add" && !idTouched) {
      setFormValues(current => {
        const scopeConfig = edit?.[editScope];
        const gate = scopeConfig?.gates?.find(item => item.id === nextGateId);
        const existingIds = new Set((gate?.items || []).map(item => item.id));
        const nextId = ensureUniqueId(slugify(current.label), existingIds);
        return { ...current, id: nextId };
      });
    }
  };

  const renderGateTable = (scope, gate) => {
    const columnDefinitions = [
      {
        id: "label",
        header: "Document",
        cell: item => (
          <SpaceBetween size="xxs">
            <Box>{item.label}</Box>
            <Box color="text-body-secondary" fontSize="body-s">
              System id: {item.id}
            </Box>
          </SpaceBetween>
        ),
      },
      {
        id: "documentTypes",
        header: "Document types",
        cell: item =>
          formatList(item.documentTypes, docTypeLabelMap, (value, label) =>
            label && label !== value ? `${label} (${value})` : label,
          ),
      },
      {
        id: "sources",
        header: "Sources",
        cell: item => formatList(item.sources, sourceLabelMap),
      },
      {
        id: "required",
        header: "Required",
        cell: item => (item.required === false ? "Optional" : "Required"),
      },
      {
        id: "minCount",
        header: "Min count",
        cell: item => (item.minCount ? String(item.minCount) : "None"),
      },
      {
        id: "notes",
        header: "Notes",
        cell: item => item.notes || "",
      },
      {
        id: "actions",
        header: "",
        cell: item => (
          <SpaceBetween direction="horizontal" size="xs">
            <Link
              variant="secondary"
              onFollow={event => {
                event.preventDefault();
                handleEditItem(scope, gate, item);
              }}
            >
              Edit
            </Link>
            <Link
              variant="secondary"
              onFollow={event => {
                event.preventDefault();
                handleDeleteItem(scope, gate, item);
              }}
            >
              Remove
            </Link>
          </SpaceBetween>
        ),
      },
    ];

    return (
      <Table
        variant="embedded"
        resizableColumns
        columnDefinitions={columnDefinitions}
        items={Array.isArray(gate.items) ? gate.items : []}
        trackBy="id"
        empty={<Box>No checklist items yet.</Box>}
      />
    );
  };

  const renderScope = scope => {
    const scopeConfig = getScopeConfig(scope);
    const sourceLabel = source?.[scope]
      ? `Source: ${source[scope] === "db" ? "Saved in database" : source[scope]}`
      : "Source: unknown";

    return (
      <SpaceBetween size="l">
        <Box color="text-body-secondary" fontSize="body-s">
          {sourceLabel}
        </Box>
        {(scopeConfig.gates || []).length === 0 && <Box>No gates configured.</Box>}
        {(scopeConfig.gates || []).map(gate => (
          <Container
            key={`${scope}-${gate.id}`}
            header={
              <Header
                variant="h3"
                description={formatGateStatusSummary(gate)}
                actions={
                  <Button onClick={() => handleAddItem(scope, gate)} iconName="add-plus">
                    Add document
                  </Button>
                }
              >
                {gate.label}
              </Header>
            }
          >
            <SpaceBetween size="s">{renderGateTable(scope, gate)}</SpaceBetween>
          </Container>
        ))}
      </SpaceBetween>
    );
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description || "Manage required documents by status gate."}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || "Document checklists"}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      {loading ? (
        <Box textAlign="center">
          <Spinner /> Loading...
        </Box>
      ) : (
        <SpaceBetween size="m">
          {error && (
            <Alert type="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert type="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          <Tabs
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={[
              { id: "application", label: "Applications", content: renderScope("application") },
              { id: "intervention", label: "Interventions", content: renderScope("intervention") },
            ]}
          />
          <Modal
            visible={editModalVisible}
            onDismiss={() => setEditModalVisible(false)}
            header={editMode === "edit" ? "Edit checklist item" : "Add checklist item"}
            size="large"
            footer={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setEditModalVisible(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveItem}>
                  Save
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="m">
              <FormField label="Gate" description="Items belong to a single status gate.">
                <Select
                  selectedOption={gateOptions.find(option => option.value === editGateId) || null}
                  onChange={handleGateChange}
                  options={gateOptions}
                  placeholder="Select a gate"
                />
              </FormField>
              <FormField
                label="Document label"
                errorText={formErrors.label}
                description="Describe the document administrators should collect."
              >
                <Input
                  value={formValues.label}
                  onChange={({ detail }) => handleLabelChange(detail.value)}
                  placeholder="e.g., Statement of Account"
                />
              </FormField>
              <FormField
                label="System id"
                errorText={formErrors.id}
                description="System id is generated for new items and fixed after creation."
              >
                <Input
                  value={formValues.id}
                  disabled={editMode === "edit"}
                  onChange={({ detail }) => {
                    setIdTouched(true);
                    setFormValues(current => ({ ...current, id: detail.value }));
                  }}
                />
              </FormField>
              <FormField
                label="Document types"
                errorText={formErrors.documentTypes}
                description="Select one or more document type codes that satisfy this item."
              >
                <Multiselect
                  selectedOptions={(formValues.documentTypes || []).map(code => ({
                    value: code,
                    label: docTypeLabelMap.get(code) || code,
                  }))}
                  onChange={({ detail }) =>
                    setFormValues(current => ({
                      ...current,
                      documentTypes: detail.selectedOptions.map(option => option.value),
                    }))
                  }
                  options={docTypeOptions}
                  placeholder="Choose document types"
                  filteringType="auto"
                />
              </FormField>
              <FormField label="Sources" description="Where the document can be collected from.">
                <Multiselect
                  selectedOptions={(formValues.sources || []).map(code => ({
                    value: code,
                    label: sourceLabelMap.get(code) || code,
                  }))}
                  onChange={({ detail }) =>
                    setFormValues(current => ({
                      ...current,
                      sources: detail.selectedOptions.map(option => option.value),
                    }))
                  }
                  options={SOURCE_OPTIONS}
                  placeholder="Choose sources"
                />
              </FormField>
              <FormField label="Required">
                <Toggle
                  checked={formValues.required !== false}
                  onChange={({ detail }) =>
                    setFormValues(current => ({ ...current, required: detail.checked }))
                  }
                >
                  {formValues.required !== false ? "Required" : "Optional"}
                </Toggle>
              </FormField>
              <FormField
                label="Minimum count"
                errorText={formErrors.minCount}
                description="Set a minimum number of documents, if applicable."
              >
                <Input
                  type="number"
                  value={String(formValues.minCount ?? "")}
                  onChange={({ detail }) =>
                    setFormValues(current => ({ ...current, minCount: detail.value }))
                  }
                  placeholder="Leave blank for no minimum"
                />
              </FormField>
              <FormField label="Notes">
                <Textarea
                  value={formValues.notes}
                  onChange={({ detail }) =>
                    setFormValues(current => ({ ...current, notes: detail.value }))
                  }
                  placeholder="Optional guidance for administrators"
                />
              </FormField>
            </SpaceBetween>
          </Modal>
          {deleteTarget && (
            <Modal
              visible
              onDismiss={() => setDeleteTarget(null)}
              header="Remove checklist item"
              footer={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                  <Button variant="primary" onClick={confirmDelete}>
                    Remove
                  </Button>
                </SpaceBetween>
              }
            >
              <Box>
                Remove "{deleteTarget.label}" from this gate. This change is applied when you save
                the checklist configuration.
              </Box>
            </Modal>
          )}
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default DocumentChecklistConfigWidget;
