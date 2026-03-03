import React, { createContext, useCallback, useMemo, useState, useContext } from "react";
import useCasesData from "./hooks/useCasesData.js";

const STORAGE_KEYS = {
  search: "iset-portfolio-search",
  selectedAgreements: "iset-portfolio-selected-agreements",
};

const DEFAULT_STATUS_FILTERS = [
  "initiated",
  "active",
  "dormant",
  "ready_to_close",
  "closed",
  "archived",
];

const PortfolioCaseContext = createContext({
  allCases: [],
  searchFilteredCases: [],
  filteredCases: [],
  searchText: "",
  setSearchText: () => {},
  selectedAgreements: [],
  toggleAgreementFilter: () => {},
  clearAgreementFilters: () => {},
  casesLoading: false,
  casesError: null,
});

const normaliseAgreement = value => (typeof value === "string" ? value.trim() : "");

const loadPersistedArray = key => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const persistArray = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(value) && value.length) {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore persistence errors
  }
};

const loadPersistedSearch = () => {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.search) || "";
  } catch {
    return "";
  }
};

const persistSearch = value => {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEYS.search, value);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS.search);
    }
  } catch {
    // ignore persistence errors
  }
};

export const PortfolioCaseProvider = ({ children }) => {
  const [searchText, setSearchTextState] = useState(() => loadPersistedSearch());
  const [selectedAgreements, setSelectedAgreements] = useState(() => loadPersistedArray(STORAGE_KEYS.selectedAgreements));

  const {
    items: allCases,
    loading: casesLoading,
    error: casesError,
  } = useCasesData({
    enabled: true,
    searchText,
    statusFilters: DEFAULT_STATUS_FILTERS,
    ownerFilters: undefined,
    page: 1,
    pageSize: 500,
    sort: null,
    groupByClient: false,
  });

  const setSearchText = useCallback(next => {
    const value = typeof next === "string" ? next : "";
    setSearchTextState(value);
    persistSearch(value);
  }, []);

  const searchFilteredCases = useMemo(() => {
    return Array.isArray(allCases) ? allCases : [];
  }, [allCases]);

  const filteredCases = useMemo(() => {
    if (!selectedAgreements || selectedAgreements.length === 0) return searchFilteredCases;
    const allowed = new Set(selectedAgreements.map(normaliseAgreement));
    return searchFilteredCases.filter(item => allowed.has(normaliseAgreement(item.agreementNumber)));
  }, [searchFilteredCases, selectedAgreements]);

  const toggleAgreementFilter = useCallback(agreement => {
    const normalised = normaliseAgreement(agreement);
    if (!normalised) return;
    setSelectedAgreements(current => {
      if (current.length === 1 && normaliseAgreement(current[0]) === normalised) {
        persistArray(STORAGE_KEYS.selectedAgreements, []);
        return [];
      }
      const next = [normalised];
      persistArray(STORAGE_KEYS.selectedAgreements, next);
      return next;
    });
  }, []);

  const clearAgreementFilters = useCallback(() => {
    persistArray(STORAGE_KEYS.selectedAgreements, []);
    setSelectedAgreements([]);
  }, []);

  const contextValue = useMemo(() => ({
    allCases: searchFilteredCases,
    searchFilteredCases,
    filteredCases,
    searchText,
    setSearchText,
    selectedAgreements,
    toggleAgreementFilter,
    clearAgreementFilters,
    casesLoading,
    casesError,
  }), [
    searchFilteredCases,
    filteredCases,
    searchText,
    setSearchText,
    selectedAgreements,
    toggleAgreementFilter,
    clearAgreementFilters,
    casesLoading,
    casesError,
  ]);

  return (
    <PortfolioCaseContext.Provider value={contextValue}>
      {children}
    </PortfolioCaseContext.Provider>
  );
};

export const usePortfolioCases = () => useContext(PortfolioCaseContext);

export default PortfolioCaseContext;
