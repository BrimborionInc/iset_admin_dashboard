
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Board from "@cloudscape-design/board-components/board";
import {
  Badge,
  Box,
  Button,
  Input,
  Modal,
  SpaceBetween,
} from "@cloudscape-design/components";
import AiConfigWidget from "../widgets/AiConfigWidget";
import AuthConfigWidget from "../widgets/AuthConfigWidget";
import LockingConfigWidget from "../widgets/LockingConfigWidget";
import SlaConfigWidget from "../widgets/SlaConfigWidget";
import SessionAuditWidget from "../widgets/SessionAuditWidget";
import CorsOriginsWidget from "../widgets/CorsOriginsWidget";
import EnvironmentWidget from "../widgets/EnvironmentWidget";
import SecretsWidget from "../widgets/SecretsWidget";
import AppearanceWidget from "../widgets/AppearanceWidget";
import BackendJobsWidget from "../widgets/BackendJobsWidget";
import AutoAssignmentConfigWidget from "../widgets/AutoAssignmentConfigWidget";
import DocumentChecklistConfigWidget from "../widgets/DocumentChecklistConfigWidget";
import AiConfigWidgetHelp from "../helpPanelContents/aiConfigWidgetHelp";
import AuthWidgetHelp from "../helpPanelContents/authWidgetHelp";
import SessionAuditWidgetHelp from "../helpPanelContents/sessionAuditWidgetHelp";
import CorsOriginsWidgetHelp from "../helpPanelContents/corsOriginsWidgetHelp";
import EnvironmentWidgetHelp from "../helpPanelContents/environmentWidgetHelp";
import SlaWidgetHelp from "../helpPanelContents/slaWidgetHelp";
import SecretsWidgetHelp from "../helpPanelContents/secretsWidgetHelp";
import AppearanceWidgetHelp from "../helpPanelContents/appearanceWidgetHelp";
import LockingSettingsHelp from "../helpPanelContents/lockingSettingsHelp";
import BackendJobsWidgetHelp from "../helpPanelContents/backendJobsWidgetHelp";
import DocumentChecklistConfigHelp from "../helpPanelContents/documentChecklistConfigHelp";
import { apiFetch } from "../auth/apiClient";
import { useAuth } from "../context/AuthContext.js";
import { useDarkMode as useDarkModeContext } from "../context/DarkModeContext";
import {
  applyDemoNavigationVisibility,
  loadDemoNavigationVisibility,
  readDemoNavigationVisibility,
  saveDemoNavigationVisibility,
  subscribeToDemoNavigationVisibility,
  DEMO_NAVIGATION_ROLES,
} from "../utils/demoNavigationVisibility";

async function fetchJSON(path, opts = {}) {
  const res = await apiFetch(path, opts);
  const text = await res.text();
  if (!res.ok) {
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.error || parsed.message || `Request failed ${res.status}`);
    } catch {
      const snippet = text.slice(0, 120).replace(/\s+/g, " ").trim();
      throw new Error(`Request failed ${res.status}: ${snippet || "no body"}`);
    }
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const looksHtml = /<!doctype html/i.test(text);
    throw new Error(
      looksHtml
        ? "Received HTML instead of JSON (check API base/port or proxy config)"
        : "Invalid JSON response",
    );
  }
}

const SLA_STAGE_PLACEHOLDER = [
  {
    stage_key: "assignment",
    display_name: "Assignment",
    target_days: 3,
    description: "Time from submission to assign an assessor or coordinator.",
  },
  {
    stage_key: "ei_status_verification",
    display_name: "EI Status Verification",
    target_days: 3,
    description: "Time from assignment to confirm EI status / eligibility.",
  },
  {
    stage_key: "assessment",
    display_name: "Assessment",
    target_days: 10,
    description: "Time from EI status verification to complete the assessment.",
  },
  {
    stage_key: "program_decision",
    display_name: "Program decision",
    target_days: 2,
    description: "Time from assessment submission to issue the program decision.",
  },
  {
    stage_key: "docs_request_reminder",
    display_name: "Docs requested reminder",
    target_days: 7,
    description: "Emit the reminder-due event X days after documents are requested.",
  },
  {
    stage_key: "docs_request_closure",
    display_name: "Docs requested closure",
    target_days: 28,
    description: "Emit the mark-for-closure event X days after documents are requested.",
  },
];

const SLA_STAGE_ALLOWLIST = new Set(SLA_STAGE_PLACEHOLDER.map(item => item.stage_key));

const SLA_STAGE_LABELS = SLA_STAGE_PLACEHOLDER.reduce((acc, item) => {
  acc[item.stage_key] = item.display_name;
  return acc;
}, {});

const mergeSlaTargetsWithPlaceholders = items => {
  const itemMap = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    if (!item || !SLA_STAGE_ALLOWLIST.has(item.stage_key)) return;
    itemMap.set(item.stage_key, item);
  });
  return SLA_STAGE_PLACEHOLDER.map(placeholder => {
    const existing = itemMap.get(placeholder.stage_key);
    if (!existing) {
      return { ...placeholder };
    }
    return {
      ...placeholder,
      ...existing,
      stage_key: placeholder.stage_key,
      display_name: existing.display_name || placeholder.display_name,
      description: existing.description || placeholder.description,
    };
  });
};

const DEFAULT_LOCKING_CONFIG = {
  mode: "optimistic",
  lockTtlMinutes: 15,
  heartbeatMinutes: 2,
};

const LOCKING_MODE_OPTIONS = [
  { label: "Optimistic only", value: "optimistic" },
  { label: "Optimistic + Pessimistic", value: "pessimistic" },
];

const LOCKING_HEADER_DESCRIPTION =
  "Configure pessimistic locking for application edits. Optimistic version checks remain enabled in all modes; enabling pessimistic locking adds a database lock so only one user can edit at a time within the configured timeout.";

// Bump the layout storage key whenever the default layout changes so new widgets
// (like Backend jobs) appear on the board instead of lingering in the palette.
const STORAGE_KEY = "configuration-dashboard-layout-v4";

