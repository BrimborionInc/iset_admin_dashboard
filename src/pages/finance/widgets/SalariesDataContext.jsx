import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../auth/apiClient";

const SalariesDataContext = createContext(undefined);

const resolveInitialFiscalYearStart = () => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

const parseSalaryAmountInput = value => {
  const trimmed = String(value ?? "")
    .replace(/[$,\s]/g, "")
    .trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return Number.NaN;
  }
  return Math.round(numeric * 100) / 100;
};

const formatSavedSalaryAmount = value => {
  if (value === null || typeof value === "undefined" || value === "") {
    return "";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "";
};

const normalizePotOptions = options =>
  Array.isArray(options)
    ? options.map(option => ({
        value: String(option.value),
        label: option.label || option.code || `Pot ${option.value}`,
        description: option.code || undefined,
      }))
    : [];

const normalizeRow = row => {
  const annualSalaryAmount =
    row?.annualSalaryAmount === null || typeof row?.annualSalaryAmount === "undefined"
      ? null
      : Number(row.annualSalaryAmount);
  const derivedMonthlyAmount =
    row?.derivedMonthlyAmount === null || typeof row?.derivedMonthlyAmount === "undefined"
      ? null
      : Number(row.derivedMonthlyAmount);
  return {
    regionCode: row?.regionCode || "",
    regionName: row?.regionName || "",
    entryId: row?.entryId || null,
    budgetPotId: row?.budgetPotId ? String(row.budgetPotId) : null,
    annualSalaryAmount: Number.isFinite(annualSalaryAmount) ? annualSalaryAmount : null,
    annualSalaryAmountInput: formatSavedSalaryAmount(annualSalaryAmount),
    derivedMonthlyAmount: Number.isFinite(derivedMonthlyAmount) ? derivedMonthlyAmount : null,
    updatedAt: row?.updatedAt || null,
    updatedByName: row?.updatedByName || null,
    potOptions: normalizePotOptions(row?.potOptions),
  };
};

const buildComparableRowState = row => {
  const parsedAmount = parseSalaryAmountInput(row?.annualSalaryAmountInput);
  const rawAmount = String(row?.annualSalaryAmountInput ?? "").trim();
  return JSON.stringify({
    budgetPotId: row?.budgetPotId || null,
    annualSalaryAmount:
      rawAmount === ""
        ? null
        : Number.isNaN(parsedAmount)
          ? `invalid:${rawAmount}`
          : parsedAmount,
  });
};

const buildPreviewSummary = (rows, savedRows) => {
  const savedByRegion = new Map((savedRows || []).map(row => [row.regionCode, row]));
  let annualTotal = 0;
  let enteredRegionCount = 0;
  let assignedPotCount = 0;

  (rows || []).forEach(row => {
    const savedRow = savedByRegion.get(row.regionCode) || row;
    const parsedAmount = parseSalaryAmountInput(row.annualSalaryAmountInput);
    const effectiveAmount =
      Number.isNaN(parsedAmount)
        ? savedRow?.annualSalaryAmount ?? null
        : parsedAmount;

    annualTotal += Number(effectiveAmount || 0);
    if (effectiveAmount !== null) {
      enteredRegionCount += 1;
    }
    if (row.budgetPotId) {
      assignedPotCount += 1;
    }
  });

  return {
    annualTotal: Math.round(annualTotal * 100) / 100,
    derivedMonthlyTotal: Math.round((annualTotal / 12) * 100) / 100,
    enteredRegionCount,
    missingRegionCount: Math.max(0, (rows || []).length - enteredRegionCount),
    assignedPotCount,
    regionCount: (rows || []).length,
  };
};

export const SalariesDataProvider = ({ children }) => {
  const [selectedFiscalYearStart, setSelectedFiscalYearStartState] = useState(() =>
    resolveInitialFiscalYearStart()
  );
  const [fiscalYear, setFiscalYear] = useState(`FY ${resolveInitialFiscalYearStart()}`);
  const [fiscalYearOptions, setFiscalYearOptions] = useState([]);
  const [rows, setRows] = useState([]);
  const [savedRows, setSavedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const loadData = useCallback(async fiscalYearStart => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearStart: String(fiscalYearStart),
      });
      const response = await apiFetch(`/api/finance/salaries?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || `Salary load failed (${response.status})`);
      }

      const normalizedRows = Array.isArray(payload?.rows) ? payload.rows.map(normalizeRow) : [];
      setSelectedFiscalYearStartState(Number(payload?.fiscalYearStart || fiscalYearStart));
      setFiscalYear(payload?.fiscalYear ? `FY ${payload.fiscalYear}` : `FY ${fiscalYearStart}`);
      setFiscalYearOptions(Array.isArray(payload?.fiscalYearOptions) ? payload.fiscalYearOptions : []);
      setRows(normalizedRows);
      setSavedRows(normalizedRows);
      setLastLoadedAt(new Date().toISOString());
    } catch (fetchError) {
      console.error("[FinanceSalaries] failed to load salary data", fetchError);
      setRows([]);
      setSavedRows([]);
      setError(fetchError.message || "Failed to load salary data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedFiscalYearStart);
  }, [loadData, selectedFiscalYearStart]);

  const updateRow = useCallback((regionCode, changes) => {
    setRows(currentRows =>
      currentRows.map(row =>
        row.regionCode === regionCode
          ? { ...row, ...changes }
          : row
      )
    );
    setSaveMessage("");
    setError(null);
  }, []);

  const setSelectedFiscalYearStart = useCallback(value => {
    const nextValue = Number(value);
    if (!Number.isInteger(nextValue)) {
      return;
    }
    setSelectedFiscalYearStartState(nextValue);
    setSaveMessage("");
    setError(null);
  }, []);

  const changedRows = useMemo(() => {
    const savedByRegion = new Map(savedRows.map(row => [row.regionCode, row]));
    return rows.filter(row => buildComparableRowState(row) !== buildComparableRowState(savedByRegion.get(row.regionCode) || {}));
  }, [rows, savedRows]);

  const summary = useMemo(() => buildPreviewSummary(rows, savedRows), [rows, savedRows]);

  const saveChanges = useCallback(async () => {
    if (!changedRows.length) {
      return;
    }

    const invalidAmountRow = changedRows.find(row => {
      const parsed = parseSalaryAmountInput(row.annualSalaryAmountInput);
      const raw = String(row.annualSalaryAmountInput ?? "").trim();
      return raw && Number.isNaN(parsed);
    });
    if (invalidAmountRow) {
      setError(`Enter a valid non-negative salary amount for ${invalidAmountRow.regionName}.`);
      return;
    }

    const missingPotRow = changedRows.find(row => {
      const parsed = parseSalaryAmountInput(row.annualSalaryAmountInput);
      return parsed !== null && !Number.isNaN(parsed) && !row.budgetPotId;
    });
    if (missingPotRow) {
      setError(`Assign a budget pot before saving ${missingPotRow.regionName}.`);
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage("");
    try {
      const response = await apiFetch("/api/finance/salaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalYearStart: selectedFiscalYearStart,
          rows: changedRows.map(row => ({
            regionCode: row.regionCode,
            budgetPotId: row.budgetPotId || null,
            annualSalaryAmount:
              String(row.annualSalaryAmountInput ?? "").trim() === ""
                ? null
                : String(row.annualSalaryAmountInput).trim(),
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || `Salary save failed (${response.status})`);
      }
      const normalizedRows = Array.isArray(payload?.rows) ? payload.rows.map(normalizeRow) : [];
      setSelectedFiscalYearStartState(Number(payload?.fiscalYearStart || selectedFiscalYearStart));
      setFiscalYear(payload?.fiscalYear ? `FY ${payload.fiscalYear}` : `FY ${selectedFiscalYearStart}`);
      setFiscalYearOptions(Array.isArray(payload?.fiscalYearOptions) ? payload.fiscalYearOptions : []);
      setRows(normalizedRows);
      setSavedRows(normalizedRows);
      setLastLoadedAt(new Date().toISOString());
      setSaveMessage(
        changedRows.length === 1
          ? "Saved 1 salary row."
          : `Saved ${changedRows.length} salary rows.`
      );
    } catch (saveError) {
      console.error("[FinanceSalaries] failed to save salary data", saveError);
      setError(saveError.message || "Failed to save salary data.");
    } finally {
      setSaving(false);
    }
  }, [changedRows, selectedFiscalYearStart]);

  const refreshData = useCallback(() => {
    setSaveMessage("");
    loadData(selectedFiscalYearStart);
  }, [loadData, selectedFiscalYearStart]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const dismissSaveMessage = useCallback(() => {
    setSaveMessage("");
  }, []);

  const value = useMemo(
    () => ({
      selectedFiscalYearStart,
      fiscalYear,
      fiscalYearOptions,
      rows,
      summary,
      loading,
      saving,
      error,
      saveMessage,
      lastLoadedAt,
      changedRowsCount: changedRows.length,
      hasUnsavedChanges: changedRows.length > 0,
      updateRow,
      setSelectedFiscalYearStart,
      saveChanges,
      refreshData,
      dismissError,
      dismissSaveMessage,
    }),
    [
      selectedFiscalYearStart,
      fiscalYear,
      fiscalYearOptions,
      rows,
      summary,
      loading,
      saving,
      error,
      saveMessage,
      lastLoadedAt,
      changedRows.length,
      updateRow,
      setSelectedFiscalYearStart,
      saveChanges,
      refreshData,
      dismissError,
      dismissSaveMessage,
    ]
  );

  return (
    <SalariesDataContext.Provider value={value}>
      {children}
    </SalariesDataContext.Provider>
  );
};

export const useSalariesData = () => {
  const context = useContext(SalariesDataContext);
  if (!context) {
    throw new Error("useSalariesData must be used within a SalariesDataProvider");
  }
  return context;
};

export default SalariesDataContext;
