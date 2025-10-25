import React, { createContext, useCallback, useMemo, useState, useContext } from "react";

const dummyCases = [
  {
    id: "case-24082",
    clientName: "Mary Cardinal",
    ownerName: "Shelley Stacey",
    agreementNumber: "CRF-1234567",
    actionPlanStart: "2025-04-12T00:00:00Z",
    openInterventions: 1,
    totalInterventions: 3,
    financeStatus: "ok",
    fyActuals: 128400,
    fyVariance: 31600,
    allocated: 160000,
    committed: 14250,
    updatedAt: "2025-10-25T12:34:00Z",
    caseHref: "/cases/case-24082",
  },
  {
    id: "case-24061",
    clientName: "Noah Whitehorse",
    ownerName: "Avery Martin",
    agreementNumber: "EI-7788990",
    actionPlanStart: "2025-05-02T00:00:00Z",
    openInterventions: 2,
    totalInterventions: 4,
    financeStatus: "needs-mapping",
    fyActuals: 96450,
    fyVariance: -12200,
    allocated: 110000,
    committed: 22000,
    updatedAt: "2025-10-24T09:20:00Z",
    caseHref: "/cases/case-24061",
  },
  {
    id: "case-24045",
    clientName: "Talia Moose",
    ownerName: "Jordan S.",
    agreementNumber: "CRF-2233445",
    actionPlanStart: "2025-03-18T00:00:00Z",
    openInterventions: 0,
    totalInterventions: 2,
    financeStatus: "overspend",
    fyActuals: 172300,
    fyVariance: -28400,
    allocated: 160000,
    committed: 18500,
    updatedAt: "2025-10-22T16:48:00Z",
    caseHref: "/cases/case-24045",
  },
  {
    id: "case-24012",
    clientName: "Elijah Fox",
    ownerName: "Shelley Stacey",
    agreementNumber: "CRF-5566778",
    actionPlanStart: "2025-02-10T00:00:00Z",
    openInterventions: 1,
    totalInterventions: 1,
    financeStatus: "ok",
    fyActuals: 85400,
    fyVariance: 9200,
    allocated: 95000,
    committed: 7800,
    updatedAt: "2025-10-21T10:05:00Z",
    caseHref: "/cases/case-24012",
  },
  {
    id: "case-23998",
    clientName: "Shania Bear",
    ownerName: "Noah Prentice",
    agreementNumber: "EI-3344556",
    actionPlanStart: "2025-01-05T00:00:00Z",
    openInterventions: 3,
    totalInterventions: 5,
    financeStatus: "needs-mapping",
    fyActuals: 201500,
    fyVariance: 40500,
    allocated: 180000,
    committed: 26000,
    updatedAt: "2025-10-20T14:18:00Z",
    caseHref: "/cases/case-23998",
  },
];

const STORAGE_KEYS = {
  search: "iset-portfolio-search",
  selectedAgreements: "iset-portfolio-selected-agreements",
};

const PortfolioCaseContext = createContext({
  allCases: dummyCases,
  searchFilteredCases: dummyCases,
  filteredCases: dummyCases,
  searchText: "",
  setSearchText: () => {},
  selectedAgreements: [],
  toggleAgreementFilter: () => {},
  clearAgreementFilters: () => {},
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
    // ignore persistence errors in scaffold
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
    // ignore persistence errors in scaffold
  }
};

export const PortfolioCaseProvider = ({ children }) => {
  const [cases] = useState(dummyCases);
  const [searchText, setSearchTextState] = useState(() => loadPersistedSearch());
  const [selectedAgreements, setSelectedAgreements] = useState(() => loadPersistedArray(STORAGE_KEYS.selectedAgreements));

  const setSearchText = useCallback(next => {
    const value = typeof next === "string" ? next : "";
    setSearchTextState(value);
    persistSearch(value);
  }, []);

  const searchFilteredCases = useMemo(() => {
    if (!searchText) return cases;
    const query = searchText.trim().toLowerCase();
    return cases.filter(item =>
      item.clientName.toLowerCase().includes(query) ||
      (item.ownerName ?? "unassigned").toLowerCase().includes(query) ||
      item.agreementNumber.toLowerCase().includes(query) ||
      item.caseHref.toLowerCase().includes(query)
    );
  }, [cases, searchText]);

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
    allCases: cases,
    searchFilteredCases,
    filteredCases,
    searchText,
    setSearchText,
    selectedAgreements,
    toggleAgreementFilter,
    clearAgreementFilters,
  }), [cases, searchFilteredCases, filteredCases, searchText, setSearchText, selectedAgreements, toggleAgreementFilter, clearAgreementFilters]);

  return (
    <PortfolioCaseContext.Provider value={contextValue}>
      {children}
    </PortfolioCaseContext.Provider>
  );
};

export const usePortfolioCases = () => useContext(PortfolioCaseContext);

export default PortfolioCaseContext;
