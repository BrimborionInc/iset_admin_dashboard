import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Container,
  FormField,
  Header,
  Input,
  Link,
  Modal,
  Multiselect,
  Popover,
  Select,
  SegmentedControl,
  SpaceBetween,
  StatusIndicator,
  Table,
  Textarea,
  Toggle,
} from "@cloudscape-design/components";
import Board from "@cloudscape-design/board-components/board";
import BoardItem from "@cloudscape-design/board-components/board-item";
import { apiFetch } from "../../auth/apiClient";
import useCurrentUser from "../../hooks/useCurrentUser";
import useReportingDemoMode from "./useReportingDemoMode";

const PROVINCE_TERRITORY_OPTIONS = [
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

const PROVINCE_CODE_INDEX = PROVINCE_TERRITORY_OPTIONS.reduce((acc, option, index) => {
  acc[option.value] = index;
  return acc;
}, {});

const DEMO_PROVINCE_WEIGHTS = {
  AB: 0.92,
  BC: 0.88,
  MB: 0.54,
  NB: 0.34,
  NL: 0.29,
  NT: 0.12,
  NS: 0.37,
  NU: 0.09,
  ON: 1.08,
  PE: 0.15,
  QC: 0.96,
  SK: 0.46,
  YT: 0.1,
};

const OVERALL_METRIC_DEFINITIONS = [
  { metric: "Clients Served", targetMultiplier: 58, resultMultiplier: 49 },
  { metric: "Clients Employed", targetMultiplier: 7, resultMultiplier: 5.4 },
  { metric: "Clients Returned to School", targetMultiplier: 11, resultMultiplier: 8.6 },
];

const DEMO_OVERALL_TARGET_BASE_WEIGHT = Object.values(DEMO_PROVINCE_WEIGHTS).reduce(
  (total, weight) => total + weight,
  0
);

const OVERALL_TARGET_KEY_BY_METRIC = {
  "Clients Served": "clientsServed",
  "Clients Employed": "clientsEmployed",
  "Clients Returned to School": "clientsReturnedToSchool",
};

const DEFAULT_REPORTING_TARGETS = {
  clientsServed: null,
  clientsEmployed: null,
  clientsReturnedToSchool: null,
};

const REPORTING_TARGET_FIELD_DEFINITIONS = [
  { key: "clientsServed", label: "Clients Served" },
  { key: "clientsEmployed", label: "Clients Employed" },
  { key: "clientsReturnedToSchool", label: "Clients Returned to School" },
];

const REPORTING_ROLE_ALIASES = {
  SysAdmin: "System Administrator",
  System_Administrator: "System Administrator",
  "System Admin": "System Administrator",
  ProgramAdmin: "Program Administrator",
  NWAC_Administrator: "Program Administrator",
  "Program Admin": "Program Administrator",
};

const REPORTING_EDITOR_ROLES = new Set([
  "System Administrator",
  "Program Administrator",
]);

const FISCAL_YEAR_OPTION_COUNT = 5;
const DEMO_CASE_MANAGER_BASELINE = 4;

const REPORTING_PERIOD_COLUMNS = [
  "April (p1)",
  "May (p2)",
  "June (p3)",
  "July (p4)",
  "August (p5)",
  "September (p6)",
  "October (p7)",
  "November (p8)",
  "December (p9)",
  "January (p10)",
  "February (p11)",
  "March (p12)",
  "Final (p14)",
];

const REPORTING_PERIOD_DISPLAY_LABELS = {
  "April (p1)": "Apr",
  "May (p2)": "May",
  "June (p3)": "Jun",
  "July (p4)": "Jul",
  "August (p5)": "Aug",
  "September (p6)": "Sep",
  "October (p7)": "Oct",
  "November (p8)": "Nov",
  "December (p9)": "Dec",
  "January (p10)": "Jan",
  "February (p11)": "Feb",
  "March (p12)": "Mar",
  "Final (p14)": "Final",
};

const RESULTS_VIEW_OPTIONS = [
  { id: "cumulative", text: "Cumulative" },
  { id: "monthly", text: "Monthly" },
];

const INTERVENTION_STATUS_OPTIONS = [
  { label: "Completed", value: "completed" },
  { label: "Planned", value: "planned" },
  { label: "Active", value: "active" },
  { label: "Cancelled", value: "cancelled" },
];

const INTERVENTION_SHOW_OPTIONS = [
  { label: "Count", value: "count" },
  { label: "Cost", value: "cost" },
];

const INTERVENTION_COUNT_DATE_BASIS_OPTIONS = [
  { label: "By start date", value: "start" },
  { label: "By end date", value: "end" },
];

const INTERVENTION_COST_DATE_BASIS_OPTIONS = [
  { label: "By payment month", value: "payment" },
];

const padDatePart = value => String(value).padStart(2, "0");

const buildIsoDate = (year, month, day) =>
  `${year}-${padDatePart(month)}-${padDatePart(day)}`;

const getReportingFiscalYearStart = (referenceDate = new Date()) => {
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
  label: `FY ${formatFiscalYearLabel(startYear)}`,
  value: String(startYear),
});

const buildFiscalYearOptions = (currentStartYear, count = FISCAL_YEAR_OPTION_COUNT) =>
  Array.from({ length: count }, (_, index) => buildFiscalYearOption(currentStartYear - index));

const buildQuarterDefinitions = (startYear = getReportingFiscalYearStart()) => {
  const nextYear = startYear + 1;
  return [
    { period: "Q1", dueDate: buildIsoDate(startYear, 6, 30) },
    { period: "Q2", dueDate: buildIsoDate(startYear, 9, 30) },
    { period: "Q3", dueDate: buildIsoDate(startYear, 12, 31) },
    { period: "Q4", dueDate: buildIsoDate(nextYear, 3, 31) },
  ];
};

const INTERVENTION_ROWS = [
  "1. Career research and exploration",
  "2. Diagnostic assessment",
  "3. Employment counselling",
  "4. Skills development - Essential Skills",
  "5. Skills development - Academic upgrading",
  "6. Work experience - job creation partnerships",
  "7. Work experience - wage subsidy",
  "8. Work experience - student employment",
  "9. Occupational skills training - certificate",
  "10. Occupational skills training - diploma",
  "11. Occupational skills training - degree",
  "12. Occupational skills training - apprenticeship",
  "13. Occupational skills training - vocational",
  "14. Self - employment",
  "15. Job search preparation strategies",
  "16. Job search supports",
  "17. Employer referral",
  "18. Employment retention supports",
  "19. Referral to agencies",
  "20. Pre-career development",
  "TOTAL",
];

const INTERVENTION_ROW_FACTORS = [
  0.22,
  0.05,
  0.34,
  0.06,
  0.12,
  0.04,
  0.07,
  0.03,
  0.2,
  0.24,
  0.18,
  0.02,
  0.08,
  0.02,
  0.05,
  0.04,
  0.03,
  0.03,
  0.04,
  0.02,
];

const CLIENT_RESULT_ROWS = [
  "Clients Served - Total",
  "Employed - Total",
  "Returned to school - Total",
];

const DATA_UPLOAD_ROWS = [
  "Submitted",
];

const ACTION_PLAN_STATUS_ROWS = [
  "3. Action Plans with a pending result",
  "4. Action Plans with data integrity issues",
  "5. Action Plans with a repeat Employed Result",
  "6. Action Plans with a repeat Returned to School Result",
  "8. Action Plans with an Unemployed Result",
];

const ACTION_PLAN_STATUS_SNAPSHOT_ROWS = new Set([
  "3. Action Plans with a pending result",
  "4. Action Plans with data integrity issues",
]);

const DASHBOARD_STORAGE_KEY = "reporting-data-and-results-layout.v1";

const REPORTING_SECTION_REGISTRY = {
  interventions: {
    id: "interventions",
    title: "Interventions",
    description: "Counts or costs for the selected fiscal year.",
    defaultRowSpan: 8,
    defaultColumnSpan: 4,
  },
  "overall-results": {
    id: "overall-results",
    title: "Overall Results Targets vs Year-end Results",
    description: "Annual targets and year-end results.",
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
  },
  "quarterly-data-uploads": {
    id: "quarterly-data-uploads",
    title: "Quarterly Data Uploads",
    description: "Quarterly submission due dates, receipt dates, and status.",
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
  },
  "client-results": {
    id: "client-results",
    title: "Client Results",
    description: "Client results for the selected fiscal year.",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
  },
  "data-uploads": {
    id: "data-uploads",
    title: "ILMP Data Uploads",
    description: "ILMP data upload submissions for the selected fiscal year.",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
  },
  "action-plan-statuses": {
    id: "action-plan-statuses",
    title: "Status of Action Plans",
    description: "Action plan status counts for the selected fiscal year.",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
  },
  "additional-comments": {
    id: "additional-comments",
    title: "Additional Comments",
    description: "Notes for this reporting year.",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
  },
};

const DEFAULT_DASHBOARD_LAYOUT = [
  { id: "interventions", rowSpan: 8, columnSpan: 4 },
  { id: "overall-results", rowSpan: 5, columnSpan: 4 },
  { id: "quarterly-data-uploads", rowSpan: 5, columnSpan: 4 },
  { id: "client-results", rowSpan: 6, columnSpan: 4 },
  { id: "data-uploads", rowSpan: 6, columnSpan: 4 },
  { id: "action-plan-statuses", rowSpan: 6, columnSpan: 4 },
  { id: "additional-comments", rowSpan: 4, columnSpan: 4 },
];

const exportLayout = (items = []) =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));

const toBoardItems = (layout = []) =>
  layout
    .map(item => {
      const definition = REPORTING_SECTION_REGISTRY[item.id];
      if (!definition) {
        return null;
      }
      return {
        id: definition.id,
        rowSpan: item.rowSpan ?? definition.defaultRowSpan,
        columnSpan: item.columnSpan ?? definition.defaultColumnSpan,
        columnOffset: item.columnOffset,
        data: {
          title: definition.title,
          description: definition.description,
        },
      };
    })
    .filter(Boolean);

const loadDashboardLayoutFromStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const filtered = parsed.filter(item => item && REPORTING_SECTION_REGISTRY[item.id]);
    return filtered.length ? filtered : null;
  } catch (error) {
    console.error("[DataAndResultsDashboard] Failed to parse stored layout", error);
    return null;
  }
};

const computePaletteItems = (layout = []) =>
  Object.values(REPORTING_SECTION_REGISTRY)
    .filter(definition => !layout.some(item => item.id === definition.id))
    .map(definition => ({
      id: definition.id,
      data: {
        title: definition.title,
        description: definition.description,
      },
    }));

const areLayoutsEqual = (left = [], right = []) => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (!leftItem || !rightItem || leftItem.id !== rightItem.id) {
      return false;
    }
    if ((leftItem.rowSpan ?? null) !== (rightItem.rowSpan ?? null)) {
      return false;
    }
    if ((leftItem.columnSpan ?? null) !== (rightItem.columnSpan ?? null)) {
      return false;
    }
    if ((leftItem.columnOffset ?? null) !== (rightItem.columnOffset ?? null)) {
      return false;
    }
  }
  return true;
};

