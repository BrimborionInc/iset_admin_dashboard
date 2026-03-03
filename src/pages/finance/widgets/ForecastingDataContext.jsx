import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const ForecastingDataContext = createContext(undefined);

const monthsFy24 = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const actualSeriesSeed = monthsFy24.map((month, index) => ({
  x: month,
  y: [220, 410, 640, 900, 1160, 1375, 1580, 1785, 2010, 2235, 2440, 2680][index],
}));

const baselineForecastSeed = monthsFy24.map((month, index) => ({
  x: month,
  y: [235, 455, 690, 960, 1220, 1480, 1740, 1980, 2240, 2500, 2760, 3050][index],
}));

const scenarioSeed = [
  {
    id: "baseline",
    name: "PTMA steady-state forecast",
    owner: FINANCE_PEOPLE.programLead,
    status: "approved",
    total: 1_705_000,
    adminRate: 17.3,
    risk: "green",
    justification: "Baseline aligns to current PTMA commitments and approved NWAC admin spend.",
    adjustments: [
      {
        id: "nwac-admin",
        pot: "NWAC Administration",
        currentForecast: 295_000,
        scenarioForecast: 295_000,
        variance: 0,
        justification: "Maintain headcount and occupancy assumptions.",
      },
      {
        id: "ptma-bc-client",
        pot: "BC Client Services",
        currentForecast: 313_000,
        scenarioForecast: 309_000,
        variance: -4_000,
        justification: "Shift a portion of travel supports into northern reserve.",
      },
      {
        id: "ptma-ab-client",
        pot: "Alberta Client Services",
        currentForecast: 278_000,
        scenarioForecast: 276_000,
        variance: -2_000,
        justification: "Slight reduction after employer wage recoveries posted.",
      },
      {
        id: "ptma-on-client",
        pot: "Ontario Client Services",
        currentForecast: 322_000,
        scenarioForecast: 326_000,
        variance: 4_000,
        justification: "Expanded integrated services pilot with municipal partner.",
      },
      {
        id: "ptma-prairies-client",
        pot: "Prairies Client Services",
        currentForecast: 211_000,
        scenarioForecast: 208_000,
        variance: -3_000,
        justification: "Reprofile mileage reimbursements to Q3 after slower spring uptake.",
      },
      {
        id: "ptma-atlantic-client",
        pot: "Atlantic Client Services",
        currentForecast: 149_000,
        scenarioForecast: 151_000,
        variance: 2_000,
        justification: "Add childcare subsidy top-up for Halifax partnership.",
      },
      {
        id: "ptma-northern-client",
        pot: "Northern Client Services",
        currentForecast: 137_000,
        scenarioForecast: 140_000,
        variance: 3_000,
        justification: "Pre-position travel for Nunavut wellness cohorts ahead of freeze-up.",
      },
    ],
  },
  {
    id: "growth-case",
    name: "Regional acceleration scenario",
    owner: FINANCE_PEOPLE.seniorDirector,
    status: "draft",
    total: 1_792_000,
    adminRate: 16.6,
    risk: "yellow",
    justification: "Push additional funding into regions experiencing high client demand.",
    adjustments: [
      {
        id: "nwac-admin",
        pot: "NWAC Administration",
        currentForecast: 295_000,
        scenarioForecast: 298_000,
        variance: 3_000,
        justification: "Add short-term policy analyst to manage top-up approvals.",
      },
      {
        id: "ptma-bc-client",
        pot: "BC Client Services",
        currentForecast: 313_000,
        scenarioForecast: 330_000,
        variance: 17_000,
        justification: "Fund additional cultural programming requested by coastal PTMAs.",
      },
      {
        id: "ptma-ab-client",
        pot: "Alberta Client Services",
        currentForecast: 278_000,
        scenarioForecast: 292_000,
        variance: 14_000,
        justification: "Scale apprenticeship placements after employer demand spike.",
      },
      {
        id: "ptma-on-client",
        pot: "Ontario Client Services",
        currentForecast: 322_000,
        scenarioForecast: 342_000,
        variance: 20_000,
        justification: "Expand integrated services pilot to Hamilton and Ottawa.",
      },
      {
        id: "ptma-prairies-client",
        pot: "Prairies Client Services",
        currentForecast: 211_000,
        scenarioForecast: 220_000,
        variance: 9_000,
        justification: "Increase outreach teams for rural Métis communities.",
      },
      {
        id: "ptma-atlantic-client",
        pot: "Atlantic Client Services",
        currentForecast: 149_000,
        scenarioForecast: 160_000,
        variance: 11_000,
        justification: "Boost wraparound supports in Mi’kmaq communities.",
      },
      {
        id: "ptma-northern-client",
        pot: "Northern Client Services",
        currentForecast: 137_000,
        scenarioForecast: 150_000,
        variance: 13_000,
        justification: "Fund new telehealth-enabled employment workshops.",
      },
    ],
  },
  {
    id: "conservative",
    name: "Risk mitigation scenario",
    owner: FINANCE_PEOPLE.ceo,
    status: "review",
    total: 1_623_000,
    adminRate: 17.6,
    risk: "green",
    justification: "Hold contingency for monitoring findings and evidence remediation.",
    adjustments: [
      {
        id: "nwac-admin",
        pot: "NWAC Administration",
        currentForecast: 295_000,
        scenarioForecast: 285_000,
        variance: -10_000,
        justification: "Delay hiring of administrative assistant until Q4.",
      },
      {
        id: "ptma-bc-client",
        pot: "BC Client Services",
        currentForecast: 313_000,
        scenarioForecast: 295_000,
        variance: -18_000,
        justification: "Pause expansion cohorts until evidence backlog is cleared.",
      },
      {
        id: "ptma-ab-client",
        pot: "Alberta Client Services",
        currentForecast: 278_000,
        scenarioForecast: 268_000,
        variance: -10_000,
        justification: "Reduce travel bursaries pending updated cost-share agreements.",
      },
      {
        id: "ptma-on-client",
        pot: "Ontario Client Services",
        currentForecast: 322_000,
        scenarioForecast: 305_000,
        variance: -17_000,
        justification: "Slow rollout of integrated services until monitoring findings close.",
      },
      {
        id: "ptma-prairies-client",
        pot: "Prairies Client Services",
        currentForecast: 211_000,
        scenarioForecast: 200_000,
        variance: -11_000,
        justification: "Hold community travel draws until new sampling set is complete.",
      },
      {
        id: "ptma-atlantic-client",
        pot: "Atlantic Client Services",
        currentForecast: 149_000,
        scenarioForecast: 140_000,
        variance: -9_000,
        justification: "Limit childcare expansion while policy review is underway.",
      },
      {
        id: "ptma-northern-client",
        pot: "Northern Client Services",
        currentForecast: 137_000,
        scenarioForecast: 130_000,
        variance: -7_000,
        justification: "Delay new wellness travel subsidies pending funding confirmation.",
      },
    ],
  },
];


