import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../../auth/apiClient";

const defaultResult = {
  items: [],
  totalCount: 0,
  loading: false,
  error: null,
};

const buildQuery = ({
  searchText,
  statusFilters,
  ownerFilters,
  page,
  pageSize,
  sort,
}) => {
  const query = new URLSearchParams();
  if (searchText) {
    query.set("query", searchText);
  }
  if (Array.isArray(statusFilters) && statusFilters.length) {
    query.set("status", statusFilters.join(","));
  }
  if (Array.isArray(ownerFilters) && ownerFilters.length) {
    query.set("owner", ownerFilters.join(","));
  }
  if (page && Number.isFinite(page)) {
    query.set("page", String(page));
  }
  if (pageSize && Number.isFinite(pageSize)) {
    query.set("pageSize", String(pageSize));
  }
  if (sort && sort.column) {
    query.set("sort", sort.column);
    if (sort.direction) {
      query.set("direction", sort.direction);
    }
  }
  return query.toString();
};

const toTitleCase = value => {
  if (!value) return "";
  return value
    .split(" ")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatClientName = (firstName, lastName) => {
  const parts = [];
  if (firstName) parts.push(toTitleCase(firstName));
  if (lastName) parts.push(toTitleCase(lastName));
  const combined = parts.join(" ").trim();
  return combined || "Unknown client";
};

const mapCaseRowToTableItem = row => {
  const clientFirst = row?.client?.firstName || null;
  const clientLast = row?.client?.lastName || null;
  const ownerName =
    row?.owner?.name || row?.owner?.email || (row?.owner ? "Assigned" : "Unassigned");
  const trackingId = row?.trackingId || null;
  const submittedAt = row?.submittedAt || row?.openedAt || null;
  return {
    id: row?.id,
    clientName: formatClientName(clientFirst, clientLast),
    ownerName: ownerName,
    agreementNumber: trackingId || "—",
    actionPlanStart: submittedAt || null,
    openInterventions: Number.isFinite(row?.openInterventions) ? row.openInterventions : 0,
    totalInterventions: Number.isFinite(row?.totalInterventions)
      ? row.totalInterventions
      : 0,
    financeStatus: row?.financeStatus || "ok",
    fyActuals: Number.isFinite(row?.fyActuals) ? row.fyActuals : 0,
    fyVariance: Number.isFinite(row?.fyVariance) ? row.fyVariance : 0,
    caseHref: row?.id ? `/cases/${row.id}` : null,
    raw: row,
  };
};

export default function useCasesData({
  enabled,
  searchText,
  statusFilters,
  ownerFilters,
  page,
  pageSize,
  sort,
}) {
  const [result, setResult] = useState(defaultResult);
  const abortRef = useRef(null);

  const fetchCases = useCallback(
    async (override = {}) => {
      if (!enabled) {
        setResult(defaultResult);
        return;
      }
      const payload = {
        searchText,
        statusFilters,
        ownerFilters,
        page,
        pageSize,
        sort,
        ...override,
      };
      const query = buildQuery(payload);
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setResult(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const response = await apiFetch(`/api/cases${query ? `?${query}` : ""}`, {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error(`Failed to load cases (${response.status})`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        const items = Array.isArray(data?.items)
          ? data.items.map(mapCaseRowToTableItem)
          : [];
        const total = Number.isFinite(data?.totalCount) ? data.totalCount : items.length;
        setResult({
          items,
          totalCount: total,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        setResult({
          items: [],
          totalCount: 0,
          loading: false,
          error: err,
        });
      }
    },
    [enabled, searchText, statusFilters, ownerFilters, page, pageSize, sort]
  );

  useEffect(() => {
    fetchCases();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchCases]);

  return {
    ...result,
    refresh: fetchCases,
  };
}
