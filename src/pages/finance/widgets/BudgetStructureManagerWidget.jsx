import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  FormField,
  Input,
  Checkbox,
  Textarea,
  Select,
  Multiselect,
  Tabs,
  Box,
  Button,
  Container,
  StatusIndicator,
  ColumnLayout,
  Table,
  Modal,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { apiFetch } from "../../../auth/apiClient.js";
import { useBudgetsData } from "./BudgetsDataContext.jsx";
import BudgetPotTagsEditor from "./BudgetPotTagsEditor.jsx";

const nodeTypeOptions = [
  { label: "Funding stream", value: "Funding stream" },
  { label: "Program", value: "Program" },
  { label: "Project", value: "Project" },
  { label: "Delivery partner", value: "Delivery partner" },
];

const isFundingStreamType = value => {
  const raw = value && typeof value === "object" && value.value !== undefined ? value.value : value;
  const norm = String(raw || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  return norm === "funding stream";
};

const topLevelOption = { label: "Top-level budget", value: "" };

const regionOptions = [
  { label: "Alberta (AB)", value: "AB" },
  { label: "British Columbia (BC)", value: "BC" },
  { label: "Manitoba (MB)", value: "MB" },
  { label: "New Brunswick (NB)", value: "NB" },
  { label: "Newfoundland and Labrador (NL)", value: "NL" },
  { label: "Northwest Territories (NT)", value: "NT" },
  { label: "Nova Scotia (NS)", value: "NS" },
  { label: "Nunavut (NU)", value: "NU" },
  { label: "Ontario (ON)", value: "ON" },
  { label: "Prince Edward Island (PE)", value: "PE" },
  { label: "Quebec (QC)", value: "QC" },
  { label: "Saskatchewan (SK)", value: "SK" },
  { label: "Yukon (YT)", value: "YT" },
];

const toSelectedRegionOptions = codes =>
  (Array.isArray(codes) ? codes : [])
    .map(code => {
      const match = regionOptions.find(opt => opt.value === code);
      return match || { label: code, value: code };
    })
    .filter(option => option.value);

const blankCreateForm = {
  name: "",
  code: "",
  parentOption: topLevelOption,
  nodeType: nodeTypeOptions[1],
  owner: "",
  regions: [],
  approved: "",
  adjusted: "",
  committed: "",
  forecast: "",
  adminPct: "",
  description: "",
  policyNotes: "",
  glProjectCodeExternal: "",
  glProjectCodeInternal: "",
  fundingSource: "",
  isRestricted: false,
  agreementId: "",
  fiscalYearTag: "",
};

const mapPotToEditForm = (pot, parentOptions) => {
  if (!pot) {
    return null;
  }
  const parentOption =
    parentOptions.find(option => option.value === (pot.parentId ?? "")) ?? topLevelOption;
  const nodeType =
    nodeTypeOptions.find(option => option.value === pot.nodeType) ?? nodeTypeOptions[0];
  return {
    name: pot.name ?? "",
    code: pot.code ?? "",
    parentOption,
    nodeType,
    owner: pot.owner ?? "",
    regions: Array.isArray(pot.regions) ? pot.regions.map(code => String(code).toUpperCase()) : [],
    approved: pot.approved !== undefined ? String(pot.approved) : "",
    adjusted: pot.adjusted !== undefined ? String(pot.adjusted) : "",
    committed: pot.committed !== undefined ? String(pot.committed) : "",
    forecast: pot.forecast !== undefined ? String(pot.forecast) : "",
    adminPct:
      pot.adminTargetPct !== undefined && pot.adminTargetPct !== null
        ? String(pot.adminTargetPct)
        : "",
    description: pot.description ?? "",
    policyNotes: pot.policyNotes ?? "",
    glProjectCodeExternal: pot.glProjectCodeExternal ?? "",
    glProjectCodeInternal: pot.glProjectCodeInternal ?? "",
    fundingSource: pot.fundingSource ?? "",
    isRestricted: Boolean(pot.isRestricted),
    agreementId: pot.agreementId ?? "",
    fiscalYearTag: pot.fiscalYearTag ?? pot.fiscalYear ?? "",
  };
};

const formatCurrencyDisplay = value => {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return value;
  return `$${num.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const draftColumns = [
  {
    id: "summary",
    header: "Change",
    cell: item => item.summary,
  },
  {
    id: "type",
    header: "Type",
    cell: item => item.type,
  },
  {
    id: "timestamp",
    header: "Recorded",
    cell: item => item.timestamp,
  },
];

const snapshotColumns = [
  {
    id: "label",
    header: "Snapshot",
    cell: item => item.label,
  },
  {
    id: "capturedOn",
    header: "Captured",
    cell: item => item.capturedOn,
  },
  {
    id: "capturedBy",
    header: "Captured by",
    cell: item => item.capturedBy,
  },
];

const BudgetStructureManagerWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    selectedPotId,
    selectPot,
    selectedDraftId,
    setSelectedDraftId,
    selectedDraft,
    selectedDraftFiscalYear,
    selectedDraftPots,
    selectedPotSource,
    draftCreateOrUpdatePot,
    draftArchivePot,
    draftDeletePot,
    saveDraftPayload,
    draftChanges,
    drafts,
    createDraft,
    deleteDraft,
    publishDraft,
    deleteSnapshot,
    restoreSnapshotAsDraft,
    snapshots,
    createSnapshot,
    activeVersion,
    reload,
  } = useBudgetsData();

const [activeTab, setActiveTab] = useState("create");
const [createForm, setCreateForm] = useState(blankCreateForm);
const [editForm, setEditForm] = useState(null);
const [createSubmitting, setCreateSubmitting] = useState(false);
const [editSubmitting, setEditSubmitting] = useState(false);
const [archiveSubmitting, setArchiveSubmitting] = useState(false);
const [feedback, setFeedback] = useState(null);
const [feedbackType, setFeedbackType] = useState(null);
const [errorText, setErrorText] = useState(null);
const [snapshotSubmitting, setSnapshotSubmitting] = useState(false);
const [snapshotNotes, setSnapshotNotes] = useState("");
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [deletePotModalOpen, setDeletePotModalOpen] = useState(false);
  const [deletePotSubmitting, setDeletePotSubmitting] = useState(false);
  const [publishSubmittingId, setPublishSubmittingId] = useState(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftFiscalYear, setDraftFiscalYear] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const fiscalYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = currentYear;
    const options = [];
    for (let i = 0; i <= 10; i += 1) {
      const startYear = start + i;
      const label = `${startYear}-${startYear + 1}`;
      options.push({ label, value: label });
    }
    return options;
  }, []);
  const [copyDraftModalOpen, setCopyDraftModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [inlineDraftLabel, setInlineDraftLabel] = useState("");
  const [inlineDraftSaving, setInlineDraftSaving] = useState(false);
  const [inlineDraftFiscalYear, setInlineDraftFiscalYear] = useState("");
  const [deleteSnapshotId, setDeleteSnapshotId] = useState(null);
  const [deleteDraftId, setDeleteDraftId] = useState(null);
const [restoreSnapshotTarget, setRestoreSnapshotTarget] = useState(null);
const [restoreFiscalYear, setRestoreFiscalYear] = useState("");
const [createApprovedFocused, setCreateApprovedFocused] = useState(false);
const [createAdjustedFocused, setCreateAdjustedFocused] = useState(false);
const [editApprovedFocused, setEditApprovedFocused] = useState(false);
const [editAdjustedFocused, setEditAdjustedFocused] = useState(false);
const hasDraft = Boolean(selectedDraftId);
const isActiveSelection = selectedPotSource === "active";
const disableEdit = isActiveSelection || !hasDraft;
const createIsFundingStream = isFundingStreamType(createForm.nodeType);
const editIsFundingStream = isFundingStreamType(editForm?.nodeType);

  useEffect(() => {
    if (!selectedDraftId && drafts?.length) {
      setSelectedDraftId(drafts[0].id);
    }
  }, [drafts, selectedDraftId, setSelectedDraftId]);

  useEffect(() => {
    if (!draftFiscalYear && activeVersion?.label) {
      const match = fiscalYearOptions.find(opt => opt.label === activeVersion.label);
      setDraftFiscalYear(match ? match.value : "");
    }
  }, [activeVersion, draftFiscalYear, fiscalYearOptions]);

  useEffect(() => {
    if (restoreSnapshotTarget && !restoreFiscalYear) {
      const matchFromSnapshot = fiscalYearOptions.find(opt => opt.value === restoreSnapshotTarget.fiscalYear || opt.label === restoreSnapshotTarget.fiscalYear);
      const matchFromActive = fiscalYearOptions.find(opt => opt.label === activeVersion?.label);
      setRestoreFiscalYear((matchFromSnapshot || matchFromActive)?.value || "");
    }
  }, [restoreSnapshotTarget, restoreFiscalYear, fiscalYearOptions, activeVersion]);

  useEffect(() => {
    const match = drafts?.find(d => String(d.id) === String(selectedDraftId));
    setInlineDraftLabel(match?.label || "");
    // Prefill inline fiscal year from payload
    if (match?.payload) {
      let payload = match.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = null;
        }
      }
      setInlineDraftFiscalYear(payload?.fiscalYear || "");
    } else {
      setInlineDraftFiscalYear("");
    }
  }, [drafts, selectedDraftId]);

  const ensureDraftSelected = async () => {
    if (selectedDraftId) return selectedDraftId;
    throw new Error("Select a draft before creating or editing pots.");
  };

const parentOptions = useMemo(() => {
    const map = new Map((selectedDraftPots || []).map(pot => [String(pot.id), pot]));
    const depthCache = new Map();
    const getDepth = potId => {
      const key = potId != null ? String(potId) : null;
      if (!key) {
        return 0;
      }
      if (depthCache.has(key)) {
        return depthCache.get(key);
      }
      const pot = map.get(key);
      if (!pot || !pot.parentId) {
        depthCache.set(key, 0);
        return 0;
      }
      const depth = 1 + getDepth(pot.parentId);
      depthCache.set(key, depth);
      return depth;
    };
    const options = (selectedDraftPots || [])
      .filter(pot => pot.status !== "archived")
      .map(pot => {
        const depth = getDepth(pot.id);
        const prefix = depth ? `${"\u2014 ".repeat(depth)}` : "";
        return { label: `${prefix}${pot.name}`, value: pot.id };
      });
    // In edit mode, hide self as parent to avoid cycles
    if (activeTab === "edit" && selectedPotId) {
      return [topLevelOption, ...options.filter(opt => String(opt.value) !== String(selectedPotId))];
    }
    return [topLevelOption, ...options];
  }, [selectedDraftPots, activeTab, selectedPotId]);

  const selectedPot = useMemo(() => {
    if (selectedPotSource !== "draft") return null;
    return (selectedDraftPots || []).find(pot => String(pot.id) === String(selectedPotId)) ?? null;
  }, [selectedDraftPots, selectedPotId, selectedPotSource]);

  useEffect(() => {
    setEditForm(mapPotToEditForm(selectedPot, parentOptions));
  }, [selectedPot, parentOptions]);

  useEffect(() => {
    if (selectedPotSource === "active") {
      setEditForm(null);
    }
  }, [selectedPotSource]);

  useEffect(() => {
    const handler = event => {
      const { mode, potId, parentId } = event.detail || {};
      if (mode === "edit" && potId) {
        setActiveTab("edit");
        selectPot(potId, "draft");
        return;
      }
      if (mode === "create") {
        setActiveTab("create");
        if (parentId) {
          const parent = (selectedDraftPots || []).find(pot => String(pot.id) === String(parentId));
          if (parent) {
            setCreateForm(form => ({
              ...form,
              parentOption: { label: parent.name, value: parent.id },
            }));
          }
        }
      }
    };
    window.addEventListener("financeBudgets:managePot", handler);
    return () => window.removeEventListener("financeBudgets:managePot", handler);
  }, [selectedDraftPots, selectPot]);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Structure manager",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const handleCreateChange = (field, value) => {
    setCreateForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

const sanitizeNumber = value => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const handleCreateSubmit = async event => {
  event.preventDefault();
  setCreateSubmitting(true);
  setErrorText(null);
  setFeedback(null);
  try {
    const draftId = await ensureDraftSelected();
    const newId = Date.now();
    await draftCreateOrUpdatePot(newId, {
      id: newId,
      name: createForm.name,
      code: createForm.code,
      parentId: createForm.parentOption?.value || null,
      nodeType: createForm.nodeType?.value,
      owner: createForm.owner,
      regions: Array.isArray(createForm.regions) ? createForm.regions : [],
      glProjectCodeExternal: createForm.glProjectCodeExternal || null,
      glProjectCodeInternal: createForm.glProjectCodeInternal || null,
      approved: sanitizeNumber(createForm.approved),
      adjusted: sanitizeNumber(createForm.adjusted),
      committed: undefined,
      forecast: undefined,
      adminTargetPct: sanitizeNumber(createForm.adminPct),
      description: createForm.description,
      policyNotes: createForm.policyNotes,
      agreementId: createForm.agreementId || null,
      fundingSource: createForm.fundingSource || null,
      isRestricted: !!createForm.isRestricted,
      fiscalYearTag: createForm.fiscalYearTag || null,
      status: "draft",
    });
    setSelectedDraftId(draftId);
    setCreateForm({
      ...blankCreateForm,
      nodeType: createForm.nodeType,
    });
    setFeedback("Budget pot created in draft.");
    setFeedbackType("success");
  } catch (err) {
    setErrorText(err?.message || "Failed to create pot. Select a draft first.");
  } finally {
    setCreateSubmitting(false);
  }
};

const handleEditSubmit = async event => {
  event.preventDefault();
  if (!selectedPot) {
    return;
  }
  setEditSubmitting(true);
  setErrorText(null);
  setFeedback(null);
  try {
    const parentIdValue =
      editForm?.parentOption?.value && String(editForm.parentOption.value) !== String(selectedPot.id)
        ? editForm.parentOption.value
        : null;
    await draftCreateOrUpdatePot(selectedPot.id, {
      ...selectedPot,
      name: editForm?.name,
      code: editForm?.code,
      parentId: parentIdValue,
      nodeType: editForm?.nodeType?.value,
      owner: editForm?.owner,
      regions: Array.isArray(editForm?.regions) ? editForm.regions : [],
      glProjectCodeExternal: editForm?.glProjectCodeExternal || null,
      glProjectCodeInternal: editForm?.glProjectCodeInternal || null,
      approved: sanitizeNumber(editForm?.approved),
      adjusted: sanitizeNumber(editForm?.adjusted),
      committed: undefined,
      forecast: undefined,
      adminTargetPct: sanitizeNumber(editForm?.adminPct),
      description: editForm?.description,
      policyNotes: editForm?.policyNotes,
      agreementId: editForm?.agreementId || null,
      fundingSource: editForm?.fundingSource || null,
      isRestricted: !!editForm?.isRestricted,
      fiscalYearTag: editForm?.fiscalYearTag || null,
    });
    setFeedback("Budget pot updated in draft.");
    setFeedbackType("success");
  } catch (err) {
    setErrorText(err?.message || "Failed to update pot.");
  } finally {
    setEditSubmitting(false);
  }
};

const handleArchive = async () => {
  if (!selectedPot) {
    return;
  }
  setArchiveSubmitting(true);
  setErrorText(null);
  setFeedback(null);
  try {
    await draftArchivePot(selectedPot.id);
    setFeedback("Budget pot archived in draft.");
    setFeedbackType("success");
  } catch (err) {
    setErrorText(err?.message || "Failed to archive pot.");
  } finally {
    setArchiveSubmitting(false);
  }
};

  const handleDeletePot = async () => {
    if (!selectedPot) return;
    setDeletePotSubmitting(true);
    setErrorText(null);
    setFeedback(null);
    try {
      await draftDeletePot(selectedPot.id);
      setFeedback("Budget pot deleted from draft.");
      setFeedbackType("success");
      selectPot(null, "draft");
      setDeletePotModalOpen(false);
    } catch (err) {
      setErrorText(err?.message || "Failed to delete pot.");
    } finally {
      setDeletePotSubmitting(false);
    }
  };

  const handleSnapshot = async () => {
    setSnapshotSubmitting(true);
    setErrorText(null);
    setFeedback(null);
    try {
      const resp = await apiFetch("/api/finance/budget-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: snapshotNotes || undefined }),
      });
      if (!resp.ok) {
        throw new Error(`Snapshot failed (${resp.status})`);
      }
      await reload();
      setFeedback("Snapshot captured.");
      setFeedbackType("success");
      setSnapshotNotes("");
    } catch (err) {
      setErrorText(err?.message || "Failed to capture snapshot.");
    } finally {
      setSnapshotSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setDraftSubmitting(true);
    setErrorText(null);
    setFeedback(null);
    try {
      await createDraft({
        label: draftLabel || `Draft ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
        fiscalYear: draftFiscalYear || null,
        notes: draftNotes,
      });
      setFeedback("Draft saved.");
      setFeedbackType("success");
      setDraftLabel("");
      setDraftFiscalYear(activeVersion?.label || "");
      setDraftNotes("");
      setCopyDraftModalOpen(false);
    } catch (err) {
      setErrorText(err?.message || "Failed to save draft.");
    } finally {
      setDraftSubmitting(false);
    }
  };

  const handlePublishDraft = async draftId => {
    if (!draftId) return;
    setPublishSubmittingId(draftId);
    setErrorText(null);
    setFeedback(null);
    try {
      await publishDraft(draftId, { fiscalYear: selectedDraftFiscalYear || undefined, autoIncrementYear: true });
      setFeedback("Draft published to live pots.");
      setFeedbackType("success");
    } catch (err) {
      setErrorText(err?.message || "Failed to publish draft.");
    } finally {
      setPublishSubmittingId(null);
    }
  };

  const draftItems = useMemo(
    () =>
      (draftChanges && draftChanges.length ? draftChanges : []).map(change => ({
        ...change,
        timestamp: new Date(change.timestamp).toLocaleString(),
      })),
    [draftChanges]
  );

  const infoBar = (
    <SpaceBetween size="xs">
      {feedback && (
        <Alert
          type={feedbackType === "success" ? "success" : "info"}
          header="Status"
          dismissible
          onDismiss={() => setFeedback(null)}
        >
          {feedback}
        </Alert>
      )}
      {errorText && (
        <Alert type="error" header="Error" dismissible onDismiss={() => setErrorText(null)}>
          {errorText}
        </Alert>
      )}
    </SpaceBetween>
  );

  const createTab = (
    <form onSubmit={handleCreateSubmit}>
      <SpaceBetween size="m">
        {!hasDraft ? (
          <Alert type="info" header="Select or create a draft first">
            Create/edit is disabled until a draft is selected. Choose a draft in Drafts & versions or create one below.
          </Alert>
        ) : null}
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Pot name" stretch description="Human-friendly title shown in lists and searches.">
              <Input
                value={createForm.name}
                placeholder="e.g., Skills Training West"
                onChange={({ detail }) => handleCreateChange("name", detail.value)}
              />
            </FormField>
            <FormField label="Funding code" stretch description="Short code or GL string; must be unique within the draft.">
              <Input
                value={createForm.code}
                placeholder="e.g., STW-2024"
                onChange={({ detail }) => handleCreateChange("code", detail.value)}
              />
            </FormField>
            <FormField label="Parent pot" stretch description="Where this pot sits in the hierarchy. Choose Top-level for roots.">
              <Select
                selectedOption={createForm.parentOption}
                options={parentOptions}
                onChange={({ detail }) => handleCreateChange("parentOption", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Node type" stretch description="Category label only; it does not drive calculations.">
              <Select
                selectedOption={createForm.nodeType}
                options={nodeTypeOptions}
                onChange={({ detail }) => handleCreateChange("nodeType", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Owner" description="Person/role accountable for this pot.">
              <Input
                value={createForm.owner}
                placeholder="e.g., Finance Officer"
                onChange={({ detail }) => handleCreateChange("owner", detail.value)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Approved amount" description="Original authority for this pot (CAD).">
              <Input
                value={
                  createApprovedFocused
                    ? createForm.approved
                    : formatCurrencyDisplay(createForm.approved)
                }
                placeholder="e.g., 0.00"
                onChange={({ detail }) => handleCreateChange("approved", detail.value)}
                onFocus={() => setCreateApprovedFocused(true)}
                onBlur={() => setCreateApprovedFocused(false)}
              />
            </FormField>
            <FormField label="Adjusted amount" description="Approved plus/minus amendments (CAD).">
              <Input
                value={
                  createAdjustedFocused
                    ? createForm.adjusted
                    : formatCurrencyDisplay(createForm.adjusted)
                }
                placeholder="e.g., 0.00"
                onChange={({ detail }) => handleCreateChange("adjusted", detail.value)}
                onFocus={() => setCreateAdjustedFocused(true)}
                onBlur={() => setCreateAdjustedFocused(false)}
              />
            </FormField>
            <FormField
              label="Committed amount"
              description="Calculated from draft spend; read-only."
            >
              <Input value={formatCurrencyDisplay(createForm.committed)} disabled />
            </FormField>
            <FormField
              label="Forecast amount"
              description="Calculated projection; read-only."
            >
              <Input value={formatCurrencyDisplay(createForm.forecast)} disabled />
            </FormField>
            <FormField label="Admin % target" description="Target admin share of adjusted amount (percentage).">
              <Input
                type="number"
                value={createForm.adminPct}
                placeholder="e.g., 12.5"
                onChange={({ detail }) => handleCreateChange("adminPct", detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </ColumnLayout>
        <FormField label="Description" description="Short context shown in details; optional.">
          <Textarea
            value={createForm.description}
            placeholder="Short description shown in the pot detail panel."
            rows={3}
            onChange={({ detail }) => handleCreateChange("description", detail.value)}
          />
        </FormField>
        <Container header={<Header variant="h3">Classification &amp; tags</Header>}>
          <BudgetPotTagsEditor
            value={{
              fundingSource: createForm.fundingSource,
              isRestricted: createForm.isRestricted,
              agreementId: createForm.agreementId,
              fiscalYearTag: createForm.fiscalYearTag,
            }}
            onChange={tags => setCreateForm(prev => ({ ...prev, ...tags }))}
          />
        </Container>
        <FormField
          label="Regions (optional)"
          description="Assign one or more regions to scope this pot. Leave blank if the pot is not region-specific."
        >
          <Multiselect
            selectedOptions={toSelectedRegionOptions(createForm.regions)}
            options={regionOptions}
            placeholder="Select regions (optional)"
            filteringType="auto"
            onChange={({ detail }) =>
              handleCreateChange(
                "regions",
                (detail.selectedOptions || []).map(opt => opt.value).filter(Boolean)
              )
            }
          />
        </FormField>
        {createIsFundingStream ? (
          <Container header={<Header variant="h3">Accounting codes</Header>}>
            <SpaceBetween size="s">
              <Box variant="p">
                External is used when the region/partner pays from their own bank account. Internal is used when NWAC pays but attributes the cost to the region.
              </Box>
              <FormField label="External GL/project code">
                <Input
                  value={createForm.glProjectCodeExternal}
                  placeholder="e.g., EXT-GL-001"
                  onChange={({ detail }) => handleCreateChange("glProjectCodeExternal", detail.value)}
                />
              </FormField>
              <FormField label="Internal GL/project code">
                <Input
                  value={createForm.glProjectCodeInternal}
                  placeholder="e.g., INT-GL-001"
                  onChange={({ detail }) => handleCreateChange("glProjectCodeInternal", detail.value)}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        ) : null}
        <FormField label="Policy guardrails" description="Key rules, approval limits, or restrictions for this pot.">
          <Textarea
            value={createForm.policyNotes}
            placeholder="Document policy notes, approval references, or usage guardrails."
            rows={3}
            onChange={({ detail }) => handleCreateChange("policyNotes", detail.value)}
          />
        </FormField>
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            type="submit"
            iconName="add-plus"
            loading={createSubmitting}
            disabled={createSubmitting || !hasDraft}
          >
            Create pot
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setCreateForm({ ...blankCreateForm });
            }}
          >
            Reset form
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </form>
  );

  const editTab = isActiveSelection ? (
    <SpaceBetween size="m">
      <Alert type="info" header="Active budgets are read-only">
        <SpaceBetween size="xs">
          <Box variant="p">
            Active pots cannot be edited directly in Structure manager. To correct an active pot, follow the publish flow:
          </Box>
          <Box variant="p">a) Take a snapshot (ideally out of hours).</Box>
          <Box variant="p">b) Promote that snapshot to a draft.</Box>
          <Box variant="p">c) Edit the pot in the draft.</Box>
          <Box variant="p">d) Publish the draft budget.</Box>
        </SpaceBetween>
      </Alert>
    </SpaceBetween>
  ) : selectedPot ? (
    <form onSubmit={handleEditSubmit}>
      <SpaceBetween size="m">
        {!hasDraft ? (
          <Alert type="info" header="Active budgets are read-only">
            Editing is only available in a draft. Create or select a draft in “Drafts & versions,”
            make your changes there, then publish to update the active budget.
          </Alert>
        ) : null}
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Pot name" stretch description="Human-friendly title shown in lists and searches.">
              <Input
                disabled={disableEdit}
                value={editForm?.name ?? ""}
                onChange={({ detail }) => handleEditChange("name", detail.value)}
              />
            </FormField>
            <FormField label="Funding code" stretch description="Short code or GL string; must be unique within the draft.">
              <Input
                disabled={disableEdit}
                value={editForm?.code ?? ""}
                onChange={({ detail }) => handleEditChange("code", detail.value)}
              />
            </FormField>
            <FormField label="Node type" stretch description="Category label only; it does not drive calculations.">
              <Select
                disabled={disableEdit}
                selectedOption={editForm?.nodeType ?? nodeTypeOptions[0]}
                options={nodeTypeOptions}
                onChange={({ detail }) => handleEditChange("nodeType", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Parent pot" stretch description="Where this pot sits in the hierarchy. Choose Top-level for roots.">
              <Select
                disabled={disableEdit}
                selectedOption={editForm?.parentOption ?? topLevelOption}
                options={parentOptions}
                onChange={({ detail }) => handleEditChange("parentOption", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Owner" description="Person/role accountable for this pot.">
              <Input
                disabled={disableEdit}
                value={editForm?.owner ?? ""}
                onChange={({ detail }) => handleEditChange("owner", detail.value)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Funding source">
              <Select
                disabled={disableEdit}
                placeholder="Select funding source"
                selectedOption={
                  editForm?.fundingSource
                    ? [
                        { label: "EI", value: "EI" },
                        { label: "CRF", value: "CRF" },
                        { label: "Other", value: "OTHER" },
                      ].find(opt => opt.value === editForm.fundingSource) ?? null
                    : null
                }
                options={[
                  { label: "EI", value: "EI" },
                  { label: "CRF", value: "CRF" },
                  { label: "Other", value: "OTHER" },
                ]}
                onChange={({ detail }) =>
                  handleEditChange("fundingSource", detail.selectedOption?.value || "")
                }
              />
            </FormField>
            <FormField label="Agreement ID">
              <Input
                disabled={disableEdit}
                value={editForm?.agreementId ?? ""}
                placeholder="e.g., CA-2025-1234"
                onChange={({ detail }) => handleEditChange("agreementId", detail.value)}
              />
            </FormField>
            <FormField label="Fiscal year" description='Accepts values like "2025" or "2025-2026".'>
              <Input
                disabled={disableEdit}
                value={editForm?.fiscalYearTag ?? ""}
                placeholder="2025-2026"
                onChange={({ detail }) => handleEditChange("fiscalYearTag", detail.value)}
              />
            </FormField>
            <FormField label="Restricted">
              <Checkbox
                disabled={disableEdit}
                checked={Boolean(editForm?.isRestricted)}
                onChange={({ detail }) => handleEditChange("isRestricted", detail.checked)}
              >
                Restricted
              </Checkbox>
            </FormField>
          </SpaceBetween>
        </ColumnLayout>

        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Approved amount" description="Original authority for this pot (CAD).">
              <Input
                disabled={disableEdit}
                value={
                  editApprovedFocused
                    ? editForm?.approved ?? ""
                    : formatCurrencyDisplay(editForm?.approved ?? "")
                }
                onChange={({ detail }) => handleEditChange("approved", detail.value)}
                onFocus={() => setEditApprovedFocused(true)}
                onBlur={() => setEditApprovedFocused(false)}
              />
            </FormField>
            <FormField label="Adjusted amount" description="Approved plus/minus amendments (CAD).">
              <Input
                disabled={disableEdit}
                value={
                  editAdjustedFocused
                    ? editForm?.adjusted ?? ""
                    : formatCurrencyDisplay(editForm?.adjusted ?? "")
                }
                onChange={({ detail }) => handleEditChange("adjusted", detail.value)}
                onFocus={() => setEditAdjustedFocused(true)}
                onBlur={() => setEditAdjustedFocused(false)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField
              label="Committed amount"
              description="Calculated from draft spend; read-only."
            >
              <Input value={formatCurrencyDisplay(editForm?.committed ?? "")} disabled />
            </FormField>
            <FormField
              label="Forecast amount"
              description="Calculated projection; read-only."
            >
              <Input value={formatCurrencyDisplay(editForm?.forecast ?? "")} disabled />
            </FormField>
            <FormField label="Admin % target" description="Target admin share of adjusted amount (percentage).">
              <Input
                disabled={disableEdit}
                type="number"
                value={editForm?.adminPct ?? ""}
                onChange={({ detail }) => handleEditChange("adminPct", detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </ColumnLayout>

        <FormField
          label="Regions (optional)"
          description="Assign one or more regions to scope this pot. Leave blank if the pot is not region-specific."
        >
          <Multiselect
            inlineTokens
            disabled={disableEdit}
            selectedOptions={toSelectedRegionOptions(editForm?.regions)}
            options={regionOptions}
            placeholder="Select regions (optional)"
            filteringType="auto"
            onChange={({ detail }) =>
              handleEditChange(
                "regions",
                (detail.selectedOptions || []).map(opt => opt.value).filter(Boolean)
              )
            }
          />
        </FormField>

        <FormField label="Description" description="Short context shown in details; optional.">
          <Textarea
            disabled={disableEdit}
            value={editForm?.description ?? ""}
            rows={3}
            onChange={({ detail }) => handleEditChange("description", detail.value)}
          />
        </FormField>
        {editIsFundingStream ? (
          <Container header={<Header variant="h3">Accounting codes</Header>}>
            <SpaceBetween size="s">
              <Box variant="p">
                External is used when the region/partner pays from their own bank account. Internal is used when NWAC pays but the cost is attributed to the region.
              </Box>
              <FormField label="External GL/project code">
                <Input
                  disabled={disableEdit}
                  value={editForm?.glProjectCodeExternal ?? ""}
                  placeholder="e.g., EXT-GL-001"
                  onChange={({ detail }) => handleEditChange("glProjectCodeExternal", detail.value)}
                />
              </FormField>
              <FormField label="Internal GL/project code">
                <Input
                  disabled={disableEdit}
                  value={editForm?.glProjectCodeInternal ?? ""}
                  placeholder="e.g., INT-GL-001"
                  onChange={({ detail }) => handleEditChange("glProjectCodeInternal", detail.value)}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        ) : null}
        <FormField label="Policy guardrails" description="Key rules, approval limits, or restrictions for this pot.">
          <Textarea
            disabled={disableEdit}
            value={editForm?.policyNotes ?? ""}
            rows={3}
            onChange={({ detail }) => handleEditChange("policyNotes", detail.value)}
          />
        </FormField>
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" type="submit" loading={editSubmitting} disabled={editSubmitting || disableEdit}>
            Save changes
          </Button>
          <Button
            variant="normal"
            onClick={() => setDeletePotModalOpen(true)}
            disabled={deletePotSubmitting || disableEdit}
            iconName="remove"
          >
            Delete
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </form>
  ) : (
    <Box variant="p">Select a draft pot from the hierarchy to edit its details.</Box>
  );

  const versionsTab = (
    <SpaceBetween size="m">
      {infoBar}
      <Container
        header={
          <Header
            variant="h3"
            actions={
              <Button iconName="add-plus" onClick={() => setCopyDraftModalOpen(true)}>
                Copy active hierarchy as new draft
              </Button>
            }
          >
            Drafts
          </Header>
        }
      >
        <Table
          items={Array.isArray(drafts) ? drafts : []}
          trackBy="id"
          selectionType="single"
          selectedItems={
            selectedDraftId
              ? (drafts || []).filter(d => String(d.id) === String(selectedDraftId))
              : []
          }
          onSelectionChange={({ detail }) => {
            const next = detail.selectedItems?.[0];
            if (next?.id) {
              setSelectedDraftId(next.id);
            }
          }}
          columnDefinitions={[
            {
              id: "label",
              header: "Label",
              cell: item =>
                String(item.id) === String(selectedDraftId) ? (
                  <Input
                    value={inlineDraftLabel}
                    onChange={({ detail }) => setInlineDraftLabel(detail.value)}
                    onBlur={async () => {
                      if (!item.id || inlineDraftSaving) return;
                      if (!inlineDraftLabel.trim() || inlineDraftLabel === item.label) return;
                      try {
                        setInlineDraftSaving(true);
                        const payloadPots = item.id === selectedDraftId && selectedDraftPots ? selectedDraftPots : [];
                        await saveDraftPayload(item.id, payloadPots, {
                          label: inlineDraftLabel.trim(),
                          notes: item.notes,
                        });
                        await reload();
                      } catch (err) {
                        console.error("Failed to update draft label", err);
                        setErrorText("Failed to update draft label.");
                      } finally {
                        setInlineDraftSaving(false);
                      }
                    }}
                    ariaLabel="Draft label"
                  />
                ) : (
                  item.label
                ),
            },
            {
              id: "fiscalYear",
              header: "Fiscal year",
              cell: item => {
                const isSelected = String(item.id) === String(selectedDraftId);
                let payload = item.payload;
                if (typeof payload === "string") {
                  try {
                    payload = JSON.parse(payload);
                  } catch {
                    payload = null;
                  }
                }
                const value = isSelected ? inlineDraftFiscalYear : payload?.fiscalYear || "—";
                if (!isSelected) {
                  return value || "—";
                }
                return (
                  <Select
                    selectedOption={fiscalYearOptions.find(opt => opt.value === value) || null}
                    options={fiscalYearOptions}
                    expandToViewport
                    placeholder="Select fiscal year"
                    onChange={async ({ detail }) => {
                      const nextFy = detail.selectedOption?.value || "";
                      setInlineDraftFiscalYear(nextFy);
                      if (!item.id || inlineDraftSaving) return;
                      const payloadPots =
                        item.id === selectedDraftId && selectedDraftPots ? selectedDraftPots : [];
                      try {
                        setInlineDraftSaving(true);
                        await saveDraftPayload(item.id, payloadPots, {
                          label: item.label,
                          notes: item.notes,
                          fiscalYear: nextFy,
                        });
                        await reload();
                      } catch (err) {
                        console.error("Failed to update draft fiscal year", err);
                        setErrorText("Failed to update draft fiscal year.");
                      } finally {
                        setInlineDraftSaving(false);
                      }
                    }}
                  />
                );
              },
            },
            { id: "createdAt", header: "Created", cell: item => item.createdAt ? new Date(item.createdAt).toLocaleString() : "-" },
            {
              id: "actions",
              header: "Actions",
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="link"
                    onClick={() => setDeleteDraftId(item.id)}
                  >
                    ✕
                  </Button>
                </SpaceBetween>
              ),
            },
          ]}
          resizableColumns
          variant="embedded"
          empty={<Box variant="p">No drafts captured.</Box>}
        />
      </Container>
      <Modal
        visible={copyDraftModalOpen}
        onDismiss={() => setCopyDraftModalOpen(false)}
        header="Copy active hierarchy as new draft"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setCopyDraftModalOpen(false)} disabled={draftSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={draftSubmitting}
              onClick={handleSaveDraft}
              disabled={draftSubmitting || !draftFiscalYear?.trim()}
            >
              Create draft
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <FormField label="Draft label">
            <Input
              placeholder="e.g., FY2026 baseline"
              value={draftLabel}
              onChange={({ detail }) => setDraftLabel(detail.value)}
            />
          </FormField>
          <FormField label="Fiscal year" description="Required; applies to all pots in this draft.">
            <Select
              selectedOption={fiscalYearOptions.find(opt => opt.value === draftFiscalYear) || null}
              options={fiscalYearOptions}
              placeholder="Select fiscal year"
              onChange={({ detail }) => setDraftFiscalYear(detail.selectedOption?.value || "")}
            />
          </FormField>
          <FormField label="Notes (optional)">
            <Textarea
              placeholder="Why this draft? What changes does it contain?"
              value={draftNotes}
              rows={3}
              onChange={({ detail }) => setDraftNotes(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={deleteDraftId !== null}
        onDismiss={() => setDeleteDraftId(null)}
        header="Delete draft"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setDeleteDraftId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (deleteDraftId) {
                  await deleteDraft(deleteDraftId);
                }
                setDeleteDraftId(null);
              }}
            >
              Delete
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Box variant="p">Delete this draft? This cannot be undone.</Box>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={snapshotModalOpen}
        onDismiss={() => setSnapshotModalOpen(false)}
        header="Capture snapshot"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setSnapshotModalOpen(false)} disabled={snapshotSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={snapshotSubmitting}
              onClick={async () => {
                await handleSnapshot();
                setSnapshotModalOpen(false);
              }}
            >
              Capture
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <FormField label="Notes (optional)">
            <Textarea
              placeholder="What this snapshot represents (e.g., pre-publish baseline)."
              value={snapshotNotes}
              rows={3}
              onChange={({ detail }) => setSnapshotNotes(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={deleteSnapshotId !== null}
        onDismiss={() => setDeleteSnapshotId(null)}
        header="Delete snapshot"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setDeleteSnapshotId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (deleteSnapshotId) {
                  await deleteSnapshot(deleteSnapshotId);
                  await reload();
                }
                setDeleteSnapshotId(null);
              }}
            >
              Delete
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Box variant="p">
            Delete this snapshot? This cannot be undone.
          </Box>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={restoreSnapshotTarget !== null}
        onDismiss={() => {
          setRestoreSnapshotTarget(null);
          setRestoreFiscalYear("");
        }}
        header="Restore snapshot as draft"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setRestoreSnapshotTarget(null);
                setRestoreFiscalYear("");
              }}
              disabled={snapshotSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={snapshotSubmitting}
              disabled={snapshotSubmitting || !restoreFiscalYear.trim()}
              onClick={async () => {
                if (!restoreSnapshotTarget?.id) return;
                setSnapshotSubmitting(true);
                try {
                  const data = await restoreSnapshotAsDraft(restoreSnapshotTarget.id, {
                    fiscalYear: restoreFiscalYear,
                  });
                  if (data?.id) {
                    setSelectedDraftId(data.id);
                  }
                  setRestoreSnapshotTarget(null);
                  setRestoreFiscalYear("");
                } catch (err) {
                  setErrorText(err?.message || "Failed to restore snapshot as draft.");
                } finally {
                  setSnapshotSubmitting(false);
                }
              }}
            >
              Restore
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <FormField label="Fiscal year" description="Required; applied to all pots in the restored draft.">
            <Select
              selectedOption={fiscalYearOptions.find(opt => opt.value === restoreFiscalYear) || null}
              options={fiscalYearOptions}
              placeholder="Select fiscal year"
              onChange={({ detail }) => setRestoreFiscalYear(detail.selectedOption?.value || "")}
            />
          </FormField>
          <Alert type="info">
            The snapshot will be restored as a draft with this fiscal year. You can publish or edit it afterward.
          </Alert>
        </SpaceBetween>
      </Modal>
      <Container
        header={
          <Header
            variant="h3"
            actions={
              <Button onClick={() => setSnapshotModalOpen(true)} iconName="file">
                Capture snapshot
              </Button>
            }
          >
            Snapshots
          </Header>
        }
      >
        <Table
          items={snapshots}
          trackBy="id"
          columnDefinitions={[
            { id: "label", header: "Snapshot", cell: item => item.label },
            { id: "capturedOn", header: "Captured", cell: item => item.snapshotAt ? new Date(item.snapshotAt).toLocaleString() : "-" },
            {
              id: "actions",
              header: "Actions",
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="link"
                    onClick={() => setDeleteSnapshotId(item.id)}
                  >
                    ✕
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => {
                      setRestoreSnapshotTarget({ id: item.id, fiscalYear: item.fiscalYear });
                      setRestoreFiscalYear(item.fiscalYear || "");
                    }}
                  >
                    Restore as draft
                  </Button>
                </SpaceBetween>
              ),
            },
          ]}
          resizableColumns
          variant="embedded"
          empty={<Box variant="p">No snapshots captured yet.</Box>}
        />
      </Container>
    </SpaceBetween>
  );

  const tabs = [
    { id: "create", label: "Create pot", content: createTab },
    { id: "edit", label: "Edit selected", content: editTab },
    { id: "versions", label: "Drafts and Snapshots", content: versionsTab },
  ];

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
          description="Work inside the selected draft: create/edit pots, copy Active to a new draft, and manage snapshots. Publish from Draft Budgets to replace the live hierarchy."
        >
          Structure manager
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Structure manager settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Modal
        visible={deletePotModalOpen}
        onDismiss={() => setDeletePotModalOpen(false)}
        header="Delete pot and children"
        closeAriaLabel="Close"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setDeletePotModalOpen(false)} disabled={deletePotSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDeletePot} loading={deletePotSubmitting}>
              Delete
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Box variant="p">
            Delete this draft pot and all of its child pots? This removes them from the draft permanently.
          </Box>
        </SpaceBetween>
      </Modal>
      <Tabs
        tabs={tabs}
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
      />
    </BoardItem>
  );
};

export default BudgetStructureManagerWidget;