const boardI18nStrings = {
  liveAnnouncementDndStarted: operationType => (operationType === "resize" ? "Resizing" : "Dragging"),
  liveAnnouncementDndItemReordered: operation => {
    const columns = `column ${operation.placement.x + 1}`;
    const rows = `row ${operation.placement.y + 1}`;
    return `Item moved to ${operation.direction === "horizontal" ? columns : rows}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const columnsConstraint = operation.isMinimalColumnsReached ? " (minimal)" : "";
    const rowsConstraint = operation.isMinimalRowsReached ? " (minimal)" : "";
    const sizeAnnouncement =
      operation.direction === "horizontal"
        ? `columns ${operation.placement.width}${columnsConstraint}`
        : `rows ${operation.placement.height}${rowsConstraint}`;
    return `Item resized to ${sizeAnnouncement}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const columns = `column ${operation.placement.x + 1}`;
    const rows = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${columns}, ${rows}.`;
  },
  liveAnnouncementDndCommitted: operationType => `${operationType} committed`,
  liveAnnouncementDndDiscarded: operationType => `${operationType} discarded`,
  liveAnnouncementItemRemoved: operation => `Removed item ${operation.item.data.title}.`,
  navigationAriaLabel: "Data and Results dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between report sections.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const boardItemI18nStrings = {
  dragHandleAriaLabel: "Drag handle",
  dragHandleAriaDescription:
    "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
  resizeHandleAriaLabel: "Resize handle",
  resizeHandleAriaDescription:
    "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.",
};

const QUARTER_STATUS_META = {
  accepted: { label: "Accepted", type: "success" },
  pending: { label: "Pending", type: "pending" },
  "needs-review": { label: "Needs review", type: "warning" },
  submitted: { label: "Submitted", type: "info" },
  ready: { label: "Ready to submit", type: "info" },
  "in-review": { label: "In review", type: "info" },
  rejected: { label: "Rejected", type: "warning" },
};

const LIVE_QUARTERLY_FILTER_NOTE =
  "Quarterly submission dates and statuses apply to the agreement as a whole, so province/territory and case manager filters do not change this section.";

const DEMO_MODE_POPOVER_CONTENT = (
  <Box variant="p">
    Demo mode shows sample figures so you can review the report layout and filters without relying
    on current reporting records.
  </Box>
);

const REPORT_CONTROLS_POPOVER_CONTENT = (
  <Box variant="p">
    Province or territory and case manager filters apply to the report sections below. Quarterly
    submission dates and statuses apply to the agreement as a whole.
  </Box>
);

const PENDING_OVERALL_RESULTS_ITEMS = [
  { metric: "Clients Served", target: null, result: null },
  { metric: "Clients Employed", target: null, result: null },
  { metric: "Clients Returned to School", target: null, result: null },
];

const buildPendingQuarterlyUploadItems = startYear =>
  buildQuarterDefinitions(startYear).map(item => ({
    period: item.period,
    dueDate: item.dueDate,
    receivedDate: null,
    status: null,
  }));

const buildPendingLiveReportData = () => ({
  overallResults: PENDING_OVERALL_RESULTS_ITEMS,
  interventions: buildPendingPeriodRows(INTERVENTION_ROWS),
  clientResults: buildPendingPeriodRows(CLIENT_RESULT_ROWS),
  dataUploads: buildPendingPeriodRows(DATA_UPLOAD_ROWS),
  actionPlanStatuses: buildPendingPeriodRows(ACTION_PLAN_STATUS_ROWS),
});

const DEFAULT_LIVE_REPORT_META = {
  hasAnyOperationalData: false,
  hasTargetsConfigured: false,
  sectionStatus: {
    overall: "pending",
    interventions: "pending",
    clientResults: "pending",
    dataUploads: "pending",
    actionPlanStatuses: "pending",
  },
  notes: {
    overall: "",
    interventions: "",
    clientResults: "",
    dataUploads: "",
    actionPlanStatuses: "",
  },
};

const createPendingPeriodRow = label => ({
  label,
  values: REPORTING_PERIOD_COLUMNS.reduce((acc, column) => {
    acc[column] = null;
    return acc;
  }, {}),
});

const buildPendingPeriodRows = labels => labels.map(createPendingPeriodRow);

const buildMonthlyPeriodRows = rows =>
  (rows || []).map(row => {
    let previousCumulativeValue = null;
    return {
      ...row,
      values: REPORTING_PERIOD_COLUMNS.reduce((acc, column) => {
        const currentValue = row?.values?.[column];

        if (column === "Final (p14)") {
          acc[column] = currentValue;
          return acc;
        }

        const currentNumber = Number(currentValue);
        if (!Number.isFinite(currentNumber)) {
          acc[column] = currentValue;
          return acc;
        }

        const nextValue =
          previousCumulativeValue === null
            ? currentNumber
            : currentNumber - previousCumulativeValue;
        acc[column] = Math.abs(nextValue - Math.round(nextValue)) < 0.000001
          ? Math.round(nextValue)
          : Math.round(nextValue * 100) / 100;

        previousCumulativeValue = currentNumber;
        return acc;
      }, {}),
    };
  });

const buildMonthlyActionPlanStatusRows = rows =>
  (rows || []).map(row => {
    if (ACTION_PLAN_STATUS_SNAPSHOT_ROWS.has(row?.label)) {
      return {
        ...row,
        values: REPORTING_PERIOD_COLUMNS.reduce((acc, column) => {
          acc[column] = row?.values?.[column] ?? null;
          return acc;
        }, {}),
      };
    }

    return buildMonthlyPeriodRows([row])[0];
  });

const matrixWrapperStyle = {
  overflowX: "auto",
};

const matrixTableStyle = {
  width: "max-content",
  minWidth: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const matrixHeaderCellStyle = {
  borderBottom: "1px solid #d5dbdb",
  borderTop: "1px solid #d5dbdb",
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
  backgroundColor: "#f2f3f3",
  fontWeight: 700,
};

const matrixValueHeaderCellStyle = {
  ...matrixHeaderCellStyle,
  textAlign: "center",
};

const matrixLabelCellStyle = {
  borderBottom: "1px solid #eaeded",
  padding: "10px 12px",
  whiteSpace: "nowrap",
  position: "sticky",
  left: 0,
  backgroundColor: "#ffffff",
  fontWeight: 600,
  zIndex: 1,
};

const matrixValueCellStyle = {
  borderBottom: "1px solid #eaeded",
  padding: "10px 12px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const matrixTotalRowCellStyle = {
  fontWeight: 700,
};

const MATRIX_STRIPE_BACKGROUND = "#f8f9fa";
const sectionHeaderFieldStyle = {
  minWidth: "160px",
};

const getMatrixRowBackgroundColor = (rowIndex, stripedRows) =>
  stripedRows && rowIndex % 2 === 1 ? MATRIX_STRIPE_BACKGROUND : "#ffffff";

const addDaysToIsoDate = (isoDate, days) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));
  return utcDate.toISOString().slice(0, 10);
};

const formatNumber = value =>
  Number.isFinite(value) ? value.toLocaleString("en-CA") : value;

const formatCurrency = value =>
  Number.isFinite(value)
    ? value.toLocaleString("en-CA", { style: "currency", currency: "CAD" })
    : value;

const displayValue = (value, valueFormat = "number") => {
  if (React.isValidElement(value)) {
    return value;
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return <span style={{ color: "#5f6b7a" }}>Pending</span>;
  }
  if (typeof value === "number") {
    return valueFormat === "currency" ? formatCurrency(value) : formatNumber(value);
  }
  return value;
};

const extractTextFromNode = node => {
  if (node === null || typeof node === "undefined" || typeof node === "boolean") {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join(" ");
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (React.isValidElement(node)) {
    return extractTextFromNode(node.props?.children);
  }
  return "";
};

const getDisplayTextValue = (value, valueFormat = "number") => {
  if (React.isValidElement(value)) {
    return extractTextFromNode(value).replace(/\s+/g, " ").trim();
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "Pending";
  }
  if (typeof value === "number") {
    return valueFormat === "currency" ? formatCurrency(value) : formatNumber(value);
  }
  return String(value);
};

const escapeCsvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;

const buildCsvContent = rows =>
  (rows || []).map(row => row.map(escapeCsvCell).join(",")).join("\r\n");

const triggerCsvDownload = (filename, csvContent) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const slugifyFilenamePart = value => {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "report";
};

const buildOverallResultsCsvRows = rows => [
  ["Metric", "Targets as established in AOP", "Year-end Results"],
  ...(rows || []).map(row => [
    row?.metric || "",
    getDisplayTextValue(row?.target),
    getDisplayTextValue(row?.result),
  ]),
];

const buildQuarterlyUploadsCsvRows = rows => [
  ["Period", "Due Date of Reporting Requirement", "Received by Data Gateway", "Status"],
  ...(rows || []).map(row => [
    row?.period || "",
    getDisplayTextValue(row?.dueDate),
    getDisplayTextValue(row?.receivedDate),
    getDisplayTextValue(row?.status),
  ]),
];

const buildMatrixCsvRows = (rows, valueFormat = "number") => [
  ["", ...REPORTING_PERIOD_COLUMNS.map(column => REPORTING_PERIOD_DISPLAY_LABELS[column] || column)],
  ...(rows || []).map(row => [
    row?.label || "",
    ...REPORTING_PERIOD_COLUMNS.map(column =>
      getDisplayTextValue(row?.values?.[column], valueFormat)
    ),
  ]),
];

const getInterventionStatusLabel = value =>
  INTERVENTION_STATUS_OPTIONS.find(option => option.value === value)?.label || "Completed";

const getInterventionDateBasisLabel = value =>
  value === "start" ? "start date" : value === "payment" ? "payment month" : "end date";

const buildInterventionViewLabel = ({ measure, statusView, dateBasis, prefix = "" }) =>
  measure === "cost"
    ? `${prefix}cost for ${getInterventionStatusLabel(statusView).toLowerCase()} interventions by ${getInterventionDateBasisLabel(dateBasis)}`
    : `${prefix}${getInterventionStatusLabel(statusView).toLowerCase()} interventions by ${getInterventionDateBasisLabel(dateBasis)}`;

const buildQuarterStatusIndicator = ({ statusKey, statusLabel }) => {
  const meta = QUARTER_STATUS_META[statusKey] || {
    label: statusLabel || "Pending",
    type: "pending",
  };
  return (
    <StatusIndicator type={meta.type}>
      {statusLabel || meta.label}
    </StatusIndicator>
  );
};

const getLiveSectionStatusType = ({ demoModeEnabled, loading, error, sectionStatus }) => {
  if (demoModeEnabled) return "success";
  if (error) return "error";
  if (loading) return "loading";
  if (sectionStatus === "live") return "success";
  return "info";
};

const getLiveSectionStatusMessage = ({
  demoModeEnabled,
  selectedFilterSummary,
  loading,
  error,
  sectionStatus,
  liveMessage,
  emptyMessage,
  errorMessage,
  loadingMessage,
}) => {
  if (demoModeEnabled) {
    return `Showing demo data for ${selectedFilterSummary}.`;
  }
  if (error) {
    return errorMessage;
  }
  if (loading) {
    return loadingMessage;
  }
  if (sectionStatus === "live" || sectionStatus === "partial") {
    return liveMessage;
  }
  return emptyMessage;
};

const getActiveProvinceCodes = selectedProvinceOptions =>
  selectedProvinceOptions.length
    ? selectedProvinceOptions.map(option => option.value)
    : PROVINCE_TERRITORY_OPTIONS.map(option => option.value);

const getActiveCaseManagerIds = selectedCaseManagerOptions =>
  selectedCaseManagerOptions.length
    ? selectedCaseManagerOptions.map(option => option.value)
    : [];

const getDemoCaseManagerScale = selectedCaseManagerCount => {
  if (!selectedCaseManagerCount) {
    return 1;
  }
  return Math.min(selectedCaseManagerCount, DEMO_CASE_MANAGER_BASELINE) / DEMO_CASE_MANAGER_BASELINE;
};

const DEMO_MONTHLY_SHARE_WEIGHTS = [5, 6, 7, 8, 8, 9, 9, 9, 10, 10, 9, 10];
const DEMO_EMPLOYED_MONTHLY_SHARE_WEIGHTS = [3, 4, 5, 6, 7, 8, 10, 11, 11, 12, 11, 12];
const DEMO_SCHOOL_MONTHLY_SHARE_WEIGHTS = [6, 7, 8, 8, 9, 10, 9, 9, 8, 8, 8, 10];
const DEMO_ACTION_PLAN_MONTHLY_SHARE_WEIGHTS = [4, 5, 6, 7, 7, 8, 9, 10, 10, 11, 11, 12];
const DEMO_INTERVENTION_START_DATE_SHARE_WEIGHTS = [10, 10, 9, 9, 8, 8, 7, 7, 6, 5, 4, 4];
const DEMO_INTERVENTION_END_DATE_SHARE_WEIGHTS = DEMO_MONTHLY_SHARE_WEIGHTS;
const DEMO_INTERVENTION_PAYMENT_MONTH_SHARE_WEIGHTS = [6, 8, 9, 10, 10, 11, 11, 11, 10, 9, 8, 7];
const DEMO_INTERVENTION_STATUS_FACTORS = {
  completed: 1,
  planned: 0.44,
  active: 0.28,
  cancelled: 0.08,
};
const DEMO_INTERVENTION_COST_STATUS_FACTORS = {
  completed: 0.94,
  planned: 1,
  active: 1,
  cancelled: 1,
};
const DEMO_INTERVENTION_AVERAGE_COSTS = [
  250,
  180,
  300,
  650,
  1200,
  1800,
  3400,
  1500,
  4500,
  9000,
  18000,
  7000,
  3800,
  5000,
  220,
  240,
  180,
  300,
  120,
  275,
];

const sumNumberArray = values =>
  (values || []).reduce((total, value) => total + Number(value || 0), 0);

const allocateByWeights = (total, weights) => {
  const targetTotal = Math.max(0, Math.round(Number(total) || 0));
  const safeWeights = (weights || []).map(weight => Math.max(0, Number(weight) || 0));

  if (!safeWeights.length || !targetTotal) {
    return safeWeights.map(() => 0);
  }

  const totalWeight = sumNumberArray(safeWeights);
  if (!totalWeight) {
    const evenAllocation = safeWeights.map(() => 0);
    for (let index = 0; index < targetTotal; index += 1) {
      evenAllocation[index % evenAllocation.length] += 1;
    }
    return evenAllocation;
  }

  const rawAllocations = safeWeights.map(weight => (targetTotal * weight) / totalWeight);
  const allocations = rawAllocations.map(value => Math.floor(value));
  let remaining = targetTotal - sumNumberArray(allocations);

  const rankedRemainders = rawAllocations
    .map((value, index) => ({
      index,
      remainder: value - allocations[index],
      weight: safeWeights[index],
    }))
    .sort((left, right) =>
      right.remainder - left.remainder ||
      right.weight - left.weight ||
      left.index - right.index
    );

  for (let index = 0; index < rankedRemainders.length && remaining > 0; index += 1) {
    allocations[rankedRemainders[index].index] += 1;
    remaining -= 1;
  }

  return allocations;
};

const allocateCurrencyByWeights = (total, weights) =>
  allocateByWeights(Math.round(Number(total || 0) * 100), weights).map(value => value / 100);

const buildReportingValuesFromMonthlyCounts = monthlyCounts => {
  let runningTotal = 0;
  return REPORTING_PERIOD_COLUMNS.reduce((acc, column, index) => {
    if (column === "Final (p14)") {
      acc[column] = runningTotal;
      return acc;
    }

    runningTotal += Number(monthlyCounts[index] || 0);
    acc[column] = runningTotal;
    return acc;
  }, {});
};

const buildDemoRowFromMonthlyCounts = (label, monthlyCounts) => ({
  label,
  values: buildReportingValuesFromMonthlyCounts(monthlyCounts),
});

const buildDemoOverallResults = ({ targets, results }) =>
  OVERALL_METRIC_DEFINITIONS.map(definition => {
    const metricKey = OVERALL_TARGET_KEY_BY_METRIC[definition.metric];
    return {
      metric: definition.metric,
      target: targets[metricKey],
      result: results[metricKey],
    };
  });

const buildDemoReportData = ({
  activeProvinceCodes,
  selectedCaseManagerCount,
  activeFiscalYearStart,
  interventionMeasure,
  interventionStatusView,
  interventionDateBasis,
}) => {
  const caseManagerScale = getDemoCaseManagerScale(selectedCaseManagerCount);
  const filteredResultWeight = activeProvinceCodes.reduce(
    (total, provinceCode) => total + (DEMO_PROVINCE_WEIGHTS[provinceCode] || 0),
    0
  ) * caseManagerScale;

  const results = {
    clientsServed: Math.max(0, Math.round(filteredResultWeight * 49)),
    clientsEmployed: Math.max(0, Math.round(filteredResultWeight * 5.4)),
    clientsReturnedToSchool: Math.max(0, Math.round(filteredResultWeight * 8.6)),
  };

  const targets = {
    clientsServed: Math.round(DEMO_OVERALL_TARGET_BASE_WEIGHT * 58),
    clientsEmployed: Math.round(DEMO_OVERALL_TARGET_BASE_WEIGHT * 7),
    clientsReturnedToSchool: Math.round(DEMO_OVERALL_TARGET_BASE_WEIGHT * 11),
  };

  const clientsServedMonthly = allocateByWeights(results.clientsServed, DEMO_MONTHLY_SHARE_WEIGHTS);
  const employedMonthly = allocateByWeights(
    Math.min(results.clientsEmployed, results.clientsServed),
    DEMO_EMPLOYED_MONTHLY_SHARE_WEIGHTS
  );
  const returnedToSchoolMonthly = allocateByWeights(
    Math.min(results.clientsReturnedToSchool, results.clientsServed),
    DEMO_SCHOOL_MONTHLY_SHARE_WEIGHTS
  );
  const effectiveInterventionDateBasis =
    interventionMeasure === "cost" ? "payment" : interventionDateBasis;
  const interventionMonthlyWeights =
    effectiveInterventionDateBasis === "payment"
      ? DEMO_INTERVENTION_PAYMENT_MONTH_SHARE_WEIGHTS
      : effectiveInterventionDateBasis === "start"
      ? DEMO_INTERVENTION_START_DATE_SHARE_WEIGHTS
      : DEMO_INTERVENTION_END_DATE_SHARE_WEIGHTS;
  const interventionStatusFactor =
    DEMO_INTERVENTION_STATUS_FACTORS[interventionStatusView] ||
    DEMO_INTERVENTION_STATUS_FACTORS.completed;
  const interventionMonthlyTotals = allocateByWeights(
    Math.round(results.clientsServed * interventionStatusFactor),
    interventionMonthlyWeights
  );

  const interventionLabels = INTERVENTION_ROWS.filter(label => label !== "TOTAL");
  const interventionMonthlyByLabel = interventionLabels.reduce((acc, label) => {
    acc[label] = Array(12).fill(0);
    return acc;
  }, {});

  interventionMonthlyTotals.forEach((monthTotal, monthIndex) => {
    const monthWeights = INTERVENTION_ROW_FACTORS.map((factor, factorIndex) =>
      factor * (1 + ((monthIndex + factorIndex) % 5) * 0.03)
    );
    const monthlyAllocations = allocateByWeights(monthTotal, monthWeights);
    monthlyAllocations.forEach((value, factorIndex) => {
      interventionMonthlyByLabel[interventionLabels[factorIndex]][monthIndex] = value;
    });
  });

  const interventions = interventionLabels.map(label =>
    buildDemoRowFromMonthlyCounts(label, interventionMonthlyByLabel[label])
  );
  interventions.push(buildDemoRowFromMonthlyCounts("TOTAL", interventionMonthlyTotals));

  const submittedMonthly = [...clientsServedMonthly];

  const actionPlanTotals = {
    pendingResult: Math.round(results.clientsServed * 0.24),
    dataIntegrityIssues: Math.round(sumNumberArray(submittedMonthly) * 0.04),
    repeatEmployedResult: Math.round(results.clientsEmployed * 0.08),
    repeatReturnedToSchoolResult: Math.round(results.clientsReturnedToSchool * 0.08),
    unemployedResult: Math.max(
      0,
      Math.round(results.clientsServed * 0.38)
    ),
  };

  const actionPlanStatuses = [
    buildDemoRowFromMonthlyCounts(
      "3. Action Plans with a pending result",
      allocateByWeights(actionPlanTotals.pendingResult, DEMO_ACTION_PLAN_MONTHLY_SHARE_WEIGHTS)
    ),
    buildDemoRowFromMonthlyCounts(
      "4. Action Plans with data integrity issues",
      allocateByWeights(actionPlanTotals.dataIntegrityIssues, DEMO_ACTION_PLAN_MONTHLY_SHARE_WEIGHTS)
    ),
    buildDemoRowFromMonthlyCounts(
      "5. Action Plans with a repeat Employed Result",
      allocateByWeights(actionPlanTotals.repeatEmployedResult, DEMO_ACTION_PLAN_MONTHLY_SHARE_WEIGHTS)
    ),
    buildDemoRowFromMonthlyCounts(
      "6. Action Plans with a repeat Returned to School Result",
      allocateByWeights(
        actionPlanTotals.repeatReturnedToSchoolResult,
        DEMO_ACTION_PLAN_MONTHLY_SHARE_WEIGHTS
      )
    ),
    buildDemoRowFromMonthlyCounts(
      "8. Action Plans with an Unemployed Result",
      allocateByWeights(actionPlanTotals.unemployedResult, DEMO_ACTION_PLAN_MONTHLY_SHARE_WEIGHTS)
    ),
  ];

  if (interventionMeasure === "cost") {
    const costStatusFactor =
      DEMO_INTERVENTION_COST_STATUS_FACTORS[interventionStatusView] ||
      DEMO_INTERVENTION_COST_STATUS_FACTORS.completed;
    const interventionCostRows = interventionLabels.map((label, index) => {
      const rowCountTotal = sumNumberArray(interventionMonthlyByLabel[label]);
      const rowCostTotal = rowCountTotal * DEMO_INTERVENTION_AVERAGE_COSTS[index] * costStatusFactor;
      return buildDemoRowFromMonthlyCounts(
        label,
        allocateCurrencyByWeights(rowCostTotal, DEMO_INTERVENTION_PAYMENT_MONTH_SHARE_WEIGHTS)
      );
    });
    const totalCostMonthly = Array(12).fill(0);
    interventionCostRows.forEach(row => {
      REPORTING_PERIOD_COLUMNS.slice(0, 12).forEach((column, monthIndex) => {
        const previousColumn =
          monthIndex === 0 ? null : REPORTING_PERIOD_COLUMNS[monthIndex - 1];
        const cumulativeValue = Number(row.values?.[column] || 0);
        const previousValue = previousColumn ? Number(row.values?.[previousColumn] || 0) : 0;
        totalCostMonthly[monthIndex] += cumulativeValue - previousValue;
      });
    });
    return {
      overallResults: buildDemoOverallResults({ targets, results }),
      quarterlyUploads: buildDemoQuarterlyUploads(activeProvinceCodes, activeFiscalYearStart),
      interventions: [
        ...interventionCostRows,
        buildDemoRowFromMonthlyCounts(
          "TOTAL",
          totalCostMonthly.map(value => Math.round(value * 100) / 100)
        ),
      ],
      clientResults: [
        buildDemoRowFromMonthlyCounts("Clients Served - Total", clientsServedMonthly),
        buildDemoRowFromMonthlyCounts("Employed - Total", employedMonthly),
        buildDemoRowFromMonthlyCounts("Returned to school - Total", returnedToSchoolMonthly),
      ],
      dataUploads: [
        buildDemoRowFromMonthlyCounts("Submitted", submittedMonthly),
      ],
      actionPlanStatuses,
    };
  }

  return {
    overallResults: buildDemoOverallResults({ targets, results }),
    quarterlyUploads: buildDemoQuarterlyUploads(activeProvinceCodes, activeFiscalYearStart),
    interventions,
    clientResults: [
      buildDemoRowFromMonthlyCounts("Clients Served - Total", clientsServedMonthly),
      buildDemoRowFromMonthlyCounts("Employed - Total", employedMonthly),
      buildDemoRowFromMonthlyCounts("Returned to school - Total", returnedToSchoolMonthly),
    ],
    dataUploads: [
      buildDemoRowFromMonthlyCounts("Submitted", submittedMonthly),
    ],
    actionPlanStatuses,
  };
};

const normaliseReportingTargetValue = value => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normaliseReportingTargetsResponse = rawValue => {
  const payload = rawValue && typeof rawValue === "object" ? rawValue : {};
  return {
    clientsServed: normaliseReportingTargetValue(payload.clientsServed),
    clientsEmployed: normaliseReportingTargetValue(payload.clientsEmployed),
    clientsReturnedToSchool: normaliseReportingTargetValue(payload.clientsReturnedToSchool),
  };
};

const buildReportingTargetsFormValues = targets => ({
  clientsServed:
    targets?.clientsServed === null || typeof targets?.clientsServed === "undefined"
      ? ""
      : String(targets.clientsServed),
  clientsEmployed:
    targets?.clientsEmployed === null || typeof targets?.clientsEmployed === "undefined"
      ? ""
      : String(targets.clientsEmployed),
  clientsReturnedToSchool:
    targets?.clientsReturnedToSchool === null ||
    typeof targets?.clientsReturnedToSchool === "undefined"
      ? ""
      : String(targets.clientsReturnedToSchool),
});

const getReportingTargetsFromOverallResults = rows => {
  const targets = { ...DEFAULT_REPORTING_TARGETS };
  (rows || []).forEach(row => {
    const targetKey = OVERALL_TARGET_KEY_BY_METRIC[row?.metric];
    if (!targetKey) {
      return;
    }
    targets[targetKey] = normaliseReportingTargetValue(row?.target);
  });
  return targets;
};

const applyReportingTargetsToOverallResults = (rows, targets) =>
  (rows || []).map(row => {
    const targetKey = OVERALL_TARGET_KEY_BY_METRIC[row?.metric];
    if (!targetKey) {
      return row;
    }
    return {
      ...row,
      target: targets[targetKey],
    };
  });

const validateReportingTargetFormValues = formValues => {
  const errors = {};
  REPORTING_TARGET_FIELD_DEFINITIONS.forEach(field => {
    const rawValue = String(formValues?.[field.key] ?? "").trim();
    if (!rawValue) {
      return;
    }
    if (!/^\d+$/.test(rawValue)) {
      errors[field.key] = "Enter a whole number or leave blank.";
    }
  });
  return errors;
};

const buildReportingTargetsPayload = formValues =>
  REPORTING_TARGET_FIELD_DEFINITIONS.reduce((acc, field) => {
    const rawValue = String(formValues?.[field.key] ?? "").trim();
    acc[field.key] = rawValue ? Number(rawValue) : null;
    return acc;
  }, {});

const formatReportingConfigUpdatedAt = value => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const canonicaliseReportingRole = role => {
  if (!role) {
    return null;
  }
  const rawValue =
    typeof role === "object" && role !== null
      ? role.value || role.label || role.role || role.name
      : role;
  if (!rawValue) {
    return null;
  }
  const normalised = String(rawValue).trim();
  return REPORTING_ROLE_ALIASES[normalised] || normalised;
};

const getQuarterStatusForProvince = (provinceCode, quarterIndex) => {
  const provinceIndex = PROVINCE_CODE_INDEX[provinceCode] ?? 0;
  if (quarterIndex === 0) return "accepted";
  if (quarterIndex === 1) return provinceIndex % 7 === 0 ? "needs-review" : "accepted";
  if (quarterIndex === 2) return provinceIndex % 4 === 0 ? "needs-review" : "accepted";
  if (provinceIndex % 5 === 0) return "accepted";
  if (provinceIndex % 3 === 0) return "needs-review";
  return "pending";
};

const getQuarterReceivedDateForProvince = (provinceCode, quarterIndex, quarterDefinitions) => {
  const status = getQuarterStatusForProvince(provinceCode, quarterIndex);
  if (status !== "accepted") {
    return null;
  }
  const provinceIndex = PROVINCE_CODE_INDEX[provinceCode] ?? 0;
  return addDaysToIsoDate(
    quarterDefinitions[quarterIndex].dueDate,
    (provinceIndex % 4) + quarterIndex + 1
  );
};

const buildQuarterStatusSummary = counts => {
  const parts = [];
  if (counts.accepted) {
    parts.push(`${counts.accepted} accepted`);
  }
  if (counts.pending) {
    parts.push(`${counts.pending} pending`);
  }
  if (counts["needs-review"]) {
    parts.push(`${counts["needs-review"]} need review`);
  }
  return parts.join(", ");
};

const buildDemoQuarterlyUploads = (activeProvinceCodes, fiscalYearStart) => {
  const quarterDefinitions = buildQuarterDefinitions(fiscalYearStart);
  return quarterDefinitions.map((quarter, quarterIndex) => {
    const statusKeys = activeProvinceCodes.map(provinceCode =>
      getQuarterStatusForProvince(provinceCode, quarterIndex)
    );
    const counts = statusKeys.reduce((acc, statusKey) => {
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    }, {});
    const distinctStatuses = Object.keys(counts);
    const hasMixedStatuses = distinctStatuses.length > 1;
    const acceptedDates = activeProvinceCodes
      .map(provinceCode => getQuarterReceivedDateForProvince(provinceCode, quarterIndex, quarterDefinitions))
      .filter(Boolean)
      .sort();

    const receivedDate = hasMixedStatuses
      ? acceptedDates.length
        ? "Varies by province"
        : null
      : acceptedDates.length
        ? acceptedDates[acceptedDates.length - 1]
        : null;

    const statusNode = hasMixedStatuses
      ? (
          <StatusIndicator type="info">
            Mixed ({buildQuarterStatusSummary(counts)})
          </StatusIndicator>
        )
      : (
          <StatusIndicator type={QUARTER_STATUS_META[distinctStatuses[0]].type}>
            {QUARTER_STATUS_META[distinctStatuses[0]].label}
          </StatusIndicator>
        );

    return {
      period: quarter.period,
      dueDate: quarter.dueDate,
      receivedDate,
      status: statusNode,
    };
  });
};

const SimpleSection = ({
  title,
  description,
  children,
  badgeText = null,
  badgeColor = "blue",
  headerActions = null,
  asBoardItem = false,
  actions = null,
  onDownloadCsv = null,
}) => {
  const headerContent =
    badgeText && headerActions ? (
      <SpaceBetween direction="horizontal" size="xs">
        {headerActions}
        <Badge color={badgeColor}>{badgeText}</Badge>
      </SpaceBetween>
    ) : headerActions ? (
      headerActions
    ) : badgeText ? (
      <Badge color={badgeColor}>{badgeText}</Badge>
    ) : null;

  const headerElement = (
    <Header variant="h2" description={description} actions={headerContent}>
      {title}
    </Header>
  );

  const content = <SpaceBetween size="m">{children}</SpaceBetween>;

  if (asBoardItem) {
    const settingsItems = [];
    if (onDownloadCsv) {
      settingsItems.push({ id: "download-csv", text: "Download CSV" });
    }
    if (actions?.removeItem) {
      settingsItems.push({ id: "remove", text: "Remove section" });
    }

    return (
      <BoardItem
        header={headerElement}
        settings={
          settingsItems.length ? (
            <ButtonDropdown
              items={settingsItems}
              ariaLabel="Board item settings"
              variant="icon"
              onItemClick={({ detail }) => {
                if (detail.id === "download-csv") {
                  onDownloadCsv?.();
                } else if (detail.id === "remove") {
                  actions.removeItem();
                }
              }}
            />
          ) : null
        }
        i18nStrings={boardItemI18nStrings}
      >
        {content}
      </BoardItem>
    );
  }

  return <Container header={headerElement}>{content}</Container>;
};

const MatrixSection = ({
  title,
  description,
  rows,
  stripedRows = false,
  badgeText = null,
  badgeColor = "blue",
  headerActions = null,
  valueFormat = "number",
  statusType = "info",
  statusMessage,
  asBoardItem = false,
  actions = null,
  onDownloadCsv = null,
}) => {
  const headerContent =
    badgeText && headerActions ? (
      <SpaceBetween direction="horizontal" size="xs">
        {headerActions}
        <Badge color={badgeColor}>{badgeText}</Badge>
      </SpaceBetween>
    ) : headerActions ? (
      headerActions
    ) : badgeText ? (
      <Badge color={badgeColor}>{badgeText}</Badge>
    ) : null;

  const headerElement = (
    <Header variant="h2" description={description} actions={headerContent}>
      {title}
    </Header>
  );

  const content = (
    <SpaceBetween size="m">
      <div style={matrixWrapperStyle}>
        <table style={matrixTableStyle}>
          <thead>
            <tr>
              <th style={matrixHeaderCellStyle} />
              {REPORTING_PERIOD_COLUMNS.map(column => (
                <th key={column} style={matrixValueHeaderCellStyle}>
                  {REPORTING_PERIOD_DISPLAY_LABELS[column] || column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowBackgroundColor = getMatrixRowBackgroundColor(rowIndex, stripedRows);
              return (
                <tr key={row.label}>
                  <td
                    style={
                      row.label === "TOTAL"
                        ? {
                            ...matrixLabelCellStyle,
                            backgroundColor: rowBackgroundColor,
                            ...matrixTotalRowCellStyle,
                          }
                        : { ...matrixLabelCellStyle, backgroundColor: rowBackgroundColor }
                    }
                  >
                    {row.label}
                  </td>
                  {REPORTING_PERIOD_COLUMNS.map(column => (
                    <td
                      key={`${row.label}-${column}`}
                      style={
                        row.label === "TOTAL"
                          ? {
                              ...matrixValueCellStyle,
                              backgroundColor: rowBackgroundColor,
                              ...matrixTotalRowCellStyle,
                            }
                          : { ...matrixValueCellStyle, backgroundColor: rowBackgroundColor }
                      }
                    >
                      {displayValue(row.values?.[column], valueFormat)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StatusIndicator type={statusType}>{statusMessage}</StatusIndicator>
    </SpaceBetween>
  );

  if (asBoardItem) {
    const settingsItems = [];
    if (onDownloadCsv) {
      settingsItems.push({ id: "download-csv", text: "Download CSV" });
    }
    if (actions?.removeItem) {
      settingsItems.push({ id: "remove", text: "Remove section" });
    }

    return (
      <BoardItem
        header={headerElement}
        settings={
          settingsItems.length ? (
            <ButtonDropdown
              items={settingsItems}
              ariaLabel="Board item settings"
              variant="icon"
              onItemClick={({ detail }) => {
                if (detail.id === "download-csv") {
                  onDownloadCsv?.();
                } else if (detail.id === "remove") {
                  actions.removeItem();
                }
              }}
            />
          ) : null
        }
        i18nStrings={boardItemI18nStrings}
      >
        {content}
      </BoardItem>
    );
  }

  return <Container header={headerElement}>{content}</Container>;
};

const DataAndResultsDashboard = ({
  updateBreadcrumbs,
  setSplitPanelOpen,
  setAvailableItems,
}) => {
  const { role: currentUserRole } = useCurrentUser();
  const defaultFiscalYearStart = useMemo(() => getReportingFiscalYearStart(), []);
  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(defaultFiscalYearStart),
    [defaultFiscalYearStart]
  );
  const [layout, setLayout] = useState(
    () => loadDashboardLayoutFromStorage() ?? DEFAULT_DASHBOARD_LAYOUT
  );
  const [selectedProvinceOptions, setSelectedProvinceOptions] = useState([]);
  const [selectedCaseManagerOptions, setSelectedCaseManagerOptions] = useState([]);
  const [caseManagerOptions, setCaseManagerOptions] = useState([]);
  const [caseManagerOptionsLoading, setCaseManagerOptionsLoading] = useState(false);
  const [caseManagerOptionsError, setCaseManagerOptionsError] = useState(null);
  const [selectedFiscalYearOption, setSelectedFiscalYearOption] = useState(
    () => buildFiscalYearOption(getReportingFiscalYearStart())
  );
  const [demoModeEnabled, setDemoModeEnabled] = useReportingDemoMode();
  const [monthlyResultsEnabled, setMonthlyResultsEnabled] = useState(false);
  const [interventionMeasure, setInterventionMeasure] = useState("count");
  const [interventionStatusView, setInterventionStatusView] = useState("completed");
  const [interventionDateBasis, setInterventionDateBasis] = useState("end");
  const [noRecordsAlertDismissed, setNoRecordsAlertDismissed] = useState(false);
  const [liveReportRefreshKey, setLiveReportRefreshKey] = useState(0);
  const [liveReportData, setLiveReportData] = useState(buildPendingLiveReportData);
  const [liveReportLoading, setLiveReportLoading] = useState(false);
  const [liveReportError, setLiveReportError] = useState(null);
  const [liveReportMeta, setLiveReportMeta] = useState(DEFAULT_LIVE_REPORT_META);
  const [liveQuarterlyUploads, setLiveQuarterlyUploads] = useState(
    () => buildPendingQuarterlyUploadItems(getReportingFiscalYearStart())
  );
  const [liveQuarterlyUploadsLoading, setLiveQuarterlyUploadsLoading] = useState(false);
  const [liveQuarterlyUploadsError, setLiveQuarterlyUploadsError] = useState(null);
  const [liveQuarterlyUploadsMeta, setLiveQuarterlyUploadsMeta] = useState({
    sourceStatus: "schedule_only",
    filterNote: LIVE_QUARTERLY_FILTER_NOTE,
    fiscalYear: formatFiscalYearLabel(getReportingFiscalYearStart()),
  });
  const [targetsModalVisible, setTargetsModalVisible] = useState(false);
  const [targetsModalLoading, setTargetsModalLoading] = useState(false);
  const [targetsModalError, setTargetsModalError] = useState(null);
  const [targetsSaving, setTargetsSaving] = useState(false);
  const [targetsFormValues, setTargetsFormValues] = useState(
    buildReportingTargetsFormValues(DEFAULT_REPORTING_TARGETS)
  );
  const [targetsFormErrors, setTargetsFormErrors] = useState({});
  const [targetsUpdatedAt, setTargetsUpdatedAt] = useState(null);
  const [targetsSaveNotice, setTargetsSaveNotice] = useState(null);
  const [additionalCommentsRefreshKey, setAdditionalCommentsRefreshKey] = useState(0);
  const [additionalCommentsLoading, setAdditionalCommentsLoading] = useState(false);
  const [additionalCommentsError, setAdditionalCommentsError] = useState(null);
  const [additionalCommentsValue, setAdditionalCommentsValue] = useState("");
  const [additionalCommentsUpdatedAt, setAdditionalCommentsUpdatedAt] = useState(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [commentsModalLoading, setCommentsModalLoading] = useState(false);
  const [commentsModalError, setCommentsModalError] = useState(null);
  const [commentsSaving, setCommentsSaving] = useState(false);
  const [commentsDraft, setCommentsDraft] = useState("");
  const [commentsSaveNotice, setCommentsSaveNotice] = useState(null);

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Reporting" },
        { text: "Data and Results", href: "/reporting/data-and-results" },
      ]);
    }
  }, [updateBreadcrumbs]);

  const activeProvinceCodes = useMemo(
    () => getActiveProvinceCodes(selectedProvinceOptions),
    [selectedProvinceOptions]
  );
  const activeCaseManagerIds = useMemo(
    () => getActiveCaseManagerIds(selectedCaseManagerOptions),
    [selectedCaseManagerOptions]
  );
  const activeFiscalYearStart = useMemo(() => {
    const parsed = Number(selectedFiscalYearOption?.value);
    return Number.isInteger(parsed) ? parsed : defaultFiscalYearStart;
  }, [defaultFiscalYearStart, selectedFiscalYearOption]);
  const activeFiscalYearLabel = useMemo(
    () => formatFiscalYearLabel(activeFiscalYearStart),
    [activeFiscalYearStart]
  );
  const activeInterventionDateBasis = useMemo(
    () => (interventionMeasure === "cost" ? "payment" : interventionDateBasis),
    [interventionDateBasis, interventionMeasure]
  );
  const activeInterventionDateOptions = useMemo(
    () =>
      interventionMeasure === "cost"
        ? INTERVENTION_COST_DATE_BASIS_OPTIONS
        : INTERVENTION_COUNT_DATE_BASIS_OPTIONS,
    [interventionMeasure]
  );
  const selectedInterventionShowOption = useMemo(
    () =>
      INTERVENTION_SHOW_OPTIONS.find(option => option.value === interventionMeasure) ||
      INTERVENTION_SHOW_OPTIONS[0],
    [interventionMeasure]
  );
  const selectedInterventionStatusOption = useMemo(
    () =>
      INTERVENTION_STATUS_OPTIONS.find(option => option.value === interventionStatusView) ||
      INTERVENTION_STATUS_OPTIONS[0],
    [interventionStatusView]
  );
  const selectedInterventionDateBasisOption = useMemo(
    () =>
      activeInterventionDateOptions.find(option => option.value === activeInterventionDateBasis) ||
      activeInterventionDateOptions[0],
    [activeInterventionDateBasis, activeInterventionDateOptions]
  );
  const canEditReportingConfig = useMemo(() => {
    const canonicalRole = canonicaliseReportingRole(currentUserRole);
    return REPORTING_EDITOR_ROLES.has(canonicalRole);
  }, [currentUserRole]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));
  const layoutSignatureRef = useRef(JSON.stringify(exportLayout(boardItems)));

  const selectedProvinceSummary = useMemo(() => {
    if (!selectedProvinceOptions.length) {
      return "All participant home provinces and territories";
    }
    if (selectedProvinceOptions.length === 1) {
      return selectedProvinceOptions[0].label;
    }
    return `${selectedProvinceOptions.length} selected`;
  }, [selectedProvinceOptions]);

  const selectedCaseManagerSummary = useMemo(() => {
    if (!selectedCaseManagerOptions.length) {
      return "All case managers";
    }
    if (selectedCaseManagerOptions.length === 1) {
      return selectedCaseManagerOptions[0].label;
    }
    return `${selectedCaseManagerOptions.length} case managers selected`;
  }, [selectedCaseManagerOptions]);

  const selectedFilterSummary = useMemo(
    () =>
      `FY ${activeFiscalYearLabel}; ${selectedProvinceSummary}; ${selectedCaseManagerSummary}`,
    [activeFiscalYearLabel, selectedCaseManagerSummary, selectedProvinceSummary]
  );

  useEffect(() => {
    setNoRecordsAlertDismissed(false);
  }, [selectedFilterSummary]);

  const hasActiveReportFilters =
    Boolean(selectedProvinceOptions.length) ||
    Boolean(selectedCaseManagerOptions.length) ||
    activeFiscalYearStart !== defaultFiscalYearStart;

  useEffect(() => {
    const paletteSignature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== paletteSignature) {
      paletteSignatureRef.current = paletteSignature;
      if (typeof setAvailableItems === "function") {
        try {
          setAvailableItems(paletteItems);
        } catch {}
      }
    }

    const exportedLayout = exportLayout(boardItems);
    const layoutSignature = JSON.stringify(exportedLayout);
    if (layoutSignatureRef.current !== layoutSignature) {
      layoutSignatureRef.current = layoutSignature;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DASHBOARD_STORAGE_KEY, layoutSignature);
        } catch {}
      }
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  const handleBoardItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) {
      return;
    }
    const nextLayout = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, nextLayout) ? current : nextLayout));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(current => (
      areLayoutsEqual(current, DEFAULT_DASHBOARD_LAYOUT) ? current : DEFAULT_DASHBOARD_LAYOUT
    ));
    const defaultPalette = computePaletteItems(toBoardItems(DEFAULT_DASHBOARD_LAYOUT));
    paletteSignatureRef.current = JSON.stringify(defaultPalette);
    layoutSignatureRef.current = JSON.stringify(DEFAULT_DASHBOARD_LAYOUT);
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(defaultPalette);
      } catch {}
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
      } catch {}
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch {}
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    const handlePaletteAdd = event => {
      const id = event?.detail?.id;
      if (!id || !REPORTING_SECTION_REGISTRY[id]) {
        return;
      }
      setLayout(current => {
        if (current.some(item => item.id === id)) {
          return current;
        }
        return [...current, { id }];
      });
    };

    window.addEventListener("dataAndResults:openPalette", handleOpen);
    window.addEventListener("dataAndResults:resetLayout", handleReset);
    window.addEventListener("palette:add", handlePaletteAdd);
    return () => {
      window.removeEventListener("dataAndResults:openPalette", handleOpen);
      window.removeEventListener("dataAndResults:resetLayout", handleReset);
      window.removeEventListener("palette:add", handlePaletteAdd);
    };
  }, [openPalette, resetLayout]);

  const handleOpenTargetsModal = async () => {
    setTargetsSaveNotice(null);
    setTargetsFormErrors({});
    setTargetsModalError(null);
    setTargetsUpdatedAt(null);
    setTargetsFormValues(
      buildReportingTargetsFormValues(
        getReportingTargetsFromOverallResults(liveReportData.overallResults)
      )
    );
    setTargetsModalVisible(true);
    setTargetsModalLoading(true);

    try {
      const response = await apiFetch(
        `/api/config/runtime/reporting-data-results-targets?fiscalYearStart=${activeFiscalYearStart}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.message || `Reporting targets request failed (${response.status})`
        );
      }
      const payload = await response.json().catch(() => ({}));
      const nextTargets = normaliseReportingTargetsResponse(payload.targets);
      setTargetsFormValues(buildReportingTargetsFormValues(nextTargets));
      setTargetsUpdatedAt(payload.updatedAt || null);
    } catch (error) {
      console.error("[Data and Results] failed to load reporting targets", error);
      setTargetsModalError(error?.message || "Reporting targets could not be loaded.");
    } finally {
      setTargetsModalLoading(false);
    }
  };

  const handleCloseTargetsModal = () => {
    if (targetsSaving) {
      return;
    }
    setTargetsModalVisible(false);
    setTargetsModalError(null);
    setTargetsFormErrors({});
  };

  const handleTargetsFieldChange = (fieldKey, nextValue) => {
    setTargetsFormValues(current => ({
      ...current,
      [fieldKey]: nextValue,
    }));
    setTargetsFormErrors(current => {
      if (!current?.[fieldKey]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[fieldKey];
      return nextErrors;
    });
  };

  const handleSaveTargets = async () => {
    const nextErrors = validateReportingTargetFormValues(targetsFormValues);
    setTargetsFormErrors(nextErrors);
    setTargetsModalError(null);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setTargetsSaving(true);

    try {
      const payload = buildReportingTargetsPayload(targetsFormValues);
      const response = await apiFetch("/api/config/runtime/reporting-data-results-targets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fiscalYearStart: activeFiscalYearStart,
          ...payload,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Reporting targets update failed (${response.status})`);
      }

      const savedPayload = await response.json().catch(() => ({}));
      const savedTargets = normaliseReportingTargetsResponse(savedPayload.targets);
      const hasTargetsConfigured = Object.values(savedTargets).some(value => value !== null);

      setTargetsFormValues(buildReportingTargetsFormValues(savedTargets));
      setTargetsUpdatedAt(savedPayload.updatedAt || null);
      setTargetsModalVisible(false);
      setTargetsSaveNotice(`AOP targets saved for FY ${activeFiscalYearLabel}.`);
      setLiveReportData(current => ({
        ...current,
        overallResults: applyReportingTargetsToOverallResults(current.overallResults, savedTargets),
      }));
      setLiveReportMeta(current => ({
        ...current,
        hasTargetsConfigured,
        sectionStatus: {
          ...current.sectionStatus,
          overall: current.hasAnyOperationalData
            ? hasTargetsConfigured
              ? "live"
              : "partial"
            : current.sectionStatus.overall,
        },
        notes: {
          ...current.notes,
          overall: hasTargetsConfigured
            ? "Year-end results and annual targets are shown below."
            : "Year-end results are shown below. Annual targets have not been entered for this fiscal year yet.",
        },
      }));
      setLiveReportRefreshKey(current => current + 1);
    } catch (error) {
      console.error("[Data and Results] failed to save reporting targets", error);
      setTargetsModalError(error?.message || "Reporting targets could not be saved.");
    } finally {
      setTargetsSaving(false);
    }
  };

  const loadAdditionalComments = useCallback(async controller => {
    setAdditionalCommentsLoading(true);
    setAdditionalCommentsError(null);

    try {
      const response = await apiFetch(
        `/api/config/runtime/reporting-data-results-comments?fiscalYearStart=${activeFiscalYearStart}`,
        { signal: controller?.signal }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.message || `Additional comments request failed (${response.status})`
        );
      }
      const payload = await response.json().catch(() => ({}));
      if (controller?.signal?.aborted) {
        return;
      }
      setAdditionalCommentsValue(String(payload.comments || ""));
      setAdditionalCommentsUpdatedAt(payload.updatedAt || null);
    } catch (error) {
      if (controller?.signal?.aborted) {
        return;
      }
      console.error("[Data and Results] failed to load additional comments", error);
      setAdditionalCommentsValue("");
      setAdditionalCommentsUpdatedAt(null);
      setAdditionalCommentsError(
        error?.message || "Additional comments could not be loaded."
      );
    } finally {
      if (!controller?.signal?.aborted) {
        setAdditionalCommentsLoading(false);
      }
    }
  }, [activeFiscalYearStart]);

  const handleOpenCommentsModal = async () => {
    setCommentsSaveNotice(null);
    setCommentsModalError(null);
    setCommentsDraft(additionalCommentsValue);
    setCommentsModalVisible(true);
    setCommentsModalLoading(true);

    try {
      const response = await apiFetch(
        `/api/config/runtime/reporting-data-results-comments?fiscalYearStart=${activeFiscalYearStart}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.message || `Additional comments request failed (${response.status})`
        );
      }
      const payload = await response.json().catch(() => ({}));
      setCommentsDraft(String(payload.comments || ""));
      setAdditionalCommentsUpdatedAt(payload.updatedAt || null);
    } catch (error) {
      console.error("[Data and Results] failed to load additional comments for editing", error);
      setCommentsModalError(error?.message || "Additional comments could not be loaded.");
    } finally {
      setCommentsModalLoading(false);
    }
  };

  const handleCloseCommentsModal = () => {
    if (commentsSaving) {
      return;
    }
    setCommentsModalVisible(false);
    setCommentsModalError(null);
  };

  const handleSaveComments = async () => {
    setCommentsModalError(null);
    setCommentsSaving(true);

    try {
      const response = await apiFetch("/api/config/runtime/reporting-data-results-comments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fiscalYearStart: activeFiscalYearStart,
          comments: commentsDraft,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.message || `Additional comments update failed (${response.status})`
        );
      }
      const payload = await response.json().catch(() => ({}));
      const nextComments = String(payload.comments || "");
      setAdditionalCommentsValue(nextComments);
      setAdditionalCommentsUpdatedAt(payload.updatedAt || null);
      setCommentsDraft(nextComments);
      setCommentsModalVisible(false);
      setCommentsSaveNotice("Additional comments saved.");
      setAdditionalCommentsRefreshKey(current => current + 1);
    } catch (error) {
      console.error("[Data and Results] failed to save additional comments", error);
      setCommentsModalError(error?.message || "Additional comments could not be saved.");
    } finally {
      setCommentsSaving(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadCaseManagerOptions = async () => {
      setCaseManagerOptionsLoading(true);
      setCaseManagerOptionsError(null);

      try {
        const response = await apiFetch(
          `/api/reporting/data-and-results/filter-options?fiscalYearStart=${activeFiscalYearStart}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Reporting filter options request failed (${response.status})`);
        }
        const payload = await response.json().catch(() => ({}));
        if (controller.signal.aborted) {
          return;
        }
        const nextOptions = Array.isArray(payload.caseManagers)
          ? payload.caseManagers
              .filter(option => option?.value && option?.label)
              .map(option => ({
                label: option.label,
                value: String(option.value),
                description: option.role || undefined,
              }))
          : [];
        setCaseManagerOptions(nextOptions);
        setSelectedCaseManagerOptions(currentSelected =>
          currentSelected
            .map(option => nextOptions.find(candidate => candidate.value === option.value) || option)
            .filter(option => nextOptions.some(candidate => candidate.value === option.value))
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("[Data and Results] failed to load case manager filters", error);
        setCaseManagerOptions([]);
        setCaseManagerOptionsError(
          error?.message || "Case manager filters could not be loaded."
        );
      } finally {
        if (!controller.signal.aborted) {
          setCaseManagerOptionsLoading(false);
        }
      }
    };

    loadCaseManagerOptions();

    return () => controller.abort();
  }, [activeFiscalYearStart]);

  useEffect(() => {
    if (demoModeEnabled) {
      return undefined;
    }

    const controller = new AbortController();

    const loadLiveQuarterlyUploads = async () => {
      setLiveQuarterlyUploadsLoading(true);
      setLiveQuarterlyUploadsError(null);

      try {
        const params = new URLSearchParams();
        params.set("fiscalYearStart", String(activeFiscalYearStart));
        if (selectedProvinceOptions.length) {
          params.set("provinces", activeProvinceCodes.join(","));
        }
        if (selectedCaseManagerOptions.length) {
          params.set("caseManagers", activeCaseManagerIds.join(","));
        }

        const response = await apiFetch(
          params.toString()
            ? `/api/reporting/data-and-results/quarterly-uploads?${params.toString()}`
            : "/api/reporting/data-and-results/quarterly-uploads",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Quarterly uploads request failed (${response.status})`);
        }

        const payload = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        const items = Array.isArray(payload.items) && payload.items.length
          ? payload.items.map(item => ({
              period: item.period,
              dueDate: item.dueDate,
              receivedDate: item.receivedDate,
              status: buildQuarterStatusIndicator({
                statusKey: item.statusKey,
                statusLabel: item.statusLabel,
              }),
            }))
          : buildPendingQuarterlyUploadItems(activeFiscalYearStart);

        setLiveQuarterlyUploads(items);
        setLiveQuarterlyUploadsMeta({
          sourceStatus: payload.sourceStatus || "schedule_only",
          filterNote: payload.filterNote || LIVE_QUARTERLY_FILTER_NOTE,
          fiscalYear: payload.fiscalYear || formatFiscalYearLabel(getReportingFiscalYearStart()),
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("[Data and Results] failed to load quarterly uploads", error);
        setLiveQuarterlyUploads(buildPendingQuarterlyUploadItems(activeFiscalYearStart));
        setLiveQuarterlyUploadsError(
          error?.message || "Quarterly upload data could not be loaded."
        );
        setLiveQuarterlyUploadsMeta(current => ({
          ...current,
          sourceStatus: "schedule_only",
        }));
      } finally {
        if (!controller.signal.aborted) {
          setLiveQuarterlyUploadsLoading(false);
        }
      }
    };

    loadLiveQuarterlyUploads();

    return () => controller.abort();
  }, [
    activeCaseManagerIds,
    activeFiscalYearStart,
    activeProvinceCodes,
    demoModeEnabled,
    selectedCaseManagerOptions.length,
    selectedProvinceOptions.length,
  ]);

  useEffect(() => {
    if (demoModeEnabled) {
      return undefined;
    }

    const controller = new AbortController();

    const loadLiveReport = async () => {
      setLiveReportLoading(true);
      setLiveReportError(null);

      try {
        const params = new URLSearchParams();
        params.set("fiscalYearStart", String(activeFiscalYearStart));
        params.set("interventionMeasure", interventionMeasure);
        params.set("interventionStatus", interventionStatusView);
        params.set("interventionDateBasis", activeInterventionDateBasis);
        if (selectedProvinceOptions.length) {
          params.set("provinces", activeProvinceCodes.join(","));
        }
        if (selectedCaseManagerOptions.length) {
          params.set("caseManagers", activeCaseManagerIds.join(","));
        }

        const response = await apiFetch(
          params.toString()
            ? `/api/reporting/data-and-results/live-report?${params.toString()}`
            : "/api/reporting/data-and-results/live-report",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Live report request failed (${response.status})`);
        }

        const payload = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        setLiveReportData({
          overallResults: Array.isArray(payload.overallResults) && payload.overallResults.length
            ? payload.overallResults
            : PENDING_OVERALL_RESULTS_ITEMS,
          interventions: Array.isArray(payload.interventions) && payload.interventions.length
            ? payload.interventions
            : buildPendingPeriodRows(INTERVENTION_ROWS),
          clientResults: Array.isArray(payload.clientResults) && payload.clientResults.length
            ? payload.clientResults
            : buildPendingPeriodRows(CLIENT_RESULT_ROWS),
          dataUploads: Array.isArray(payload.dataUploads) && payload.dataUploads.length
            ? payload.dataUploads
            : buildPendingPeriodRows(DATA_UPLOAD_ROWS),
          actionPlanStatuses: Array.isArray(payload.actionPlanStatuses) && payload.actionPlanStatuses.length
            ? payload.actionPlanStatuses
            : buildPendingPeriodRows(ACTION_PLAN_STATUS_ROWS),
        });
        setLiveReportMeta({
          ...DEFAULT_LIVE_REPORT_META,
          ...(payload.meta || {}),
          sectionStatus: {
            ...DEFAULT_LIVE_REPORT_META.sectionStatus,
            ...(payload.meta?.sectionStatus || {}),
          },
          notes: {
            ...DEFAULT_LIVE_REPORT_META.notes,
            ...(payload.meta?.notes || {}),
          },
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("[Data and Results] failed to load live report", error);
        setLiveReportError(error?.message || "Live report data could not be loaded.");
      } finally {
        if (!controller.signal.aborted) {
          setLiveReportLoading(false);
        }
      }
    };

    loadLiveReport();

    return () => controller.abort();
  }, [
    activeCaseManagerIds,
    activeFiscalYearStart,
    activeProvinceCodes,
    activeInterventionDateBasis,
    demoModeEnabled,
    interventionMeasure,
    interventionDateBasis,
    interventionStatusView,
    liveReportRefreshKey,
    selectedCaseManagerOptions.length,
    selectedProvinceOptions.length,
  ]);

  useEffect(() => {
    if (demoModeEnabled) {
      return undefined;
    }

    const controller = new AbortController();
    loadAdditionalComments(controller);
    return () => controller.abort();
  }, [additionalCommentsRefreshKey, demoModeEnabled, loadAdditionalComments]);

  const reportData = useMemo(() => {
    const baseReportData = !demoModeEnabled
      ? {
          overallResults: liveReportData.overallResults,
          quarterlyUploads: liveQuarterlyUploads,
          interventions: liveReportData.interventions,
          clientResults: liveReportData.clientResults,
          dataUploads: liveReportData.dataUploads,
          actionPlanStatuses: liveReportData.actionPlanStatuses,
        }
      : buildDemoReportData({
          activeProvinceCodes,
          selectedCaseManagerCount: selectedCaseManagerOptions.length,
          activeFiscalYearStart,
          interventionMeasure,
          interventionStatusView,
          interventionDateBasis: activeInterventionDateBasis,
        });

    if (!monthlyResultsEnabled) {
      return baseReportData;
    }

    return {
      ...baseReportData,
      interventions: buildMonthlyPeriodRows(baseReportData.interventions),
      clientResults: buildMonthlyPeriodRows(baseReportData.clientResults),
      dataUploads: buildMonthlyPeriodRows(baseReportData.dataUploads),
      actionPlanStatuses: buildMonthlyActionPlanStatusRows(baseReportData.actionPlanStatuses),
    };
  }, [
    activeFiscalYearStart,
    activeProvinceCodes,
    activeInterventionDateBasis,
    demoModeEnabled,
    interventionMeasure,
    interventionStatusView,
    liveQuarterlyUploads,
    liveReportData,
    monthlyResultsEnabled,
    selectedCaseManagerOptions.length,
  ]);

  const resultsViewLabel = monthlyResultsEnabled ? "Monthly" : "Cumulative";
  const resultsViewDescription = "Toggle the report between cumulative and monthly figures.";
  const interventionViewLabel = buildInterventionViewLabel({
    measure: interventionMeasure,
    statusView: interventionStatusView,
    dateBasis: activeInterventionDateBasis,
  });

  const matrixSectionDescriptionByMode = {
    interventions: monthlyResultsEnabled
      ? `Review monthly ${interventionViewLabel} for the selected fiscal year.`
      : `Review cumulative ${interventionViewLabel} for the selected fiscal year.`,
    clientResults: monthlyResultsEnabled
      ? "Monthly client results for the selected fiscal year."
      : "Cumulative client results for the selected fiscal year.",
    dataUploads: monthlyResultsEnabled
      ? "Monthly ILMP data upload submissions for the selected fiscal year."
      : "Cumulative ILMP data upload submissions for the selected fiscal year.",
    actionPlanStatuses: monthlyResultsEnabled
      ? "Month-end action plan status counts and monthly result counts for the selected fiscal year."
      : "Cumulative action plan status counts for the selected fiscal year.",
  };

  const matrixSectionStatusMessageByMode = {
    interventions: monthlyResultsEnabled
      ? `The interventions table shows monthly ${interventionViewLabel}.`
      : `The interventions table shows ${resultsViewLabel.toLowerCase()} ${interventionViewLabel}.`,
    clientResults: monthlyResultsEnabled
      ? "Monthly client results are shown below."
      : liveReportMeta.notes.clientResults || "Client results are shown below.",
    dataUploads: monthlyResultsEnabled
      ? "Monthly ILMP data upload submissions are shown below."
      : liveReportMeta.notes.dataUploads || "ILMP data upload submissions are shown below.",
    actionPlanStatuses: monthlyResultsEnabled
      ? "Pending-result and data-integrity rows show month-end counts; result rows show monthly counts."
      : liveReportMeta.notes.actionPlanStatuses || "Action plan status counts are shown below.",
  };

  const liveReportingError = liveQuarterlyUploadsError || liveReportError;
  const liveReportingLoading = !demoModeEnabled && (liveQuarterlyUploadsLoading || liveReportLoading);
  const showNoRecordsAlert = !demoModeEnabled &&
    !liveReportingError &&
    !liveReportingLoading &&
    !liveReportMeta.hasAnyOperationalData &&
    liveQuarterlyUploadsMeta.sourceStatus !== "live";
  const topAlertConfig = liveReportingError
    ? {
        type: "info",
        header: "Data and Results",
        body: "Some report information is temporarily unavailable. Sections with missing information may show blank or pending values.",
        dismissible: false,
        onDismiss: undefined,
      }
    : showNoRecordsAlert && !noRecordsAlertDismissed
      ? {
          type: "info",
          header: "Data and Results",
          body: "No reporting records were found for the selected filters.",
          dismissible: true,
          onDismiss: () => setNoRecordsAlertDismissed(true),
        }
      : null;

  const quarterlySectionStatusType = demoModeEnabled
    ? "success"
    : liveQuarterlyUploadsError
      ? "error"
      : liveQuarterlyUploadsLoading
        ? "loading"
        : liveQuarterlyUploadsMeta.sourceStatus === "live"
          ? "success"
          : "info";

  const quarterlySectionStatusMessage = demoModeEnabled
    ? `Sample quarterly submission information is shown for ${selectedFilterSummary}.`
    : liveQuarterlyUploadsError
      ? "Quarterly submission information is currently unavailable."
      : liveQuarterlyUploadsLoading
        ? "Updating quarterly submission information."
        : liveQuarterlyUploadsMeta.sourceStatus === "live"
          ? "Quarterly submission dates and statuses are shown below."
          : `No quarterly submission record has been entered yet for FY ${liveQuarterlyUploadsMeta.fiscalYear}.`;

  const overallSectionStatusType = getLiveSectionStatusType({
    demoModeEnabled,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.overall,
  });

  const overallSectionStatusMessage = getLiveSectionStatusMessage({
    demoModeEnabled,
    selectedFilterSummary,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.overall,
    liveMessage: liveReportMeta.notes.overall || "Year-end results are shown below.",
    emptyMessage: "No year-end results were found for the selected filters.",
    errorMessage: "Year-end results are currently unavailable.",
    loadingMessage: "Updating year-end results.",
  });

  const interventionsSectionStatusType = getLiveSectionStatusType({
    demoModeEnabled,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.interventions,
  });

  const interventionsSectionStatusMessage = getLiveSectionStatusMessage({
    demoModeEnabled,
    selectedFilterSummary,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.interventions,
    liveMessage: matrixSectionStatusMessageByMode.interventions,
    emptyMessage: `No ${interventionViewLabel} were found for the selected filters.`,
    errorMessage: "Intervention information is currently unavailable.",
    loadingMessage: "Updating intervention information.",
  });

  const clientResultsSectionStatusType = getLiveSectionStatusType({
    demoModeEnabled,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.clientResults,
  });

  const clientResultsSectionStatusMessage = getLiveSectionStatusMessage({
    demoModeEnabled,
    selectedFilterSummary,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.clientResults,
    liveMessage: matrixSectionStatusMessageByMode.clientResults,
    emptyMessage: "No client results were found for the selected filters.",
    errorMessage: "Client results are currently unavailable.",
    loadingMessage: "Updating client results.",
  });

  const dataUploadsSectionStatusType = getLiveSectionStatusType({
    demoModeEnabled,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.dataUploads,
  });

  const dataUploadsSectionStatusMessage = getLiveSectionStatusMessage({
    demoModeEnabled,
    selectedFilterSummary,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.dataUploads,
    liveMessage: matrixSectionStatusMessageByMode.dataUploads,
    emptyMessage: "No ILMP data upload submissions were found for the selected filters.",
    errorMessage: "ILMP data upload information is currently unavailable.",
    loadingMessage: "Updating ILMP data upload information.",
  });

  const actionPlanStatusesSectionStatusType = getLiveSectionStatusType({
    demoModeEnabled,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.actionPlanStatuses,
  });

  const actionPlanStatusesSectionStatusMessage = getLiveSectionStatusMessage({
    demoModeEnabled,
    selectedFilterSummary,
    loading: liveReportLoading,
    error: liveReportError,
    sectionStatus: liveReportMeta.sectionStatus.actionPlanStatuses,
    liveMessage: matrixSectionStatusMessageByMode.actionPlanStatuses,
    emptyMessage: "No action plan status information was found for the selected filters.",
    errorMessage: "Action plan status information is currently unavailable.",
    loadingMessage: "Updating action plan status information.",
  });

  const commentsContent = demoModeEnabled
    ? `Sample comments are shown for ${selectedFilterSummary}.`
    : additionalCommentsLoading
      ? `Loading comments for FY ${activeFiscalYearLabel}.`
      : additionalCommentsValue
        ? additionalCommentsValue
        : `No comments have been added for FY ${activeFiscalYearLabel} yet.`;

  const downloadSectionCsv = useCallback(sectionId => {
    const baseFileNameParts = ["data-and-results", `fy-${activeFiscalYearLabel}`];
    if (demoModeEnabled) {
      baseFileNameParts.push("sample-data");
    }

    let filename = "data-and-results.csv";
    let csvRows = null;

    switch (sectionId) {
      case "interventions":
        filename = [
          ...baseFileNameParts,
          "interventions",
          interventionMeasure,
          interventionStatusView,
          activeInterventionDateBasis,
          monthlyResultsEnabled ? "monthly" : "cumulative",
        ]
          .map(slugifyFilenamePart)
          .join("-")
          .concat(".csv");
        csvRows = buildMatrixCsvRows(
          reportData.interventions,
          interventionMeasure === "cost" ? "currency" : "number"
        );
        break;
      case "overall-results":
        filename = [
          ...baseFileNameParts,
          "overall-results",
        ]
          .map(slugifyFilenamePart)
          .join("-")
          .concat(".csv");
        csvRows = buildOverallResultsCsvRows(reportData.overallResults);
        break;
      case "quarterly-data-uploads":
        filename = [
          ...baseFileNameParts,
          "quarterly-data-uploads",
        ]
          .map(slugifyFilenamePart)
          .join("-")
          .concat(".csv");
        csvRows = buildQuarterlyUploadsCsvRows(reportData.quarterlyUploads);
        break;
      case "client-results":
        filename = [
          ...baseFileNameParts,
          "client-results",
          monthlyResultsEnabled ? "monthly" : "cumulative",
        ]
          .map(slugifyFilenamePart)
          .join("-")
          .concat(".csv");
        csvRows = buildMatrixCsvRows(reportData.clientResults);
        break;
      case "data-uploads":
        filename = [
          ...baseFileNameParts,
          "ilmp-data-uploads",
          monthlyResultsEnabled ? "monthly" : "cumulative",
        ]
          .map(slugifyFilenamePart)
          .join("-")
          .concat(".csv");
        csvRows = buildMatrixCsvRows(reportData.dataUploads);
        break;
      case "action-plan-statuses":
        filename = [
          ...baseFileNameParts,
          "status-of-action-plans",
          monthlyResultsEnabled ? "monthly" : "cumulative",
        ]
          .map(slugifyFilenamePart)
          .join("-")
          .concat(".csv");
        csvRows = buildMatrixCsvRows(reportData.actionPlanStatuses);
        break;
      default:
        return;
    }

    triggerCsvDownload(filename, buildCsvContent(csvRows));
  }, [
    activeFiscalYearLabel,
    activeInterventionDateBasis,
    demoModeEnabled,
    interventionMeasure,
    interventionStatusView,
    monthlyResultsEnabled,
    reportData,
  ]);

  const renderBoardItem = (item, actions) => {
    switch (item?.id) {
      case "interventions":
        return (
          <MatrixSection
            asBoardItem
            actions={actions}
            onDownloadCsv={() => downloadSectionCsv("interventions")}
            title="Interventions"
            description={matrixSectionDescriptionByMode.interventions}
            rows={reportData.interventions}
            stripedRows
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            valueFormat={interventionMeasure === "cost" ? "currency" : "number"}
            headerActions={
              <SpaceBetween direction="horizontal" size="s">
                <div style={sectionHeaderFieldStyle}>
                  <Box variant="awsui-key-label">Show</Box>
                  <Select
                    selectedOption={selectedInterventionShowOption}
                    onChange={({ detail }) =>
                      setInterventionMeasure(detail.selectedOption?.value || "count")
                    }
                    options={INTERVENTION_SHOW_OPTIONS}
                    ariaLabel="Choose whether to show intervention counts or costs"
                  />
                </div>
                <div style={sectionHeaderFieldStyle}>
                  <Box variant="awsui-key-label">Status</Box>
                  <Select
                    selectedOption={selectedInterventionStatusOption}
                    onChange={({ detail }) =>
                      setInterventionStatusView(detail.selectedOption?.value || "completed")
                    }
                    options={INTERVENTION_STATUS_OPTIONS}
                    ariaLabel="Choose which intervention status to show"
                  />
                </div>
                <div style={sectionHeaderFieldStyle}>
                  <Box variant="awsui-key-label">Date</Box>
                  <Select
                    selectedOption={selectedInterventionDateBasisOption}
                    onChange={({ detail }) =>
                      setInterventionDateBasis(detail.selectedOption?.value || "end")
                    }
                    options={activeInterventionDateOptions}
                    disabled={interventionMeasure === "cost"}
                    ariaLabel={
                      interventionMeasure === "cost"
                        ? "Intervention costs are grouped by payment month"
                        : "Choose whether to group interventions by start date or end date"
                    }
                  />
                </div>
              </SpaceBetween>
            }
            statusType={interventionsSectionStatusType}
            statusMessage={interventionsSectionStatusMessage}
          />
        );
      case "overall-results":
        return (
          <SimpleSection
            asBoardItem
            actions={actions}
            onDownloadCsv={() => downloadSectionCsv("overall-results")}
            title="Overall Results Targets vs Year-end Results"
            description="Annual targets and year-end results."
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            headerActions={
              <Button onClick={handleOpenTargetsModal}>
                Edit targets
              </Button>
            }
          >
            {targetsSaveNotice ? (
              <Alert
                type="success"
                dismissible
                onDismiss={() => setTargetsSaveNotice(null)}
              >
                {targetsSaveNotice}
              </Alert>
            ) : null}
            <Table
              variant="embedded"
              wrapLines
              columnDefinitions={[
                {
                  id: "metric",
                  header: "Metric",
                  cell: itemRow => itemRow.metric,
                },
                {
                  id: "target",
                  header: "Targets as established in AOP",
                  cell: itemRow => displayValue(itemRow.target),
                },
                {
                  id: "result",
                  header: "Year-end Results",
                  cell: itemRow => displayValue(itemRow.result),
                },
              ]}
              items={reportData.overallResults}
              empty={<Box padding="m">No summary information is available.</Box>}
            />
            <StatusIndicator type={overallSectionStatusType}>{overallSectionStatusMessage}</StatusIndicator>
          </SimpleSection>
        );
      case "quarterly-data-uploads":
        return (
          <SimpleSection
            asBoardItem
            actions={actions}
            onDownloadCsv={() => downloadSectionCsv("quarterly-data-uploads")}
            title="Quarterly Data Uploads"
            description="Quarterly submission due dates, receipt dates, and status."
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            headerActions={
              !demoModeEnabled ? (
                <Popover
                  triggerType="click"
                  size="small"
                  position="top"
                  header="Quarterly Data Uploads"
                  content={<Box variant="p">{liveQuarterlyUploadsMeta.filterNote}</Box>}
                >
                  <Link variant="info">How this section works</Link>
                </Popover>
              ) : null
            }
          >
            <Table
              variant="embedded"
              wrapLines
              loading={!demoModeEnabled && liveQuarterlyUploadsLoading}
              loadingText="Loading quarterly submission information"
              columnDefinitions={[
                {
                  id: "period",
                  header: "Period",
                  cell: itemRow => itemRow.period,
                },
                {
                  id: "dueDate",
                  header: "Due Date of Reporting Requirement",
                  cell: itemRow => displayValue(itemRow.dueDate),
                },
                {
                  id: "receivedDate",
                  header: "Received by Data Gateway",
                  cell: itemRow => displayValue(itemRow.receivedDate),
                },
                {
                  id: "status",
                  header: "Status",
                  cell: itemRow => displayValue(itemRow.status),
                },
              ]}
              items={reportData.quarterlyUploads}
              empty={<Box padding="m">No quarterly submission information is available.</Box>}
            />
            <StatusIndicator type={quarterlySectionStatusType}>{quarterlySectionStatusMessage}</StatusIndicator>
          </SimpleSection>
        );
      case "client-results":
        return (
          <MatrixSection
            asBoardItem
            actions={actions}
            onDownloadCsv={() => downloadSectionCsv("client-results")}
            title="Client Results"
            description={matrixSectionDescriptionByMode.clientResults}
            rows={reportData.clientResults}
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            statusType={clientResultsSectionStatusType}
            statusMessage={clientResultsSectionStatusMessage}
          />
        );
      case "data-uploads":
        return (
          <MatrixSection
            asBoardItem
            actions={actions}
            onDownloadCsv={() => downloadSectionCsv("data-uploads")}
            title="ILMP Data Uploads"
            description={matrixSectionDescriptionByMode.dataUploads}
            rows={reportData.dataUploads}
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            statusType={dataUploadsSectionStatusType}
            statusMessage={dataUploadsSectionStatusMessage}
          />
        );
      case "action-plan-statuses":
        return (
          <MatrixSection
            asBoardItem
            actions={actions}
            onDownloadCsv={() => downloadSectionCsv("action-plan-statuses")}
            title="Status of Action Plans"
            description={matrixSectionDescriptionByMode.actionPlanStatuses}
            rows={reportData.actionPlanStatuses}
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            statusType={actionPlanStatusesSectionStatusType}
            statusMessage={actionPlanStatusesSectionStatusMessage}
          />
        );
      case "additional-comments":
        return (
          <SimpleSection
            asBoardItem
            actions={actions}
            title="Additional Comments"
            description="Notes for this reporting year."
            badgeText={demoModeEnabled ? "Sample data" : null}
            badgeColor={demoModeEnabled ? "green" : "blue"}
            headerActions={
              !demoModeEnabled && canEditReportingConfig ? (
                <Button onClick={handleOpenCommentsModal}>
                  Edit comments
                </Button>
              ) : null
            }
          >
            {commentsSaveNotice ? (
              <Alert
                type="success"
                dismissible
                onDismiss={() => setCommentsSaveNotice(null)}
              >
                {commentsSaveNotice}
              </Alert>
            ) : null}
            {!demoModeEnabled ? (
              <Box color="text-body-secondary" fontSize="body-s">
                Comments for FY {activeFiscalYearLabel}
                {additionalCommentsUpdatedAt
                  ? ` . Last updated ${formatReportingConfigUpdatedAt(additionalCommentsUpdatedAt)}`
                  : ""}
              </Box>
            ) : null}
            {additionalCommentsError && !demoModeEnabled ? (
              <Alert type="error">{additionalCommentsError}</Alert>
            ) : null}
            <Box
              color={
                demoModeEnabled || additionalCommentsValue
                  ? "text-body-default"
                  : "text-body-secondary"
              }
              style={{ whiteSpace: "pre-wrap" }}
            >
              {commentsContent}
            </Box>
          </SimpleSection>
        );
      default:
        return null;
    }
  };

  return (
    <SpaceBetween size="l">
      {topAlertConfig ? (
        <Alert
          type={topAlertConfig.type}
          header={topAlertConfig.header}
          dismissible={topAlertConfig.dismissible}
          onDismiss={topAlertConfig.onDismiss}
        >
          {topAlertConfig.body}
        </Alert>
      ) : null}

      <Container
        header={
          <Header
            variant="h2"
            description="Use these controls to focus the report."
            actions={
              <SpaceBetween direction="horizontal" size="m">
                <Toggle
                  checked={demoModeEnabled}
                  onChange={({ detail }) => setDemoModeEnabled(detail.checked)}
                >
                  Demo mode
                </Toggle>
                <Popover
                  triggerType="click"
                  size="small"
                  position="bottom"
                  header="Demo mode"
                  content={DEMO_MODE_POPOVER_CONTENT}
                >
                  <Link variant="info">About demo mode</Link>
                </Popover>
                <Button
                  disabled={!hasActiveReportFilters}
                  onClick={() => {
                    setSelectedProvinceOptions([]);
                    setSelectedCaseManagerOptions([]);
                    setSelectedFiscalYearOption(buildFiscalYearOption(defaultFiscalYearStart));
                  }}
                >
                  Clear filters
                </Button>
              </SpaceBetween>
            }
          >
            Report Controls
          </Header>
        }
      >
        <SpaceBetween size="m">
          <ColumnLayout columns={3} variant="text-grid">
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">ISP Name</Box>
              <Box>Native Women's Association of Canada</Box>
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Portfolio</Box>
              <Box>18769224</Box>
            </SpaceBetween>
            <FormField label="Results view" description={resultsViewDescription}>
              <SegmentedControl
                selectedId={monthlyResultsEnabled ? "monthly" : "cumulative"}
                onChange={({ detail }) =>
                  setMonthlyResultsEnabled(detail.selectedId === "monthly")
                }
                options={RESULTS_VIEW_OPTIONS}
              />
            </FormField>
          </ColumnLayout>

          <ColumnLayout columns={3}>
            <FormField
              label="Participant home province / territory"
              description="Filter the report by one or more participant home provinces or territories."
            >
              <Multiselect
                selectedOptions={selectedProvinceOptions}
                onChange={({ detail }) => setSelectedProvinceOptions(detail.selectedOptions || [])}
                options={PROVINCE_TERRITORY_OPTIONS}
                tokenLimit={5}
                placeholder="All participant home provinces and territories"
              />
            </FormField>

            <FormField
              label="Case manager"
              description="Filter the report by one or more case managers."
              errorText={caseManagerOptionsError || undefined}
            >
              <Multiselect
                selectedOptions={selectedCaseManagerOptions}
                onChange={({ detail }) =>
                  setSelectedCaseManagerOptions(detail.selectedOptions || [])
                }
                options={caseManagerOptions}
                tokenLimit={4}
                disabled={caseManagerOptionsLoading}
                placeholder={
                  caseManagerOptionsLoading
                    ? "Loading case managers"
                    : caseManagerOptions.length
                      ? "All case managers"
                      : "No case managers available"
                }
              />
            </FormField>

            <FormField
              label="Fiscal year"
              description="Choose the fiscal year shown in this report."
            >
              <Select
                selectedOption={selectedFiscalYearOption}
                onChange={({ detail }) => setSelectedFiscalYearOption(detail.selectedOption)}
                options={fiscalYearOptions}
              />
            </FormField>
          </ColumnLayout>

          <SpaceBetween direction="horizontal" size="xs">
            <Box color="text-body-secondary" fontSize="body-s">
              Results view is currently set to {resultsViewLabel.toLowerCase()}.
            </Box>
            <Popover
              triggerType="click"
              size="small"
              position="top"
              header="How filters apply"
              content={REPORT_CONTROLS_POPOVER_CONTENT}
            >
              <Link variant="info">How filters apply</Link>
            </Popover>
          </SpaceBetween>
        </SpaceBetween>
      </Container>

      <Board
        items={boardItems}
        onItemsChange={handleBoardItemsChange}
        renderItem={renderBoardItem}
        i18nStrings={boardI18nStrings}
        empty={<Box padding="m">No report sections are shown. Use Add section to restore them.</Box>}
      />

      <Modal
        visible={targetsModalVisible}
        onDismiss={handleCloseTargetsModal}
        closeAriaLabel="Close edit targets modal"
        header="Edit AOP targets"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCloseTargetsModal} disabled={targetsSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveTargets} loading={targetsSaving}>
                Save targets
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box color="text-body-secondary">
            Enter the annual target values for FY {activeFiscalYearLabel}. These values appear in
            the AOP target column.
          </Box>

          {targetsModalError ? (
            <Alert type="error">{targetsModalError}</Alert>
          ) : null}

          {targetsModalLoading ? (
            <StatusIndicator type="loading">Loading saved target values</StatusIndicator>
          ) : null}

          {REPORTING_TARGET_FIELD_DEFINITIONS.map(field => (
            <FormField
              key={field.key}
              label={field.label}
              description="Whole number target."
              errorText={targetsFormErrors[field.key]}
            >
              <Input
                type="number"
                inputMode="numeric"
                value={targetsFormValues[field.key]}
                onChange={({ detail }) => handleTargetsFieldChange(field.key, detail.value)}
                disabled={targetsModalLoading || targetsSaving}
                placeholder="Leave blank to clear"
              />
            </FormField>
          ))}

          {targetsUpdatedAt ? (
            <Box color="text-body-secondary" fontSize="body-s">
              Last updated: {formatReportingConfigUpdatedAt(targetsUpdatedAt)}
            </Box>
          ) : null}
        </SpaceBetween>
      </Modal>

      <Modal
        visible={commentsModalVisible}
        onDismiss={handleCloseCommentsModal}
        closeAriaLabel="Close edit comments modal"
        header="Edit Additional Comments"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCloseCommentsModal} disabled={commentsSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveComments} loading={commentsSaving}>
                Save comments
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box color="text-body-secondary">
            These comments are saved for FY {activeFiscalYearLabel} and shown in the Additional
            Comments section of the report.
          </Box>

          {commentsModalError ? (
            <Alert type="error">{commentsModalError}</Alert>
          ) : null}

          {commentsModalLoading ? (
            <StatusIndicator type="loading">Loading saved comments</StatusIndicator>
          ) : null}

          <FormField
            label="Additional comments"
            description="Narrative reporting note for management and NWAC review."
          >
            <Textarea
              value={commentsDraft}
              onChange={({ detail }) => setCommentsDraft(detail.value)}
              rows={10}
              disabled={commentsModalLoading || commentsSaving}
              placeholder="Enter fiscal-year reporting comments"
            />
          </FormField>

          {additionalCommentsUpdatedAt ? (
            <Box color="text-body-secondary" fontSize="body-s">
              Last updated: {formatReportingConfigUpdatedAt(additionalCommentsUpdatedAt)}
            </Box>
          ) : null}
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};

export default DataAndResultsDashboard;
