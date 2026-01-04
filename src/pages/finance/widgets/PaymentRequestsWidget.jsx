import React, { useEffect, useMemo, useState } from "react";
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
  Badge,
  Button,
  ColumnLayout,
  Modal,
  FormField,
  Input,
  Textarea,
  DatePicker,
  Autosuggest,
  Alert,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";
import { PAYMENT_TYPE_OPTIONS, PAYEE_TYPE_OPTIONS, findOptionByValue } from "./paymentOptions";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-payments-requests-widths-v2";
const PREFERENCES_STORAGE_KEY = "finance-payments-requests-preferences-v2";
const DEFAULT_PAGE_SIZE = 10;
const CASE_SEARCH_MIN_CHARS = 2;

const EMPTY_CREATE_FORM = {
  caseSearch: "",
  caseId: "",
  interventionId: "",
  reportingUnit: "",
  dueBy: "",
  notes: "",
  paymentType: "",
  payeeType: "",
  payeeName: "",
  payeeReference: "",
  amount: "",
  potId: "",
  servicePeriodStart: "",
  servicePeriodEnd: "",
  requestedPaymentDate: "",
  invoiceReferenceNumber: "",
};

const statusMeta = {
  draft: { label: "Draft", indicator: "pending" },
  submitted: { label: "Submitted", indicator: "info" },
  program_review: { label: "Program review", indicator: "info" },
  returned: { label: "Returned", indicator: "warning" },
  program_approved: { label: "Program approved", indicator: "info" },
  finance_review: { label: "Finance review", indicator: "warning" },
  finance_approved: { label: "Finance approved", indicator: "info" },
  batched: { label: "Batched", indicator: "info" },
  sent: { label: "Sent", indicator: "warning" },
  confirmed: { label: "Confirmed", indicator: "success" },
  closed: { label: "Closed", indicator: "success" },
  on_hold: { label: "On hold", indicator: "error" },
  cancelled: { label: "Cancelled", indicator: "error" },
};

const financeStatusOptions = [
  { value: "all", label: "All packets" },
  { value: "finance_review", label: "Ready for finance review", statuses: ["finance_review"] },
  { value: "finance_approved", label: "Ready for batching", statuses: ["finance_approved"] },
  { value: "on_hold", label: "On hold", statuses: ["on_hold"] },
  { value: "sent", label: "Sent awaiting confirmation", statuses: ["sent"] },
  { value: "confirmed", label: "Confirmed / closed", statuses: ["confirmed", "closed"] },
];

const programStatusOptions = [
  { value: "all", label: "All packets" },
  { value: "draft", label: "My drafts / needs evidence", statuses: ["draft"] },
  {
    value: "submitted",
    label: "Submitted / in program review",
    statuses: ["submitted", "program_review"],
  },
  { value: "returned", label: "Returned", statuses: ["returned"] },
  { value: "program_approved", label: "Program approved", statuses: ["program_approved"] },
];

const formatCurrency = value =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

const formatEvidenceSummary = summary => {
  if (!summary) return { label: "-", indicator: "info" };
  if (summary.missing === 0) {
    return { label: `${summary.verified}/${summary.required} verified`, indicator: "success" };
  }
  return { label: `${summary.verified}/${summary.required} missing`, indicator: "warning" };
};

const formatCaseClientName = row => {
  const first =
    row?.client?.firstName ||
    row?.client?.first_name ||
    row?.client_first_name ||
    row?.clientFirstName ||
    "";
  const last =
    row?.client?.lastName ||
    row?.client?.last_name ||
    row?.client_last_name ||
    row?.clientLastName ||
    "";
  const combined = `${first} ${last}`.trim();
  return combined || row?.clientName || row?.client_name || "Unknown client";
};

const buildCaseOption = row => {
  const caseNumber = row?.caseNumber || row?.case_number || row?.id;
  const label = `Case ${caseNumber || "-"} - ${formatCaseClientName(row)}`;
  const tracking = row?.trackingId || row?.tracking_id || row?.tracking;
  return {
    value: label,
    label,
    description: tracking ? `Tracking ${tracking}` : undefined,
    caseId: row?.id ? String(row.id) : null,
  };
};

