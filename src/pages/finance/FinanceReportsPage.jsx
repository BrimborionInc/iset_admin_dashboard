import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  ColumnLayout,
  Container,
  FormField,
  Header,
  Link,
  Multiselect,
  Pagination,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
} from "@cloudscape-design/components";

import { apiFetch } from "../../auth/apiClient";
import { triggerFinanceInterventionReportExcelDownload } from "./financeInterventionReportExport.js";

const FINANCE_REPORT_PERIOD_TYPE = "year";
const FINANCE_REPORT_PERIOD_KEY = "annual";

const DEFAULT_MODE_OPTIONS = [
  {
    value: "approved",
    label: "Approved funding",
    description: "Approved intervention funding for the selected fiscal year.",
    disabled: false,
  },
];

const DEFAULT_SUMMARY = {
  totalAmount: 0,
  fundingTotals: { CRF: 0, EI: 0 },
  financeTotals: {
    sentAmount: 0,
    paidAmount: 0,
    notYetSentAmount: 0,
  },
  financeStatusCounts: {
    noPaymentRequest: 0,
    draftPaymentRequest: 0,
    awaitingRelease: 0,
    readyToSend: 0,
    sentToFinance: 0,
    followUpNeeded: 0,
    followUpLogged: 0,
    reportedPaid: 0,
    confirmedByEvidence: 0,
    staleNoResponse: 0,
    partiallyPaid: 0,
    paidInFull: 0,
    cancelled: 0,
  },
  categoryTotals: {
    tuition: 0,
    booksMaterials: 0,
    living: 0,
    childcare: 0,
    wage: 0,
    other: 0,
  },
  carryOver: {
    enabled: false,
    carryInAmount: 0,
    carryInInterventionCount: 0,
    carryOutAmount: 0,
    carryOutInterventionCount: 0,
    currentFiscalEstimatedAmount: 0,
    sourceNote: null,
  },
  interventionCount: 0,
  participantCount: 0,
  provinceCount: 0,
  provinceRows: [],
};

const PAGE_SIZE = 20;

const getCurrentFiscalYearStart = (referenceDate = new Date()) => {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
};

const formatFiscalYearLabel = startYear =>
  `${startYear}-${String(startYear + 1).slice(-2)}`;

const buildFiscalYearOption = startYear => ({
  value: String(startYear),
  label: `FY ${formatFiscalYearLabel(startYear)}`,
});

const buildFiscalYearOptions = (currentStartYear, count = 5) =>
  Array.from({ length: count }, (_, index) => buildFiscalYearOption(currentStartYear - index));

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatInteger = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-CA") : "0";
};

const formatDate = value => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatStatusLabel = value =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase()) || "—";

const getStatusIndicatorType = status => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed") return "success";
  if (normalized === "approved") return "info";
  if (normalized === "in_progress") return "in-progress";
  if (normalized === "suspended") return "warning";
  return "stopped";
};

const getFinanceFollowUpIndicatorType = statusKey => {
  const normalized = String(statusKey || "").trim();
  if (normalized === "paidInFull") return "success";
  if (normalized === "partiallyPaid") return "in-progress";
  if (normalized === "reportedPaid") return "success";
  if (normalized === "confirmedByEvidence") return "success";
  if (normalized === "followUpLogged") return "in-progress";
  if (normalized === "followUpNeeded") return "warning";
  if (normalized === "staleNoResponse") return "error";
  if (normalized === "sentToFinance") return "info";
  if (normalized === "readyToSend") return "success";
  if (normalized === "awaitingRelease") return "warning";
  if (normalized === "draftPaymentRequest") return "pending";
  if (normalized === "cancelled") return "error";
  return "stopped";
};

const findOptionByValue = (options, value) =>
  (Array.isArray(options) ? options : []).find(option => option?.value === value) || null;

const reconcileSelectedValue = (currentValue, options, fallbackValue = null) => {
  const optionList = Array.isArray(options) ? options : [];
  const currentOption = findOptionByValue(optionList, currentValue);
  if (currentOption && !currentOption.disabled) {
    return currentOption.value;
  }
  const fallbackOption = findOptionByValue(optionList, fallbackValue);
  if (fallbackOption && !fallbackOption.disabled) {
    return fallbackOption.value;
  }
  const firstEnabled = optionList.find(option => !option?.disabled);
  return firstEnabled?.value || optionList[0]?.value || "";
};

