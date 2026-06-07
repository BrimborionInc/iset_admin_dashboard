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
  Popover,
  SegmentedControl,
  Select,
  SpaceBetween,
  StatusIndicator,
  Textarea,
  Toggle,
} from "@cloudscape-design/components";
import { apiFetch } from "../../auth/apiClient";
import useCurrentUser from "../../hooks/useCurrentUser";
import { triggerExcelDownload } from "./regionalSnapshotExport";
import useReportingDemoMode from "./useReportingDemoMode";

const PERIOD_TYPE_OPTIONS = [
  { id: "month", text: "Monthly" },
  { id: "quarter", text: "Quarterly" },
  { id: "year", text: "Annual" },
];

const SNAPSHOT_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Final", value: "final" },
];

const ROLE_ALIASES = {
  System_Administrator: "System Administrator",
  NWAC_Administrator: "NWAC Administrator",
  Regional_Manager: "Regional Manager",
  ISET_Coordinator: "ISET Coordinator",
};

const EDITOR_ROLES = new Set(["System Administrator", "NWAC Administrator"]);

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

const buildFiscalYearOptions = (currentStartYear, count = 5) =>
  Array.from({ length: count }, (_, index) => buildFiscalYearOption(currentStartYear - index));

const buildPeriodOptions = (periodType, fiscalYearStart) => {
  const nextYear = fiscalYearStart + 1;
  if (periodType === "month") {
    return [
      { label: "April", value: "apr" },
      { label: "May", value: "may" },
      { label: "June", value: "jun" },
      { label: "July", value: "jul" },
      { label: "August", value: "aug" },
      { label: "September", value: "sep" },
      { label: "October", value: "oct" },
      { label: "November", value: "nov" },
      { label: "December", value: "dec" },
      { label: "January", value: "jan" },
      { label: "February", value: "feb" },
      { label: "March", value: "mar" },
    ];
  }
  if (periodType === "quarter") {
    return [
      { label: `Q1 (${buildIsoDate(fiscalYearStart, 4, 1)} to ${buildIsoDate(fiscalYearStart, 6, 30)})`, value: "q1" },
      { label: `Q2 (${buildIsoDate(fiscalYearStart, 7, 1)} to ${buildIsoDate(fiscalYearStart, 9, 30)})`, value: "q2" },
      { label: `Q3 (${buildIsoDate(fiscalYearStart, 10, 1)} to ${buildIsoDate(fiscalYearStart, 12, 31)})`, value: "q3" },
      { label: `Q4 (${buildIsoDate(nextYear, 1, 1)} to ${buildIsoDate(nextYear, 3, 31)})`, value: "q4" },
    ];
  }
  return [{ label: `FY ${formatFiscalYearLabel(fiscalYearStart)}`, value: "annual" }];
};

const toCanonicalRole = role => {
  const trimmed = String(role || "").trim();
  return ROLE_ALIASES[trimmed] || trimmed;
};