const mapRegionOption = region => ({
  value: String(region.code || "").trim().toUpperCase(),
  label: region.name ? `${region.name} (${String(region.code || "").trim().toUpperCase()})` : String(region.code || "").trim().toUpperCase(),
});

const mapPotOption = pot => {
  const code = pot?.code ? String(pot.code).trim() : "";
  const name = pot?.name ? String(pot.name).trim() : "";
  const label = [code, name].filter(Boolean).join(" - ") || String(pot?.id || "").trim();
  return {
    value: String(pot?.id || pot?.value || ""),
    label,
    description: pot?.fundingSource || pot?.funding_source || undefined,
  };
};

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
    id: "clientName",
    header: "Client",
    cell: item => item.clientName ?? "-",
  },
  {
    id: "interventionName",
    header: "Intervention",
    cell: item => item.interventionName ?? "-",
  },
  {
    id: "paymentTypes",
    header: "Payment type",
    cell: item => (item.paymentTypes?.length ? item.paymentTypes.join(", ") : "-"),
  },
  {
    id: "amount",
    header: "Amount",
    cell: item => formatCurrency(item.totalAmount ?? 0),
  },
  {
    id: "stream",
    header: "Stream",
    cell: item => {
      const entries = Object.entries(item.streamTotals ?? {}).filter(([, value]) => value > 0);
      if (!entries.length) return "-";
      return entries.map(([stream, value]) => `${stream} ${formatCurrency(value)}`).join(" / ");
    },
  },
  {
    id: "reportingUnit",
    header: "Reporting unit",
    cell: item => item.reportingUnit ?? "-",
  },
  {
    id: "potName",
    header: "Pot",
    cell: item => item.potName ?? "-",
  },
  {
    id: "requester",
    header: "Requester",
    cell: item => item.requester ?? "-",
  },
  {
    id: "ageDays",
    header: "Age (days)",
    cell: item => item.ageDays ?? "-",
  },
  {
    id: "evidence",
    header: "Evidence",
    cell: item => {
      const meta = formatEvidenceSummary(item.evidenceSummary);
      return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
    },
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
    id: "riskFlags",
    header: "Risk flags",
    cell: item =>
      item.riskFlags?.length ? (
        <SpaceBetween direction="horizontal" size="xs">
          {item.riskFlags.map(flag => (
            <Badge key={flag} color="red">
              {flag}
            </Badge>
          ))}
        </SpaceBetween>
      ) : (
        "-"
      ),
  },
  {
    id: "submittedOn",
    header: "Submitted",
    cell: item => item.submittedOn,
  },
];

