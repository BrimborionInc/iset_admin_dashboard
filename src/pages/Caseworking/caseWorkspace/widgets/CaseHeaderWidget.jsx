import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Hotspot,
  Link,
  Modal,
  Alert,
  SpaceBetween,
  StatusIndicator,
  Select,
  FormField,
  Input,
  Textarea,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import { apiFetch } from "../../../../auth/apiClient.js";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { toCanonicalRole } from "../../../../context/RoleMatrixContext.js";
import { usePaymentsData } from "../../../finance/widgets/PaymentsDataContext.jsx";
import { buildApplicantWatchlistIdentity, formatSinDisplay } from "../../../../utils/applicantWatchlist.js";
import { buildLockConflictMessage } from "../../../../hooks/useApplicationLock.js";
import { getCaseStatusLabel, normalizeCaseStatus } from "../../../../utils/caseStatus.js";
import {
  isInterventionProposalStatus,
  resolveInterventionStateFields,
} from "../../../../utils/interventionStatus.js";
import ExistingActionPlanModal from "../modals/ExistingActionPlanModal.jsx";
import ExistingInterventionModal from "../modals/ExistingInterventionModal.jsx";

const AWAITING_SUBMISSION_STATUSES = new Set([
  "draft",
  "returned",
  "awaiting_trigger",
  "released",
]);

const parseMetadataObject = value => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const interventionTimestamp = intervention => {
  const candidates = [
    intervention?.updatedAt,
    intervention?.updated_at,
    intervention?.submittedAt,
    intervention?.submitted_at,
    intervention?.createdAt,
    intervention?.created_at,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const time = new Date(candidate).getTime();
    if (Number.isFinite(time)) return time;
  }
  return 0;
};

const isRevisionProposal = intervention => {
  const metadata = parseMetadataObject(intervention?.metadata);
  const revision = metadata?.revision && typeof metadata.revision === "object" ? metadata.revision : null;
  const sourceInterventionId =
    intervention?.sourceInterventionId ??
    intervention?.source_intervention_id ??
    intervention?.revisionSourceInterventionId ??
    intervention?.revision_source_intervention_id ??
    revision?.sourceInterventionId ??
    revision?.source_intervention_id ??
    null;
  const proposalKind = String(
    intervention?.proposalKind ??
      intervention?.proposal_kind ??
      metadata?.proposalKind ??
      metadata?.proposal_kind ??
      ""
  )
    .trim()
    .toLowerCase();
  return proposalKind === "revision" || Boolean(sourceInterventionId);
};

const findLatestOpenInterventionProposal = actionPlans => {
  let latest = null;
  const plans = Array.isArray(actionPlans) ? actionPlans : [];
  plans.forEach(plan => {
    const interventions = Array.isArray(plan?.interventions) ? plan.interventions : [];
    interventions.forEach(intervention => {
      if (!isInterventionProposalStatus(intervention)) return;
      const state = resolveInterventionStateFields(intervention, { fallbackStatus: null });
      const reviewStatus = state.reviewStatus || null;
      if (!reviewStatus) return;
      const time = interventionTimestamp(intervention);
      const idScore = Number.isFinite(Number(intervention?.id)) ? Number(intervention.id) : 0;
      if (latest && (time < latest.time || (time === latest.time && idScore < latest.idScore))) return;
      latest = {
        interventionId: intervention?.id ?? null,
        planId: plan?.id ?? intervention?.actionPlanId ?? intervention?.action_plan_id ?? null,
        reviewStatus,
        isRevision: isRevisionProposal(intervention),
        time,
        idScore,
      };
    });
  });
  return latest;
};

const getInterventionProposalActionLabel = proposal => {
  if (!proposal) return "Propose new intervention";
  const target = proposal.isRevision ? "intervention change" : "intervention proposal";
  if (proposal.reviewStatus === "draft") return `Resume ${target}`;
  if (proposal.reviewStatus === "changes_requested") return `Update ${target}`;
  if (proposal.reviewStatus === "submitted" || proposal.reviewStatus === "in_review") {
    return `View pending ${target}`;
  }
  return `Open ${target}`;
};

const CaseHeaderWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    isLoading,
    error,
    markReadyToClose,
    closeCase,
    reopenCase,
    reopenCaseRecovery,
    archiveCase,
    refresh,
    selectedActionPlanId,
  } = useCaseWorkspace();
  const { requests: paymentRequests, loading: paymentsLoading } = usePaymentsData();
  const currentUser = useCurrentUser();
  const [actionError, setActionError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [validationModal, setValidationModal] = useState({
    visible: false,
    blockers: [],
    warnings: [],
    detail: null,
    mode: "ready",
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [headerWarnings, setHeaderWarnings] = useState([]);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [watchlistNotes, setWatchlistNotes] = useState("");
  const [watchlistError, setWatchlistError] = useState(null);
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [existingActionPlanModalOpen, setExistingActionPlanModalOpen] = useState(false);
  const [existingInterventionModalOpen, setExistingInterventionModalOpen] = useState(false);
  const [historicalActionWarning, setHistoricalActionWarning] = useState(null);
  const [accountEmailModalOpen, setAccountEmailModalOpen] = useState(false);
  const [accountEmailValue, setAccountEmailValue] = useState("");
  const [accountEmailSaving, setAccountEmailSaving] = useState(false);
  const [accountEmailError, setAccountEmailError] = useState(null);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState("new_intervention");
  const [recoveryActionPlanId, setRecoveryActionPlanId] = useState("");
  const [recoveryInterventionId, setRecoveryInterventionId] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [recoveryError, setRecoveryError] = useState(null);
  const canonicalRole = toCanonicalRole(currentUser?.role || null);
  const isSystemAdmin = canonicalRole === "System Administrator";
  const isNwacAdministrator = canonicalRole === "NWAC Administrator";
  const isRegionalManager = canonicalRole === "Regional Manager";
  const currentRegionIds = useMemo(
    () => (Array.isArray(currentUser?.regionIds) && currentUser.regionIds.length
      ? currentUser.regionIds.map(Number).filter(Number.isFinite)
      : (Number.isFinite(Number(currentUser?.regionId)) ? [Number(currentUser.regionId)] : [])),
    [currentUser?.regionId, currentUser?.regionIds]
  );
  const pendingManagePaymentsRef = useRef(false);

  const DetailItem = ({ label, value }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>{label}</span>
      {React.isValidElement(value) ? (
        value
      ) : (
        <span style={{ fontWeight: 500 }}>{value ?? "-"}</span>
      )}
    </div>
  );

  const formatDateTime = value => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };
  const formatDate = value => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  };
  const formatCurrency = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return `$${numeric.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const pathAccount = caseData?.pathAccount || {};
  const pathAccountStatusKey =
    pathAccount?.status === "created" ||
    pathAccount?.status === "invitation_sent" ||
    pathAccount?.status === "activated"
      ? pathAccount.status
      : "no_account";
  const pathAccountStatusLabel =
    pathAccountStatusKey === "created"
      ? "Ready to invite"
      : pathAccountStatusKey === "invitation_sent"
        ? "Invitation sent"
        : pathAccountStatusKey === "activated"
          ? "Activated"
          : "No account";
  const pathAccountStatusType =
    pathAccountStatusKey === "activated"
      ? "success"
      : pathAccountStatusKey === "invitation_sent"
        ? "info"
        : pathAccountStatusKey === "created"
          ? "warning"
          : "pending";
  const pathAccountTimestampLabel =
    pathAccountStatusKey === "activated"
      ? "Activated"
      : pathAccountStatusKey === "invitation_sent"
        ? "Invitation sent"
        : null;
  const pathAccountTimestampValue =
    pathAccountStatusKey === "activated"
      ? pathAccount?.activatedAt
      : pathAccountStatusKey === "invitation_sent"
        ? pathAccount?.invitedAt
        : null;
  const rawStatus = typeof caseData?.status === "string" ? caseData.status.trim().toLowerCase() : "";
  const normalizedStatus = rawStatus.replace(/-/g, "_");
  const statusKey = normalizeCaseStatus(normalizedStatus === "withdrawn" ? "closed" : normalizedStatus);
  const statusLabel = getCaseStatusLabel(statusKey || rawStatus) || "Unknown";
  const statusType = (() => {
    switch (statusKey) {
      case "intake":
        return "info";
      case "active":
      case "closed":
        return "success";
      case "ready_to_close":
        return "warning";
      case "initiated":
      case "dormant":
      case "archived":
        return "info";
      case "cancelled":
        return "error";
      default:
        return "info";
    }
  })();
  const caseNumber = caseData?.caseNumber || (caseData?.id ? `CASE-${caseData.id}` : "-");
  const clientName = caseData?.client?.name ?? "Unknown client";
  const watchlistIdentity = useMemo(
    () =>
      buildApplicantWatchlistIdentity({
        caseContext: caseData?.caseContext,
        fallbackName: caseData?.applicant_name || caseData?.applicantName || clientName,
        client: caseData?.client,
      }),
    [caseData?.applicant_name, caseData?.applicantName, caseData?.caseContext, caseData?.client, clientName]
  );
  const watchlistCaseId = caseData?.id ?? null;
  const watchlistApplicationId = caseData?.applicationId ?? caseData?.application_id ?? null;
  const watchlistReady =
    Boolean(watchlistIdentity.fullName) &&
    Boolean(watchlistIdentity.dob) &&
    Boolean(watchlistIdentity.sin) &&
    watchlistIdentity.sin.length === 9;
  const canAddToWatchlist = Boolean(watchlistCaseId || watchlistApplicationId);
  const watchlistDisplayName = watchlistIdentity.fullName || "Unavailable";
  const watchlistDisplayDob = watchlistIdentity.dob || "Unavailable";
  const watchlistDisplaySin = formatSinDisplay(watchlistIdentity.sin) || "Unavailable";
  const watchlistExplanation =
    "Adding a client to the watchlist means their future applications will be flagged for administrator review. Use this when the client owes money to the program or when there are similar risk concerns. If a new application is received with the same Social Insurance Number, administrators will be alerted automatically.";
  const formatPlanStatus = value => {
    if (!value) return "Unknown";
    return String(value)
      .trim()
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  };
  const selectedPlan = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    if (!plans.length) return null;
    if (selectedActionPlanId) {
      return plans.find(plan => String(plan.id) === String(selectedActionPlanId)) || null;
    }
    const activePlan = plans.find(plan => String(plan.status || "").toLowerCase() === "active");
    return activePlan || plans[0];
  }, [caseData, selectedActionPlanId]);
  const selectedPlanSummary = useMemo(() => {
    if (!selectedPlan) return "—";
    const planLabel = selectedPlan.title || `Action Plan ${selectedPlan.id}`;
    const status = formatPlanStatus(selectedPlan.status);
    const stream = selectedPlan.fundingStream || selectedPlan.funding_stream || "—";
    return `${planLabel} · ${status} · ${stream}`;
  }, [selectedPlan]);
  const interventionFundingTotals = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    const approvedStatuses = new Set(["approved", "in_progress", "suspended", "completed"]);
    const toNumberOrNull = value => {
      if (value === null || typeof value === "undefined") return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const numeric = Number(trimmed.replace(/,/g, ""));
        return Number.isFinite(numeric) ? numeric : null;
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const normalizeStatusKey = value =>
      typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_") : "";
    const getApprovedCost = item => {
      if (!approvedStatuses.has(normalizeStatusKey(item?.status))) {
        return null;
      }
      return toNumberOrNull(
        item?.approvedAmount ??
          item?.budgetAmount ??
          item?.plannedCost ??
          item?.cost ??
          item?.intervention_cost ??
          item?.interventionCost
      );
    };
    const getCommittedCost = item =>
      toNumberOrNull(
        item?.financeCommittedAmount ??
          item?.committedAmount ??
          item?.metadata?.finance?.committed
      );
    const getActualCost = item =>
      toNumberOrNull(
        item?.financeActualAmount ??
          item?.actualAmount ??
          item?.metadata?.finance?.actual
      );
    const totals = {
      overall: { approved: 0, committed: 0, actual: 0, count: 0 },
      byPlan: new Map(),
    };
    plans.forEach(plan => {
      const interventions = Array.isArray(plan.interventions) ? plan.interventions : [];
      const planTotals = { approved: 0, committed: 0, actual: 0, count: interventions.length };
      interventions.forEach(intervention => {
        totals.overall.count += 1;
        const approved = getApprovedCost(intervention);
        const committed = getCommittedCost(intervention);
        const actual = getActualCost(intervention);
        if (approved !== null) {
          totals.overall.approved += approved;
          planTotals.approved += approved;
        }
        if (committed !== null) {
          totals.overall.committed += committed;
          planTotals.committed += committed;
        }
        if (actual !== null) {
          totals.overall.actual += actual;
          planTotals.actual += actual;
        }
      });
      totals.byPlan.set(String(plan.id), planTotals);
    });
    return totals;
  }, [caseData]);
  const fundingSnapshotSummary = useMemo(() => {
    const financeSummary = caseData?.finance;
    const pots = Array.isArray(financeSummary?.pots) ? financeSummary.pots : [];
    const pickSummaryValue = (...candidates) => {
      const candidate = candidates.find(value => Number.isFinite(Number(value)));
      if (candidate === undefined) return null;
      return Number(candidate);
    };
    const pickMetricWithInterventionFallback = (financeValue, interventionValue) => {
      if (
        Number.isFinite(Number(interventionValue)) &&
        Number(interventionValue) > 0 &&
        (!Number.isFinite(Number(financeValue)) || Number(financeValue) <= 0)
      ) {
        return Number(interventionValue);
      }
      if (Number.isFinite(Number(financeValue))) {
        return Number(financeValue);
      }
      if (Number.isFinite(Number(interventionValue))) {
        return Number(interventionValue);
      }
      return null;
    };
    const sumPotValues = key =>
      pots.reduce((acc, pot) => {
        const numeric = Number(pot?.[key]);
        return acc + (Number.isFinite(numeric) ? numeric : 0);
      }, 0);
    const potApprovedTotal = pots.length ? sumPotValues("approved") : null;
    const potCommittedTotal = pots.length ? sumPotValues("committed") : null;
    const potActualTotal = pots.length ? sumPotValues("actual") : null;
    const overallApproved = pickMetricWithInterventionFallback(
      pickSummaryValue(potApprovedTotal, financeSummary?.approved, financeSummary?.allocated),
      interventionFundingTotals.overall.approved
    );
    const overallCommitted = pickMetricWithInterventionFallback(
      pickSummaryValue(potCommittedTotal, financeSummary?.committed),
      interventionFundingTotals.overall.committed
    );
    const overallActual = pickMetricWithInterventionFallback(
      pickSummaryValue(potActualTotal, financeSummary?.actual, financeSummary?.actuals, financeSummary?.spent),
      interventionFundingTotals.overall.actual
    );
    const overallRemaining =
      overallApproved !== null && overallCommitted !== null && overallActual !== null
        ? overallApproved - overallCommitted - overallActual
        : null;
    const hasOverall =
      Number.isFinite(overallApproved) ||
      Number.isFinite(overallCommitted) ||
      Number.isFinite(overallActual) ||
      interventionFundingTotals.overall.count > 0;
    let planLine = "Selected Action Plan: —";
    if (selectedPlan) {
      const planTotals = interventionFundingTotals.byPlan.get(String(selectedPlan.id)) || {
        approved: 0,
        committed: 0,
        actual: 0,
        count: 0,
      };
      const planRemaining = planTotals.approved - planTotals.committed - planTotals.actual;
      planLine = `Selected Action Plan: ${formatCurrency(planTotals.approved)} approved · ${formatCurrency(
        planTotals.committed
      )} committed · ${formatCurrency(planTotals.actual)} actual · ${formatCurrency(planRemaining)} remaining`;
    }
    if (!hasOverall && !selectedPlan) return "—";
    const overallLine = `Overall: ${formatCurrency(overallApproved)} approved · ${formatCurrency(
      overallCommitted
    )} committed · ${formatCurrency(overallActual)} actual · ${formatCurrency(overallRemaining)} remaining`;
    return (
      <Box>
        <div>{overallLine}</div>
        <div style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>{planLine}</div>
      </Box>
    );
  }, [caseData, interventionFundingTotals, selectedPlan]);
  const nextKeyDate = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    const candidates = [];
    plans.forEach(plan => {
      if (plan?.endDate) {
        candidates.push({
          date: plan.endDate,
          label: "Action plan end",
          name: plan.title || (plan.id ? `Action Plan ${plan.id}` : ""),
        });
      }
      const interventions = Array.isArray(plan.interventions) ? plan.interventions : [];
      interventions.forEach(intervention => {
        const interventionName = intervention?.title || intervention?.code || "Intervention";
        if (intervention?.startDate) {
          candidates.push({
            date: intervention.startDate,
            label: "Intervention start",
            name: interventionName,
          });
        }
        if (intervention?.endDate) {
          candidates.push({
            date: intervention.endDate,
            label: "Intervention end",
            name: interventionName,
          });
        }
      });
    });
    const parsed = candidates
      .map(candidate => {
        const time = new Date(candidate.date).getTime();
        if (!Number.isFinite(time)) return null;
        return { ...candidate, time };
      })
      .filter(Boolean);
    if (!parsed.length) return null;
    const now = Date.now();
    const upcoming = parsed.filter(item => item.time >= now).sort((a, b) => a.time - b.time);
    if (upcoming.length) return upcoming[0];
    return parsed.sort((a, b) => a.time - b.time)[0];
  }, [caseData]);
  const nextKeyDateSummary = useMemo(() => {
    if (!nextKeyDate) return "—";
    return (
      <Box>
        <div>{formatDate(nextKeyDate.date)}</div>
        <div style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>
          {nextKeyDate.label}
          {nextKeyDate.name ? ` · ${nextKeyDate.name}` : ""}
        </div>
      </Box>
    );
  }, [nextKeyDate]);
  const lastActivity = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    const candidates = [];
    plans.forEach(plan => {
      const planStamp = plan?.updatedAt || plan?.createdAt || null;
      if (planStamp) {
        candidates.push({
          when: planStamp,
          label: "Action plan update",
          name: plan.title || (plan.id ? `Action Plan ${plan.id}` : ""),
          who: plan?.owner?.name || plan?.updatedBy || plan?.updatedByName || null,
        });
      }
      const interventions = Array.isArray(plan.interventions) ? plan.interventions : [];
      interventions.forEach(intervention => {
        const interventionStamp = intervention?.updatedAt || intervention?.createdAt || null;
        if (!interventionStamp) return;
        candidates.push({
          when: interventionStamp,
          label: "Intervention update",
          name: intervention?.title || intervention?.code || "Intervention",
          who:
            intervention?.updatedBy?.name ||
            intervention?.updatedBy ||
            intervention?.updatedByName ||
            intervention?.createdBy ||
            null,
        });
      });
    });
    const parsed = candidates
      .map(item => {
        const time = new Date(item.when).getTime();
        if (!Number.isFinite(time)) return null;
        return { ...item, time };
      })
      .filter(Boolean);
    if (!parsed.length) return null;
    return parsed.sort((a, b) => b.time - a.time)[0];
  }, [caseData]);
  const lastActivitySummary = useMemo(() => {
    if (!lastActivity) return "—";
    const who = lastActivity.who ? ` · ${lastActivity.who}` : "";
    return (
      <Box>
        <div>{formatDateTime(lastActivity.when)}</div>
        <div style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>
          {lastActivity.label}
          {lastActivity.name ? ` · ${lastActivity.name}` : ""}
          {who}
        </div>
      </Box>
    );
  }, [lastActivity]);
  const interventionRollup = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    const counts = {
      total: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      inProgress: 0,
      closed: 0,
    };
    plans.forEach(plan => {
      const interventions = Array.isArray(plan.interventions) ? plan.interventions : [];
      interventions.forEach(intervention => {
        counts.total += 1;
        const interventionState = resolveInterventionStateFields(intervention, { fallbackStatus: null });
        const reviewStatus = interventionState.reviewStatus || null;
        const deliveryStatus = interventionState.deliveryStatus || null;
        if (reviewStatus === "draft") {
          counts.draft += 1;
        } else if (["submitted", "in_review", "changes_requested"].includes(reviewStatus)) {
          counts.submitted += 1;
        } else if (deliveryStatus === "in_progress" || deliveryStatus === "suspended") {
          counts.inProgress += 1;
        } else if (deliveryStatus === "completed" || deliveryStatus === "cancelled" || reviewStatus === "rejected") {
          counts.closed += 1;
        } else if (reviewStatus === "approved" || deliveryStatus === "planned") {
          counts.approved += 1;
        }
      });
    });
    return counts;
  }, [caseData]);
  const interventionRollupSummary = useMemo(() => {
    if (!interventionRollup.total) return "0 total";
    return (
      <Box>
        <div>{`${interventionRollup.total} total`}</div>
        <div style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>
          {`Draft ${interventionRollup.draft} · Submitted ${interventionRollup.submitted} · Approved ${interventionRollup.approved} · In progress ${interventionRollup.inProgress} · Closed ${interventionRollup.closed}`}
        </div>
      </Box>
    );
  }, [interventionRollup]);
  const openInterventionProposalAction = useMemo(
    () => findLatestOpenInterventionProposal(caseData?.actionPlans),
    [caseData?.actionPlans]
  );
  const interventionProposalActionLabel = useMemo(
    () => getInterventionProposalActionLabel(openInterventionProposalAction),
    [openInterventionProposalAction]
  );
  const recoveryModeOptions = useMemo(
    () => [
      {
        value: "new_intervention",
        label: "New intervention",
        description: "Reopen the closed plan and leave completed interventions unchanged.",
      },
      {
        value: "amend_intervention",
        label: "Amend completed intervention",
        description: "Reopen the closed plan and move one completed intervention back to in progress.",
      },
    ],
    []
  );
  const closedActionPlanOptions = useMemo(() => {
    const plans = Array.isArray(caseData?.actionPlans) ? caseData.actionPlans : [];
    return plans
      .filter(plan => String(plan?.status || "").trim().toLowerCase() === "closed" && !plan?.archivedAt)
      .map(plan => ({
        value: String(plan.id),
        label: plan.name || plan.title || `Action plan ${plan.id}`,
        description: plan.closedAt ? `Closed ${formatDate(plan.closedAt)}` : "Closed action plan",
        plan,
      }));
  }, [caseData?.actionPlans]);
  const hasActiveActionPlan = useMemo(() => {
    const plans = Array.isArray(caseData?.actionPlans) ? caseData.actionPlans : [];
    return plans.some(plan => (
      String(plan?.status || "").trim().toLowerCase() === "active" && !plan?.archivedAt
    ));
  }, [caseData?.actionPlans]);
  const selectedRecoveryPlan = useMemo(
    () => closedActionPlanOptions.find(option => option.value === String(recoveryActionPlanId))?.plan || null,
    [closedActionPlanOptions, recoveryActionPlanId]
  );
  const completedRecoveryInterventionOptions = useMemo(() => {
    const interventions = Array.isArray(selectedRecoveryPlan?.interventions) ? selectedRecoveryPlan.interventions : [];
    return interventions
      .filter(intervention => {
        const state = resolveInterventionStateFields(intervention);
        return state.deliveryStatus === "completed" || state.deliveryStatus === "cancelled";
      })
      .map(intervention => ({
        value: String(intervention.id),
        label: intervention.title || intervention.code || `Intervention ${intervention.id}`,
        description: intervention.endDate ? `Ended ${formatDate(intervention.endDate)}` : "Completed intervention",
      }));
  }, [selectedRecoveryPlan]);
  useEffect(() => {
    if (!recoveryModalOpen) return;
    if (!closedActionPlanOptions.length) {
      setRecoveryActionPlanId("");
      return;
    }
    if (!closedActionPlanOptions.some(option => option.value === String(recoveryActionPlanId))) {
      setRecoveryActionPlanId(closedActionPlanOptions[0].value);
    }
  }, [closedActionPlanOptions, recoveryActionPlanId, recoveryModalOpen]);
  useEffect(() => {
    if (!recoveryModalOpen) return;
    if (recoveryMode !== "amend_intervention") {
      setRecoveryInterventionId("");
      return;
    }
    if (!completedRecoveryInterventionOptions.length) {
      setRecoveryInterventionId("");
      return;
    }
    if (!completedRecoveryInterventionOptions.some(option => option.value === String(recoveryInterventionId))) {
      setRecoveryInterventionId(completedRecoveryInterventionOptions[0].value);
    }
  }, [completedRecoveryInterventionOptions, recoveryInterventionId, recoveryModalOpen, recoveryMode]);
  const quickLayoutItems = useMemo(
    () => [
      { id: "manage-plans-interventions", text: "View plans and interventions" },
      { id: "manage-payments", text: "View payments" },
      { id: "view-notes-calendar", text: "View notes and calendar" },
      { id: "documents-messages", text: "View documents and messages" },
      { id: "audit-trail", text: "View audit trail" },
      { id: "esdc-validation", text: "ILMP Validation and Export" },
    ],
    []
  );

  const quickActions = useMemo(() => {
    const items = [];
    const hasCase = Boolean(caseData?.id);
    const lockApplicationId = caseData?.applicationId || caseData?.application_id || null;
    const isReadyToClose = statusKey === "ready_to_close";
    const isClosed = statusKey === "closed";
    const isArchived = statusKey === "archived";
    const isActive = statusKey === "active";
    const isDormant = statusKey === "dormant";
    const isInitiated = statusKey === "initiated";
    const canAssign = hasCase && !isArchived && (isSystemAdmin || isNwacAdministrator || isRegionalManager);
    const canPropose = hasCase && (isInitiated || isActive || isDormant);
    const canMarkReady = hasCase && (isActive || isDormant);
    const canClose = hasCase && isReadyToClose && (isSystemAdmin || isNwacAdministrator || isRegionalManager);
    const canArchive = hasCase && isClosed && (isSystemAdmin || isNwacAdministrator);
    const canReopenClosed = hasCase && (isReadyToClose || isClosed) && (isSystemAdmin || isNwacAdministrator);
    const canReopenArchived = hasCase && isArchived && isSystemAdmin;
    const canReopen = canReopenClosed || canReopenArchived;
    const canReopenPlanRecovery =
      hasCase && isSystemAdmin && !isArchived && !hasActiveActionPlan && closedActionPlanOptions.length > 0;
    const canUseHistoricalEntry = hasCase && !isArchived && (isSystemAdmin || isNwacAdministrator || isRegionalManager);
    const canManagePathAccount = hasCase && Boolean(caseData?.client?.id) && !isArchived;
    const hasPathAccountEmail = Boolean(pathAccount?.email);

    if (canAssign) {
      items.push({ id: "assign", text: "Assign / reassign" });
    }
    if (canPropose) {
      items.push({ id: "propose-intervention", text: interventionProposalActionLabel });
    }
    if (canUseHistoricalEntry) {
      items.push({ id: "backload-action-plan", text: "Add existing action plan" });
      items.push({ id: "backload-intervention", text: "Add existing intervention" });
      items.push({ id: "backload-documents", text: "Upload existing documents" });
    }
    if (canManagePathAccount && pathAccountStatusKey !== "activated") {
      items.push({ id: "change-path-account-email", text: "Change PATH account email" });
    }
    if (canManagePathAccount && hasPathAccountEmail && pathAccountStatusKey !== "activated") {
      items.push({
        id: "activate-path-account",
        text: pathAccountStatusKey === "invitation_sent" ? "Resend PATH activation" : "Activate PATH account",
      });
    }
    if (canAddToWatchlist) {
      items.push({ id: "add-watchlist", text: "Add client SIN to watchlist" });
    }
    if (canMarkReady) {
      items.push({ id: "mark-ready-to-close", text: "Mark ready to close" });
    }
    if (canClose) {
      items.push({ id: "close-case", text: "Close case" });
    }
    if (canArchive) {
      items.push({ id: "archive-case", text: "Archive case" });
    }
    if (canReopen) {
      items.push({ id: "reopen-case", text: "Reopen case" });
    }
    if (canReopenPlanRecovery) {
      items.push({ id: "reopen-plan-recovery", text: "Reopen closed plan" });
    }
    if (lockApplicationId) {
      items.push({ id: "release-lock", text: "Release lock" });
    }

    return items;
  }, [
    caseData?.id,
    caseData?.applicationId,
    caseData?.application_id,
    statusKey,
    isSystemAdmin,
    isNwacAdministrator,
    isRegionalManager,
    canAddToWatchlist,
    closedActionPlanOptions.length,
    hasActiveActionPlan,
    interventionProposalActionLabel,
    caseData?.client?.id,
    pathAccount?.email,
    pathAccountStatusKey,
  ]);

  const compliance = caseData?.compliance ?? {};
  const mapValidationStatus = status => {
    const value = typeof status === "string" ? status.toLowerCase() : "pending";
    switch (value) {
      case "clean":
      case "ok":
        return { type: "success", label: "Clean" };
      case "warning":
        return { type: "warning", label: "Warnings" };
      case "blocked":
      case "error":
        return { type: "error", label: "Blocked" };
      case "pending":
      default:
        return { type: "pending", label: "Pending" };
    }
  };

  const ilmpStatusSummary = useMemo(() => mapValidationStatus(compliance.ilmp?.status), [compliance.ilmp?.status]);
  const financeStatusSummary = useMemo(() => mapValidationStatus(compliance.finance?.status), [compliance.finance?.status]);
  const ilmpLastValidated = compliance.ilmp?.lastValidatedAt ? formatDateTime(compliance.ilmp.lastValidatedAt) : "-";

  const detailItems = useMemo(() => {
    if (!caseData) {
      return [];
    }
    const statusIndicator = <StatusIndicator type={statusType}>{statusLabel}</StatusIndicator>;
    const pathAccountStatusValue = (
      <Box>
        <StatusIndicator type={pathAccountStatusType}>{pathAccountStatusLabel}</StatusIndicator>
        {pathAccount?.email ? (
          <Box fontSize="body-s" color="text-body-secondary">
            {pathAccount.email}
          </Box>
        ) : null}
        {pathAccountTimestampLabel && pathAccountTimestampValue ? (
          <Box fontSize="body-s" color="text-body-secondary">
            {pathAccountTimestampLabel}: {formatDateTime(pathAccountTimestampValue)}
          </Box>
        ) : null}
      </Box>
    );
    return [
      { label: "Client name", value: clientName },
      { label: "Case number", value: caseNumber },
      { label: "Case Manager", value: caseData?.owner?.name ?? "Unassigned" },
      { label: "Status", value: statusIndicator },
      { label: "Action plan", value: selectedPlanSummary },
      { label: "Interventions", value: interventionRollupSummary },
      { label: "Funding", value: fundingSnapshotSummary },
      { label: "Next key date", value: nextKeyDateSummary },
      { label: "Last activity", value: lastActivitySummary },
      {
        label: "ILMP validation",
        value: (
          <Box>
            <StatusIndicator type={ilmpStatusSummary.type}>{ilmpStatusSummary.label}</StatusIndicator>
            <Box fontSize="body-s" color="text-body-secondary">
              Last validated: {ilmpLastValidated}
            </Box>
          </Box>
        ),
      },
      {
        label: "Finance validation",
        value: <StatusIndicator type={financeStatusSummary.type}>{financeStatusSummary.label}</StatusIndicator>,
      },
      {
        label: "PATH Account Status",
        value: pathAccountStatusValue,
      },
    ];
  }, [
    caseData,
    caseNumber,
    clientName,
    statusLabel,
    statusType,
    ilmpStatusSummary,
    ilmpLastValidated,
    financeStatusSummary,
    pathAccount?.email,
    pathAccountStatusLabel,
    pathAccountStatusType,
    pathAccountTimestampLabel,
    pathAccountTimestampValue,
    selectedPlanSummary,
    interventionRollupSummary,
    fundingSnapshotSummary,
    nextKeyDateSummary,
    lastActivitySummary,
  ]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Case header", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const buildValidationSummary = useCallback((detail, fallbackMessage) => {
    const blockers = [];
    const warningSet = new Set();
    const addWarning = value => {
      if (value === null || typeof value === "undefined") return;
      const str = typeof value === "string" ? value : String(value);
      const trimmed = str.trim();
      if (trimmed) {
        warningSet.add(trimmed);
      }
    };

    const blockersRaw = detail?.blockers || {};
    if (blockersRaw.actionPlans) {
      const count = blockersRaw.actionPlans;
      blockers.push(
        `${count} action plan${count === 1 ? "" : "s"} are still open. Close or archive plans before marking the case ready to close.`
      );
    }
    if (blockersRaw.interventions) {
      const count = blockersRaw.interventions;
      blockers.push(
        `${count} intervention${count === 1 ? "" : "s"} remain active. Complete or cancel all interventions before closing the case.`
      );
    }
    if (blockersRaw.reminders) {
      const count = blockersRaw.reminders;
      blockers.push(
        `${count} open future reminder${count === 1 ? "" : "s"} exist. Clear or reschedule future reminders before closing the case.`
      );
    }

    const warningsRaw = detail?.warnings || {};
    if (warningsRaw.reminders) {
      const count = warningsRaw.reminders;
      addWarning(
        `${count} open future reminder${count === 1 ? "" : "s"} exist. Clearing or rescheduling them is recommended before closure.`
      );
    }
    if (Array.isArray(warningsRaw.ilmp) && warningsRaw.ilmp.length) {
      warningsRaw.ilmp.forEach(item => addWarning(item));
    }

    const ilmp = detail?.compliance?.ilmp || {};
    if (Array.isArray(ilmp.blockingIssues) && ilmp.blockingIssues.length) {
      ilmp.blockingIssues.forEach(issue => {
        blockers.push(typeof issue === "string" ? issue : String(issue));
      });
    } else if (ilmp.status === "blocked" && !blockers.length) {
      blockers.push("ILMP validation is blocked. Review ILMP readiness details before closing the case.");
    }

    if (Array.isArray(ilmp.warnings) && ilmp.warnings.length) {
      ilmp.warnings.forEach(addWarning);
    } else if (Array.isArray(ilmp.messages) && ilmp.messages.length && warningSet.size === 0) {
      ilmp.messages.forEach(addWarning);
    }

    if (!blockers.length && warningSet.size === 0 && fallbackMessage) {
      addWarning(fallbackMessage);
    }

    return { blockers, warnings: Array.from(warningSet) };
  }, []);

  const openValidationModal = useCallback(
    (detail, fallbackMessage, mode = "ready", summaryOverride = null) => {
      const summary = summaryOverride || buildValidationSummary(detail, fallbackMessage);
      setValidationModal({
        visible: true,
        detail: detail || null,
        blockers: summary.blockers,
        warnings: summary.warnings,
        mode,
      });
      setHeaderWarnings(summary.warnings || []);
    },
    [buildValidationSummary]
  );

  const closeValidationModal = () => {
    setModalLoading(false);
    setValidationModal({
      visible: false,
      blockers: [],
      warnings: [],
      detail: null,
      mode: "ready",
    });
  };

  const handleModalConfirm = async () => {
    setModalLoading(true);
    setActionError(null);
    try {
      if (validationModal.mode === "close") {
        await closeCase();
        await refresh();
        closeValidationModal();
      } else {
        closeValidationModal();
      }
    } catch (err) {
      const detail = err?.details || null;
      openValidationModal(detail, err?.message || "Failed to process case.", validationModal.mode);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const loadAssignable = useCallback(async () => {
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await apiFetch("/api/staff/assignable");
      if (!res.ok) {
        throw new Error("assignable_fetch_failed");
      }
      const data = await res.json();
      const rawStaff = Array.isArray(data) ? data : [];
      const filteredStaff = rawStaff.filter(staff => {
        if (isSystemAdmin) return true;
        if (isNwacAdministrator) {
          const staffRole = toCanonicalRole(staff?.role || staff?.primary_role || staff?.primaryRole || "");
          return staffRole !== "System Administrator";
        }
        if (isRegionalManager) {
          const staffRegion = Number(staff?.region_id ?? staff?.regionId ?? null);
          return Number.isFinite(staffRegion) && currentRegionIds.length && currentRegionIds.includes(staffRegion);
        }
        return false;
      });
      const options = filteredStaff.map(staff => ({
        label: `${staff.display_name || staff.email || staff.id} (${staff.role || "Staff"})`,
        value: String(staff.id),
      }));
      setAssignableStaff(options);
      const currentOwnerId = caseData?.owner?.id ? String(caseData.owner.id) : null;
      if (currentOwnerId && options.some(opt => opt.value === currentOwnerId)) {
        setSelectedAssignee(options.find(opt => opt.value === currentOwnerId) || null);
      }
    } catch (err) {
      setAssignableStaff([]);
      setAssignError("Unable to load assignable staff.");
    } finally {
      setAssignLoading(false);
    }
  }, [caseData?.owner?.id, currentRegionIds, isNwacAdministrator, isRegionalManager, isSystemAdmin]);

  const handleAssignSubmit = useCallback(async () => {
    const caseId = caseData?.id;
    if (!caseId || !selectedAssignee?.value) {
      setAssignError("Select an assignee.");
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      const response = await apiFetch(`/api/cases/${caseId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: selectedAssignee.value }),
      });
      if (!response.ok) {
        throw new Error("assign_failed");
      }
      setAssignModalVisible(false);
      setSelectedAssignee(null);
      await refresh();
    } catch (err) {
      setAssignError("Assignment failed. Please try again.");
    } finally {
      setAssignSubmitting(false);
    }
  }, [caseData?.id, selectedAssignee, refresh]);

  const focusFirstAwaitingSubmissionIntervention = useCallback(() => {
    if (typeof window === "undefined") return false;
    const candidate = (paymentRequests || []).find(
      item => AWAITING_SUBMISSION_STATUSES.has(item.status) && item.interventionId
    );
    if (!candidate) return false;
    const interventionIdValue = String(candidate.interventionId);
    const plans = caseData?.actionPlans || [];
    const planMatch = plans.find(plan =>
      (plan?.interventions || []).some(intervention => String(intervention?.id) === interventionIdValue)
    );
    if (!planMatch?.id) return false;
    window.dispatchEvent(
      new CustomEvent("iset:focus-intervention", {
        detail: { planId: planMatch.id, interventionId: interventionIdValue },
      })
    );
    return true;
  }, [caseData?.actionPlans, paymentRequests]);

  useEffect(() => {
    if (!pendingManagePaymentsRef.current) return;
    if (paymentsLoading || isLoading) return;
    if (focusFirstAwaitingSubmissionIntervention()) {
      pendingManagePaymentsRef.current = false;
      return;
    }
    pendingManagePaymentsRef.current = false;
  }, [focusFirstAwaitingSubmissionIntervention, isLoading, paymentsLoading]);

  const requestLayoutSwitch = useCallback(layoutId => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("iset-case-workspace:set-layout", {
        detail: { layoutId },
      })
    );
  }, []);

  const openHistoricalAction = useCallback((actionId) => {
    setActionError(null);
    setActionNotice(null);
    if (actionId === "backload-action-plan") {
      setExistingActionPlanModalOpen(true);
      return;
    }
    if (actionId === "backload-intervention") {
      setExistingInterventionModalOpen(true);
      return;
    }
    if (actionId === "backload-documents") {
      requestLayoutSwitch("documentsMessages");
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("iset:supporting-documents:open-upload", {
              detail: { caseId: caseData?.id || null },
            })
          );
        }, 0);
      }
    }
  }, [caseData?.id, requestLayoutSwitch]);

  const handleQuickLayout = useCallback(
    ({ detail }) => {
      if (!detail?.id) return;
      if (detail.id === "manage-plans-interventions") {
        requestLayoutSwitch("managePlans");
      } else if (detail.id === "manage-payments") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("iset-case-workspace:manage-payments", {
              detail: { caseId: caseData?.id || null },
            })
          );
        }
        pendingManagePaymentsRef.current = true;
        if (focusFirstAwaitingSubmissionIntervention()) {
          pendingManagePaymentsRef.current = false;
        }
        requestLayoutSwitch("managePayments");
      } else if (detail.id === "view-notes-calendar") {
        requestLayoutSwitch("notesCalendar");
      } else if (detail.id === "documents-messages") {
        requestLayoutSwitch("documentsMessages");
      } else if (detail.id === "audit-trail") {
        requestLayoutSwitch("auditTrail");
      } else if (detail.id === "esdc-validation") {
        requestLayoutSwitch("esdcValidation");
      }
    },
    [caseData?.id, focusFirstAwaitingSubmissionIntervention, requestLayoutSwitch]
  );

  const handleExistingActionPlanCreated = useCallback(
    async createdPlan => {
      setExistingActionPlanModalOpen(false);
      setActionError(null);
      setActionNotice({
        type: "success",
        text: createdPlan?.status === "closed" ? "Existing action plan recorded as closed." : "Existing action plan recorded.",
      });
      requestLayoutSwitch("managePlans");
      await refresh();
    },
    [refresh, requestLayoutSwitch]
  );

  const handleExistingInterventionCreated = useCallback(
    async createdIntervention => {
      setExistingInterventionModalOpen(false);
      setActionError(null);
      setActionNotice({
        type: "success",
        text:
          createdIntervention?.status && ["completed", "cancelled"].includes(String(createdIntervention.status).toLowerCase())
            ? "Existing intervention recorded as closed."
            : "Existing intervention recorded.",
      });
      requestLayoutSwitch("managePlans");
      await refresh();
    },
    [refresh, requestLayoutSwitch]
  );

  const handleWatchlistSubmit = useCallback(async () => {
    if (!watchlistReady) {
      setWatchlistError("Name, date of birth, and SIN are required to add to the watchlist.");
      return;
    }
    setWatchlistSaving(true);
    setWatchlistError(null);
    try {
      const response = await apiFetch("/api/applicant-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: watchlistCaseId,
          applicationId: watchlistApplicationId,
          fullName: watchlistIdentity.fullName,
          firstName: watchlistIdentity.firstName,
          lastName: watchlistIdentity.lastName,
          dob: watchlistIdentity.dob,
          sin: watchlistIdentity.sin,
          notes: watchlistNotes.trim() || null,
        }),
      });
      if (response.ok) {
        setActionNotice({ type: "success", text: "Client SIN added to the watchlist." });
        setWatchlistModalOpen(false);
        setWatchlistNotes("");
        return;
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {}
      if (response.status === 409) {
        setWatchlistError("This client SIN is already on the watchlist.");
        return;
      }
      if (response.status === 400 && payload?.error === "identity_missing") {
        setWatchlistError("Name, date of birth, and SIN are required to add to the watchlist.");
        return;
      }
      if (response.status === 400 && payload?.error === "notes_too_long") {
        setWatchlistError(`Notes must be ${payload.max || 2000} characters or fewer.`);
        return;
      }
      setWatchlistError("Unable to add to the watchlist. Please try again.");
    } catch (_) {
      setWatchlistError("Unable to add to the watchlist. Please try again.");
    } finally {
      setWatchlistSaving(false);
    }
  }, [
    watchlistReady,
    watchlistCaseId,
    watchlistApplicationId,
    watchlistIdentity,
    watchlistNotes,
  ]);

  const handleAccountEmailSubmit = useCallback(async () => {
    const clientId = caseData?.client?.id;
    const nextEmail = accountEmailValue.trim();
    if (!clientId) {
      setAccountEmailError("No client is linked to this case.");
      return;
    }
    if (!nextEmail) {
      setAccountEmailError("Enter the PATH account email address.");
      return;
    }
    setAccountEmailSaving(true);
    setAccountEmailError(null);
    try {
      const response = await apiFetch(`/api/admin/applicants/${clientId}/account-email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Unable to update the PATH account email.");
      }
      setAccountEmailModalOpen(false);
      setActionError(null);
      setActionNotice({
        type: "success",
        text: "PATH account email updated. Send a new activation email when ready.",
      });
      await refresh();
    } catch (err) {
      setAccountEmailError(err?.message || "Unable to update the PATH account email.");
    } finally {
      setAccountEmailSaving(false);
    }
  }, [accountEmailValue, caseData?.client?.id, refresh]);

  const handleRecoverySubmit = useCallback(async () => {
    if (actionLoading) return;
    const trimmedReason = recoveryReason.trim();
    if (!recoveryActionPlanId) {
      setRecoveryError("Select the closed action plan to reopen.");
      return;
    }
    if (recoveryMode === "amend_intervention" && !recoveryInterventionId) {
      setRecoveryError("Select the completed intervention to reopen.");
      return;
    }
    if (!trimmedReason) {
      setRecoveryError("Enter the reason this closeout is being reopened.");
      return;
    }
    setActionError(null);
    setActionNotice(null);
    setRecoveryError(null);
    setActionLoading(true);
    try {
      await reopenCaseRecovery({
        mode: recoveryMode,
        actionPlanId: Number(recoveryActionPlanId),
        interventionId: recoveryMode === "amend_intervention" ? Number(recoveryInterventionId) : null,
        reason: trimmedReason,
      });
      await refresh();
      setRecoveryModalOpen(false);
      setActionNotice({
        type: "success",
        text:
          recoveryMode === "amend_intervention"
            ? "Closed plan and intervention reopened for amendment."
            : "Closed plan reopened for a new intervention.",
      });
    } catch (err) {
      setRecoveryError(err?.message || "Unable to reopen the closed plan.");
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    recoveryActionPlanId,
    recoveryInterventionId,
    recoveryMode,
    recoveryReason,
    refresh,
    reopenCaseRecovery,
  ]);

  const handleQuickAction = useCallback(
    async ({ detail }) => {
      if (!detail?.id) return;
      if (detail.id === "assign") {
        setAssignError(null);
        setSelectedAssignee(null);
        setAssignModalVisible(true);
        loadAssignable().catch(() => {});
      } else if (detail.id === "mark-ready-to-close") {
        setActionError(null);
        setActionLoading(true);
        try {
          const result = await markReadyToClose();
          await refresh();
          openValidationModal(
            result || null,
            "Ready to close completed.",
            "ready",
            buildValidationSummary(result || null, "Ready to close completed.")
          );
        } catch (err) {
          const errorMessage = err?.message || "Failed to mark ready to close.";
          openValidationModal(err?.details || null, errorMessage);
          setActionError(null);
        } finally {
          setActionLoading(false);
        }
      } else if (detail.id === "close-case") {
        setActionError(null);
        setActionLoading(true);
        try {
          const result = await markReadyToClose();
          await refresh();
          openValidationModal(
            result || null,
            "Close case validation completed.",
            "close",
            buildValidationSummary(result || null, "Close case validation completed.")
          );
        } catch (err) {
          setActionError(err?.message || "Failed to close case.");
        } finally {
          setActionLoading(false);
        }
      } else if (detail.id === "reopen-case") {
        setReopenModalOpen(true);
      } else if (detail.id === "reopen-plan-recovery") {
        setRecoveryMode("new_intervention");
        setRecoveryActionPlanId(closedActionPlanOptions[0]?.value || "");
        setRecoveryInterventionId("");
        setRecoveryReason("");
        setRecoveryError(null);
        setActionError(null);
        setActionNotice(null);
        setRecoveryModalOpen(true);
      } else if (detail.id === "archive-case") {
        setArchiveModalOpen(true);
      } else if (detail.id === "propose-intervention") {
        setActionError(null);
        const existingProposal = openInterventionProposalAction;
        const planId = existingProposal?.planId || selectedActionPlanId || caseData?.actionPlans?.[0]?.id || null;
        if (!planId) {
          setActionError("Select an action plan before proposing an intervention.");
          return;
        }
        if (typeof window !== "undefined") {
          if (existingProposal?.interventionId) {
            window.dispatchEvent(
              new CustomEvent("iset:intervention-assessment:select", {
                detail: {
                  interventionId: existingProposal.interventionId,
                  planId,
                },
              })
            );
            return;
          }
          window.dispatchEvent(
            new CustomEvent("iset:intervention-assessment:new", {
              detail: { planId },
            })
          );
        }
      } else if (detail.id === "backload-action-plan") {
        setHistoricalActionWarning({ actionId: detail.id, label: "add an existing action plan" });
      } else if (detail.id === "backload-intervention") {
        setHistoricalActionWarning({ actionId: detail.id, label: "add an existing intervention" });
      } else if (detail.id === "backload-documents") {
        setHistoricalActionWarning({ actionId: detail.id, label: "upload existing documents" });
      } else if (detail.id === "manage-plans-interventions") {
        requestLayoutSwitch("managePlans");
      } else if (detail.id === "manage-payments") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("iset-case-workspace:manage-payments", {
              detail: { caseId: caseData?.id || null },
            })
          );
        }
        pendingManagePaymentsRef.current = true;
        if (focusFirstAwaitingSubmissionIntervention()) {
          pendingManagePaymentsRef.current = false;
        }
        requestLayoutSwitch("managePayments");
      } else if (detail.id === "view-notes-calendar") {
        requestLayoutSwitch("notesCalendar");
      } else if (detail.id === "documents-messages") {
        requestLayoutSwitch("documentsMessages");
      } else if (detail.id === "audit-trail") {
        requestLayoutSwitch("auditTrail");
      } else if (detail.id === "esdc-validation") {
        requestLayoutSwitch("esdcValidation");
      } else if (detail.id === "add-watchlist") {
        setWatchlistError(null);
        setWatchlistNotes("");
        setWatchlistModalOpen(true);
        setActionNotice(null);
      } else if (detail.id === "change-path-account-email") {
        setAccountEmailValue(pathAccount?.email || "");
        setAccountEmailError(null);
        setAccountEmailModalOpen(true);
        setActionNotice(null);
      } else if (detail.id === "activate-path-account") {
        const clientId = caseData?.client?.id;
        if (!clientId) {
          setActionError("No client is linked to this case.");
          return;
        }
        if (!pathAccount?.email) {
          setActionError("This client does not have a valid email address on file for PATH activation.");
          return;
        }
        setActionError(null);
        setActionNotice(null);
        setActionLoading(true);
        try {
          if (pathAccountStatusKey === "no_account") {
            const createResponse = await apiFetch(`/api/admin/applicants/${clientId}/create-account`, { method: "POST" });
            const createPayload = await createResponse.json().catch(() => null);
            if (!createResponse.ok) {
              throw new Error(createPayload?.message || createPayload?.error || "Unable to create the applicant account.");
            }
          }
          const sendResponse = await apiFetch(`/api/admin/applicants/${clientId}/send-activation`, { method: "POST" });
          const sendPayload = await sendResponse.json().catch(() => null);
          if (!sendResponse.ok) {
            throw new Error(sendPayload?.message || sendPayload?.error || "Unable to send the PATH activation email.");
          }
          setActionNotice({
            type: "success",
            text: pathAccountStatusKey === "invitation_sent" ? "PATH activation email resent." : "PATH activation email sent.",
          });
          await refresh();
        } catch (err) {
          setActionError(err?.message || "Unable to start PATH account activation.");
        } finally {
          setActionLoading(false);
        }
      } else if (detail.id === "release-lock") {
        const lockApplicationId = caseData?.applicationId || caseData?.application_id || null;
        if (!lockApplicationId) {
          setActionError("No application lock is available to release.");
          return;
        }
        setActionError(null);
        setActionNotice(null);
        setActionLoading(true);
        try {
          const response = await apiFetch(`/api/locks/application/${lockApplicationId}`, { method: "DELETE" });
          let payload = null;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }
          if (response.status === 423) {
            const message = buildLockConflictMessage({
              reason: payload?.reason || payload?.error,
              lock: payload?.lock,
            });
            setActionError(message);
            return;
          }
          if (!response.ok) {
            throw new Error(payload?.message || payload?.error || "Unable to release lock.");
          }
          if (payload?.released === false) {
            setActionNotice({ type: "info", text: "No active lock to release." });
          } else {
            setActionNotice({ type: "success", text: "Lock released." });
          }
          await refresh();
        } catch (err) {
          setActionError(err?.message || "Unable to release lock.");
        } finally {
          setActionLoading(false);
        }
      }
    },
    [
      markReadyToClose,
      refresh,
      openValidationModal,
      buildValidationSummary,
      focusFirstAwaitingSubmissionIntervention,
      loadAssignable,
      openInterventionProposalAction,
      selectedActionPlanId,
      caseData,
      closedActionPlanOptions,
      pathAccount?.email,
      pathAccountStatusKey,
      requestLayoutSwitch,
      setActionNotice,
    ]
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description}
          actions={
            <Hotspot hotspotId="case-workspace-quick-actions" direction="left">
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  ariaLabel="Case quick layouts"
                  items={quickLayoutItems}
                  onItemClick={handleQuickLayout}
                >
                  Quick layouts
                </ButtonDropdown>
                {quickActions.length ? (
                  <ButtonDropdown
                    ariaLabel="Case quick actions"
                    items={quickActions}
                    onItemClick={handleQuickAction}
                  >
                    Quick actions
                  </ButtonDropdown>
                ) : null}
              </SpaceBetween>
            </Hotspot>
          }
        >
          <Hotspot hotspotId="case-workspace-header" direction="right" />
          {metadata.title ?? "Case header"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Case header settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {headerWarnings.length ? (
          <Alert
            type="warning"
            header="Case close warnings"
            dismissible
            dismissAriaLabel="Dismiss close warnings"
            onDismiss={() => setHeaderWarnings([])}
          >
            <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
              {headerWarnings.map((item, index) => (
                <li key={`header-warning-${index}`}>{item}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {actionLoading ? <StatusIndicator type="loading">Updating case…</StatusIndicator> : null}
        {actionNotice ? <StatusIndicator type={actionNotice.type}>{actionNotice.text}</StatusIndicator> : null}
        {actionError ? <StatusIndicator type="error">{actionError}</StatusIndicator> : null}
        {error ? (
          <StatusIndicator type="error">{error}</StatusIndicator>
        ) : null}
        {isLoading ? (
          <StatusIndicator type="loading">
            {caseData ? "Refreshing case..." : "Loading case..."}
          </StatusIndicator>
        ) : null}
        {caseData ? (
          <Box>
            <ColumnLayout columns={5} variant="text-grid">
              {detailItems.map(item => (
                <DetailItem key={item.label} label={item.label} value={item.value} />
              ))}
            </ColumnLayout>
          </Box>
        ) : !isLoading && !error ? (
          <Box padding="m">
            <StatusIndicator type="info">No case data available.</StatusIndicator>
          </Box>
        ) : null}
        <ExistingActionPlanModal
          visible={existingActionPlanModalOpen}
          onDismiss={() => setExistingActionPlanModalOpen(false)}
          onCreated={handleExistingActionPlanCreated}
        />
        <ExistingInterventionModal
          visible={existingInterventionModalOpen}
          initialActionPlanId={selectedActionPlanId || caseData?.actionPlans?.[0]?.id || null}
          onDismiss={() => setExistingInterventionModalOpen(false)}
          onCreated={handleExistingInterventionCreated}
        />
        <Modal
          visible={Boolean(historicalActionWarning)}
          onDismiss={() => setHistoricalActionWarning(null)}
          header="Historical record only"
          closeAriaLabel="Close historical record warning"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setHistoricalActionWarning(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const actionId = historicalActionWarning?.actionId;
                  setHistoricalActionWarning(null);
                  if (actionId) {
                    openHistoricalAction(actionId);
                  }
                }}
              >
                Continue
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>
              Use this only to {historicalActionWarning?.label || "record existing history"} when the work or document already existed outside PATH.
            </Box>
            <Alert type="warning">
              This creates real case history, but it does not start approval routing, checklist steps, payment packets, applicant notifications, signing workflows, or generated approval documents. For new or current work that needs approval, use the normal proposal workflow.
            </Alert>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={assignModalVisible}
          onDismiss={() => {
            if (assignSubmitting) return;
            setAssignModalVisible(false);
            setSelectedAssignee(null);
            setAssignError(null);
          }}
          header="Assign / reassign case"
          closeAriaLabel="Close assign modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (assignSubmitting) return;
                  setAssignModalVisible(false);
                  setSelectedAssignee(null);
                  setAssignError(null);
                }}
                disabled={assignSubmitting}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={assignSubmitting} onClick={handleAssignSubmit}>
                Save
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            {assignError ? <StatusIndicator type="error">{assignError}</StatusIndicator> : null}
            <FormField
              label="Assignee"
              description="Select the staff member who will own this case."
              stretch
            >
              <Select
                placeholder={assignLoading ? "Loading staff..." : "Select assignee"}
                selectedOption={selectedAssignee}
                options={assignableStaff}
                onChange={({ detail }) => setSelectedAssignee(detail.selectedOption || null)}
                statusType={assignLoading ? "loading" : "finished"}
                filteringType="auto"
                disabled={assignLoading}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={watchlistModalOpen}
          onDismiss={() => {
            if (watchlistSaving) return;
            setWatchlistModalOpen(false);
            setWatchlistNotes("");
            setWatchlistError(null);
          }}
          header="Add client SIN to watchlist"
          closeAriaLabel="Close watchlist modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (watchlistSaving) return;
                  setWatchlistModalOpen(false);
                  setWatchlistNotes("");
                  setWatchlistError(null);
                }}
                disabled={watchlistSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={watchlistSaving}
                disabled={watchlistSaving || !watchlistReady}
                onClick={handleWatchlistSubmit}
              >
                Add to watchlist
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>{watchlistExplanation}</Box>
            {watchlistError ? <Alert type="error">{watchlistError}</Alert> : null}
            {!watchlistReady ? (
              <Alert type="warning">
                Name, date of birth, and SIN are required before adding a client to the watchlist.
              </Alert>
            ) : null}
            <FormField label="Client name">
              <Input value={watchlistDisplayName} readOnly />
            </FormField>
            <FormField label="Date of birth">
              <Input value={watchlistDisplayDob} readOnly />
            </FormField>
            <FormField label="Social Insurance Number">
              <Input value={watchlistDisplaySin} readOnly />
            </FormField>
            <FormField
              label="Notes"
              description="Shown in watchlist details when staff review a future watchlist hit."
            >
              <Textarea
                value={watchlistNotes}
                onChange={({ detail }) => setWatchlistNotes(detail.value)}
                placeholder="Explain why this applicant is watchlisted and what staff should do when a future watchlist hit is reviewed"
                rows={4}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={accountEmailModalOpen}
          onDismiss={() => {
            if (accountEmailSaving) return;
            setAccountEmailModalOpen(false);
            setAccountEmailError(null);
          }}
          header="Change PATH account email"
          closeAriaLabel="Close PATH account email modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (accountEmailSaving) return;
                  setAccountEmailModalOpen(false);
                  setAccountEmailError(null);
                }}
                disabled={accountEmailSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={accountEmailSaving}
                onClick={handleAccountEmailSubmit}
              >
                Save
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Alert type="info">
              This updates the PATH sign-in account and clears any previous invitation. Send activation again after saving.
            </Alert>
            {accountEmailError ? <Alert type="error">{accountEmailError}</Alert> : null}
            <FormField
              label="PATH account email"
              description="Use the email address the participant should use to activate and sign in to PATH."
            >
              <Input
                type="email"
                value={accountEmailValue}
                spellcheck={false}
                disabled={accountEmailSaving}
                onChange={({ detail }) => setAccountEmailValue(detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={recoveryModalOpen}
          onDismiss={() => {
            if (actionLoading) return;
            setRecoveryModalOpen(false);
          }}
          header="Reopen closed plan"
          closeAriaLabel="Dismiss reopen closed plan"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setRecoveryModalOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={actionLoading}
                disabled={
                  !recoveryActionPlanId ||
                  !recoveryReason.trim() ||
                  (recoveryMode === "amend_intervention" && !recoveryInterventionId)
                }
                onClick={handleRecoverySubmit}
              >
                Reopen closed plan
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Alert type="warning">
              This clears the action plan closeout result and resets ILMP validation to needs review. Amendment mode
              also clears the selected intervention outcome and actual amount, then returns it to in progress.
            </Alert>
            {recoveryError ? <Alert type="error">{recoveryError}</Alert> : null}
            <FormField label="Recovery type">
              <Select
                selectedOption={
                  recoveryModeOptions.find(option => option.value === recoveryMode) || recoveryModeOptions[0]
                }
                options={recoveryModeOptions}
                disabled={actionLoading}
                onChange={({ detail }) => {
                  setRecoveryMode(detail.selectedOption?.value || "new_intervention");
                  setRecoveryError(null);
                }}
              />
            </FormField>
            <FormField label="Closed action plan">
              <Select
                selectedOption={
                  closedActionPlanOptions.find(option => option.value === String(recoveryActionPlanId)) || null
                }
                options={closedActionPlanOptions}
                disabled={actionLoading || !closedActionPlanOptions.length}
                placeholder="Select a closed action plan"
                onChange={({ detail }) => {
                  setRecoveryActionPlanId(detail.selectedOption?.value || "");
                  setRecoveryInterventionId("");
                  setRecoveryError(null);
                }}
              />
            </FormField>
            {recoveryMode === "amend_intervention" ? (
              <FormField label="Completed intervention">
                <Select
                  selectedOption={
                    completedRecoveryInterventionOptions.find(
                      option => option.value === String(recoveryInterventionId)
                    ) || null
                  }
                  options={completedRecoveryInterventionOptions}
                  disabled={actionLoading || !completedRecoveryInterventionOptions.length}
                  placeholder="Select a completed intervention"
                  onChange={({ detail }) => {
                    setRecoveryInterventionId(detail.selectedOption?.value || "");
                    setRecoveryError(null);
                  }}
                />
              </FormField>
            ) : null}
            <FormField label="Reason">
              <Textarea
                value={recoveryReason}
                spellcheck={true}
                disabled={actionLoading}
                placeholder="Describe why the closed plan needs to be reopened."
                onChange={({ detail }) => {
                  setRecoveryReason(detail.value);
                  setRecoveryError(null);
                }}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={validationModal.visible}
          onDismiss={closeValidationModal}
          header="Case closeout checks"
          closeAriaLabel="Close case validation summary"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={closeValidationModal} disabled={modalLoading}>
                Cancel
              </Button>
              {!validationModal.blockers.length ? (
                <Button variant="primary" loading={modalLoading} onClick={handleModalConfirm}>
                  {validationModal.mode === "close" ? "Close case" : "Mark as Ready to Close"}
                </Button>
              ) : null}
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <div>
              <Box fontWeight="bold">Blockers</Box>
              {validationModal.blockers.length ? (
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                  {validationModal.blockers.map((item, index) => (
                    <li key={`blocker-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <Box color="text-body-secondary">No blockers detected.</Box>
              )}
            </div>
            <div>
              <Box fontWeight="bold">Warnings</Box>
              {validationModal.warnings.length ? (
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                  {validationModal.warnings.map((item, index) => (
                    <li key={`warning-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <Box color="text-body-secondary">No warnings detected.</Box>
              )}
            </div>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={archiveModalOpen}
          onDismiss={() => setArchiveModalOpen(false)}
          header="Archive case"
          closeAriaLabel="Dismiss archive case confirmation"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setArchiveModalOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={actionLoading}
                onClick={async () => {
                  if (actionLoading) return;
                  setActionError(null);
                  setActionLoading(true);
                  try {
                    await archiveCase();
                    await refresh();
                  } catch (err) {
                    setActionError(err?.message || "Failed to archive case.");
                  } finally {
                    setActionLoading(false);
                    setArchiveModalOpen(false);
                  }
                }}
              >
                Archive case
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Box>
              Archive this case? It will be hidden from standard views until restored by a System Administrator.
            </Box>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={reopenModalOpen}
          onDismiss={() => setReopenModalOpen(false)}
          header="Re-open case"
          closeAriaLabel="Dismiss re-open case confirmation"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setReopenModalOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={actionLoading}
                onClick={async () => {
                  if (actionLoading) return;
                  setActionError(null);
                  setActionLoading(true);
                  try {
                    await reopenCase();
                    await refresh();
                  } catch (err) {
                    setActionError(err?.message || "Failed to re-open case.");
                  } finally {
                    setActionLoading(false);
                    setReopenModalOpen(false);
                  }
                }}
              >
                Re-open case
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Box>
              Re-open this case? The status will move to No Active Plan and will stay there until a new action plan is initiated.
            </Box>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </BoardItem>
  );
};

export default CaseHeaderWidget;