const widgetRegistry = {
  ai: {
    id: "ai",
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: AiConfigWidget,
    title: "AI / LLM Configuration",
    description: "Tune the default AI model, generation parameters, and fallback behaviour.",
    helpComponent: AiConfigWidgetHelp,
    helpTitle: "AI configuration",
    aiContext: AiConfigWidgetHelp?.aiContext,
  },
  auth: {
    id: "auth",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: AuthConfigWidget,
    title: "Authentication",
    description: "Manage session lifetimes and security policy for admin and applicant portals.",
    helpComponent: AuthWidgetHelp,
    helpTitle: "Authentication",
    aiContext: AuthWidgetHelp?.aiContext,
  },
  locking: {
    id: "locking",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: LockingConfigWidget,
    title: "Record locking",
    description: LOCKING_HEADER_DESCRIPTION,
    helpComponent: LockingSettingsHelp,
    helpTitle: "Record locking",
    aiContext: LockingSettingsHelp?.aiContext,
  },
  slaConfig: {
    id: "slaConfig",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: SlaConfigWidget,
    title: "Workflow timing targets",
    description: "Baseline timing targets for workflow stages.",
    helpComponent: SlaWidgetHelp,
    helpTitle: "Workflow timing targets",
    aiContext: SlaWidgetHelp?.aiContext,
  },
  sessionAudit: {
    id: "sessionAudit",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: SessionAuditWidget,
    title: "Session audit",
    description: "Recent session activity and maintenance tools.",
    helpComponent: SessionAuditWidgetHelp,
    helpTitle: "Session audit",
    aiContext: SessionAuditWidgetHelp?.aiContext,
  },
  cors: {
    id: "cors",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: CorsOriginsWidget,
    title: "CORS / Origins",
    description: "Allowed browser origins for the public portal.",
    helpComponent: CorsOriginsWidgetHelp,
    helpTitle: "CORS origins",
    aiContext: CorsOriginsWidgetHelp?.aiContext,
  },
  "backend-jobs": {
    id: "backend-jobs",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: BackendJobsWidget,
    title: "Backend jobs",
    description: "Configure server-side background jobs (e.g., reminder polling).",
    helpComponent: BackendJobsWidgetHelp,
    helpTitle: "Backend jobs",
    aiContext: BackendJobsWidgetHelp?.aiContext,
  },
  "document-checklists": {
    id: "document-checklists",
    defaultRowSpan: 6,
    defaultColumnSpan: 2,
    component: DocumentChecklistConfigWidget,
    title: "Document checklists",
    description: "Configure required documents by status gate for applications and interventions.",
    helpComponent: DocumentChecklistConfigHelp,
    helpTitle: "Document checklists",
    aiContext: DocumentChecklistConfigHelp?.aiContext,
  },
  env: {
    id: "env",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: EnvironmentWidget,
    title: "Environment",
    description: "Runtime environment flags and demo navigation visibility.",
    helpComponent: EnvironmentWidgetHelp,
    helpTitle: "Environment",
    aiContext: EnvironmentWidgetHelp?.aiContext,
  },
  secrets: {
    id: "secrets",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: SecretsWidget,
    title: "Secrets overview",
    description: "Presence of stored secrets and rotation status.",
    helpComponent: SecretsWidgetHelp,
    helpTitle: "Secrets overview",
    aiContext: SecretsWidgetHelp?.aiContext,
  },
  appearance: {
    id: "appearance",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: AppearanceWidget,
    title: "Appearance & Theme",
    description: "Dark mode and theme preferences.",
    helpComponent: AppearanceWidgetHelp,
    helpTitle: "Appearance settings",
    aiContext: AppearanceWidgetHelp?.aiContext,
  },
  autoAssignment: {
    id: "autoAssignment",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: AutoAssignmentConfigWidget,
    title: "Automatic assignment",
    description: "Configure auto-assignment rules for incoming applications.",
    helpComponent: null,
    helpTitle: "Automatic assignment",
    aiContext: null,
  },
};

const defaultLayout = [
  { id: "ai", rowSpan: 5, columnSpan: 2 },
  { id: "auth", rowSpan: 4, columnSpan: 2 },
  { id: "locking", rowSpan: 4, columnSpan: 2 },
  { id: "slaConfig", rowSpan: 3, columnSpan: 2 },
  { id: "sessionAudit", rowSpan: 3, columnSpan: 2 },
  { id: "cors", rowSpan: 2, columnSpan: 2 },
  { id: "backend-jobs", rowSpan: 2, columnSpan: 2 },
  { id: "document-checklists", rowSpan: 6, columnSpan: 2 },
  { id: "autoAssignment", rowSpan: 4, columnSpan: 2 },
  { id: "env", rowSpan: 4, columnSpan: 2 },
  { id: "secrets", rowSpan: 3, columnSpan: 2 },
  { id: "appearance", rowSpan: 2, columnSpan: 2 },
];

const loadLayout = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
    return filtered.length ? filtered : null;
  } catch {
    return null;
  }
};

const persistLayout = layout => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage errors
  }
};

const toBoardItems = layout =>
  layout
    .map(item => {
      const definition = widgetRegistry[item.id];
      if (!definition) return null;
      return {
        id: definition.id,
        rowSpan: item.rowSpan ?? definition.defaultRowSpan,
        columnSpan: item.columnSpan ?? definition.defaultColumnSpan,
        columnOffset: item.columnOffset,
        data: {
          title: definition.title,
          description: definition.description,
          helpComponent: definition.helpComponent,
          helpTitle: definition.helpTitle,
          aiContext: definition.aiContext,
        },
      };
    })
    .filter(Boolean);

const exportLayout = items =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({
      id: def.id,
      data: { title: def.title, description: def.description },
    }));

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      !left ||
      !right ||
      left.id !== right.id ||
      (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
      (left.columnSpan ?? null) !== (right.columnSpan ?? null) ||
      (left.columnOffset ?? null) !== (right.columnOffset ?? null)
    ) {
      return false;
    }
  }
  return true;
};

const toOption = (value, modelOptions) => {
  if (!value) return null;
  const match = modelOptions.find(option => option.value === value);
  return match || { value, label: value };
};

const toOptionList = (values, modelOptions) =>
  values.map(value => toOption(value, modelOptions)).filter(Boolean);