const defaultPreferences = {
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: [
    "id",
    "clientName",
    "paymentTypes",
    "amount",
    "status",
    "reportingUnit",
    "evidence",
    "ageDays",
  ],
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
    createPacket,
    loading,
    error,
  } = usePaymentsData();
  const isProgramView = metadata?.mode === "program";

  const statusOptions = useMemo(() => {
    if (Array.isArray(metadata?.statusOptions) && metadata.statusOptions.length) {
      return metadata.statusOptions;
    }
    if (metadata?.mode === "program") {
      return programStatusOptions;
    }
    return financeStatusOptions;
  }, [metadata?.mode, metadata?.statusOptions]);
  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [filteringText, setFilteringText] = useState("");
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths());
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_CREATE_FORM });
  const [createError, setCreateError] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [ledgerExporting, setLedgerExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [caseOptions, setCaseOptions] = useState([]);
  const [caseOptionsLoading, setCaseOptionsLoading] = useState(false);
  const [caseDetailsLoading, setCaseDetailsLoading] = useState(false);
  const [caseDetails, setCaseDetails] = useState(null);
  const [interventionOptions, setInterventionOptions] = useState([]);
  const [interventionsLoading, setInterventionsLoading] = useState(false);
  const [regionOptions, setRegionOptions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [potOptions, setPotOptions] = useState([]);
  const [potsLoading, setPotsLoading] = useState(false);

  useEffect(() => {
    if (!statusOptions.length) return;
    if (!statusFilter || !statusOptions.some(option => option.value === statusFilter.value)) {
      setStatusFilter(statusOptions[0]);
    }
  }, [statusOptions, statusFilter]);

  useEffect(() => {
    if (!createModalOpen || !isProgramView) return;
    if (!regionOptions.length && !regionsLoading) {
      setRegionsLoading(true);
      apiFetch("/api/regions/canada")
        .then(resp => resp.ok ? resp.json() : Promise.reject(new Error("Failed to load regions")))
        .then(payload => {
          const list = Array.isArray(payload) ? payload.map(mapRegionOption).filter(option => option.value) : [];
          setRegionOptions(list);
        })
        .catch(() => {
          setRegionOptions([]);
        })
        .finally(() => {
          setRegionsLoading(false);
        });
    }
    if (!potOptions.length && !potsLoading) {
      setPotsLoading(true);
      apiFetch("/api/reference/budget-pots-lite?chargeableOnly=1")
        .then(resp => resp.ok ? resp.json() : Promise.reject(new Error("Failed to load pots")))
        .then(payload => {
          const list = Array.isArray(payload) ? payload.map(mapPotOption).filter(option => option.value) : [];
          setPotOptions(list);
        })
        .catch(() => {
          setPotOptions([]);
        })
        .finally(() => {
          setPotsLoading(false);
        });
    }
  }, [createModalOpen, isProgramView, regionOptions.length, regionsLoading, potOptions.length, potsLoading]);

  const resetCreateForm = () => {
    setCreateForm({ ...EMPTY_CREATE_FORM });
    setCreateError(null);
    setCaseOptions([]);
    setCaseDetails(null);
    setCaseDetailsLoading(false);
    setInterventionOptions([]);
    setInterventionsLoading(false);
  };

  const updateCreateForm = (key, value) => {
    setCreateForm(current => ({ ...current, [key]: value }));
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    if (createSubmitting) return;
    setCreateModalOpen(false);
  };

  const loadCaseSuggestions = async query => {
    const trimmed = (query || "").trim();
    if (trimmed.length < CASE_SEARCH_MIN_CHARS) {
      setCaseOptions([]);
      return;
    }
    setCaseOptionsLoading(true);
    try {
      const resp = await apiFetch(
        `/api/cases?query=${encodeURIComponent(trimmed)}&pageSize=10&groupByClient=false`
      );
      if (!resp.ok) {
        throw new Error(`Case search failed (${resp.status})`);
      }
      const payload = await resp.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const options = items.map(buildCaseOption).filter(option => option.caseId);
      setCaseOptions(options);
    } catch (err) {
      setCaseOptions([]);
    } finally {
      setCaseOptionsLoading(false);
    }
  };

  const loadCaseContext = async caseId => {
    if (!caseId) return;
    setCaseDetailsLoading(true);
    setInterventionsLoading(true);
    setCaseDetails(null);
    setInterventionOptions([]);
    try {
      const [caseResp, workspaceResp] = await Promise.all([
        apiFetch(`/api/cases/${encodeURIComponent(caseId)}`),
        apiFetch(`/api/cases/${encodeURIComponent(caseId)}/workspace`),
      ]);
      if (caseResp.ok) {
        const casePayload = await caseResp.json();
        setCaseDetails(casePayload || null);
      }
      if (workspaceResp.ok) {
        const workspacePayload = await workspaceResp.json();
        const plans = Array.isArray(workspacePayload?.actionPlans) ? workspacePayload.actionPlans : [];
        const options = [];
        plans.forEach(plan => {
          const planLabel = plan?.name || plan?.title || `Plan ${plan?.id || ""}`.trim();
          const interventions = Array.isArray(plan?.interventions) ? plan.interventions : [];
          interventions.forEach(item => {
            const id = item?.id || item?.intervention_id;
            if (!id) return;
            const title =
              item?.title ||
              item?.description ||
              item?.notes ||
              item?.interventionType ||
              item?.intervention_type ||
              `Intervention ${id}`;
            options.push({
              value: String(id),
              label: title,
              description: planLabel || undefined,
            });
          });
        });
        setInterventionOptions(options);
      }
    } catch (err) {
      setInterventionOptions([]);
    } finally {
      setCaseDetailsLoading(false);
      setInterventionsLoading(false);
    }
  };

  const handleCaseChange = ({ detail }) => {
    const value = detail.value || "";
    updateCreateForm("caseSearch", value);
    updateCreateForm("caseId", "");
    setCaseDetails(null);
    setInterventionOptions([]);
    updateCreateForm("interventionId", "");
    if (!value) {
      setCaseOptions([]);
      return;
    }
    if (value.trim().length >= CASE_SEARCH_MIN_CHARS) {
      loadCaseSuggestions(value);
    } else {
      setCaseOptions([]);
    }
  };

  const handleCaseSelect = ({ detail }) => {
    const value = detail.value || "";
    updateCreateForm("caseSearch", value);
    const selected = caseOptions.find(option => option.value === value) || null;
    const caseId = selected?.caseId ? String(selected.caseId) : "";
    updateCreateForm("caseId", caseId);
    updateCreateForm("interventionId", "");
    if (caseId) {
      loadCaseContext(caseId);
    }
  };

  const handleCreateSubmit = async () => {
    setCreateError(null);
    const paymentType = createForm.paymentType;
    const payeeType = createForm.payeeType;
    const payeeName = createForm.payeeName.trim();
    const amountValue = Number(createForm.amount);
    const potId = createForm.potId;
    if (!createForm.caseId) {
      setCreateError("Select a case to create a payment packet.");
      return;
    }
    if (!paymentType || !payeeType || !payeeName) {
      setCreateError("Payment type, payee type, and payee name are required.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setCreateError("Amount must be a positive number.");
      return;
    }
    if (!potId) {
      setCreateError("Select a budget pot for the payment line.");
      return;
    }
    const requiresPeriod = ["LivingAllowance", "WageSubsidyEmployer"].includes(paymentType);
    if (requiresPeriod && (!createForm.servicePeriodStart || !createForm.servicePeriodEnd)) {
      setCreateError("Service period start and end are required for this payment type.");
      return;
    }
    setCreateSubmitting(true);
    try {
      const clientId =
        caseDetails?.clientId ||
        caseDetails?.client_id ||
        caseDetails?.client?.id ||
        null;
      const payload = {
        caseId: Number(createForm.caseId),
        clientId: clientId ? Number(clientId) : null,
        interventionId: createForm.interventionId ? Number(createForm.interventionId) : null,
        reportingUnit: createForm.reportingUnit || null,
        dueBy: createForm.dueBy || null,
        notes: createForm.notes ? createForm.notes.trim() : null,
        lines: [
          {
            paymentType,
            payeeType,
            payeeName,
            payeeReference: createForm.payeeReference ? createForm.payeeReference.trim() : null,
            amount: amountValue,
            potId: Number(potId),
            servicePeriodStart: createForm.servicePeriodStart || null,
            servicePeriodEnd: createForm.servicePeriodEnd || null,
            requestedPaymentDate: createForm.requestedPaymentDate || null,
            invoiceReferenceNumber: createForm.invoiceReferenceNumber || null,
          },
        ],
      };
      await createPacket(payload);
      setCreateModalOpen(false);
    } catch (err) {
      setCreateError(err?.message || "Failed to create payment packet.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleExportLedger = async () => {
    setLedgerExporting(true);
    setExportStatus(null);
    try {
      const resp = await apiFetch("/api/finance/payment-ledger-export");
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Export failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payment-ledger-extract-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportStatus({ type: "success", message: "Ledger extract downloaded." });
    } catch (err) {
      setExportStatus({
        type: "error",
        message: err?.message || "Failed to export payment ledger.",
      });
    } finally {
      setLedgerExporting(false);
    }
  };

  const visibleColumns = useMemo(() => {
    const set = new Set(preferences.visibleColumns ?? columnDefinitions.map(column => column.id));
    return columnDefinitions.filter(column => set.has(column.id));
  }, [preferences.visibleColumns]);

  const filteredItems = useMemo(() => {
    return requests.filter(item => {
      if (statusFilter.value !== "all" && !statusFilter.statuses?.includes(item.status)) {
        return false;
      }
      if (filteringText) {
        const lower = filteringText.toLowerCase();
        return (
          item.id.toLowerCase().includes(lower) ||
          (item.clientName ?? "").toLowerCase().includes(lower) ||
          (item.interventionName ?? "").toLowerCase().includes(lower) ||
          (item.paymentTypes ?? []).some(type => type.toLowerCase().includes(lower)) ||
          (item.reportingUnit ?? "").toLowerCase().includes(lower) ||
          (item.potName ?? "").toLowerCase().includes(lower) ||
          (item.requester ?? "").toLowerCase().includes(lower) ||
          (item.riskFlags ?? []).some(flag => flag.toLowerCase().includes(lower))
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

  const selectedPaymentType = useMemo(
    () => findOptionByValue(PAYMENT_TYPE_OPTIONS, createForm.paymentType),
    [createForm.paymentType]
  );
  const selectedPayeeType = useMemo(
    () => findOptionByValue(PAYEE_TYPE_OPTIONS, createForm.payeeType),
    [createForm.payeeType]
  );
  const selectedIntervention = useMemo(
    () => interventionOptions.find(option => option.value === createForm.interventionId) || null,
    [interventionOptions, createForm.interventionId]
  );
  const selectedReportingUnit = useMemo(
    () => regionOptions.find(option => option.value === createForm.reportingUnit) || null,
    [regionOptions, createForm.reportingUnit]
  );
  const selectedPot = useMemo(
    () => potOptions.find(option => option.value === createForm.potId) || null,
    [potOptions, createForm.potId]
  );

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
              {isProgramView ? (
                <Button iconName="add-plus" onClick={handleOpenCreateModal}>
                  Create packet
                </Button>
              ) : null}
              {!isProgramView ? (
                <Button
                  iconName="download"
                  onClick={handleExportLedger}
                  disabled={ledgerExporting}
                  loading={ledgerExporting}
                >
                  Export ledger
                </Button>
              ) : null}
              <Select
                selectedOption={statusFilter}
                options={statusOptions}
                onChange={({ detail }) => {
                  setStatusFilter(detail.selectedOption);
                  setCurrentPageIndex(1);
                }}
              />
            </SpaceBetween>
          }
        >
          Payment packet queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment packet queue settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {exportStatus ? (
          <Alert type={exportStatus.type} onDismiss={() => setExportStatus(null)}>
            {exportStatus.message}
          </Alert>
        ) : null}
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
              Packets
            </Header>
          }
          filter={
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Find by packet ID, client, intervention, or risk flag"
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                setCurrentPageIndex(1);
              }}
              countText={`${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}`}
            />
          }
          preferences={preferencesComponent}
          pagination={pagination}
          loading={loading}
          loadingText="Loading payment packets"
          empty={
            <Box padding="m">
              {error ? `Unable to load payment packets: ${error}` : "No payment packets match the current filters."}
            </Box>
          }
        />
        <Modal
          visible={createModalOpen}
          onDismiss={handleCloseCreateModal}
          header="Create payment packet"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCloseCreateModal} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateSubmit}
                loading={createSubmitting}
              >
                Create packet
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            {createError ? <Alert type="error">{createError}</Alert> : null}
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Case" description="Search by client name, case number, or tracking ID.">
                <Autosuggest
                  value={createForm.caseSearch}
                  onChange={handleCaseChange}
                  onSelect={handleCaseSelect}
                  onLoadItems={({ detail }) => loadCaseSuggestions(detail.filteringText)}
                  options={caseOptions}
                  statusType={caseOptionsLoading ? "loading" : "finished"}
                  placeholder="Start typing to search cases"
                  empty={
                    createForm.caseSearch.trim().length < CASE_SEARCH_MIN_CHARS
                      ? "Type at least 2 characters to search."
                      : "No cases found."
                  }
                  enteredTextLabel={value => `Use \"${value}\"`}
                />
              </FormField>
              <FormField label="Intervention (optional)">
                <Select
                  selectedOption={selectedIntervention}
                  options={interventionOptions}
                  onChange={({ detail }) => updateCreateForm("interventionId", detail.selectedOption?.value || "")}
                  statusType={interventionsLoading || caseDetailsLoading ? "loading" : "finished"}
                  placeholder={
                    caseDetailsLoading
                      ? "Loading interventions"
                      : "Select an intervention"
                  }
                  filteringType="auto"
                  empty="No interventions available for this case."
                />
              </FormField>
              <FormField label="Reporting unit (optional)">
                <Select
                  selectedOption={selectedReportingUnit}
                  options={regionOptions}
                  onChange={({ detail }) => updateCreateForm("reportingUnit", detail.selectedOption?.value || "")}
                  statusType={regionsLoading ? "loading" : "finished"}
                  placeholder={regionsLoading ? "Loading regions" : "Select reporting unit"}
                  filteringType="auto"
                  empty="No regions available."
                />
              </FormField>
              <FormField label="Due by (optional)">
                <DatePicker
                  value={createForm.dueBy}
                  onChange={({ detail }) => updateCreateForm("dueBy", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
            </ColumnLayout>
            <FormField label="Notes (optional)">
              <Textarea
                value={createForm.notes}
                onChange={({ detail }) => updateCreateForm("notes", detail.value)}
                rows={3}
              />
            </FormField>

            <Header variant="h3">Initial payment line</Header>
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Payment type">
                <Select
                  selectedOption={selectedPaymentType}
                  options={PAYMENT_TYPE_OPTIONS}
                  onChange={({ detail }) => updateCreateForm("paymentType", detail.selectedOption?.value || "")}
                  placeholder="Select payment type"
                  filteringType="auto"
                />
              </FormField>
              <FormField label="Payee type">
                <Select
                  selectedOption={selectedPayeeType}
                  options={PAYEE_TYPE_OPTIONS}
                  onChange={({ detail }) => updateCreateForm("payeeType", detail.selectedOption?.value || "")}
                  placeholder="Select payee type"
                />
              </FormField>
              <FormField label="Payee name">
                <Input
                  value={createForm.payeeName}
                  onChange={({ detail }) => updateCreateForm("payeeName", detail.value)}
                  placeholder="Payee name"
                />
              </FormField>
              <FormField label="Payee reference (optional)">
                <Input
                  value={createForm.payeeReference}
                  onChange={({ detail }) => updateCreateForm("payeeReference", detail.value)}
                  placeholder="Account or vendor reference"
                />
              </FormField>
              <FormField label="Amount">
                <Input
                  value={createForm.amount}
                  onChange={({ detail }) => updateCreateForm("amount", detail.value)}
                  type="number"
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Budget pot">
                <Select
                  selectedOption={selectedPot}
                  options={potOptions}
                  onChange={({ detail }) => updateCreateForm("potId", detail.selectedOption?.value || "")}
                  statusType={potsLoading ? "loading" : "finished"}
                  placeholder={potsLoading ? "Loading pots" : "Select budget pot"}
                  filteringType="auto"
                  empty="No budget pots available."
                />
              </FormField>
              <FormField
                label="Service period start"
                description="Required for living allowance and wage subsidy."
              >
                <DatePicker
                  value={createForm.servicePeriodStart}
                  onChange={({ detail }) => updateCreateForm("servicePeriodStart", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField
                label="Service period end"
                description="Required for living allowance and wage subsidy."
              >
                <DatePicker
                  value={createForm.servicePeriodEnd}
                  onChange={({ detail }) => updateCreateForm("servicePeriodEnd", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Requested payment date (optional)">
                <DatePicker
                  value={createForm.requestedPaymentDate}
                  onChange={({ detail }) => updateCreateForm("requestedPaymentDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Invoice reference (optional)">
                <Input
                  value={createForm.invoiceReferenceNumber}
                  onChange={({ detail }) => updateCreateForm("invoiceReferenceNumber", detail.value)}
                  placeholder="Invoice or receipt number"
                />
              </FormField>
            </ColumnLayout>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </BoardItem>
  );
};

export default PaymentRequestsWidget;