const reconcileSelectedValues = (currentValues, options) => {
  const validValues = new Set(
    (Array.isArray(options) ? options : [])
      .map(option => option?.value)
      .filter(value => value !== undefined && value !== null)
  );
  return (Array.isArray(currentValues) ? currentValues : []).filter(value => validValues.has(value));
};

const isFinanceReportsDebugEnabled = () => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    if (window.__financeReportsDebug === true) {
      return true;
    }
    return new URLSearchParams(window.location.search).get("financeReportsDebug") === "1";
  } catch (_) {
    return false;
  }
};

const debugFinanceReports = (...args) => {
  if (isFinanceReportsDebugEnabled()) {
    console.debug("[FinanceReports]", ...args);
  }
};

const filterRowsByText = (rows, filteringText) => {
  const text = String(filteringText || "").trim().toLowerCase();
  if (!text) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter(row =>
    [
      row?.participantName,
      row?.participantProvince,
      row?.participantProvinceName,
      row?.caseNumber,
      row?.trackingId,
      row?.caseManagerName,
      row?.fundingSource,
      row?.interventionCode,
      row?.interventionLabel,
      row?.interventionTitle,
      row?.institution,
      row?.programName,
      row?.actionPlanName,
      row?.budgetPotCode,
      row?.budgetPotName,
      row?.financeFollowUpStatusLabel,
      row?.latestPacketStatusLabel,
      row?.approvedDate,
      row?.commitmentDate,
    ]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(text))
  );
};

const summarizeRows = rows => {
  const items = Array.isArray(rows) ? rows : [];
  const fundingTotals = { CRF: 0, EI: 0 };
  const financeTotals = {
    sentAmount: 0,
    paidAmount: 0,
    notYetSentAmount: 0,
  };
  const financeStatusCounts = {
    noPaymentRequest: 0,
    draftPaymentRequest: 0,
    awaitingRelease: 0,
    readyToSend: 0,
    sentToFinance: 0,
    followUpNeeded: 0,
    followUpLogged: 0,
    reportedPaid: 0,
    confirmedByEvidence: 0,
    staleNoResponse: 0,
    partiallyPaid: 0,
    paidInFull: 0,
    cancelled: 0,
  };
  const categoryTotals = {
    tuition: 0,
    booksMaterials: 0,
    living: 0,
    childcare: 0,
    wage: 0,
    other: 0,
  };
  const participantKeys = new Set();
  const provinceCodes = new Set();
  const provinceSummary = new Map();

  items.forEach(row => {
    const totalAmount = Number(row?.totalAmount || 0);
    const financeSentAmount = Number(row?.financeSentAmount || 0);
    const financePaidAmount = Number(row?.financePaidAmount || 0);
    if (row?.fundingSource === "CRF") {
      fundingTotals.CRF += totalAmount;
    } else if (row?.fundingSource === "EI") {
      fundingTotals.EI += totalAmount;
    }
    financeTotals.sentAmount += financeSentAmount;
    financeTotals.paidAmount += financePaidAmount;
    financeTotals.notYetSentAmount += Math.max(
      0,
      Math.round((totalAmount - financeSentAmount - financePaidAmount) * 100) / 100
    );
    if (
      row?.financeFollowUpStatusKey &&
      Object.prototype.hasOwnProperty.call(financeStatusCounts, row.financeFollowUpStatusKey)
    ) {
      financeStatusCounts[row.financeFollowUpStatusKey] += 1;
    }
    categoryTotals.tuition += Number(row?.tuitionAmount || 0);
    categoryTotals.booksMaterials += Number(row?.booksMaterialsAmount || 0);
    categoryTotals.living += Number(row?.livingAmount || 0);
    categoryTotals.childcare += Number(row?.childcareAmount || 0);
    categoryTotals.wage += Number(row?.wageAmount || 0);
    categoryTotals.other += Number(row?.otherAmount || 0);

    if (row?.participantKey) {
      participantKeys.add(String(row.participantKey));
    }
    if (row?.participantProvince) {
      provinceCodes.add(row.participantProvince);
    }

    const provinceKey = row?.participantProvince || "UNSPECIFIED";
    if (!provinceSummary.has(provinceKey)) {
      provinceSummary.set(provinceKey, {
        provinceCode: row?.participantProvince || null,
        provinceName: row?.participantProvinceName || "Unspecified",
        crfAmount: 0,
        eiAmount: 0,
        totalAmount: 0,
        interventionCount: 0,
        participants: new Set(),
      });
    }
    const provinceEntry = provinceSummary.get(provinceKey);
    provinceEntry.totalAmount += totalAmount;
    provinceEntry.interventionCount += 1;
    if (row?.fundingSource === "CRF") {
      provinceEntry.crfAmount += totalAmount;
    } else if (row?.fundingSource === "EI") {
      provinceEntry.eiAmount += totalAmount;
    }
    if (row?.participantKey) {
      provinceEntry.participants.add(String(row.participantKey));
    }
  });

  return {
    totalAmount: items.reduce((sum, row) => sum + Number(row?.totalAmount || 0), 0),
    fundingTotals,
    financeTotals,
    financeStatusCounts,
    categoryTotals,
    carryOver: DEFAULT_SUMMARY.carryOver,
    interventionCount: items.length,
    participantCount: participantKeys.size,
    provinceCount: provinceCodes.size,
    provinceRows: Array.from(provinceSummary.values())
      .map(entry => ({
        provinceCode: entry.provinceCode,
        provinceName: entry.provinceName,
        crfAmount: entry.crfAmount,
        eiAmount: entry.eiAmount,
        totalAmount: entry.totalAmount,
        interventionCount: entry.interventionCount,
        participantCount: entry.participants.size,
      }))
      .sort((left, right) =>
        String(left?.provinceName || "Unspecified").localeCompare(
          String(right?.provinceName || "Unspecified")
        )
      ),
  };
};