export default function ConfigurationSettings({
  toggleHelpPanel,
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
}) {
  const { role = "" } = useAuth();
  const [layout, setLayout] = useState(() => loadLayout() ?? [...defaultLayout]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));
  useEffect(() => {
    // Auto-inject newly added widgets (e.g., auto-assignment) if the current layout was missing them.
    setLayout(current => {
      const known = new Set((current || []).map(item => item.id));
      let changed = false;
      const next = [...(current || [])];
      defaultLayout.forEach(item => {
        if (!known.has(item.id)) {
          next.push({ ...item });
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const [runtime, setRuntime] = useState(null);
  const [security, setSecurity] = useState(null);
  const [error, setError] = useState(null);
  const [demoToolbarSaving, setDemoToolbarSaving] = useState(false);
  const { useDarkMode: isDarkMode, setUseDarkMode } = useDarkModeContext();
  const [demoToolbarVisibility, setDemoToolbarVisibility] = useState(() =>
    readDemoNavigationVisibility(),
  );

  const [slaTargets, setSlaTargets] = useState([]);
  const [slaEdits, setSlaEdits] = useState({});
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState(null);
  const [savingSla, setSavingSla] = useState(false);

  const [lockingConfig, setLockingConfig] = useState(null);
  const [lockingEdits, setLockingEdits] = useState(null);
  const [lockingLoading, setLockingLoading] = useState(true);
  const [lockingSaving, setLockingSaving] = useState(false);
  const [lockingError, setLockingError] = useState(null);

  const [authSessionAdminOriginal, setAuthSessionAdminOriginal] = useState(null);
  const [authSessionAdminEdits, setAuthSessionAdminEdits] = useState(null);
  const [authSessionPublicOriginal, setAuthSessionPublicOriginal] = useState(null);
  const [authSessionPublicEdits, setAuthSessionPublicEdits] = useState(null);
  const [authPolicyAdminOriginal, setAuthPolicyAdminOriginal] = useState(null);
  const [authPolicyAdminEdits, setAuthPolicyAdminEdits] = useState(null);
  const [authPolicyPublicOriginal, setAuthPolicyPublicOriginal] = useState(null);
  const [authPolicyPublicEdits, setAuthPolicyPublicEdits] = useState(null);
  const [savingAuthSessionScope, setSavingAuthSessionScope] = useState({
    admin: false,
    public: false,
  });
  const [savingAuthPolicyScope, setSavingAuthPolicyScope] = useState({
    admin: false,
    public: false,
  });
  const [syncingFederationScope, setSyncingFederationScope] = useState({
    admin: false,
    public: false,
  });
  const [authTab, setAuthTab] = useState("admin");
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [claimsModalContent, setClaimsModalContent] = useState("");

  const [auditStats, setAuditStats] = useState(null);
  const [auditRecent, setAuditRecent] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const [aiModelValue, setAiModelValue] = useState(null);
  const [modelOptions, setModelOptions] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [savingModel, setSavingModel] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [savingFallbacks, setSavingFallbacks] = useState(false);
  const [params, setParams] = useState({
    temperature: "",
    top_p: "",
    max_tokens: "",
    presence_penalty: "",
    frequency_penalty: "",
  });
  const [fallbackValues, setFallbackValues] = useState([]);

  const selectedAiModel = useMemo(
    () => toOption(aiModelValue, modelOptions),
    [aiModelValue, modelOptions],
  );
  const selectedFallbackOptions = useMemo(
    () => toOptionList(fallbackValues, modelOptions),
    [fallbackValues, modelOptions],
  );
  const availableModelValues = useMemo(
    () => new Set(modelOptions.map(option => option.value)),
    [modelOptions],
  );
  const unavailableDefaultModel = useMemo(() => {
    if (!aiModelValue || modelsLoading || modelsError) return null;
    return availableModelValues.has(aiModelValue) ? null : aiModelValue;
  }, [aiModelValue, availableModelValues, modelsError, modelsLoading]);
  const unavailableFallbackModels = useMemo(() => {
    if (modelsLoading || modelsError) return [];
    return fallbackValues.filter(value => !availableModelValues.has(value));
  }, [availableModelValues, fallbackValues, modelsError, modelsLoading]);
  const canSaveSelectedModel = Boolean(selectedAiModel) && (!unavailableDefaultModel || Boolean(modelsError));
  const canSaveSelectedFallbacks =
    !unavailableFallbackModels.length || Boolean(modelsError);

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Configuration Settings", href: "/configuration-settings" },
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems.map(item => item.id));
    if (signature !== paletteSignatureRef.current) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === "function") {
        setAvailableItems(paletteItems);
      }
    }
    persistLayout(exportLayout(boardItems));
  }, [boardItems, paletteItems, setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      setAvailableItems(paletteItems);
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : [...defaultLayout]));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette.map(item => item.id));
    if (typeof setAvailableItems === "function") {
      setAvailableItems(defaultPalette);
    }
    persistLayout(defaultLayout);
  }, [setAvailableItems]);

  useEffect(() => {
    const openHandler = () => openPalette();
    const resetHandler = () => resetLayout();
    window.addEventListener("configuration-dashboard:openPalette", openHandler);
    window.addEventListener("configuration-dashboard:resetLayout", resetHandler);
    return () => {
      window.removeEventListener("configuration-dashboard:openPalette", openHandler);
      window.removeEventListener("configuration-dashboard:resetLayout", resetHandler);
    };
  }, [openPalette, resetLayout]);

  const handleItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  }, []);

  useEffect(() => {
    loadDemoNavigationVisibility().catch(() => {
      setDemoToolbarVisibility(readDemoNavigationVisibility());
    });
    const unsubscribe = subscribeToDemoNavigationVisibility(map => {
      setDemoToolbarVisibility(map || readDemoNavigationVisibility());
    });
    return unsubscribe;
  }, []);

  const canEditAI = role === "System Administrator";
  const canEditAuth = role === "System Administrator";
  const canEditSla = role === "System Administrator" || role === "NWAC Administrator";
  const canEditLocking = role === "System Administrator";
  const canEditDemoToolbarVisibility = role === "System Administrator";

  const visibility = security?.visibility;
  const canSeeAnySecrets = visibility === "admin" || visibility === "restricted";
  const fullyAdminSecrets = visibility === "admin";
  const parseLockingMinutes = useCallback(value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric);
  }, []);

  const normaliseLocking = useCallback(
    value => {
      const modeRaw = typeof value?.mode === "string" ? value.mode.toLowerCase() : DEFAULT_LOCKING_CONFIG.mode;
      const mode = LOCKING_MODE_OPTIONS.some(option => option.value === modeRaw)
        ? modeRaw
        : DEFAULT_LOCKING_CONFIG.mode;

      const ttlRaw = Number(value?.lockTtlMinutes);
      const ttl = Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.round(ttlRaw) : DEFAULT_LOCKING_CONFIG.lockTtlMinutes;

      const heartbeatRaw = Number(value?.heartbeatMinutes);
      let heartbeat = Number.isFinite(heartbeatRaw) && heartbeatRaw > 0 ? Math.round(heartbeatRaw) : null;
      if (heartbeat !== null && heartbeat > ttl) heartbeat = ttl;

      return {
        mode,
        lockTtlMinutes: ttl,
        heartbeatMinutes: heartbeat,
        source: value?.source || null,
      };
    },
    [],
  );

  const toLockingEditState = useCallback(config => ({
    mode: config.mode,
    lockTtlMinutes: config.lockTtlMinutes != null ? String(config.lockTtlMinutes) : "",
    heartbeatMinutes: config.heartbeatMinutes != null ? String(config.heartbeatMinutes) : "",
  }), []);

  const lockingDirty = useMemo(() => {
    if (!lockingConfig || !lockingEdits) return false;
    const ttl = parseLockingMinutes(lockingEdits.lockTtlMinutes) ?? lockingConfig.lockTtlMinutes;
    const heartbeat = parseLockingMinutes(lockingEdits.heartbeatMinutes);
    const normalizedHeartbeat = heartbeat ?? null;
    return (
      lockingEdits.mode !== lockingConfig.mode ||
      ttl !== lockingConfig.lockTtlMinutes ||
      (normalizedHeartbeat ?? null) !== (lockingConfig.heartbeatMinutes ?? null)
    );
  }, [lockingConfig, lockingEdits, parseLockingMinutes]);

  const lockingUi = useMemo(() => {
    const currentMode = lockingEdits?.mode || lockingConfig?.mode || DEFAULT_LOCKING_CONFIG.mode;
    const selectedMode =
      LOCKING_MODE_OPTIONS.find(option => option.value === currentMode) || LOCKING_MODE_OPTIONS[0];
    const ttlInput = lockingEdits?.lockTtlMinutes ?? "";
    const heartbeatInput = lockingEdits?.heartbeatMinutes ?? "";

    const parsedTtl = parseLockingMinutes(ttlInput);
    const ttlError = ttlInput && parsedTtl === null ? "Enter a positive number of minutes." : null;

    const parsedHeartbeat = parseLockingMinutes(heartbeatInput);
    let heartbeatError = heartbeatInput && parsedHeartbeat === null ? "Enter a positive number of minutes." : null;
    if (!heartbeatError && parsedHeartbeat !== null) {
      const compareTtl = parsedTtl ?? lockingConfig?.lockTtlMinutes ?? DEFAULT_LOCKING_CONFIG.lockTtlMinutes;
      if (parsedHeartbeat > compareTtl) {
        heartbeatError = "Heartbeat interval must be less than or equal to the lock timeout.";
      }
    }

    const disableInputs = lockingLoading || !canEditLocking;
    const disableActions =
      disableInputs || lockingSaving || !lockingDirty || Boolean(ttlError) || Boolean(heartbeatError);

    return {
      selectedMode,
      ttlInput,
      heartbeatInput,
      ttlError,
      heartbeatError,
      disableInputs,
      disableActions,
    };
  }, [
    lockingEdits,
    lockingConfig,
    parseLockingMinutes,
    lockingLoading,
    canEditLocking,
    lockingSaving,
    lockingDirty,
  ]);

  const handleDemoToolbarVisibilityChange = useCallback(async (roleName, visible) => {
    if (!canEditDemoToolbarVisibility || demoToolbarSaving) return;
    const next = {
      ...(demoToolbarVisibility || readDemoNavigationVisibility()),
      [roleName]: visible,
    };
    setDemoToolbarSaving(true);
    setError(null);
    try {
      const saved = await saveDemoNavigationVisibility(next);
      const visibility = saved?.visibility || readDemoNavigationVisibility();
      setDemoToolbarVisibility(visibility);
      setRuntime(current => (current ? { ...current, demoNavigation: saved } : current));
    } catch (err) {
      setError(err?.message || "Failed to save demo toolbar visibility.");
      setDemoToolbarVisibility(readDemoNavigationVisibility());
    } finally {
      setDemoToolbarSaving(false);
    }
  }, [canEditDemoToolbarVisibility, demoToolbarSaving, demoToolbarVisibility]);

  const demoToolbarRows = useMemo(() => {
    const map = demoToolbarVisibility || {};
    return DEMO_NAVIGATION_ROLES.map(roleName => ({
      role: roleName,
      visible: Object.prototype.hasOwnProperty.call(map, roleName) ? !!map[roleName] : false,
    }));
  }, [demoToolbarVisibility]);

  const demoToolbarColumns = useMemo(
    () => [
      {
        id: "role",
        header: "Role",
        cell: item => item.role,
      },
      {
        id: "visible",
        header: "Visible",
        cell: item => (
          <Button
            variant={item.visible ? "normal" : "link"}
            disabled={!canEditDemoToolbarVisibility || demoToolbarSaving}
            onClick={() => handleDemoToolbarVisibilityChange(item.role, !item.visible)}
          >
            {item.visible ? "Visible" : "Hidden"}
          </Button>
        ),
      },
    ],
    [canEditDemoToolbarVisibility, demoToolbarSaving, handleDemoToolbarVisibilityChange],
  );

  const seedSlaEdits = useCallback(items => {
    const next = items.reduce((acc, item) => {
      const days = item?.target_days;
      acc[item.stage_key] = {
        target_days: days === null || days === undefined ? "" : String(days),
        description: item?.description || "",
      };
      return acc;
    }, {});
    setSlaEdits(next);
  }, []);

  const fetchSlaTargets = useCallback(async () => {
    setSlaLoading(true);
    setSlaError(null);
    try {
      const response = await fetchJSON("/api/config/sla-targets");
      const items = Array.isArray(response?.targets) ? response.targets : [];
      const normalised = items.length
        ? items
            .map(item => {
              const key = item.stage_key || item.stage || "";
              if (!SLA_STAGE_ALLOWLIST.has(key)) return null;
              const hours = item.target_hours ?? item.targetHours ?? null;
              return {
                id: item.id || null,
                stage_key: key,
                display_name: item.display_name || SLA_STAGE_LABELS[key] || key,
                target_days:
                  hours === null || hours === undefined
                    ? ""
                    : String(Math.round(Number(hours) / 24)),
                description: item.description || "",
                applies_to_role: item.applies_to_role ?? item.appliesToRole ?? null,
              };
            })
            .filter(Boolean)
        : SLA_STAGE_PLACEHOLDER.map(item => ({ ...item }));
      const merged = mergeSlaTargetsWithPlaceholders(
        normalised.length ? normalised : SLA_STAGE_PLACEHOLDER.map(item => ({ ...item }))
      );
      setSlaTargets(merged);
      seedSlaEdits(merged);
    } catch (err) {
      const message = err?.message || "Failed to load workflow timing targets";
      setSlaTargets(prev => {
        if (prev.length) return prev;
        const fallback = SLA_STAGE_PLACEHOLDER.map(item => ({ ...item }));
        seedSlaEdits(fallback);
        return fallback;
      });
      if (!String(message).includes("404")) {
        setSlaError(message);
      }
    } finally {
      setSlaLoading(false);
    }
  }, [seedSlaEdits]);

  useEffect(() => {
    fetchSlaTargets();
  }, [fetchSlaTargets]);

  const effectiveSlaTargets = useMemo(
    () => (slaTargets.length ? slaTargets : SLA_STAGE_PLACEHOLDER),
    [slaTargets],
  );

  const filteredSlaTargets = useMemo(() => {
    const filtered = (effectiveSlaTargets || []).filter(item =>
      item && SLA_STAGE_ALLOWLIST.has(item.stage_key)
    );
    return filtered.length ? filtered : SLA_STAGE_PLACEHOLDER;
  }, [effectiveSlaTargets]);

  const isSlaDirty = useMemo(
    () =>
      filteredSlaTargets.some(item => {
        const edit = slaEdits[item.stage_key];
        if (!edit) return false;
        const originalDays =
          item.target_days === null || item.target_days === undefined
            ? ""
            : String(item.target_days);
        const originalNotes = item.description || "";
        return (
          edit.target_days !== originalDays ||
          (edit.description || "") !== originalNotes
        );
      }),
    [filteredSlaTargets, slaEdits],
  );

  const handleSlaEdit = useCallback((stageKey, field, value) => {
    setSlaEdits(prev => ({
      ...prev,
      [stageKey]: {
        ...prev[stageKey],
        target_days:
          field === "target_days"
            ? value.replace(/[^0-9]/g, "")
            : prev[stageKey]?.target_days ?? "",
        description:
          field === "description" ? value : prev[stageKey]?.description ?? "",
      },
    }));
  }, []);

  const handleSlaReset = useCallback(() => {
    seedSlaEdits(filteredSlaTargets);
    setSlaError(null);
  }, [filteredSlaTargets, seedSlaEdits]);

  const handleSlaSave = useCallback(async () => {
    if (!canEditSla) return;

    const payloads = filteredSlaTargets.map(item => {
      const edit = slaEdits[item.stage_key] || { target_days: "", description: "" };
      const daysValue = edit.target_days === "" ? null : Number(edit.target_days);
      return {
        id: item.id,
        stage_key: item.stage_key,
        target_hours:
          daysValue === null || Number.isNaN(daysValue) ? null : Number(daysValue) * 24,
        description: edit.description || "",
        applies_to_role: item.applies_to_role || null,
        display_name: item.display_name,
      };
    });

    for (const target of payloads) {
      if (target.target_hours === null || Number.isNaN(target.target_hours)) {
        setSlaError(
          `Target days required for ${SLA_STAGE_LABELS[target.stage_key] || target.stage_key}`,
        );
        return;
      }
    }

    setSavingSla(true);
    setSlaError(null);
    try {
      await Promise.all(
        payloads.map(async target => {
          const body = {
            target_hours: target.target_hours,
            description: target.description,
          };
          if (target.id) {
            await fetchJSON(`/api/config/sla-targets/${target.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          } else {
            await fetchJSON("/api/config/sla-targets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stage_key: target.stage_key,
                target_hours: target.target_hours,
                description: target.description,
                applies_to_role: target.applies_to_role,
              }),
            });
          }
        }),
      );
      await fetchSlaTargets();
    } catch (err) {
      setSlaError(err?.message || "Failed to save workflow timing targets");
    } finally {
      setSavingSla(false);
    }
  }, [canEditSla, filteredSlaTargets, fetchSlaTargets, slaEdits]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const stats = await fetchJSON("/api/audit/session/stats");
      const recent = await fetchJSON("/api/audit/session/recent?limit=25");
      setAuditStats(stats);
      setAuditRecent(recent.sessions || []);
    } catch (err) {
      setAuditError(err.message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const loadModelOptions = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchJSON("/api/ai/models");
      const options = Array.isArray(data?.models)
        ? data.models.map(model => ({
            value: model.id,
            label: model.name || model.id,
            description: model.provider || model.architecture,
          }))
        : [];
      setModelOptions(options);
    } catch (err) {
      setModelsError(err.message);
      console.error("[configuration] Failed to load AI model catalogue:", err);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const loadAiStatus = useCallback(async () => {
    try {
      const status = await fetchJSON("/api/ai/status");
      if (status?.model) {
        setAiModelValue(status.model);
      }
      if (status?.params) {
        setParams(prev => ({
          ...prev,
          temperature:
            typeof status.params.temperature === "number" ? Number(status.params.temperature) : "",
          top_p: typeof status.params.top_p === "number" ? Number(status.params.top_p) : "",
          max_tokens:
            typeof status.params.max_tokens === "number" ? Number(status.params.max_tokens) : "",
          presence_penalty:
            typeof status.params.presence_penalty === "number"
              ? Number(status.params.presence_penalty)
              : "",
          frequency_penalty:
            typeof status.params.frequency_penalty === "number"
              ? Number(status.params.frequency_penalty)
              : "",
        }));
      }
      if (Array.isArray(status?.fallbacks)) {
        setFallbackValues(status.fallbacks.map(value => String(value)));
      }
    } catch (err) {
      console.error("[configuration] Failed to load AI status:", err);
    }
  }, []);

  useEffect(() => {
    loadModelOptions();
    loadAiStatus();
  }, [loadModelOptions, loadAiStatus]);

  const loadConfiguration = useCallback(async () => {
    setError(null);
    setLockingLoading(true);
    setLockingError(null);
    try {
      const [runtimeResponse, securityResponse] = await Promise.all([
        fetchJSON("/api/config/runtime"),
        fetchJSON("/api/config/security"),
      ]);

      setRuntime(runtimeResponse);
      setSecurity(securityResponse);

      if (runtimeResponse?.ai?.model) {
        setAiModelValue(runtimeResponse.ai.model);
      }
      if (runtimeResponse?.ai?.params) {
        const cleaned = {};
        const defaults = {
          temperature: 0.7,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
        };
        Object.entries(runtimeResponse.ai.params).forEach(([key, value]) => {
          if (value === null || typeof value === "undefined") {
            cleaned[key] = key === "max_tokens" ? "" : defaults[key] ?? "";
          } else {
            cleaned[key] = value;
          }
        });
        setParams(prev => ({ ...prev, ...cleaned }));
      }
      if (Array.isArray(runtimeResponse?.ai?.fallbackModels)) {
        setFallbackValues(runtimeResponse.ai.fallbackModels.map(model => String(model)));
      }
      const demoNavigationVisibility = runtimeResponse?.demoNavigation?.visibility
        ? applyDemoNavigationVisibility(runtimeResponse.demoNavigation.visibility)
        : readDemoNavigationVisibility();
      setDemoToolbarVisibility(demoNavigationVisibility);

      const tokenTtl = runtimeResponse?.auth?.tokenTtl || {};
      const sessionTemplate = scope => {
        const frontendIdle = scope?.frontendIdle;
        let warningCountdownSeconds =
          scope?.warningCountdownSeconds ??
          scope?.warningSeconds ??
          "";
        if (
          (warningCountdownSeconds === "" || warningCountdownSeconds == null) &&
          frontendIdle !== null &&
          typeof frontendIdle !== "undefined" &&
          frontendIdle !== ""
        ) {
          const idle = Number(frontendIdle);
          if (Number.isFinite(idle)) {
            const computed = Math.floor(idle * 0.1);
            warningCountdownSeconds = Math.max(
              5,
              Math.min(Math.max(5, idle - 10), computed || 30),
            );
          }
        }
        let warningTriggerSeconds = scope?.warningTriggerSeconds;
        if (
          (warningTriggerSeconds === null ||
            typeof warningTriggerSeconds === "undefined" ||
            warningTriggerSeconds === "") &&
          frontendIdle !== null &&
          typeof frontendIdle !== "undefined" &&
          frontendIdle !== "" &&
          warningCountdownSeconds !== ""
        ) {
          const trigger = Number(frontendIdle) - Number(warningCountdownSeconds);
          warningTriggerSeconds = Number.isFinite(trigger) && trigger >= 0 ? trigger : "";
        }
        return {
          access: scope?.access || "",
          id: scope?.id || "",
          refresh: scope?.refresh || "",
          frontendIdle: frontendIdle || "",
          absolute: scope?.absolute || "",
          warningTriggerSeconds: warningTriggerSeconds ?? "",
          warningCountdownSeconds,
          warningSeconds: scope?.warningSeconds || "",
        };
      };
      const adminTtlSource = runtimeResponse?.authAdmin?.tokenTtl || tokenTtl;
      const publicTtlSource = runtimeResponse?.authPublic?.tokenTtl || tokenTtl;
      const adminSession = sessionTemplate(adminTtlSource);
      const publicSession = sessionTemplate(publicTtlSource);
      setAuthSessionAdminOriginal(adminSession);
      setAuthSessionAdminEdits(adminSession);
      setAuthSessionPublicOriginal(publicSession);
      setAuthSessionPublicEdits(publicSession);

      const policyTemplate = auth => ({
        mfaMode: auth?.mfa?.mode || auth?.mfaMode || "off",
        pkceRequired: !!auth?.pkceRequired,
        passwordPolicy: {
          minLength: auth?.passwordPolicy?.minLength || 8,
          requireUpper: !!auth?.passwordPolicy?.requireUpper,
          requireLower: !!auth?.passwordPolicy?.requireLower,
          requireNumber: !!auth?.passwordPolicy?.requireNumber,
          requireSymbol: !!auth?.passwordPolicy?.requireSymbol,
        },
        lockout: {
          threshold: auth?.lockout?.threshold || 5,
          durationSeconds: auth?.lockout?.durationSeconds || 900,
        },
        federation: {
          providers: auth?.federation?.providers || [],
          lastSync: auth?.federation?.lastSync || null,
        },
      });

      const baseAuth = runtimeResponse?.auth || {};
      const adminPolicy = policyTemplate(baseAuth);
      const publicPolicy = policyTemplate(baseAuth);
      setAuthPolicyAdminOriginal(adminPolicy);
      setAuthPolicyAdminEdits(adminPolicy);
      setAuthPolicyPublicOriginal(publicPolicy);
      setAuthPolicyPublicEdits(publicPolicy);

      try {
        if (runtimeResponse?.appearance?.darkMode != null) {
          setUseDarkMode(!!runtimeResponse.appearance.darkMode);
        }
      } catch {
        // ignore theme sync errors
      }

      try {
        const locking = await fetchJSON("/api/config/runtime/locking");
        const normalized = normaliseLocking(locking);
        setLockingConfig(normalized);
        setLockingEdits(toLockingEditState(normalized));
      } catch (lockingErr) {
        setLockingError(lockingErr.message);
        const fallbackConfig = normaliseLocking(DEFAULT_LOCKING_CONFIG);
        setLockingConfig(fallbackConfig);
        setLockingEdits(toLockingEditState(fallbackConfig));
      } finally {
        setLockingLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLockingLoading(false);
    }
  }, [normaliseLocking, setUseDarkMode, toLockingEditState]);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const saveModel = useCallback(async () => {
    if (!selectedAiModel?.value) return;
    setSavingModel(true);
    try {
      await fetchJSON("/api/config/runtime/ai-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedAiModel.value }),
      });
    } catch (err) {
      console.error("[configuration] Failed to save AI model:", err);
    } finally {
      setSavingModel(false);
    }
  }, [selectedAiModel]);

  const saveParams = useCallback(async () => {
    setSavingParams(true);
    const coerceNumber = value => {
      if (value === "" || value === null || typeof value === "undefined") return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };
    try {
      await fetchJSON("/api/config/runtime/ai-params", {
        method: "PATCH",
        body: {
          temperature: coerceNumber(params.temperature),
          top_p: coerceNumber(params.top_p),
          max_tokens: coerceNumber(params.max_tokens),
          presence_penalty: coerceNumber(params.presence_penalty),
          frequency_penalty: coerceNumber(params.frequency_penalty),
        },
      });
    } catch (err) {
      console.error("[configuration] Failed to save AI parameters:", err);
    } finally {
      setSavingParams(false);
    }
  }, [params]);

  const saveFallbacks = useCallback(async () => {
    setSavingFallbacks(true);
    try {
      await fetchJSON("/api/config/runtime/ai-fallbacks", {
        method: "PATCH",
        body: { fallbackModels: fallbackValues },
      });
    } catch (err) {
      console.error("[configuration] Failed to save AI fallbacks:", err);
    } finally {
      setSavingFallbacks(false);
    }
  }, [fallbackValues]);

  const numberInput = useCallback(
    (field, min, max, step) => {
      const raw = params[field];
      const value =
        raw === "" || raw === null || typeof raw === "undefined" ? "" : String(raw);
      return (
        <Input
          type="number"
          value={value}
          onChange={event => {
            const next = event.detail.value;
            setParams(prev => ({
              ...prev,
              [field]: next === "" ? "" : Number(next),
            }));
          }}
          min={min}
          max={max}
          step={step}
          disabled={!canEditAI}
        />
      );
    },
    [canEditAI, params],
  );

  const resetLockingEdits = useCallback(() => {
    if (!lockingConfig) return;
    setLockingEdits(toLockingEditState(lockingConfig));
    setLockingError(null);
  }, [lockingConfig, toLockingEditState]);

  const saveLockingConfig = useCallback(async () => {
    if (!canEditLocking || !lockingEdits) return;
    setLockingSaving(true);
    setLockingError(null);
    try {
      const ttl =
        parseLockingMinutes(lockingEdits.lockTtlMinutes) ??
        lockingConfig?.lockTtlMinutes ??
        DEFAULT_LOCKING_CONFIG.lockTtlMinutes;
      const heartbeat = parseLockingMinutes(lockingEdits.heartbeatMinutes);
      const payload = {
        mode: lockingEdits.mode || DEFAULT_LOCKING_CONFIG.mode,
        lockTtlMinutes: ttl,
        heartbeatMinutes: heartbeat ?? null,
      };
      const saved = await fetchJSON("/api/config/runtime/locking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const normalized = normaliseLocking(saved);
      setLockingConfig(normalized);
      setLockingEdits(toLockingEditState(normalized));
    } catch (err) {
      setLockingError(err.message);
    } finally {
      setLockingSaving(false);
    }
  }, [
    canEditLocking,
    lockingEdits,
    lockingConfig,
    normaliseLocking,
    parseLockingMinutes,
    toLockingEditState,
  ]);

  const scopeState = useCallback(
    scope => {
      const adminScope = scope === "admin";
      return {
        sessionOriginal: adminScope ? authSessionAdminOriginal : authSessionPublicOriginal,
        sessionEdits: adminScope ? authSessionAdminEdits : authSessionPublicEdits,
        setSessionEdits: adminScope ? setAuthSessionAdminEdits : setAuthSessionPublicEdits,
        policyOriginal: adminScope ? authPolicyAdminOriginal : authPolicyPublicOriginal,
        policyEdits: adminScope ? authPolicyAdminEdits : authPolicyPublicEdits,
        setPolicyEdits: adminScope ? setAuthPolicyAdminEdits : setAuthPolicyPublicEdits,
      };
    },
    [
      authSessionAdminOriginal,
      authSessionPublicOriginal,
      authSessionAdminEdits,
      authSessionPublicEdits,
      authPolicyAdminOriginal,
      authPolicyPublicOriginal,
      authPolicyAdminEdits,
      authPolicyPublicEdits,
    ],
  );

  const isSessionDirty = useCallback(
    scope => {
      const { sessionOriginal, sessionEdits } = scopeState(scope);
      if (!sessionOriginal || !sessionEdits) return false;
      return (
        sessionOriginal.access !== sessionEdits.access ||
        sessionOriginal.id !== sessionEdits.id ||
        sessionOriginal.refresh !== sessionEdits.refresh ||
        sessionOriginal.frontendIdle !== sessionEdits.frontendIdle ||
        sessionOriginal.absolute !== sessionEdits.absolute ||
        sessionOriginal.warningTriggerSeconds !== sessionEdits.warningTriggerSeconds ||
        sessionOriginal.warningCountdownSeconds !== sessionEdits.warningCountdownSeconds ||
        sessionOriginal.warningSeconds !== sessionEdits.warningSeconds
      );
    },
    [scopeState],
  );

  const isPolicyDirty = useCallback(
    scope => {
      const { policyOriginal, policyEdits } = scopeState(scope);
      if (!policyOriginal || !policyEdits) return false;
      return (
        policyOriginal.mfaMode !== policyEdits.mfaMode ||
        policyOriginal.pkceRequired !== policyEdits.pkceRequired ||
        policyOriginal.passwordPolicy.minLength !== policyEdits.passwordPolicy.minLength ||
        policyOriginal.passwordPolicy.requireUpper !== policyEdits.passwordPolicy.requireUpper ||
        policyOriginal.passwordPolicy.requireLower !== policyEdits.passwordPolicy.requireLower ||
        policyOriginal.passwordPolicy.requireNumber !== policyEdits.passwordPolicy.requireNumber ||
        policyOriginal.passwordPolicy.requireSymbol !== policyEdits.passwordPolicy.requireSymbol ||
        policyOriginal.lockout.threshold !== policyEdits.lockout.threshold ||
        policyOriginal.lockout.durationSeconds !== policyEdits.lockout.durationSeconds
      );
    },
    [scopeState],
  );

  const sessionDirty = useMemo(
    () => ({ admin: isSessionDirty("admin"), public: isSessionDirty("public") }),
    [isSessionDirty],
  );

  const policyDirty = useMemo(
    () => ({ admin: isPolicyDirty("admin"), public: isPolicyDirty("public") }),
    [isPolicyDirty],
  );

  const resetAuthSession = useCallback(
    scope => {
      const adminScope = scope === "admin";
      if (adminScope && authSessionAdminOriginal) {
        setAuthSessionAdminEdits(authSessionAdminOriginal);
      }
      if (!adminScope && authSessionPublicOriginal) {
        setAuthSessionPublicEdits(authSessionPublicOriginal);
      }
    },
    [authSessionAdminOriginal, authSessionPublicOriginal],
  );

  const resetAuthPolicy = useCallback(
    scope => {
      const adminScope = scope === "admin";
      if (adminScope && authPolicyAdminOriginal) {
        setAuthPolicyAdminEdits(authPolicyAdminOriginal);
      }
      if (!adminScope && authPolicyPublicOriginal) {
        setAuthPolicyPublicEdits(authPolicyPublicOriginal);
      }
    },
    [authPolicyAdminOriginal, authPolicyPublicOriginal],
  );

  const saveAuthSession = useCallback(
    async scope => {
      if (!isSessionDirty(scope)) return;
      const { sessionEdits } = scopeState(scope);
      if (!sessionEdits) return;
      try {
        setSavingAuthSessionScope(prev => ({ ...prev, [scope]: true }));
        const body = { tokenTtl: sessionEdits };
        const pathBase = "/api/config/runtime/auth-session";
        let response;
        try {
          response = await fetchJSON(`${pathBase}?scope=${scope}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch (err) {
          if (/404/.test(err.message)) {
            response = await fetchJSON(pathBase, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          } else {
            throw err;
          }
        }
        setRuntime(current => ({
          ...(current || {}),
          auth: {
            ...(current?.auth || {}),
            tokenTtl: { ...(response?.tokenTtl || sessionEdits) },
          },
        }));
        if (scope === "admin") {
          setAuthSessionAdminOriginal(sessionEdits);
        } else {
          setAuthSessionPublicOriginal(sessionEdits);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingAuthSessionScope(prev => ({ ...prev, [scope]: false }));
      }
    },
    [isSessionDirty, scopeState],
  );

  const saveAuthPolicy = useCallback(
    async scope => {
      if (!isPolicyDirty(scope)) return;
      const { policyEdits } = scopeState(scope);
      if (!policyEdits) return;
      try {
        setSavingAuthPolicyScope(prev => ({ ...prev, [scope]: true }));
        const body = {
          mfa: { mode: policyEdits.mfaMode },
          passwordPolicy: policyEdits.passwordPolicy,
          lockout: policyEdits.lockout,
          pkceRequired: policyEdits.pkceRequired,
        };
        await fetchJSON(`/api/config/runtime/auth-policy?scope=${scope}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (scope === "admin") {
          setAuthPolicyAdminOriginal(policyEdits);
        } else {
          setAuthPolicyPublicOriginal(policyEdits);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingAuthPolicyScope(prev => ({ ...prev, [scope]: false }));
      }
    },
    [isPolicyDirty, scopeState],
  );

  const handleAuthSave = useCallback(
    async scope => {
      await Promise.all([saveAuthSession(scope), saveAuthPolicy(scope)]);
    },
    [saveAuthPolicy, saveAuthSession],
  );

  const handleAuthCancel = useCallback(
    scope => {
      resetAuthSession(scope);
      resetAuthPolicy(scope);
    },
    [resetAuthPolicy, resetAuthSession],
  );

  const buildAiHeaderActions = useCallback(() => {
    const badges = [];
    if (runtime?.ai?.model) {
      badges.push(
        <Badge key="model" color="blue">
          {runtime.ai.model}
        </Badge>,
      );
    }
    if (runtime?.ai?.enabled != null) {
      badges.push(
        <Badge key="enabled" color={runtime.ai.enabled ? "green" : "red"}>
          {runtime.ai.enabled ? "Enabled" : "Disabled"}
        </Badge>,
      );
    }
    if (!badges.length) return undefined;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        {badges}
      </SpaceBetween>
    );
  }, [runtime]);

  const buildSlaHeaderActions = useCallback(() => {
    if (!canEditSla) {
      return <Badge color="grey">Read only</Badge>;
    }
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button onClick={handleSlaSave} loading={savingSla} disabled={!isSlaDirty || savingSla}>
          Save
        </Button>
        <Button variant="link" onClick={handleSlaReset} disabled={!isSlaDirty || savingSla}>
          Cancel
        </Button>
      </SpaceBetween>
    );
  }, [canEditSla, handleSlaReset, handleSlaSave, isSlaDirty, savingSla]);

  const buildLockingHeaderActions = useCallback(() => {
    if (!canEditLocking) {
      return <Badge color="grey">Read only</Badge>;
    }
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          onClick={resetLockingEdits}
          disabled={lockingLoading || lockingSaving || !lockingDirty}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          loading={lockingSaving}
          disabled={lockingUi.disableActions}
          onClick={saveLockingConfig}
        >
          Save locking settings
        </Button>
      </SpaceBetween>
    );
  }, [
    canEditLocking,
    lockingDirty,
    lockingLoading,
    lockingSaving,
    lockingUi.disableActions,
    resetLockingEdits,
    saveLockingConfig,
  ]);

  const buildAuthHeaderActions = useCallback(() => {
    const auth = runtime?.auth || {};
    const currentScope = authTab === "public" ? "public" : "admin";
    const dirty = sessionDirty[currentScope] || policyDirty[currentScope];
    const scopeSaving =
      savingAuthSessionScope[currentScope] || savingAuthPolicyScope[currentScope];

    const actions = [];
    if (canEditAuth) {
      actions.push(
        <Button
          key="auth-save"
          onClick={() => handleAuthSave(currentScope)}
          loading={scopeSaving}
          disabled={!dirty}
        >
          Save
        </Button>,
      );
      actions.push(
        <Button
          key="auth-cancel"
          variant="link"
          onClick={() => handleAuthCancel(currentScope)}
          disabled={!dirty || scopeSaving}
        >
          Cancel
        </Button>,
      );
    }
    if (auth.provider) {
      actions.push(
        <Badge key="provider" color="blue">
          {auth.provider}
        </Badge>,
      );
    }
    const mfaMode = auth.mfa?.mode || auth.mfaMode;
    if (mfaMode) {
      actions.push(
        <Badge key="mfa" color="purple">
          MFA: {mfaMode.toLowerCase()}
        </Badge>,
      );
    }
    const ssoEnabled = auth.ssoEnabled || auth.sso?.enabled;
    if (ssoEnabled) {
      actions.push(
        <Badge key="sso" color="green">
          SSO
        </Badge>,
      );
    }
    if (auth.issuer) {
      actions.push(
        <Button
          key="copy-issuer"
          variant="inline-icon"
          iconName="copy"
          ariaLabel="Copy issuer URL"
          onClick={() => navigator?.clipboard?.writeText(auth.issuer).catch(() => {})}
        />,
      );
    }
    if (auth.issuer || auth.jwksUri) {
      actions.push(
        <Button
          key="open-jwks"
          variant="inline-icon"
          iconName="external"
          ariaLabel="Open JWKS"
          onClick={() => {
            const jwks =
              auth.jwksUri ||
              (auth.issuer ? auth.issuer.replace(/\/$/, "") + "/.well-known/jwks.json" : null);
            if (jwks) window.open(jwks, "_blank", "noopener");
          }}
        />,
      );
    }
    actions.push(
      <Button
        key="refresh-auth"
        variant="inline-icon"
        iconName="refresh"
        ariaLabel="Refresh auth config"
        onClick={loadConfiguration}
      />,
    );
    if (!actions.length) return undefined;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        {actions}
      </SpaceBetween>
    );
  }, [
    authTab,
    canEditAuth,
    handleAuthCancel,
    handleAuthSave,
    loadConfiguration,
    policyDirty,
    runtime,
    savingAuthPolicyScope,
    savingAuthSessionScope,
    sessionDirty,
  ]);
  const renderItem = useCallback(
    (item, actions) => {
      if (!item?.id) return null;
      const metadata = item.data;
      switch (item.id) {
        case "ai":
          return (
            <AiConfigWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={buildAiHeaderActions()}
              aiModel={selectedAiModel}
              setAiModel={option => setAiModelValue(option?.value || null)}
              canEditAI={canEditAI}
              modelOptions={modelOptions}
              modelsLoading={modelsLoading}
              modelsError={modelsError}
              unavailableDefaultModel={unavailableDefaultModel}
              unavailableFallbackModels={unavailableFallbackModels}
              savingModel={savingModel}
              canSaveModel={canSaveSelectedModel}
              saveModel={saveModel}
              params={params}
              setParams={setParams}
              numberInput={numberInput}
              fallbacks={selectedFallbackOptions}
              setFallbacks={options => setFallbackValues(options.map(option => option.value))}
              savingParams={savingParams}
              saveParams={saveParams}
              savingFallbacks={savingFallbacks}
              canSaveFallbacks={canSaveSelectedFallbacks}
              saveFallbacks={saveFallbacks}
            />
          );
        case "auth":
          return (
            <AuthConfigWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={buildAuthHeaderActions()}
              runtime={runtime}
              canEditAuth={canEditAuth}
              authSessionAdminEdits={authSessionAdminEdits}
              setAuthSessionAdminEdits={setAuthSessionAdminEdits}
              authSessionPublicEdits={authSessionPublicEdits}
              setAuthSessionPublicEdits={setAuthSessionPublicEdits}
              authPolicyAdminOriginal={authPolicyAdminOriginal}
              authPolicyPublicOriginal={authPolicyPublicOriginal}
              authPolicyAdminEdits={authPolicyAdminEdits}
              setAuthPolicyAdminEdits={setAuthPolicyAdminEdits}
              authPolicyPublicEdits={authPolicyPublicEdits}
              setAuthPolicyPublicEdits={setAuthPolicyPublicEdits}
              savingAuthSessionScope={savingAuthSessionScope}
              savingAuthPolicyScope={savingAuthPolicyScope}
              syncingFederationScope={syncingFederationScope}
              setSyncingFederationScope={setSyncingFederationScope}
              sessionDirty={sessionDirty}
              policyDirty={policyDirty}
              setClaimsModalContent={setClaimsModalContent}
              setShowClaimsModal={setShowClaimsModal}
              fetchJSON={fetchJSON}
              setError={setError}
              authTab={authTab}
              setAuthTab={setAuthTab}
            />
          );
        case "locking":
          return (
            <LockingConfigWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={buildLockingHeaderActions()}
              lockingError={lockingError}
              setLockingError={setLockingError}
              lockingLoading={lockingLoading}
              lockingUi={lockingUi}
              lockingModeOptions={LOCKING_MODE_OPTIONS}
              lockingConfig={lockingConfig}
              defaultLockingConfig={DEFAULT_LOCKING_CONFIG}
              setLockingEdits={setLockingEdits}
            />
          );
        case "slaConfig":
          return (
            <SlaConfigWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={buildSlaHeaderActions()}
              slaError={slaError}
              slaLoading={slaLoading}
              effectiveSlaTargets={filteredSlaTargets}
              canEditSla={canEditSla}
              slaEdits={slaEdits}
              handleSlaEdit={handleSlaEdit}
              slaStageLabels={SLA_STAGE_LABELS}
            />
          );
        case "sessionAudit":
          return (
            <SessionAuditWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={undefined}
              auditError={auditError}
              setAuditError={setAuditError}
              auditLoading={auditLoading}
              auditStats={auditStats}
              auditRecent={auditRecent}
              fetchAudit={fetchAudit}
              fetchJSON={fetchJSON}
            />
          );
        case "autoAssignment":
          return (
            <AutoAssignmentConfigWidget
              actions={actions}
              role={role}
            />
          );
        case "cors":
          return (
            <CorsOriginsWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={undefined}
              runtime={runtime}
            />
          );
        case "env":
          return (
            <EnvironmentWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={undefined}
              runtime={runtime}
              demoToolbarColumns={demoToolbarColumns}
              demoToolbarRows={demoToolbarRows}
              demoToolbarSaving={demoToolbarSaving}
            />
          );
        case "secrets":
          return (
            <SecretsWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={undefined}
              security={security}
              canSeeAny={canSeeAnySecrets}
              fullyAdmin={fullyAdminSecrets}
            />
          );
        case "appearance":
          return (
            <AppearanceWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={undefined}
              isDarkMode={isDarkMode}
              setUseDarkMode={setUseDarkMode}
            />
          );
        case "backend-jobs":
          return (
            <BackendJobsWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
              headerActions={undefined}
            />
          );
        case "document-checklists":
          return (
            <DocumentChecklistConfigWidget
              actions={actions}
              metadata={metadata}
              toggleHelpPanel={toggleHelpPanel}
            />
          );
        default:
          return null;
      }
    },
    [
      auditError,
      auditLoading,
      auditRecent,
      auditStats,
      authPolicyAdminEdits,
      authPolicyAdminOriginal,
      authPolicyPublicEdits,
      authPolicyPublicOriginal,
      authSessionAdminEdits,
      authSessionPublicEdits,
      authTab,
      buildAiHeaderActions,
      buildAuthHeaderActions,
      buildLockingHeaderActions,
      buildSlaHeaderActions,
      canEditAI,
      canEditAuth,
      canEditSla,
      canSeeAnySecrets,
      demoToolbarColumns,
      demoToolbarRows,
      demoToolbarSaving,
      fetchAudit,
      filteredSlaTargets,
      fullyAdminSecrets,
      handleSlaEdit,
      isDarkMode,
      lockingConfig,
      lockingError,
      lockingLoading,
      lockingUi,
      modelOptions,
      modelsLoading,
      modelsError,
      numberInput,
      params,
      policyDirty,
      runtime,
      role,
      savingAuthPolicyScope,
      savingAuthSessionScope,
      savingFallbacks,
      savingModel,
      savingParams,
      saveFallbacks,
      saveModel,
      saveParams,
      security,
      canSaveSelectedFallbacks,
      canSaveSelectedModel,
      selectedAiModel,
      selectedFallbackOptions,
      sessionDirty,
      setUseDarkMode,
      slaEdits,
      slaError,
      slaLoading,
      syncingFederationScope,
      toggleHelpPanel,
      unavailableDefaultModel,
      unavailableFallbackModels,
    ],
  );

  return (
    <SpaceBetween size="l">
      {error && (
        <Box color="text-status-error" fontSize="body-s">
          {error}
        </Box>
      )}
      <Board
        boardId="configuration-dashboard"
        items={boardItems}
        renderItem={renderItem}
        onItemsChange={handleItemsChange}
        i18nStrings={{
          empty: "No widgets configured.",
          loading: "Loading widgets",
          columnAriaLabel: index => `Column ${index + 1}`,
          itemPositionAnnouncement: ({ currentColumn, currentIndex, currentRow }) =>
            `Widget moved to position ${currentIndex + 1}, column ${currentColumn + 1}, row ${currentRow + 1}`,
          liveAnnouncementDndStarted: () => "Dragging widget",
          liveAnnouncementDndItemReordered: operation => {
            const position =
              operation.direction === "horizontal"
                ? `column ${operation.placement.x + 1}`
                : `row ${operation.placement.y + 1}`;
            return `Widget moved to ${position}.`;
          },
          liveAnnouncementDndItemResized: operation => {
            const base =
              operation.direction === "horizontal"
                ? `columns ${operation.placement.width}`
                : `rows ${operation.placement.height}`;
            return `Widget resized to ${base}.`;
          },
          liveAnnouncementDndItemInserted: operation => {
            const column = `column ${operation.placement.x + 1}`;
            const row = `row ${operation.placement.y + 1}`;
            return `Widget inserted into ${column}, ${row}.`;
          },
          liveAnnouncementDndCommitted: () => "Drag and drop committed.",
          liveAnnouncementDndDiscarded: () => "Drag and drop cancelled.",
          liveAnnouncementItemRemoved: () => "Removed widget.",
        }}
        empty={
          <Box padding="m" textAlign="center" color="text-status-inactive">
            Add widgets from the palette to start configuring the dashboard.
          </Box>
        }
      />
      {showClaimsModal && (
        <Modal
          visible
          onDismiss={() => setShowClaimsModal(false)}
          header="Claims Mapping"
          closeAriaLabel="Close claims mapping"
          size="large"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={() => navigator?.clipboard?.writeText(claimsModalContent).catch(() => {})}
                variant="primary"
              >
                Copy JSON
              </Button>
              <Button onClick={() => setShowClaimsModal(false)}>Close</Button>
            </SpaceBetween>
          }
        >
          <Box as="pre" fontSize="body-s" style={{ maxHeight: "60vh", overflow: "auto", margin: 0 }}>
            {claimsModalContent}
          </Box>
        </Modal>
      )}
    </SpaceBetween>
  );
}