const formatInteger = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-CA");
};

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPercent = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(2)}%`;
};

const amountInputValue = value =>
  value === null || typeof value === "undefined" || value === "" ? "" : String(value);

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

const DEMO_MONTH_KEYS = [
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
  "jan",
  "feb",
  "mar",
];

const DEMO_MONTH_LABELS = {
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December",
  jan: "January",
  feb: "February",
  mar: "March",
};

const DEMO_MONTHLY_SHARE_WEIGHTS = [5, 6, 7, 8, 8, 9, 9, 9, 10, 10, 9, 10];
const DEMO_CRF_FUNDING_PER_FUNDED = 11509.693;
const DEMO_EI_FUNDING_PER_FUNDED = 5272.182;

const DEMO_MODE_POPOVER_CONTENT = (
  <Box variant="p">
    Demo mode shows sample figures so you can review the Regional Snapshot layout and controls
    without relying on current live records.
  </Box>
);

const slugifyFilenamePart = value => {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "snapshot";
};

const REPORT_SHEET_MAX_WIDTH = 920;

const reportStyles = {
  sheet: {
    maxWidth: `${REPORT_SHEET_MAX_WIDTH}px`,
    margin: "0 auto",
    border: "1px solid #d5d9e0",
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  titleWrap: {
    padding: "18px 22px 8px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
  },
  subtitle: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#5f6b7a",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  },
  block: {
    borderTop: "1px solid #d5d9e0",
  },
  leftBlock: {
    borderRight: "1px solid #d5d9e0",
  },
  fullWidth: {
    gridColumn: "1 / -1",
  },
  sectionBar: {
    background: "#eceff3",
    borderBottom: "1px solid #d5d9e0",
    padding: "4px 10px",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  labelCell: {
    width: "62%",
    padding: "6px 10px",
    borderBottom: "1px solid #e7eaf0",
    fontSize: "13px",
    verticalAlign: "top",
  },
  valueCell: {
    width: "38%",
    padding: "6px 10px",
    borderBottom: "1px solid #e7eaf0",
    borderLeft: "1px solid #e7eaf0",
    fontSize: "13px",
    verticalAlign: "top",
  },
  commentsBody: {
    minHeight: "96px",
    padding: "10px 12px 14px",
    fontSize: "13px",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  },
  footer: {
    borderTop: "1px solid #d5d9e0",
    padding: "8px 12px 10px",
    fontSize: "12px",
    color: "#5f6b7a",
  },
};

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
    return safeWeights.map(() => 0);
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

const allocateCurrencyByWeights = (totalAmount, weights) =>
  allocateByWeights(Math.round((Number(totalAmount) || 0) * 100), weights).map(value => value / 100);

const buildMonthStartAndEnd = (fiscalYearStart, monthKey) => {
  const nextYear = fiscalYearStart + 1;
  const mapping = {
    apr: [fiscalYearStart, 4, 1, fiscalYearStart, 4, 30],
    may: [fiscalYearStart, 5, 1, fiscalYearStart, 5, 31],
    jun: [fiscalYearStart, 6, 1, fiscalYearStart, 6, 30],
    jul: [fiscalYearStart, 7, 1, fiscalYearStart, 7, 31],
    aug: [fiscalYearStart, 8, 1, fiscalYearStart, 8, 31],
    sep: [fiscalYearStart, 9, 1, fiscalYearStart, 9, 30],
    oct: [fiscalYearStart, 10, 1, fiscalYearStart, 10, 31],
    nov: [fiscalYearStart, 11, 1, fiscalYearStart, 11, 30],
    dec: [fiscalYearStart, 12, 1, fiscalYearStart, 12, 31],
    jan: [nextYear, 1, 1, nextYear, 1, 31],
    feb: [nextYear, 2, 1, nextYear, 2, 28],
    mar: [nextYear, 3, 1, nextYear, 3, 31],
  };
  const [startYear, startMonth, startDay, endYear, endMonth, endDay] = mapping[monthKey] || mapping.apr;
  return {
    start: buildIsoDate(startYear, startMonth, startDay),
    end: buildIsoDate(endYear, endMonth, endDay),
  };
};

const buildDemoPeriodDefinition = ({ periodType, fiscalYearStart, periodKey }) => {
  const fiscalYear = formatFiscalYearLabel(fiscalYearStart);
  const nextYear = fiscalYearStart + 1;

  if (periodType === "month") {
    const { start, end } = buildMonthStartAndEnd(fiscalYearStart, periodKey);
    return {
      label: DEMO_MONTH_LABELS[periodKey] || "April",
      start,
      end,
      fiscalYear,
    };
  }

  if (periodType === "quarter") {
    const quarterDefinitions = {
      q1: {
        label: "Q1",
        start: buildIsoDate(fiscalYearStart, 4, 1),
        end: buildIsoDate(fiscalYearStart, 6, 30),
        monthKeys: ["apr", "may", "jun"],
      },
      q2: {
        label: "Q2",
        start: buildIsoDate(fiscalYearStart, 7, 1),
        end: buildIsoDate(fiscalYearStart, 9, 30),
        monthKeys: ["jul", "aug", "sep"],
      },
      q3: {
        label: "Q3",
        start: buildIsoDate(fiscalYearStart, 10, 1),
        end: buildIsoDate(fiscalYearStart, 12, 31),
        monthKeys: ["oct", "nov", "dec"],
      },
      q4: {
        label: "Q4",
        start: buildIsoDate(nextYear, 1, 1),
        end: buildIsoDate(nextYear, 3, 31),
        monthKeys: ["jan", "feb", "mar"],
      },
    };
    return { ...quarterDefinitions[periodKey], fiscalYear };
  }

  return {
    label: `FY ${fiscalYear}`,
    start: buildIsoDate(fiscalYearStart, 4, 1),
    end: buildIsoDate(nextYear, 3, 31),
    fiscalYear,
    monthKeys: DEMO_MONTH_KEYS,
  };
};

const buildDemoRegionalSnapshotReport = ({
  selectedRegion,
  fiscalYearStart,
  periodType,
  periodKey,
  fallbackSnapshot,
}) => {
  const region = selectedRegion?.data || {};
  const provinceCode = String(region.code || "").toUpperCase();
  const regionWeight = DEMO_PROVINCE_WEIGHTS[provinceCode] || 0.5;
  const annualApplications = Math.max(8, Math.round(regionWeight * 36));
  const annualFunded = Math.max(4, Math.round(annualApplications * 0.66));
  const annualOtherOutcomes = Math.max(
    1,
    annualApplications - annualFunded - Math.max(1, Math.round(annualApplications * 0.08))
  );
  const applicationsByMonth = allocateByWeights(annualApplications, DEMO_MONTHLY_SHARE_WEIGHTS);
  const fundedByMonth = allocateByWeights(annualFunded, DEMO_MONTHLY_SHARE_WEIGHTS);
  const otherOutcomesByMonth = allocateByWeights(annualOtherOutcomes, DEMO_MONTHLY_SHARE_WEIGHTS);
  const period = buildDemoPeriodDefinition({ periodType, fiscalYearStart, periodKey });
  const monthKeys = period.monthKeys || DEMO_MONTH_KEYS;
  const activeIndexes = monthKeys.map(key => DEMO_MONTH_KEYS.indexOf(key)).filter(index => index >= 0);
  const sumForActiveIndexes = values =>
    activeIndexes.reduce((total, index) => total + Number(values[index] || 0), 0);

  const applicationsReceived = sumForActiveIndexes(applicationsByMonth);
  const funded = sumForActiveIndexes(fundedByMonth);
  const deniedIneligibleWithdrawn = sumForActiveIndexes(otherOutcomesByMonth);
  const pendingDecision = Math.max(0, applicationsReceived - funded - deniedIneligibleWithdrawn);

  const annualCrfFundingAmount = Number(
    Math.round(annualFunded * DEMO_CRF_FUNDING_PER_FUNDED * 100) / 100
  );
  const annualEiFundingAmount = Number(
    Math.round(annualFunded * DEMO_EI_FUNDING_PER_FUNDED * 100) / 100
  );
  const annualCoordinatorSalaryAmount =
    fallbackSnapshot?.coordinatorSalaryAmount === null || typeof fallbackSnapshot?.coordinatorSalaryAmount === "undefined"
      ? null
      : Number(fallbackSnapshot.coordinatorSalaryAmount);
  const annualOperatingCostsAmount =
    fallbackSnapshot?.operatingCostsAmount === null || typeof fallbackSnapshot?.operatingCostsAmount === "undefined"
      ? null
      : Number(fallbackSnapshot.operatingCostsAmount);
  const fundingWeights = fundedByMonth.map(value => Math.max(1, Number(value || 0)));
  const evenMonthlyWeights = Array.from({ length: DEMO_MONTH_KEYS.length }, () => 1);
  const crfFundingByMonth = allocateCurrencyByWeights(annualCrfFundingAmount, fundingWeights);
  const eiFundingByMonth = allocateCurrencyByWeights(annualEiFundingAmount, fundingWeights);
  const coordinatorSalaryByMonth =
    annualCoordinatorSalaryAmount === null
      ? []
      : allocateCurrencyByWeights(annualCoordinatorSalaryAmount, evenMonthlyWeights);
  const operatingCostsByMonth =
    annualOperatingCostsAmount === null
      ? []
      : allocateCurrencyByWeights(annualOperatingCostsAmount, evenMonthlyWeights);
  const crfFundingAmount = Number(
    sumForActiveIndexes(crfFundingByMonth).toFixed(2)
  );
  const eiFundingAmount = Number(
    sumForActiveIndexes(eiFundingByMonth).toFixed(2)
  );
  const coordinatorSalaryAmount =
    annualCoordinatorSalaryAmount === null
      ? null
      : Number(sumForActiveIndexes(coordinatorSalaryByMonth).toFixed(2));
  const operatingCostsAmount =
    annualOperatingCostsAmount === null
      ? null
      : Number(sumForActiveIndexes(operatingCostsByMonth).toFixed(2));
  const totalFunding = crfFundingAmount + eiFundingAmount;
  const totalAdminCost = coordinatorSalaryAmount + operatingCostsAmount;
  const clientAverageAmountFunded = funded ? totalFunding / funded : 0;
  const adminCostPerClient = funded ? totalAdminCost / funded : 0;
  const adminRatioPercent = totalFunding ? (totalAdminCost / totalFunding) * 100 : 0;

  return {
    region: {
      regionId: Number(selectedRegion?.value || region.regionId || 0),
      name: region.name || selectedRegion?.label || "Region",
      code: provinceCode || "—",
    },
    period: {
      label: period.label,
      start: period.start,
      end: period.end,
      fiscalYear: period.fiscalYear,
    },
    liveMetrics: {
      applicationsReceived,
      fundedApplications: funded,
      funded,
      fundedClients: funded,
      deniedIneligibleWithdrawn,
      pendingDecision,
    },
    fundingMetrics: {
      fundedClientCount: funded,
      fundedInterventionCount: funded,
      crfFundingAmount,
      eiFundingAmount,
    },
    snapshot: {
      snapshotStatus: "draft",
      regionalManagerName:
        fallbackSnapshot?.regionalManagerName || `${region.name || "Regional"} Manager`,
      regionalCoordinatorName:
        fallbackSnapshot?.regionalCoordinatorName || `${region.code || "Region"} Coordinator`,
      coordinatorSalaryAmount,
      operatingCostsAmount,
      complianceFlag: fallbackSnapshot?.complianceFlag || "Review Required",
      commentsRecommendations:
        fallbackSnapshot?.commentsRecommendations ||
        `${region.name || "This region"} sample snapshot demonstrates the regional summary layout with illustrative counts, funding, and comments.`,
      updatedAt: null,
      updatedByName: null,
    },
    derivedMetrics: {
      totalFunding,
      totalAdminCost,
      clientAverageAmountFunded,
      adminCostPerClient,
      adminRatioPercent,
    },
  };
};

const ReportSection = ({ title, rows, left = false, fullWidth = false }) => (
  <div
    style={{
      ...reportStyles.block,
      ...(left ? reportStyles.leftBlock : null),
      ...(fullWidth ? reportStyles.fullWidth : null),
    }}
  >
    <div style={reportStyles.sectionBar}>{title}</div>
    <table style={reportStyles.table}>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <td
              style={{
                ...reportStyles.labelCell,
                fontWeight: row.emphasis ? 700 : 400,
              }}
            >
              {row.label}
            </td>
            <td
              style={{
                ...reportStyles.valueCell,
                fontWeight: row.emphasis ? 700 : 400,
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RegionalSnapshotDashboard = () => {
  const { role } = useCurrentUser();
  const canEdit = EDITOR_ROLES.has(toCanonicalRole(role));
  const [demoModeEnabled, setDemoModeEnabled] = useReportingDemoMode();
  const currentFiscalYearStart = useMemo(() => getReportingFiscalYearStart(), []);
  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(currentFiscalYearStart),
    [currentFiscalYearStart]
  );

  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(fiscalYearOptions[0] || null);
  const [periodType, setPeriodType] = useState("year");
  const [selectedPeriod, setSelectedPeriod] = useState({ label: `FY ${formatFiscalYearLabel(currentFiscalYearStart)}`, value: "annual" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadCurrentLoading, setDownloadCurrentLoading] = useState(false);
  const [downloadAllLoading, setDownloadAllLoading] = useState(false);
  const [formState, setFormState] = useState({
    snapshotStatus: "draft",
    regionalManagerName: "",
    regionalCoordinatorName: "",
    operatingCostsAmount: "",
    complianceFlag: "",
    commentsRecommendations: "",
  });
  const latestLiveSnapshotRef = useRef(null);

  const periodOptions = useMemo(
    () => buildPeriodOptions(periodType, Number(selectedFiscalYear?.value || currentFiscalYearStart)),
    [currentFiscalYearStart, periodType, selectedFiscalYear]
  );

  const fetchLiveRegionalSnapshotPayload = useCallback(async regionOption => {
    const params = new URLSearchParams({
      regionId: regionOption.value,
      fiscalYearStart: selectedFiscalYear.value,
      periodType,
      periodKey: selectedPeriod.value,
    });
    const response = await apiFetch(`/api/reporting/regional-snapshot?${params.toString()}`);
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }
      throw new Error(payload?.message || `Failed to load ${regionOption.label}.`);
    }
    return response.json();
  }, [periodType, selectedFiscalYear, selectedPeriod]);

  useEffect(() => {
    setSelectedPeriod(current =>
      periodOptions.find(option => option.value === current?.value) || periodOptions[0] || null
    );
  }, [periodOptions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRegionsLoading(true);
      try {
        const response = await apiFetch("/api/reporting/regional-snapshot/filter-options");
        if (!response.ok) {
          throw new Error("Failed to load regional snapshot options.");
        }
        const payload = await response.json();
        if (cancelled) return;
        const regionOptions = (Array.isArray(payload?.regions) ? payload.regions : []).map(region => ({
          label: `${region.name} (${region.code})`,
          value: String(region.regionId),
          data: region,
        }));
        setRegions(regionOptions);
        setSelectedRegion(current =>
          current && regionOptions.some(option => option.value === current.value)
            ? current
            : regionOptions.find(option => option?.data?.code !== "XX") || regionOptions[0] || null
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error?.message || "Failed to load regional snapshot options.");
        }
      } finally {
        if (!cancelled) {
          setRegionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRegion || !selectedFiscalYear || !selectedPeriod) {
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const payload = await fetchLiveRegionalSnapshotPayload(selectedRegion);
        if (!cancelled) {
          latestLiveSnapshotRef.current = payload?.snapshot || null;
          setReport(
            demoModeEnabled
              ? buildDemoRegionalSnapshotReport({
                  selectedRegion,
                  fiscalYearStart: Number(selectedFiscalYear.value),
                  periodType,
                  periodKey: selectedPeriod.value,
                  fallbackSnapshot: payload?.snapshot || null,
                })
              : payload
          );
        }
      } catch (error) {
        if (!cancelled) {
          if (demoModeEnabled) {
            setReport(
              buildDemoRegionalSnapshotReport({
                selectedRegion,
                fiscalYearStart: Number(selectedFiscalYear.value),
                periodType,
                periodKey: selectedPeriod.value,
                fallbackSnapshot: latestLiveSnapshotRef.current,
              })
            );
          } else {
            setErrorMessage(error?.message || "Failed to load the regional snapshot.");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoModeEnabled, fetchLiveRegionalSnapshotPayload, periodType, selectedFiscalYear, selectedPeriod, selectedRegion]);

  const openEditModal = () => {
    const snapshot = report?.snapshot || {};
    setFormState({
      snapshotStatus: snapshot.snapshotStatus || "draft",
      regionalManagerName: snapshot.regionalManagerName || "",
      regionalCoordinatorName: snapshot.regionalCoordinatorName || "",
      operatingCostsAmount: amountInputValue(snapshot.operatingCostsAmount),
      complianceFlag: snapshot.complianceFlag || "",
      commentsRecommendations: snapshot.commentsRecommendations || "",
    });
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!selectedRegion || !selectedFiscalYear || !selectedPeriod) return;
    setSaving(true);
    setErrorMessage("");
    setSaveMessage("");
    try {
      const response = await apiFetch("/api/reporting/regional-snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: Number(selectedRegion.value),
          fiscalYearStart: Number(selectedFiscalYear.value),
          periodType,
          periodKey: selectedPeriod.value,
          ...formState,
        }),
      });
      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_) {
          payload = null;
        }
        throw new Error(payload?.message || "Failed to save the regional snapshot.");
      }
      const payload = await response.json();
      latestLiveSnapshotRef.current = payload?.snapshot || null;
      setReport(payload);
      setEditVisible(false);
      setSaveMessage("Regional snapshot details saved.");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to save the regional snapshot.");
    } finally {
      setSaving(false);
    }
  };

  const fetchRegionalSnapshotPayload = async regionOption => {
    if (demoModeEnabled) {
      let livePayload = null;
      try {
        livePayload = await fetchLiveRegionalSnapshotPayload(regionOption);
      } catch (_) {
        livePayload = null;
      }
      return buildDemoRegionalSnapshotReport({
        selectedRegion: regionOption,
        fiscalYearStart: Number(selectedFiscalYear?.value),
        periodType,
        periodKey: selectedPeriod?.value,
        fallbackSnapshot: livePayload?.snapshot || null,
      });
    }
    return fetchLiveRegionalSnapshotPayload(regionOption);
  };

  const exportSubtitle = report?.period
    ? `Reporting Period: ${report.period.start} - ${report.period.end}`
    : selectedPeriod?.label || "";

  const handleDownloadCurrent = async () => {
    if (!report || downloadCurrentLoading) {
      return;
    }
    setDownloadCurrentLoading(true);
    setErrorMessage("");
    try {
      await triggerExcelDownload({
        reports: [report],
        filename: [
          "regional-snapshot",
          slugifyFilenamePart(report?.region?.name),
          slugifyFilenamePart(selectedFiscalYear?.label),
          slugifyFilenamePart(selectedPeriod?.label),
          demoModeEnabled ? "sample-data" : null,
        ]
          .filter(Boolean)
          .join("-")
          .concat(".xlsx"),
        subtitle: exportSubtitle,
      });
    } catch (error) {
      setErrorMessage(error?.message || "Regional snapshot download failed.");
    } finally {
      setDownloadCurrentLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (downloadAllLoading || !selectedFiscalYear || !selectedPeriod) {
      return;
    }
    setDownloadAllLoading(true);
    setErrorMessage("");
    try {
      const exportRegions = (regions || []).filter(option => option?.data?.code !== "XX");
      const reports = await Promise.all(
        exportRegions.map(regionOption => fetchRegionalSnapshotPayload(regionOption))
      );
      await triggerExcelDownload({
        reports,
        includeSummary: true,
        filename: [
          "regional-snapshot-all-regions",
          slugifyFilenamePart(selectedFiscalYear?.label),
          slugifyFilenamePart(selectedPeriod?.label),
          demoModeEnabled ? "sample-data" : null,
        ]
          .filter(Boolean)
          .join("-")
          .concat(".xlsx"),
        subtitle: exportSubtitle,
      });
    } catch (error) {
      setErrorMessage(error?.message || "Regional snapshot workbook download failed.");
    } finally {
      setDownloadAllLoading(false);
    }
  };

  const reportHeaderActions = (
    <SpaceBetween direction="horizontal" size="xs">
      <ButtonDropdown
        variant="normal"
        disabled={!report || loading || regionsLoading || downloadCurrentLoading || downloadAllLoading}
        items={[
          { id: "download-current", text: "Download Excel" },
          { id: "download-all", text: "Download all Excel" },
        ]}
        onItemClick={({ detail }) => {
          if (detail.id === "download-current") {
            handleDownloadCurrent();
          } else if (detail.id === "download-all") {
            handleDownloadAll();
          }
        }}
      >
        {downloadCurrentLoading || downloadAllLoading ? "Downloading..." : "Download"}
      </ButtonDropdown>
      {canEdit && !demoModeEnabled ? (
        <Button onClick={openEditModal}>Edit snapshot details</Button>
      ) : null}
    </SpaceBetween>
  );

  const regionRows = report
    ? [
        { label: "Region", value: report.region?.name || "—" },
        { label: "Province / Territory", value: report.region?.code || "—" },
        { label: "Regional Manager", value: report.snapshot?.regionalManagerName || "—" },
        { label: "ISET Coordinator", value: report.snapshot?.regionalCoordinatorName || "—" },
      ]
    : [];

  const clientRows = report
    ? [
        { label: "Applications Received", value: formatInteger(report.liveMetrics?.applicationsReceived) },
        { label: "Approved / Funded Applications", value: formatInteger(report.liveMetrics?.fundedApplications ?? report.liveMetrics?.funded) },
        { label: "Denied / Ineligible / Withdrawn / NC", value: formatInteger(report.liveMetrics?.deniedIneligibleWithdrawn) },
        { label: "Pending / No Decision", value: formatInteger(report.liveMetrics?.pendingDecision) },
      ]
    : [];

  const fundingRows = report
    ? [
        { label: "Funded Clients", value: formatInteger(report.fundingMetrics?.fundedClientCount ?? report.liveMetrics?.fundedClients) },
        { label: "CRF Funding ($)", value: formatCurrency(report.fundingMetrics?.crfFundingAmount) },
        { label: "EI Funding ($)", value: formatCurrency(report.fundingMetrics?.eiFundingAmount) },
        { label: "Total Funding ($)", value: formatCurrency(report.derivedMetrics?.totalFunding), emphasis: true },
      ]
    : [];

  const adminRows = report
    ? [
        { label: "Coordinator Salary ($)", value: formatCurrency(report.snapshot?.coordinatorSalaryAmount) },
        { label: "Operating Costs ($)", value: formatCurrency(report.snapshot?.operatingCostsAmount) },
        { label: "Total Admin Cost ($)", value: formatCurrency(report.derivedMetrics?.totalAdminCost), emphasis: true },
      ]
    : [];

  const keyMetricRows = report
    ? [
        { label: "Client Average Amount Funded", value: formatCurrency(report.derivedMetrics?.clientAverageAmountFunded) },
        { label: "Admin Cost per Client", value: formatCurrency(report.derivedMetrics?.adminCostPerClient) },
        { label: "Admin Ratio", value: formatPercent(report.derivedMetrics?.adminRatioPercent) },
      ]
    : [];

  const snapshotTitle = report?.region?.name
    ? `${report.region.name} ISET - Regional Snapshot Report`
    : "ISET - Regional Snapshot Report";

  const snapshotSubtitle = report?.period
    ? `Reporting Period: ${report.period.start} - ${report.period.end}`
    : "Select a region and reporting period.";

  return (
    <SpaceBetween size="l">
      {errorMessage ? (
        <Alert type="error" dismissible onDismiss={() => setErrorMessage("")}>
          {errorMessage}
        </Alert>
      ) : null}
      {saveMessage ? (
        <Alert type="success" dismissible onDismiss={() => setSaveMessage("")}>
          {saveMessage}
        </Alert>
      ) : null}

      <Container
        header={
          <Header
            variant="h2"
            description="Choose a region and reporting window for this snapshot."
            actions={
              <SpaceBetween direction="horizontal" size="m">
                <Toggle
                  checked={demoModeEnabled}
                  onChange={({ detail }) => setDemoModeEnabled(detail.checked)}
                >
                  Demo data
                </Toggle>
                <Popover
                  triggerType="click"
                  size="small"
                  position="bottom"
                  header="Demo data"
                  content={DEMO_MODE_POPOVER_CONTENT}
                >
                  <Link variant="info">About demo data</Link>
                </Popover>
              </SpaceBetween>
            }
          >
            Snapshot Controls
          </Header>
        }
      >
        <SpaceBetween size="m">
          <ColumnLayout columns={4} variant="text-grid">
            <FormField label="Region">
              <Select
                selectedOption={selectedRegion}
                onChange={({ detail }) => setSelectedRegion(detail.selectedOption)}
                options={regions}
                loadingText="Loading regions"
                statusType={regionsLoading ? "loading" : "finished"}
                placeholder="Select a region"
              />
            </FormField>
            <FormField label="Period type">
              <SegmentedControl
                selectedId={periodType}
                onChange={({ detail }) => setPeriodType(detail.selectedId)}
                options={PERIOD_TYPE_OPTIONS}
              />
            </FormField>
            <FormField label="Fiscal year">
              <Select
                selectedOption={selectedFiscalYear}
                onChange={({ detail }) => setSelectedFiscalYear(detail.selectedOption)}
                options={fiscalYearOptions}
              />
            </FormField>
            <FormField label="Period">
              <Select
                selectedOption={selectedPeriod}
                onChange={({ detail }) => setSelectedPeriod(detail.selectedOption)}
                options={periodOptions}
              />
            </FormField>
          </ColumnLayout>
          {report?.period ? (
            <Box color="text-body-secondary" fontSize="body-s">
              Reporting period: {report.period.start} to {report.period.end}
            </Box>
          ) : null}
        </SpaceBetween>
      </Container>

      <Container
        header={
          <Header
            variant="h2"
            description="Board-style summary for the selected region and reporting period."
            actions={
              reportHeaderActions || demoModeEnabled ? (
                <SpaceBetween direction="horizontal" size="xs">
                  {reportHeaderActions}
                  {demoModeEnabled ? <Badge color="green">Sample data</Badge> : null}
                </SpaceBetween>
              ) : null
            }
          >
            Regional Snapshot
          </Header>
        }
      >
        {loading && !report ? (
          <StatusIndicator type="loading">Loading snapshot</StatusIndicator>
        ) : (
          <SpaceBetween size="l">
            <div style={reportStyles.sheet}>
              <div style={reportStyles.titleWrap}>
                <div style={reportStyles.title}>{snapshotTitle}</div>
                <div style={reportStyles.subtitle}>{snapshotSubtitle}</div>
              </div>

              <div style={reportStyles.grid}>
                <ReportSection left title="A. Region Information" rows={regionRows} />
                <ReportSection title="B. Client Activity" rows={clientRows} />
                <ReportSection left title="C. Funding" rows={fundingRows} />
                <ReportSection title="D. Admin & Operating" rows={adminRows} />
                <ReportSection left title="E. Key Metrics" rows={keyMetricRows} />
                <ReportSection
                  title="F. Compliance Flag"
                  rows={[
                    {
                      label: "Status",
                      value: report?.snapshot?.complianceFlag || "Review required",
                    },
                  ]}
                />
                <div
                  style={{
                    ...reportStyles.block,
                    ...reportStyles.fullWidth,
                  }}
                >
                  <div style={reportStyles.sectionBar}>G. Comments / Recommendations</div>
                  <div style={reportStyles.commentsBody}>
                    {report?.snapshot?.commentsRecommendations || (
                      <span style={{ color: "#5f6b7a" }}>
                        No comments have been saved for this snapshot yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {report?.snapshot?.updatedAt ? (
                <div style={reportStyles.footer}>
                  Last updated {report.snapshot.updatedAt}
                  {report.snapshot.updatedByName ? ` by ${report.snapshot.updatedByName}` : ""}.
                </div>
              ) : null}
            </div>
          </SpaceBetween>
        )}
      </Container>

      <Modal
        visible={editVisible}
        onDismiss={() => setEditVisible(false)}
        closeAriaLabel="Close regional snapshot editor"
        header="Edit regional snapshot details"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setEditVisible(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Box color="text-body-secondary" fontSize="body-s">
            Live application activity, funded client totals, approved funding, and salary values are calculated by PATH. Operating costs, compliance, and comments are saved with this snapshot.
          </Box>
          <ColumnLayout columns={2} variant="text-grid">
            <FormField label="Snapshot status">
              <Select
                selectedOption={SNAPSHOT_STATUS_OPTIONS.find(option => option.value === formState.snapshotStatus) || null}
                onChange={({ detail }) =>
                  setFormState(current => ({
                    ...current,
                    snapshotStatus: detail.selectedOption?.value || "draft",
                  }))
                }
                options={SNAPSHOT_STATUS_OPTIONS}
              />
            </FormField>
            <div />
            <FormField label="Regional Manager">
              <Input
                value={formState.regionalManagerName}
                onChange={({ detail }) =>
                  setFormState(current => ({ ...current, regionalManagerName: detail.value }))
                }
              />
            </FormField>
            <FormField label="Regional Manager">
              <Input
                value={formState.regionalCoordinatorName}
                onChange={({ detail }) =>
                  setFormState(current => ({ ...current, regionalCoordinatorName: detail.value }))
                }
              />
            </FormField>
            <FormField label="Coordinator Salary ($)">
              <Input value={formatCurrency(report?.snapshot?.coordinatorSalaryAmount)} readOnly />
            </FormField>
            <FormField label="Operating Costs ($)">
              <Input
                inputMode="decimal"
                value={formState.operatingCostsAmount}
                onChange={({ detail }) =>
                  setFormState(current => ({ ...current, operatingCostsAmount: detail.value }))
                }
              />
            </FormField>
          </ColumnLayout>
          <FormField label="Compliance Flag">
            <Input
              value={formState.complianceFlag}
              onChange={({ detail }) =>
                setFormState(current => ({ ...current, complianceFlag: detail.value }))
              }
            />
          </FormField>
          <FormField label="Comments / Recommendations">
            <Textarea
              rows={6}
              value={formState.commentsRecommendations}
              onChange={({ detail }) =>
                setFormState(current => ({ ...current, commentsRecommendations: detail.value }))
              }
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};

export default RegionalSnapshotDashboard;