const SummaryCard = ({ label, value, secondary = null }) => (
  <Container>
    <SpaceBetween size="xs">
      <Box variant="awsui-key-label">{label}</Box>
      <Box fontSize="heading-l" fontWeight="bold">
        {value}
      </Box>
      {secondary ? (
        <Box color="text-body-secondary" fontSize="body-s">
          {secondary}
        </Box>
      ) : null}
    </SpaceBetween>
  </Container>
);

const FinanceReportsPage = ({ updateBreadcrumbs, setAvailableItems, setSplitPanelOpen }) => {
  const initializedShellStateRef = useRef(false);
  const currentFiscalYearStart = useMemo(() => getCurrentFiscalYearStart(new Date()), []);
  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(currentFiscalYearStart),
    [currentFiscalYearStart]
  );

  const [selectedFiscalYearStart, setSelectedFiscalYearStart] = useState(
    String(fiscalYearOptions[0]?.value || currentFiscalYearStart)
  );
  const [modeOptions, setModeOptions] = useState(DEFAULT_MODE_OPTIONS);
  const [selectedMode, setSelectedMode] = useState(DEFAULT_MODE_OPTIONS[0]?.value || "approved");
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [selectedProvinceValues, setSelectedProvinceValues] = useState([]);
  const [includeCarryOver, setIncludeCarryOver] = useState(false);
  const [filteringText, setFilteringText] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState({
    fiscalYear: formatFiscalYearLabel(currentFiscalYearStart),
    fiscalYearStart: currentFiscalYearStart,
    period: null,
    rows: [],
    summary: DEFAULT_SUMMARY,
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const selectedFiscalYearOption = useMemo(
    () =>
      findOptionByValue(fiscalYearOptions, selectedFiscalYearStart) ||
      fiscalYearOptions[0] ||
      buildFiscalYearOption(currentFiscalYearStart),
    [currentFiscalYearStart, fiscalYearOptions, selectedFiscalYearStart]
  );

  const selectedModeOption = useMemo(
    () =>
      findOptionByValue(modeOptions, selectedMode) ||
      modeOptions.find(option => !option?.disabled) ||
      modeOptions[0] ||
      null,
    [modeOptions, selectedMode]
  );

  const selectedProvinceOptions = useMemo(
    () =>
      selectedProvinceValues
        .map(value => findOptionByValue(provinceOptions, value))
        .filter(Boolean),
    [provinceOptions, selectedProvinceValues]
  );

  const fiscalYearStart = Number(selectedFiscalYearStart || currentFiscalYearStart);

  useEffect(() => {
    if (initializedShellStateRef.current) {
      return;
    }
    initializedShellStateRef.current = true;

    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Budgets and Finance", href: "/finance/overview" },
        { text: "Financial Reports", href: "/finance/reports" },
      ]);
    }

    if (typeof setAvailableItems === "function") {
      setAvailableItems(currentItems =>
        Array.isArray(currentItems) && currentItems.length === 0 ? currentItems : []
      );
    }

    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(false);
    }
  }, [setAvailableItems, setSplitPanelOpen, updateBreadcrumbs]);

  useEffect(() => {
    debugFinanceReports("mounted");
    return () => {
      debugFinanceReports("unmounted");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadFilterOptions = async () => {
      debugFinanceReports("loadFilterOptions:start", {
        fiscalYearStart,
        periodType: FINANCE_REPORT_PERIOD_TYPE,
      });
      setOptionsLoading(true);
      setOptionsError("");
      try {
        const params = new URLSearchParams({
          fiscalYearStart: String(fiscalYearStart),
          periodType: FINANCE_REPORT_PERIOD_TYPE,
        });
        const response = await apiFetch(
          `/api/finance/reports/intervention-funding/filter-options?${params.toString()}`,
          { method: "GET", signal: controller.signal }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load financial report filters.");
        }
        if (cancelled) return;

        const nextModeOptions =
          Array.isArray(payload.modeOptions) && payload.modeOptions.length
            ? payload.modeOptions
            : DEFAULT_MODE_OPTIONS;
        const nextProvinceOptions = Array.isArray(payload.provinces) ? payload.provinces : [];

        setModeOptions(nextModeOptions);
        setSelectedMode(currentValue =>
          reconcileSelectedValue(currentValue, nextModeOptions, nextModeOptions.find(option => !option?.disabled)?.value)
        );

        setProvinceOptions(nextProvinceOptions);
        setSelectedProvinceValues(currentValues =>
          reconcileSelectedValues(currentValues, nextProvinceOptions)
        );
        debugFinanceReports("loadFilterOptions:success", {
          fiscalYearStart,
          periodType: FINANCE_REPORT_PERIOD_TYPE,
          provinces: nextProvinceOptions.length,
        });
      } catch (error) {
        if (cancelled || error.name === "AbortError") return;
        debugFinanceReports("loadFilterOptions:error", {
          fiscalYearStart,
          periodType: FINANCE_REPORT_PERIOD_TYPE,
          message: error?.message || "Unable to load financial report filters.",
        });
        setOptionsError(error.message || "Unable to load financial report filters.");
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    };

    loadFilterOptions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fiscalYearStart]);

  useEffect(() => {
    if (!selectedMode) {
      setReportData({
        fiscalYear: formatFiscalYearLabel(fiscalYearStart),
        fiscalYearStart,
        period: null,
        rows: [],
        summary: DEFAULT_SUMMARY,
      });
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadReport = async () => {
      debugFinanceReports("loadReport:start", {
        fiscalYearStart,
        periodType: FINANCE_REPORT_PERIOD_TYPE,
        periodKey: FINANCE_REPORT_PERIOD_KEY,
        mode: selectedMode,
        provinces: selectedProvinceValues,
        includeCarryOver,
      });
      setDataLoading(true);
      setDataError("");
      setExportError("");
      try {
        const params = new URLSearchParams({
          fiscalYearStart: String(fiscalYearStart),
          periodType: FINANCE_REPORT_PERIOD_TYPE,
          periodKey: FINANCE_REPORT_PERIOD_KEY,
          mode: selectedMode,
        });
        if (includeCarryOver) {
          params.set("includeCarryOver", "1");
        }
        selectedProvinceValues.forEach(value => {
          if (value) {
            params.append("provinces", value);
          }
        });

        const response = await apiFetch(
          `/api/finance/reports/intervention-funding?${params.toString()}`,
          { method: "GET", signal: controller.signal }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load the financial report.");
        }
        if (cancelled) return;
        debugFinanceReports("loadReport:success", {
          fiscalYearStart,
          periodType: FINANCE_REPORT_PERIOD_TYPE,
          periodKey: FINANCE_REPORT_PERIOD_KEY,
          rows: Array.isArray(payload?.rows) ? payload.rows.length : 0,
        });
        setReportData({
          fiscalYear: payload?.fiscalYear || formatFiscalYearLabel(fiscalYearStart),
          fiscalYearStart: payload?.fiscalYearStart || fiscalYearStart,
          period: payload?.period || null,
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          summary: payload?.summary || DEFAULT_SUMMARY,
        });
      } catch (error) {
        if (cancelled || error.name === "AbortError") return;
        debugFinanceReports("loadReport:error", {
          fiscalYearStart,
          periodType: FINANCE_REPORT_PERIOD_TYPE,
          periodKey: FINANCE_REPORT_PERIOD_KEY,
          message: error?.message || "Unable to load the financial report.",
        });
        setDataError(error.message || "Unable to load the financial report.");
        setReportData({
          fiscalYear: formatFiscalYearLabel(fiscalYearStart),
          fiscalYearStart,
          period: null,
          rows: [],
          summary: DEFAULT_SUMMARY,
        });
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    loadReport();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    fiscalYearStart,
    selectedMode,
    selectedProvinceValues,
    includeCarryOver,
  ]);

  const displayRows = useMemo(
    () => filterRowsByText(reportData.rows, filteringText),
    [reportData.rows, filteringText]
  );
  const displaySummary = useMemo(() => summarizeRows(displayRows), [displayRows]);

  const pagesCount = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (currentPageIndex - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, currentPageIndex]);

  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(1);
    }
  }, [currentPageIndex, pagesCount]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [filteringText, reportData.rows.length]);

  const handleClearFilters = useCallback(() => {
    setSelectedMode(
      modeOptions.find(option => !option?.disabled)?.value || modeOptions[0]?.value || "approved"
    );
    setSelectedFiscalYearStart(String(fiscalYearOptions[0]?.value || currentFiscalYearStart));
    setSelectedProvinceValues([]);
    setIncludeCarryOver(false);
    setFilteringText("");
  }, [currentFiscalYearStart, fiscalYearOptions, modeOptions]);

  const provinceSummaryColumns = useMemo(
    () => [
      {
        id: "province",
        header: "Region",
        cell: item => item.provinceName || item.provinceCode || "Unspecified",
      },
      {
        id: "participants",
        header: "Participants",
        cell: item => formatInteger(item.participantCount),
      },
      {
        id: "interventions",
        header: "Interventions",
        cell: item => formatInteger(item.interventionCount),
      },
      {
        id: "crf",
        header: "CRF advances",
        cell: item => formatCurrency(item.crfAmount),
      },
      {
        id: "ei",
        header: "EI advances",
        cell: item => formatCurrency(item.eiAmount),
      },
      {
        id: "total",
        header: "Total advances",
        cell: item => formatCurrency(item.totalAmount),
      },
    ],
    []
  );

  const detailColumns = useMemo(
    () => [
      {
        id: "participant",
        header: "Participant",
        cell: item => (
          <SpaceBetween size="xxs">
            {item.workspacePath ? (
              <Link href={item.workspacePath}>{item.participantName || "Participant"}</Link>
            ) : (
              <span>{item.participantName || "Participant"}</span>
            )}
            <Box color="text-body-secondary" fontSize="body-s">
              {[item.caseNumber, item.trackingId].filter(Boolean).join(" · ") || "No case reference"}
            </Box>
          </SpaceBetween>
        ),
        minWidth: 220,
      },
      {
        id: "province",
        header: "Region",
        cell: item => item.participantProvinceName || item.participantProvince || "Unspecified",
        minWidth: 160,
      },
      {
        id: "approvedDate",
        header: "Approved date",
        cell: item => formatDate(item.approvedDate || item.commitmentDate),
        minWidth: 150,
      },
      {
        id: "intervention",
        header: "Intervention",
        cell: item => (
          <SpaceBetween size="xxs">
            <span>{item.interventionLabel || item.interventionCode || "Intervention"}</span>
            <Box color="text-body-secondary" fontSize="body-s">
              {item.interventionTitle || "No intervention title"}
            </Box>
          </SpaceBetween>
        ),
        minWidth: 240,
      },
      {
        id: "dates",
        header: "Start / end",
        cell: item => (
          <SpaceBetween size="xxs">
            <span>{formatDate(item.interventionStartDate)}</span>
            <Box color="text-body-secondary" fontSize="body-s">
              {formatDate(item.interventionEndDate)}
            </Box>
          </SpaceBetween>
        ),
        minWidth: 150,
      },
      {
        id: "institution",
        header: "Institution / partner",
        cell: item => item.institution || "—",
        minWidth: 200,
      },
      {
        id: "program",
        header: "Program / position",
        cell: item => item.programName || "—",
        minWidth: 200,
      },
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={getStatusIndicatorType(item.status)}>
            {formatStatusLabel(item.status)}
          </StatusIndicator>
        ),
        minWidth: 140,
      },
      {
        id: "financeFollowUp",
        header: "Payment status",
        cell: item => (
          <SpaceBetween size="xxs">
            <StatusIndicator type={getFinanceFollowUpIndicatorType(item.financeFollowUpStatusKey)}>
              {item.financeFollowUpStatusLabel || "No payment packet yet"}
            </StatusIndicator>
            <Box color="text-body-secondary" fontSize="body-s">
              {[
                `Sent: ${formatDate(item.financeSentDate)}`,
                `Recorded paid: ${formatDate(item.financePaidDate)}`,
              ].join(" · ")}
            </Box>
            <Box color="text-body-secondary" fontSize="body-s">
              {[
                Number(item?.financeSentAmount || 0) > 0
                  ? `Sent ${formatCurrency(item.financeSentAmount)}`
                  : null,
                Number(item?.financePaidAmount || 0) > 0
                  ? `Recorded paid ${formatCurrency(item.financePaidAmount)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || (item.latestPacketStatusLabel || "No finance activity yet")}
            </Box>
          </SpaceBetween>
        ),
        minWidth: 260,
      },
      {
        id: "tuition",
        header: "Tuition",
        cell: item => formatCurrency(item.tuitionAmount),
        minWidth: 130,
      },
      {
        id: "booksMaterials",
        header: "Books / materials",
        cell: item => formatCurrency(item.booksMaterialsAmount),
        minWidth: 150,
      },
      {
        id: "living",
        header: "Living",
        cell: item => formatCurrency(item.livingAmount),
        minWidth: 130,
      },
      {
        id: "childcare",
        header: "Childcare",
        cell: item => formatCurrency(item.childcareAmount),
        minWidth: 130,
      },
      {
        id: "wage",
        header: "Wage / project",
        cell: item => formatCurrency(item.wageAmount),
        minWidth: 150,
      },
      {
        id: "other",
        header: "Other",
        cell: item => formatCurrency(item.otherAmount),
        minWidth: 130,
      },
      {
        id: "total",
        header: "Total advances",
        cell: item => formatCurrency(item.totalAmount),
        minWidth: 150,
      },
      ...(includeCarryOver
        ? [
            {
              id: "carryOver",
              header: "Carry-over",
              cell: item => {
                const adjustment = Number(item?.carryOverAdjustmentAmount || 0);
                const estimatedAmount = Number(item?.carryOverCurrentFiscalAmount || 0);
                return (
                  <SpaceBetween size="xxs">
                    <Box
                      color={adjustment < 0 ? "text-status-error" : "text-body-secondary"}
                      fontSize="body-s"
                    >
                      {adjustment < 0 ? `Adjustment ${formatCurrency(adjustment)}` : "No adjustment"}
                    </Box>
                    <Box color="text-body-secondary" fontSize="body-s">
                      FY estimate {formatCurrency(estimatedAmount)}
                    </Box>
                    <Box color="text-body-secondary" fontSize="body-s">
                      {item?.carryOverNote || item?.carryOverSourceLabel || "No estimate available"}
                    </Box>
                  </SpaceBetween>
                );
              },
              minWidth: 250,
            },
          ]
        : []),
      {
        id: "budgetPot",
        header: "Budget pot",
        cell: item =>
          [item.budgetPotCode, item.budgetPotName].filter(Boolean).join(" · ") || "—",
        minWidth: 220,
      },
    ],
    [includeCarryOver]
  );

  const exportTitle = useMemo(() => {
    const fiscalYearLabel = reportData.fiscalYear || formatFiscalYearLabel(fiscalYearStart);
    return `iset-advances-and-active-clients-${fiscalYearLabel}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [fiscalYearStart, reportData.fiscalYear]);

  const handleExport = useCallback(async () => {
    setExportError("");
    setExporting(true);
    try {
      const exportSummary = includeCarryOver
        ? {
            ...displaySummary,
            carryOver: reportData.summary?.carryOver || DEFAULT_SUMMARY.carryOver,
          }
        : displaySummary;
      await triggerFinanceInterventionReportExcelDownload({
        rows: displayRows,
        summary: exportSummary,
        meta: {
          title: "ISET Advances and Active Clients",
          modeLabel: selectedModeOption?.label || "Approved funding",
          fiscalYearLabel: reportData.fiscalYear || formatFiscalYearLabel(fiscalYearStart),
          periodLabel: reportData.period?.label || `FY ${reportData.fiscalYear || formatFiscalYearLabel(fiscalYearStart)}`,
          periodStart: reportData.period?.start || null,
          periodEnd: reportData.period?.end || null,
          fundingSourceLabel: "CRF and EI",
          provinceLabel: selectedProvinceOptions.length
            ? selectedProvinceOptions.map(option => option.label).join(", ")
            : "All regions",
          includeCarryOver,
          filename: `${exportTitle || "iset-advances-and-active-clients"}.xlsx`,
        },
      });
    } catch (error) {
      setExportError(error.message || "Unable to export the current report to Excel.");
    } finally {
      setExporting(false);
    }
  }, [
    displayRows,
    displaySummary,
    exportTitle,
    fiscalYearStart,
    reportData.fiscalYear,
    reportData.period,
    reportData.summary,
    selectedModeOption,
    selectedProvinceOptions,
    includeCarryOver,
  ]);

  const carryOverSummary = reportData.summary?.carryOver || DEFAULT_SUMMARY.carryOver;
  const displayFiscalYearStart = Number(reportData.fiscalYearStart || fiscalYearStart || currentFiscalYearStart);
  const previousFiscalYearLabel = formatFiscalYearLabel(displayFiscalYearStart - 1);
  const nextFiscalYearLabel = formatFiscalYearLabel(displayFiscalYearStart + 1);

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            description="Filter by fiscal year for one or more provinces/territories. Carry-over or adjustment amounts appear as negatives, and payment status shows the current PATH follow-up state for related packets."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={handleClearFilters} disabled={optionsLoading && dataLoading}>
                  Reset Filters
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExport}
                  loading={exporting}
                  disabled={displayRows.length === 0}
                >
                  Export to Excel
                </Button>
              </SpaceBetween>
            }
          >
            ISET Advances and Active Clients
          </Header>
        }
      >
        <SpaceBetween size="l">
          <ColumnLayout columns={3}>
            <FormField
              label="Fiscal year"
              description="Choose the fiscal year for the annual report."
            >
              <Select
                selectedOption={selectedFiscalYearOption}
                options={fiscalYearOptions}
                onChange={({ detail }) => setSelectedFiscalYearStart(detail.selectedOption?.value || "")}
                selectedAriaLabel="Selected fiscal year"
                disabled={optionsLoading}
              />
            </FormField>

            <FormField
              label="Region"
              description="Select one or more provinces or territories."
            >
              <Multiselect
                selectedOptions={selectedProvinceOptions}
                options={provinceOptions}
                onChange={({ detail }) =>
                  setSelectedProvinceValues(
                    (detail.selectedOptions || [])
                      .map(option => option?.value)
                      .filter(value => value !== undefined && value !== null && value !== "")
                  )
                }
                placeholder="All provinces / territories"
                tokenLimit={5}
                disabled={optionsLoading}
              />
            </FormField>

            <FormField
              label="Carry-over"
              description="Add a best-effort estimate across fiscal years."
            >
              <Checkbox
                checked={includeCarryOver}
                onChange={({ detail }) => setIncludeCarryOver(Boolean(detail.checked))}
                disabled={dataLoading}
              >
                Include carry-over
              </Checkbox>
            </FormField>
          </ColumnLayout>

        </SpaceBetween>
      </Container>

      {optionsError ? (
        <Alert type="error" header="Unable to load report controls">
          {optionsError}
        </Alert>
      ) : null}

      {dataError ? (
        <Alert type="error" header="Unable to load report data">
          {dataError}
        </Alert>
      ) : null}

      {exportError ? (
        <Alert type="error" header="Unable to export report">
          {exportError}
        </Alert>
      ) : null}

      <ColumnLayout columns={4}>
        <SummaryCard
          label="CRF Advances"
          value={formatCurrency(displaySummary.fundingTotals.CRF)}
        />
        <SummaryCard
          label="EI Advances"
          value={formatCurrency(displaySummary.fundingTotals.EI)}
        />
        <SummaryCard
          label="Participants"
          value={formatInteger(displaySummary.participantCount)}
        />
        <SummaryCard
          label="Interventions"
          value={formatInteger(displaySummary.interventionCount)}
        />
      </ColumnLayout>

      {includeCarryOver ? (
        <Container
          header={
            <Header
              variant="h2"
              description={carryOverSummary?.sourceNote || "Best-effort estimate for cross-fiscal activity."}
            >
              Carry-over estimate
            </Header>
          }
        >
          <ColumnLayout columns={3}>
            <SummaryCard
              label={`From FY ${previousFiscalYearLabel}`}
              value={formatCurrency(carryOverSummary?.carryInAmount)}
              secondary={`${formatInteger(carryOverSummary?.carryInInterventionCount)} interventions`}
            />
            <SummaryCard
              label={`To FY ${nextFiscalYearLabel}`}
              value={formatCurrency(carryOverSummary?.carryOutAmount)}
              secondary={`${formatInteger(carryOverSummary?.carryOutInterventionCount)} interventions`}
            />
            <SummaryCard
              label="Current FY estimate"
              value={formatCurrency(carryOverSummary?.currentFiscalEstimatedAmount)}
              secondary="Estimated from dated payment activity or intervention schedule"
            />
          </ColumnLayout>
        </Container>
      ) : null}

      <Container
        header={
          <Header
            variant="h2"
            description="Current filtered totals by participant home province or territory."
          >
            Region summary
          </Header>
        }
      >
        <Table
          variant="embedded"
          items={displaySummary.provinceRows}
          columnDefinitions={provinceSummaryColumns}
          loading={dataLoading}
          loadingText="Loading province summary"
          empty={
            <Box textAlign="center" color="inherit">
              No province or territory totals match the current filters.
            </Box>
          }
        />
      </Container>

      <Container
        header={
          <Header
            variant="h2"
            description={
              includeCarryOver
                ? "One row per intervention, with payment status and a best-effort carry-over estimate beside the funding amounts."
                : "One row per intervention, with payment status shown beside the funding amounts."
            }
          >
            Intervention detail
          </Header>
        }
      >
        <Table
          variant="embedded"
          trackBy="id"
          items={pagedRows}
          columnDefinitions={detailColumns}
          loading={dataLoading}
          loadingText="Loading intervention detail"
          resizableColumns
          stickyHeader
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              filteringPlaceholder="Find participant, case, intervention, institution, program, region, pot, or payment status"
              countText={`${displayRows.length} matches`}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={currentPageIndex}
              pagesCount={pagesCount}
              disabled={pagesCount <= 1}
              onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
            />
          }
          empty={
            <Box textAlign="center" color="inherit">
              No interventions match the current filters.
            </Box>
          }
        />
      </Container>
    </SpaceBetween>
  );
};

export default FinanceReportsPage;