const horizonOptionsSeed = [
  { id: "fy24", label: "FY2024-25", months: monthsFy24 },
  { id: "fy25", label: "FY2025-26 (projected)", months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"] },
];

export const ForecastingDataProvider = ({ children }) => {
  const [horizonKey, setHorizonKey] = useState("fy24");
  const [scenarios, setScenarios] = useState(scenarioSeed);
  const [activeScenarioId, setActiveScenarioId] = useState(scenarioSeed[1]?.id ?? scenarioSeed[0].id);

  const selectScenario = useCallback(scenarioId => {
    setActiveScenarioId(scenarioId);
  }, []);

  const activeScenario = useMemo(
    () => scenarios.find(scenario => scenario.id === activeScenarioId) ?? scenarios[0],
    [scenarios, activeScenarioId]
  );

  const updateAdjustment = useCallback((scenarioId, adjustmentId, nextValue, justification) => {
    setScenarios(prev =>
      prev.map(scenario => {
        if (scenario.id !== scenarioId) {
          return scenario;
        }
        const nextAdjustments = scenario.adjustments.map(adjustment => {
          if (adjustment.id !== adjustmentId) {
            return adjustment;
          }
          const variance = Math.round(nextValue - adjustment.currentForecast);
          return {
            ...adjustment,
            scenarioForecast: nextValue,
            variance,
            justification: justification ?? adjustment.justification,
          };
        });
        const nextTotal = nextAdjustments.reduce((acc, item) => acc + item.scenarioForecast, 0);
        const nextAdminRate = scenario.adminRate; // keep rate stable
        return {
          ...scenario,
          adjustments: nextAdjustments,
          total: nextTotal,
          adminRate: nextAdminRate,
          status: scenario.status === "approved" ? "approved" : "draft",
        };
      })
    );
  }, []);

  const duplicateScenario = useCallback(baseScenarioId => {
    const base = scenarios.find(item => item.id === baseScenarioId);
    if (!base) return;
    const timestamp = Date.now();
    const clone = {
      ...base,
      id: `${baseScenarioId}-copy-${timestamp}`,
      name: `${base.name} (copy)`,
      status: "draft",
      owner: base.owner ?? FINANCE_PEOPLE.programLead,
      adjustments: base.adjustments.map(adj => ({ ...adj })),
    };
    setScenarios(prev => [...prev, clone]);
    setActiveScenarioId(clone.id);
  }, [scenarios]);

  const promoteScenario = useCallback((scenarioId, status = "review") => {
    setScenarios(prev =>
      prev.map(scenario =>
        scenario.id === scenarioId ? { ...scenario, status } : scenario
      )
    );
  }, []);

  const horizonOptions = useMemo(
    () => horizonOptionsSeed.map(option => ({ value: option.id, label: option.label })),
    []
  );

  const horizonMonths = useMemo(() => {
    const entry = horizonOptionsSeed.find(option => option.id === horizonKey);
    return entry ? entry.months : monthsFy24;
  }, [horizonKey]);

  const forecastSeries = useMemo(() => {
    const multiplier = horizonKey === "fy25" ? 1.08 : 1;
    return baselineForecastSeed.slice(0, horizonMonths.length).map((point, index) => ({
      x: horizonMonths[index],
      y: Math.round(point.y * multiplier),
    }));
  }, [horizonKey, horizonMonths]);

  const combinedActuals = useMemo(
    () => actualSeriesSeed.slice(0, horizonMonths.length),
    [horizonMonths]
  );

  const comparisonRows = useMemo(
    () =>
      scenarios.map(scenario => ({
        id: scenario.id,
        name: scenario.name,
        status: scenario.status,
        owner: scenario.owner,
        total: scenario.total,
        adminRate: scenario.adminRate,
        risk: scenario.risk,
      })),
    [scenarios]
  );

  const commitImpacts = useMemo(() => {
    if (!activeScenario) return [];
    return activeScenario.adjustments.map(adj => ({
      id: adj.id,
      pot: adj.pot,
      current: adj.currentForecast,
      proposed: adj.scenarioForecast,
      delta: adj.variance,
    }));
  }, [activeScenario]);

  const createScenario = useCallback(({ name, owner, seedVariance } = {}) => {
    const timestamp = Date.now();
    const template = scenarios[0] ?? scenarioSeed[0];
    const adjustments = template.adjustments.map(adj => {
      const delta = typeof seedVariance === "number" ? Math.round(adj.currentForecast * seedVariance) : 0;
      return {
        ...adj,
        scenarioForecast: adj.currentForecast + delta,
        variance: delta,
      };
    });
    const total = adjustments.reduce((acc, item) => acc + item.scenarioForecast, 0);
    const newScenario = {
      id: `scenario-${timestamp}`,
      name: name ?? `Scenario ${timestamp}`,
      owner: owner ?? FINANCE_PEOPLE.programLead,
      status: "draft",
      total,
      adminRate: template.adminRate,
      risk: "yellow",
      justification: "Draft scenario created for planning.",
      adjustments,
    };
    setScenarios(prev => [...prev, newScenario]);
    setActiveScenarioId(newScenario.id);
  }, [scenarios]);

  const value = useMemo(
    () => ({
      horizonKey,
      setHorizonKey,
      horizonOptions,
      horizonMonths,
      actualSeries: combinedActuals,
      forecastSeries,
      scenarios,
      activeScenarioId,
      activeScenario,
      selectScenario,
      updateAdjustment,
      duplicateScenario,
      promoteScenario,
      comparisonRows,
      commitImpacts,
      createScenario,
    }),
    [
      horizonKey,
      horizonOptions,
      horizonMonths,
      combinedActuals,
      forecastSeries,
      scenarios,
      activeScenarioId,
      activeScenario,
      selectScenario,
      updateAdjustment,
      duplicateScenario,
      promoteScenario,
      comparisonRows,
      commitImpacts,
      createScenario,
    ]
  );

  return <ForecastingDataContext.Provider value={value}>{children}</ForecastingDataContext.Provider>;
};

export const useForecastingData = () => {
  const context = useContext(ForecastingDataContext);
  if (!context) {
    throw new Error("useForecastingData must be used within a ForecastingDataProvider");
  }
  return context;
};
