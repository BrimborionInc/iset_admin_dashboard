import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { apiFetch } from '../../auth/apiClient';
import { useAuth } from '../../context/AuthContext.js';
import useCurrentUser from '../../hooks/useCurrentUser';
import { getRoleDisplayName } from '../../utils/roleDisplay';
import { formatSinDisplay } from '../../utils/applicantWatchlist';
import { buildApprovalWorkspacePath } from '../../utils/approvalWorkspaceEntry';
import { formatCurrencyDisplay } from '../../utils/currencyFormat';
import {
    SLA_DEFAULT_DAYS,
    computeApplicationSlaMeta,
    isEligibilityComplete,
    isEligibilityPending,
} from '../../utils/applicationSla';
import {
    buildApplicationStatusInfo,
    getApplicationAwaitingReasonLabel,
} from '../../utils/applicationStatus';
import {
    buildAssignedStaffProfileAliases,
    resolveAssignedStaffProfileId,
} from '../../utils/assignmentIdentity';
import ProgramAdminWorkQueueWidget, { PROGRAM_ADMIN_BUCKETS, PROGRAM_ADMIN_SAMPLE_ITEMS } from './widgets/ProgramAdminWorkQueueWidget';
import IsetCoordinatorWorkQueueWidget, { ISET_COORDINATOR_BUCKETS, ISET_COORDINATOR_SAMPLE_ITEMS } from './widgets/IsetCoordinatorWorkQueueWidget';
import WorkQueueItemsTableWidget from './widgets/WorkQueueItemsTableWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import MyWatchlistWidget from './widgets/MyWatchlistWidget';
import DevTaskTrackerWidget from './widgets/DevTaskTrackerWidget';
import MetricsWidget from './widgets/MetricsWidget';
import SystemAdminOperationsSnapshotWidget from './widgets/SystemAdminOperationsSnapshotWidget';
import SystemAdminAwsEnvironmentStatusWidget from './widgets/SystemAdminAwsEnvironmentStatusWidget';
import SystemAdminUsersAccessAlertsWidget from './widgets/SystemAdminUsersAccessAlertsWidget';
import SystemAdminFeedbackQueueWidget from './widgets/SystemAdminFeedbackQueueWidget.jsx';
import buildInfo from '../../generated/buildInfo';
import {
    buildPendingCompletionApplicationWorkspacePath,
    buildPendingCompletionApplicationSummary,
    isPendingCompletionApplicationRow,
} from './homeQueueCompletion';

const parseDashboardAmount = value => {
    if (value === null || typeof value === 'undefined' || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const parsed = Number(String(value).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
};

const formatSignedCurrencyDisplay = value => {
    const amount = parseDashboardAmount(value);
    if (amount === null) return '';
    const absoluteDisplay = formatCurrencyDisplay(Math.abs(amount));
    if (amount > 0) return `+${absoluteDisplay}`;
    if (amount < 0) return `-${absoluteDisplay}`;
    return formatCurrencyDisplay(0);
};

const resolveRevisionAmendmentSummary = row => {
    const approvalRequestType = row?.approvalRequestType || row?.approval_request_type || null;
    if (approvalRequestType !== 'revised_intervention') {
        return null;
    }
    const netChange = parseDashboardAmount(row?.revisionNetChange ?? row?.revision_net_change);
    const revisedTotal = parseDashboardAmount(
        row?.revisionRevisedCostTotal ??
        row?.revision_revised_cost_total ??
        row?.intervention_cost_total
    );
    if (netChange === null || revisedTotal === null) {
        return null;
    }
    return `Net change ${formatSignedCurrencyDisplay(netChange)} · Revised total ${formatCurrencyDisplay(revisedTotal)}`;
};

const buildApprovalInterventionBreakdownContent = (row, options = {}) => {
    const { showRevisionAmendmentSummary = false } = options;
    const approvalRequestTypeLabel =
        row?.approvalRequestTypeLabel ||
        row?.approval_request_type_label ||
        null;
    const revisionAmendmentSummary = showRevisionAmendmentSummary
        ? resolveRevisionAmendmentSummary(row)
        : null;
    const groups = Array.isArray(row?.interventionGroups)
        ? row.interventionGroups
        : Array.isArray(row?.intervention_groups)
            ? row.intervention_groups
            : [];
    const normalizedGroups = groups
        .map(group => {
            if (!group || typeof group !== 'object') {
                return null;
            }
            const paymentItems = Array.isArray(group.paymentItems)
                ? group.paymentItems
                : Array.isArray(group.payment_items)
                    ? group.payment_items
                    : [];
            const fundedItems = paymentItems
                .filter(item => Number.isFinite(Number(item?.amount)) && Number(item.amount) > 0)
                .map(item => ({
                    key: item.code || item.label || item.paymentType || item.payment_type || '',
                    label: item.label || item.paymentTypeLabel || item.payment_type_label || item.paymentType || item.payment_type || '',
                    amount: Number(item.amount),
                }))
                .filter(item => item.label);
            if (!fundedItems.length) {
                return null;
            }
            return {
                key: group.code || group.label || '',
                label: group.label || group.interventionLabel || group.intervention_label || 'Intervention',
                paymentItems: fundedItems,
            };
        })
        .filter(Boolean);
    if (!approvalRequestTypeLabel && !revisionAmendmentSummary && !normalizedGroups.length) {
        return null;
    }
    return (
        <SpaceBetween size="xxs">
            {approvalRequestTypeLabel ? (
                <Box variant="small" color="text-body-secondary">
                    {approvalRequestTypeLabel}
                </Box>
            ) : null}
            {revisionAmendmentSummary ? (
                <Box variant="small" color="text-body-secondary">
                    {revisionAmendmentSummary}
                </Box>
            ) : null}
            {normalizedGroups.map((group, groupIndex) => (
                <Box key={group.key || `${group.label}-${groupIndex}`} variant="small" color="text-body-secondary">
                    <Box variant="small" color="text-body-secondary">{group.label}</Box>
                    <SpaceBetween size="xxs">
                        {group.paymentItems.map((item, itemIndex) => (
                            <Box
                                key={item.key || `${item.label}-${itemIndex}`}
                                variant="small"
                                color="text-body-secondary"
                                margin={{ left: 's' }}
                            >
                                {item.label}: {formatCurrencyDisplay(item.amount)}
                            </Box>
                        ))}
                    </SpaceBetween>
                </Box>
            ))}
        </SpaceBetween>
    );
};

const WIDGET_REGISTRY = {
    'program-admin-work-queue': {
        id: 'program-admin-work-queue',
        component: ProgramAdminWorkQueueWidget,
        title: 'Work Queue',
        description: 'Combined application and case queues (role-scoped).',
        defaultRowSpan: 16,
        defaultColumnSpan: 1
    },
    'iset-coordinator-work-queue': {
        id: 'iset-coordinator-work-queue',
        component: IsetCoordinatorWorkQueueWidget,
        title: 'Work Queue (ISET Coordinator)',
        description: 'Scaffolded queues for ISET Coordinators.',
        defaultRowSpan: 16,
        defaultColumnSpan: 1
    },
    'work-queue-items-table': {
        id: 'work-queue-items-table',
        component: WorkQueueItemsTableWidget,
        title: 'Queue Items',
        description: 'Lists items for the selected work queue with adaptive columns.',
        defaultRowSpan: 5,
        defaultColumnSpan: 3
    },
    'recent-activity': {
        id: 'recent-activity',
        component: RecentActivityWidget,
        title: 'Recent Activity',
        description: 'Most recent submissions, assignments, and status changes.',
        defaultRowSpan: 6,
        defaultColumnSpan: 2
    },
    'my-watchlist': {
        id: 'my-watchlist',
        component: MyWatchlistWidget,
        title: 'My Tagged Applications',
        description: 'Applicants you tag appear here, and you will receive notifications as if you were the assigned Case Manager.',
        defaultRowSpan: 5,
        defaultColumnSpan: 3
    },
    'metrics': {
        id: 'metrics',
        component: MetricsWidget,
        title: 'Metrics',
        description: 'Weekly, monthly, quarterly, and yearly activity snapshot.',
        defaultRowSpan: 6,
        defaultColumnSpan: 1
    },
    'system-admin-operations-snapshot': {
        id: 'system-admin-operations-snapshot',
        component: SystemAdminOperationsSnapshotWidget,
        title: 'Operations Snapshot',
        description: 'System Administrator operational backlog and exception counts.',
        defaultRowSpan: 5,
        defaultColumnSpan: 4
    },
    'system-admin-aws-environment-status': {
        id: 'system-admin-aws-environment-status',
        component: SystemAdminAwsEnvironmentStatusWidget,
        title: 'AWS Environment Status',
        description: 'System Administrator live AWS service checks for the active environment.',
        defaultRowSpan: 8,
        defaultColumnSpan: 4
    },
    'system-admin-users-access-alerts': {
        id: 'system-admin-users-access-alerts',
        component: SystemAdminUsersAccessAlertsWidget,
        title: 'Users & Access Alerts',
        description: 'System Administrator user-access risks and applicant activation backlog.',
        defaultRowSpan: 6,
        defaultColumnSpan: 4
    },
    'system-admin-feedback-queue': {
        id: 'system-admin-feedback-queue',
        component: SystemAdminFeedbackQueueWidget,
        title: 'Bugs and Change Requests',
        description: 'Triage queue for internal bug reports and change requests.',
        defaultRowSpan: 8,
        defaultColumnSpan: 4
    },
    'dev-task-tracker': {
        id: 'dev-task-tracker',
        component: DevTaskTrackerWidget,
        title: 'Development Tracker',
        description: 'Track internal development tasks. Visible to System Administrators.',
        defaultRowSpan: 6,
        defaultColumnSpan: 4
    },
};

const STORAGE_PREFIX = 'admin-home-layout-v7';
const SYSTEM_ADMIN_STORAGE_PREFIX = 'admin-home-layout-v11';
const ISET_COORDINATOR_EI_ELIGIBILITY_FILTER = ['submitted', 'in_review', 'docs_requested', 'closure_notice'].join(',');
const ISET_COORDINATOR_READY_TO_ASSESS_FILTER = ['submitted', 'in_review'].join(',');
const ISET_COORDINATOR_APPROVALS_FILTER = ['pending_approval'].join(',');
const ACTIVE_APPLICATION_QUERY = 'excludeTerminal=1&limit=200&offset=0';
const PENDING_COMPLETION_APPLICATION_QUERY = 'statusGroup=decision_recorded&limit=200&offset=0';
const ISET_COORDINATOR_MILESTONE_WINDOW_DAYS = 14;
const ISET_COORDINATOR_MISSING_DOCS_FILTER = [
    'docs_requested',
    'docs requested',
    'action_required',
    'action required',
    'action required (docs requested)',
    'closure_notice',
    'closure notice',
    'pending info',
    'pending information',
    'info requested',
    'information requested'
].join(',');
const ISET_COORDINATOR_ON_HOLD_FILTER = [
    'on_hold',
    'on hold'
].join(',');
const NWAC_ADMIN_CLIENT_CASES_BUCKET = {
    id: 'all-client-cases',
    label: 'All Cases',
    description: 'All open client cases across the portfolio, including files with no active plan.'
};
const REGIONAL_MANAGER_OPEN_APPLICATIONS_BUCKET = {
    id: 'regional-open-applications',
    label: 'Applications in My Region',
    description: 'All non-terminal applications in your assigned provinces and territories.'
};
const REGIONAL_MANAGER_CLIENT_CASES_BUCKET = {
    id: 'regional-client-cases',
    label: 'Clients in My Region',
    description: 'Open client cases in your regional portfolio, including files with no active plan.'
};
const REGIONAL_MANAGER_PENDING_REVIEW_BUCKET = {
    id: 'pending-review',
    label: 'Pending Review',
    description: 'Submitted assessments waiting for Regional Manager review or follow-up after the Decision Maker requested changes.'
};
const SHARED_PROGRAM_ADMIN_PIPELINE_BUCKET_IDS = Object.freeze([
    'new-applications',
    'pending-assessment',
    'in-assessment',
    'on-hold',
    'pending-review',
    'pending-completion',
]);
const NWAC_ADMIN_PIPELINE_BUCKET_IDS = Object.freeze([
    'new-applications',
    'in-assessment',
    'on-hold',
    'pending-decision',
    'pending-completion',
]);
const PROGRAM_ADMIN_EXCEPTION_BUCKET_IDS = Object.freeze([
    'unresolved-conflicts',
    'exceptions-escalations',
    'payments-issues',
    'ilmp-issues',
    'overdue',
]);
const WORK_QUEUE_IN_ASSESSMENT_FILTER = [
    'in_review',
    'docs_requested',
    'docs requested',
    'action_required',
    'action required',
    'action required (docs requested)',
    'closure_notice',
    'closure notice',
    'pending info',
    'pending information',
    'info requested',
    'information requested'
].join(',');
const WORK_QUEUE_ON_HOLD_FILTER = [
    'on_hold',
    'on hold'
].join(',');

const buildDevHeaders = (role) => {
    return { Accept: 'application/json' };
};

const mapPendingCompletionInterventionItems = (items = [], bucketId = 'pending-completion') =>
    (Array.isArray(items) ? items : []).map((row, idx) => {
        const tracking =
            row.trackingId ||
            row.tracking_id ||
            row.caseNumber ||
            row.case_number ||
            row.caseId ||
            row.case_id ||
            `INTC-${idx}`;
        const applicantName =
            row.applicant_name ||
            row.applicantName ||
            tracking ||
            'Applicant';
        const interventionLabel =
            row.intervention_label ||
            row.interventionLabel ||
            row.intervention_title ||
            row.interventionTitle ||
            null;
        const interventionId = row.interventionId || row.intervention_id || null;
        const actionPlanId = row.actionPlanId || row.action_plan_id || null;
        const caseId = row.caseId || row.case_id || null;
        const approvalRequestType = row.approval_request_type || row.approvalRequestType || 'new_intervention';
        const isRevision = approvalRequestType === 'revised_intervention';
        return {
            id: `intervention-completion-${interventionId || row.proposalId || row.proposal_id || caseId || idx}`,
            title: applicantName,
            trackingId: tracking,
            titleSecondaryText: interventionLabel || row.approval_request_type_label || row.approvalRequestTypeLabel || '',
            case_id: caseId,
            application_id: row.applicationId || row.application_id || null,
            interventionId,
            actionPlanId,
            bucketId,
            type: 'InterventionCompletion',
            applicant: applicantName,
            applicant_name: applicantName,
            region: row.address_province || '—',
            address_province: row.address_province || null,
            owner: row.owner || row.assigned_user_email || 'Unassigned',
            ...buildAssignedStaffProfileAliases(row),
            status: row.review_status || row.status || 'approved',
            approvalRequestType,
            approvalRequestTypeLabel:
                row.approval_request_type_label ||
                row.approvalRequestTypeLabel ||
                (isRevision ? 'Approved intervention revision' : 'Approved intervention proposal'),
            review_status: row.review_status || 'approved',
            delivery_status: row.delivery_status || null,
            intervention_effective_status: row.intervention_effective_status || 'approved',
            intervention_code: row.intervention_code || null,
            intervention_label: interventionLabel,
            intervention_cost_total: row.intervention_cost_total || null,
            intervention_start_date: row.intervention_start_date || null,
            assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
            budgetPotCode: row.budgetPotCode || row.budget_pot_code || null,
            budget_pot_code: row.budgetPotCode || row.budget_pot_code || null,
            approvalQueuedAt: row.approvedAt || row.approved_at || row.submittedAt || row.submitted_at || null,
            dueDate: null,
            submittedAt: row.approvedAt || row.approved_at || row.submittedAt || row.submitted_at || null,
            summary: isRevision
                ? 'Approved intervention revision is waiting for the client approval letter.'
                : 'Approved intervention proposal is waiting for the client approval letter.',
            workspacePath: caseId
                ? buildApprovalWorkspacePath({
                    basePath: `/cases/${caseId}`,
                    approvalType: 'intervention',
                    step: 'communication',
                    interventionId,
                    planId: actionPlanId
                })
                : '/case-assignment-dashboard'
        };
    });

const MS_PER_DAY = 86400000;

const toDateOnly = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatMilestoneLabel = (kind, diffDays) => {
    if (diffDays > 0) {
        return `${kind} due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    }
    if (diffDays === 0) {
        return `${kind} due today`;
    }
    const overdue = Math.abs(diffDays);
    return `${kind} ${overdue} day${overdue === 1 ? '' : 's'} overdue`;
};

const resolveMilestoneBadgeColor = (diffDays) => {
    if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        if (overdueDays > 28) return 'severity-critical';
        if (overdueDays >= 15) return 'severity-high';
        if (overdueDays >= 7) return 'severity-medium';
        if (overdueDays >= 3) return 'severity-low';
        return 'grey';
    }
    if (diffDays === 0) return 'severity-medium';
    if (diffDays <= 3) return 'severity-low';
    return 'green';
};

const resolveInterventionMilestone = (startValue, endValue) => {
    const startDate = toDateOnly(startValue);
    const endDate = toDateOnly(endValue);
    if (!startDate && !endDate) return null;
    const today = toDateOnly(new Date());
    let kind = null;
    let date = null;
    if (startDate && (!endDate || (today && today <= startDate))) {
        kind = 'Start';
        date = startDate;
    } else {
        kind = 'End';
        date = endDate || startDate;
    }
    if (!date || !today) return null;
    const diffDays = Math.floor((date.getTime() - today.getTime()) / MS_PER_DAY);
    return {
        kind,
        date,
        diffDays,
        label: formatMilestoneLabel(kind, diffDays),
        badgeColor: resolveMilestoneBadgeColor(diffDays),
        inWindow: diffDays <= ISET_COORDINATOR_MILESTONE_WINDOW_DAYS
    };
};

const buildApplicationQueueStatusFields = (row, fallbackStatus = 'submitted') => {
    const statusInfo = buildApplicationStatusInfo({
        applicationStatus:
            row?.application_status ||
            row?.applicationStatus ||
            row?.status ||
            fallbackStatus,
        applicationLifecycleStatus: row?.application_lifecycle_status ?? row?.applicationLifecycleStatus ?? null,
        caseStatus: row?.case_status || row?.caseStatus || null,
        caseId: row?.case_id ?? row?.caseId ?? null,
        assignedUserId: resolveAssignedStaffProfileId(row),
        assessmentEligibility: row?.assessment_esdc_eligibility ?? row?.assessmentEsdcEligibility ?? null,
        decisionOutcome: row?.decision_outcome ?? row?.decisionOutcome ?? null,
        awaitingReason: row?.application_awaiting_reason ?? row?.applicationAwaitingReason ?? null,
        closureReason: row?.application_closure_reason ?? row?.applicationClosureReason ?? null,
        reviewStatus: row?.review_status ?? row?.reviewStatus ?? null,
        type: row?.type,
    });

    const rawStatus = statusInfo.rawStatus || fallbackStatus;
    return {
        status: rawStatus,
        application_status: rawStatus,
        application_lifecycle_status: row?.application_lifecycle_status ?? row?.applicationLifecycleStatus ?? null,
        decision_outcome: row?.decision_outcome ?? row?.decisionOutcome ?? statusInfo.decisionOutcome ?? null,
        application_awaiting_reason: row?.application_awaiting_reason ?? row?.applicationAwaitingReason ?? null,
        application_closure_reason: row?.application_closure_reason ?? row?.applicationClosureReason ?? null,
    };
};

const resolveApplicationWorkspacePath = (row, fallbackPath = '/case-assignment-dashboard') => {
    const caseId = row?.case_id || row?.caseId || null;
    if (!caseId) {
        return fallbackPath;
    }
    const basePath = `/application-case/${caseId}`;
    if (isPendingCompletionApplicationRow(row)) {
        return buildPendingCompletionApplicationWorkspacePath(basePath, row);
    }
    return basePath;
};

const getApplicationQueueRawStatus = (row, fallbackStatus = 'submitted') =>
    buildApplicationQueueStatusFields(row, fallbackStatus).status;

const isAssignedApplicationRow = row => {
    const assignedId = resolveAssignedStaffProfileId(row);
    if (Number(assignedId) > 0) return true;
    const assignedEmail = String(row?.assigned_user_email ?? row?.assignedUserEmail ?? '').trim();
    return Boolean(assignedEmail);
};

const resolveApplicationPipelineBucketId = row => {
    const rawStatus = getApplicationQueueRawStatus(row, 'submitted');
    if (rawStatus === 'submitted') {
        if (isAssignedApplicationRow(row) && isEligibilityPending(row?.assessment_esdc_eligibility ?? row?.assessmentEsdcEligibility ?? null)) {
            return 'pending-assessment';
        }
        return 'new-applications';
    }
    if (rawStatus === 'in_review' || rawStatus === 'awaiting_applicant') {
        return 'in-assessment';
    }
    if (rawStatus === 'on_hold') {
        return 'on-hold';
    }
    if (rawStatus === 'pending_decision') {
        return 'pending-decision';
    }
    return null;
};

const filterWidgetsForRole = (role) => {
    const allowed = { ...WIDGET_REGISTRY };
    const isIsetCoordinator = role === 'ISET Coordinator';
    delete allowed['dev-task-tracker'];
    if (role !== 'System Administrator') {
        delete allowed['system-admin-operations-snapshot'];
        delete allowed['system-admin-aws-environment-status'];
        delete allowed['system-admin-users-access-alerts'];
        delete allowed['system-admin-feedback-queue'];
    }
    if (role === 'System Administrator') {
        delete allowed['metrics'];
    }
    const isWorkQueueRole = role === 'NWAC Administrator' || role === 'Regional Manager';
    if (!isWorkQueueRole) {
        delete allowed['program-admin-work-queue'];
        if (!isIsetCoordinator) {
            delete allowed['work-queue-items-table'];
        }
    }
    if (!isIsetCoordinator) {
        delete allowed['iset-coordinator-work-queue'];
    }
    return allowed;
};

const buildDefaultLayout = (role) => {
    if (role === 'System Administrator') {
        return [
            { id: 'system-admin-operations-snapshot', rowSpan: 5, columnSpan: 4 },
            { id: 'system-admin-feedback-queue', rowSpan: 8, columnSpan: 4 },
            { id: 'system-admin-aws-environment-status', rowSpan: 8, columnSpan: 4 },
            { id: 'system-admin-users-access-alerts', rowSpan: 6, columnSpan: 4 },
            { id: 'recent-activity', rowSpan: 4, columnSpan: 2 },
            { id: 'my-watchlist', rowSpan: 4, columnSpan: 2 }
        ];
    }

    const layout = [];
    if (role === 'NWAC Administrator' || role === 'Regional Manager') {
        layout.push({ id: 'program-admin-work-queue', rowSpan: 16, columnSpan: 1 });
    } else if (role === 'ISET Coordinator') {
        layout.push({ id: 'iset-coordinator-work-queue', rowSpan: 16, columnSpan: 1 });
    }

    layout.push(
        { id: 'work-queue-items-table', rowSpan: 5, columnSpan: 3 },
        { id: 'my-watchlist', rowSpan: 5, columnSpan: 3 },
        { id: 'recent-activity', rowSpan: 6, columnSpan: 2 },
        { id: 'metrics', rowSpan: 6, columnSpan: 1 }
    );

    return layout;
};

const exportLayout = (items = [], allowed = {}) =>
    items
        .filter((item) => item && allowed[item.id])
        .map(({ id, rowSpan, columnSpan, columnOffset }) => ({
            id,
            rowSpan,
            columnSpan,
            columnOffset
        }));

const toBoardItems = (layout = [], allowed = {}) =>
    layout
        .filter((entry) => entry && allowed[entry.id])
        .map((entry) => {
            const def = allowed[entry.id];
            return {
                id: def.id,
                rowSpan: entry.rowSpan ?? def.defaultRowSpan,
                columnSpan: entry.columnSpan ?? def.defaultColumnSpan,
                columnOffset: entry.columnOffset,
                data: { title: def.title, description: def.description }
            };
        });

const computePaletteItems = (layout = [], allowed = {}) =>
    Object.values(allowed)
        .filter((def) => !layout.some((item) => item.id === def.id))
        .map((def) => ({
            id: def.id,
            data: { title: def.title, description: def.description }
        }));

const areLayoutsEqual = (a = [], b = []) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const left = a[i];
        const right = b[i];
        if (!left || !right || left.id !== right.id ||
            (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
            (left.columnSpan ?? null) !== (right.columnSpan ?? null) ||
            (left.columnOffset ?? null) !== (right.columnOffset ?? null)) {
            return false;
        }
    }
    return true;
};

const loadLayoutFromStorage = (storageKey, allowed = {}) => {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        const filtered = parsed.filter(entry => entry && allowed[entry.id]);
        return filtered.length ? filtered : null;
    } catch (_) {
        return null;
    }
};

const boardI18nStrings = {
    liveAnnouncementDndStarted: operationType =>
        operationType === 'resize' ? 'Resizing' : 'Dragging',
    liveAnnouncementDndItemReordered: operation => {
        const columns = `column ${operation.placement.x + 1}`;
        const rows = `row ${operation.placement.y + 1}`;
        return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
    },
    liveAnnouncementDndItemResized: operation => {
        const sizeAnnouncement =
            operation.direction === 'horizontal'
                ? `columns ${operation.placement.width}`
                : `rows ${operation.placement.height}`;
        return `Item resized to ${sizeAnnouncement}.`;
    },
    liveAnnouncementDndItemInserted: operation => {
        const columns = `column ${operation.placement.x + 1}`;
        const rows = `row ${operation.placement.y + 1}`;
        return `Item inserted to ${columns}, ${rows}.`;
    },
    liveAnnouncementDndCommitted: operationType => `${operationType} committed`,
    liveAnnouncementDndDiscarded: operationType => `${operationType} discarded`,
    liveAnnouncementItemRemoved: operation => `Removed item ${operation.item?.data?.title || ''}.`,
    navigationAriaLabel: 'Board navigation',
    navigationAriaDescription: 'Use arrow keys to move between board items.',
    navigationItemAriaLabel: item => (item ? item.data?.title || 'Board item' : 'Empty slot')
};

const buildStampLabel = (() => {
    if (!buildInfo) {
        return '';
    }
    const gitLabel = buildInfo.gitShort
        ? (buildInfo.gitDirty ? `${buildInfo.gitShort}-dirty` : buildInfo.gitShort)
        : '';
    if (buildInfo.releaseId) {
        return gitLabel ? `Release ${buildInfo.releaseId} | ${gitLabel}` : `Release ${buildInfo.releaseId}`;
    }
    if (buildInfo.buildTarget) {
        return gitLabel ? `Build ${buildInfo.buildTarget} | ${gitLabel}` : `Build ${buildInfo.buildTarget}`;
    }
    if (gitLabel) {
        return `Build ${gitLabel}`;
    }
    return '';
})();

const AdminDashboard = ({ setSplitPanelOpen, setAvailableItems, toggleHelpPanel }) => {
    const { isAuthenticated, role: authenticatedRole, signIn } = useAuth();
    const role = authenticatedRole || 'Guest';
    const { userId: currentUserId, staffProfileId: currentStaffProfileId, email: currentUserEmail } = useCurrentUser();
    const authRefreshKey = useMemo(
        () => [role, currentUserId || '', currentUserEmail || ''].join(':'),
        [role, currentUserEmail, currentUserId]
    );
    const isWorkQueueRole = role === 'NWAC Administrator' || role === 'Regional Manager';
    const isIsetCoordinatorRole = role === 'ISET Coordinator';
    const isNwacAdminRole = role === 'NWAC Administrator';
    const isRegionalCoordinatorRole = role === 'Regional Manager';

    const workQueueBuckets = useMemo(() => {
        if (!isWorkQueueRole) return [];
        const bucketLookup = new Map(
            [...PROGRAM_ADMIN_BUCKETS, REGIONAL_MANAGER_PENDING_REVIEW_BUCKET].map(bucket => [bucket.id, bucket])
        );
        const pipelineBucketIds = isNwacAdminRole
            ? NWAC_ADMIN_PIPELINE_BUCKET_IDS
            : SHARED_PROGRAM_ADMIN_PIPELINE_BUCKET_IDS;
        const pipelineBuckets = pipelineBucketIds
            .map(id => bucketLookup.get(id))
            .filter(Boolean);
        const exceptionBuckets = PROGRAM_ADMIN_EXCEPTION_BUCKET_IDS
            .map(id => bucketLookup.get(id))
            .filter(Boolean);
        if (isRegionalCoordinatorRole) {
            const regionalPipelineBuckets = pipelineBuckets.map(bucket => (
                bucket?.id === 'pending-assessment'
                    ? {
                        ...bucket,
                        label: 'EI Check Needed',
                        description: 'Assigned applications still waiting for EI status verification before assessment can begin.'
                    }
                    : bucket
            ));
            const myBucket = ISET_COORDINATOR_BUCKETS.find(bucket => bucket.id === 'my-new-applications') || null;
            return [
                REGIONAL_MANAGER_OPEN_APPLICATIONS_BUCKET,
                ...(myBucket ? [myBucket] : []),
                ...regionalPipelineBuckets,
                REGIONAL_MANAGER_CLIENT_CASES_BUCKET,
                ...exceptionBuckets,
            ];
        }
        if (isNwacAdminRole) {
            return [
                ...pipelineBuckets,
                NWAC_ADMIN_CLIENT_CASES_BUCKET,
                ...exceptionBuckets,
            ];
        }
        return PROGRAM_ADMIN_BUCKETS;
    }, [isWorkQueueRole, isNwacAdminRole, isRegionalCoordinatorRole]);

    const initialItems =
        isIsetCoordinatorRole ? ISET_COORDINATOR_SAMPLE_ITEMS : PROGRAM_ADMIN_SAMPLE_ITEMS;
    const initialBucket = isIsetCoordinatorRole ? ISET_COORDINATOR_BUCKETS[0]?.id : workQueueBuckets[0]?.id;
    const [programAdminItems, setProgramAdminItems] = useState(() => initialItems);
    const [programAdminBucketId, setProgramAdminBucketId] = useState(() => initialBucket || null);
    const [programAdminSelectedItemId, setProgramAdminSelectedItemId] = useState(() => {
        const firstItem = initialItems.find(item => item.bucketId === (initialBucket || undefined));
        return firstItem?.id || null;
    });
    const [programAdminCounts, setProgramAdminCounts] = useState(() => ({}));
    const [programAdminRefresh, setProgramAdminRefresh] = useState(0);
    const bucketDefinitions = useMemo(() => {
        if (isWorkQueueRole) return workQueueBuckets;
        if (isIsetCoordinatorRole) return ISET_COORDINATOR_BUCKETS;
        return [];
    }, [isWorkQueueRole, isIsetCoordinatorRole, workQueueBuckets]);

    useEffect(() => {
        if (isWorkQueueRole) {
            setProgramAdminItems(PROGRAM_ADMIN_SAMPLE_ITEMS);
            const first = workQueueBuckets[0]?.id || null;
            setProgramAdminBucketId(first);
            const firstItem = PROGRAM_ADMIN_SAMPLE_ITEMS.find(item => item.bucketId === first);
            setProgramAdminSelectedItemId(firstItem?.id || null);
            setProgramAdminCounts({});
            return;
        }
        if (isIsetCoordinatorRole) {
            setProgramAdminItems(ISET_COORDINATOR_SAMPLE_ITEMS);
            const first = ISET_COORDINATOR_BUCKETS[0]?.id || null;
            setProgramAdminBucketId(first);
            const firstItem = ISET_COORDINATOR_SAMPLE_ITEMS.find(item => item.bucketId === first);
            setProgramAdminSelectedItemId(firstItem?.id || null);
            setProgramAdminCounts({});
            return;
        }
        setProgramAdminItems([]);
        setProgramAdminBucketId(null);
        setProgramAdminSelectedItemId(null);
        setProgramAdminCounts({});
    }, [isWorkQueueRole, isIsetCoordinatorRole, workQueueBuckets]);

    const allowedWidgets = useMemo(() => filterWidgetsForRole(role), [role]);
    const storageKey = useMemo(() => {
        const prefix = role === 'System Administrator' ? SYSTEM_ADMIN_STORAGE_PREFIX : STORAGE_PREFIX;
        return `${prefix}.${role || 'guest'}`;
    }, [role]);
    const defaultLayout = useMemo(() => buildDefaultLayout(role), [role]);
    const [layout, setLayout] = useState(() => loadLayoutFromStorage(storageKey, allowedWidgets) ?? defaultLayout);
    const metricDrilldownAbortRef = useRef(null);
    const [metricDrilldown, setMetricDrilldown] = useState(null);
    const boardItems = useMemo(() => toBoardItems(layout, allowedWidgets), [layout, allowedWidgets]);
    const paletteItems = useMemo(() => computePaletteItems(layout, allowedWidgets), [layout, allowedWidgets]);
    const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

    useEffect(() => {
        const stored = loadLayoutFromStorage(storageKey, allowedWidgets);
        setLayout(stored ?? defaultLayout);
        paletteSignatureRef.current = JSON.stringify(computePaletteItems(stored ?? defaultLayout, allowedWidgets));
    }, [storageKey, allowedWidgets, defaultLayout]);

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(layout));
        } catch (_) {}
    }, [layout, storageKey]);

    const cancelMetricDrilldownRequest = useCallback(() => {
        if (metricDrilldownAbortRef.current) {
            metricDrilldownAbortRef.current.abort();
            metricDrilldownAbortRef.current = null;
        }
    }, []);

    const clearMetricDrilldown = useCallback(() => {
        cancelMetricDrilldownRequest();
        setMetricDrilldown(null);
    }, [cancelMetricDrilldownRequest]);

    useEffect(() => {
        return () => {
            cancelMetricDrilldownRequest();
        };
    }, [cancelMetricDrilldownRequest]);

    useEffect(() => {
        clearMetricDrilldown();
    }, [authRefreshKey, clearMetricDrilldown]);

    useEffect(() => {
        const signature = JSON.stringify(paletteItems);
        if (signature !== paletteSignatureRef.current) {
            paletteSignatureRef.current = signature;
            if (typeof setAvailableItems === 'function') {
                try { setAvailableItems(paletteItems); } catch (_) {}
            }
        }
    }, [paletteItems, setAvailableItems]);

    const handleProgramAdminBucketSelect = useCallback((bucketId) => {
        if (!bucketId) return;
        clearMetricDrilldown();
        setProgramAdminBucketId(bucketId);
        const nextItem = programAdminItems.find(item => item.bucketId === bucketId);
        setProgramAdminSelectedItemId(nextItem?.id || null);
    }, [clearMetricDrilldown, programAdminItems]);

    const handleProgramAdminItemSelect = useCallback((itemId) => {
        setProgramAdminSelectedItemId(itemId || null);
    }, []);

    const handleProgramAdminRefresh = useCallback(() => {
        setProgramAdminRefresh(v => v + 1);
    }, []);

    const handleMetricDrilldownOpen = useCallback(async ({ metricId, metricLabel, period }) => {
        if (!metricId || !period || !allowedWidgets['work-queue-items-table']) {
            return;
        }

        setLayout(current => {
            if (current.some(item => item.id === 'work-queue-items-table')) {
                return current;
            }
            return [
                ...current,
                {
                    id: 'work-queue-items-table',
                    rowSpan: WIDGET_REGISTRY['work-queue-items-table'].defaultRowSpan,
                    columnSpan: WIDGET_REGISTRY['work-queue-items-table'].defaultColumnSpan
                }
            ];
        });

        cancelMetricDrilldownRequest();
        const controller = new AbortController();
        metricDrilldownAbortRef.current = controller;

        setMetricDrilldown({
            metricId,
            metricLabel,
            loading: true,
            error: '',
            items: [],
            period: { key: period }
        });

        try {
            const response = await apiFetch(
                `/api/dashboard/metrics/details?metricId=${encodeURIComponent(metricId)}&period=${encodeURIComponent(period)}`,
                { signal: controller.signal }
            );
            if (!response.ok) {
                let errorPayload = null;
                try {
                    errorPayload = await response.json();
                } catch (_) {
                    errorPayload = null;
                }
                throw new Error(errorPayload?.message || 'Failed to load metric results.');
            }
            const payload = await response.json();
            if (metricDrilldownAbortRef.current !== controller) {
                return;
            }
            setMetricDrilldown({
                ...payload,
                loading: false,
                error: ''
            });
        } catch (err) {
            if (err?.name === 'AbortError') {
                return;
            }
            if (metricDrilldownAbortRef.current !== controller) {
                return;
            }
            setMetricDrilldown(current => ({
                ...(current || {
                    metricId,
                    metricLabel,
                    period: { key: period },
                    items: []
                }),
                loading: false,
                error: err?.message || 'Failed to load metric results.'
            }));
        } finally {
            if (metricDrilldownAbortRef.current === controller) {
                metricDrilldownAbortRef.current = null;
            }
        }
    }, [allowedWidgets, cancelMetricDrilldownRequest]);

    const coordinatorMissingDocsParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_MISSING_DOCS_FILTER),
        []
    );
    const coordinatorOnHoldParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_ON_HOLD_FILTER),
        []
    );
    const coordinatorEiEligibilityParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_EI_ELIGIBILITY_FILTER),
        []
    );
    const coordinatorReadyToAssessParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_READY_TO_ASSESS_FILTER),
        []
    );
    const coordinatorApprovalsParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_APPROVALS_FILTER),
        []
    );
    const coordinatorMilestoneWindowParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_MILESTONE_WINDOW_DAYS),
        []
    );

    const fetchEscalations = useCallback(async () => {
        try {
            const res = await apiFetch('/api/escalations');
            if (!res.ok) {
                throw new Error(`Request failed: ${res.status}`);
            }
            const body = await res.json();
            const items = Array.isArray(body?.items) ? body.items : [];
            const mapped = items.map((row, idx) => {
                const tracking = row.tracking_id || row.application_id || `ESC-${row.id || idx}`;
                const noteParts = [];
                const seenNotes = new Set();
                const addNote = (value) => {
                    if (typeof value !== 'string') return;
                    const trimmed = value.trim();
                    if (!trimmed || seenNotes.has(trimmed)) return;
                    seenNotes.add(trimmed);
                    noteParts.push(trimmed);
                };
                if (Array.isArray(row.notes_list)) {
                    row.notes_list.forEach(addNote);
                } else if (typeof row.notes === 'string') {
                    addNote(row.notes);
                }
                addNote(row.reason);
                addNote(row.details);
                addNote(row.last_action_note);
                const notes = noteParts.join(' • ');
                const applicantName = (() => {
                    const preferred = row.submission_preferred_name || row.applicant_name || row.applicant || null;
                    const first = row.submission_first_name || null;
                    const last = row.submission_last_name || null;
                    const full = [first, last].filter(Boolean).join(' ').trim();
                    if (full) return full;
                    return preferred || tracking || 'Applicant';
                })();
                const ownerLabel =
                    row.assigned_user_email ||
                    row.assigned_user_display_name ||
                    (row.current_owner_role
                      ? getRoleDisplayName(row.current_owner_role.toString().replace(/_/g, ' '))
                      : 'NWAC Administrator');
                return {
                    id: `esc-${row.id || idx}`,
                    title: `${tracking} · ${applicantName}`,
                    trackingId: tracking,
                    escalation_id: row.id || null,
                    escalationId: row.id || null,
                    application_id: row.application_id || null,
                    case_id: row.case_id || null,
                    bucketId: 'exceptions-escalations',
                    type: 'Escalation',
                    applicant: applicantName,
                    applicant_name: applicantName,
                    region: row.submission_address_province || row.address_province || row.assigned_user_region_id || row.region || '—',
                    owner: ownerLabel,
                    status: row.state || 'pending_review',
                    disposition: row.disposition || null,
                    dueDate: null,
                    submittedAt: row.created_at || null,
                    summary: notes || row.reason || row.details || row.last_action_note || 'Escalation pending review',
                    notes,
                    notes_list: noteParts,
                    workspacePath: resolveApplicationWorkspacePath(row)
                };
            });
            setProgramAdminItems(current => {
                const withoutEsc = current.filter(item => item.bucketId !== 'exceptions-escalations');
                return [...mapped, ...withoutEsc];
            });
            setProgramAdminCounts(current => ({
                ...current,
                'exceptions-escalations': mapped.length
            }));
            if (mapped.length) {
                setProgramAdminBucketId(bucket => bucket || 'exceptions-escalations');
                setProgramAdminSelectedItemId(current => {
                    if (mapped.some(item => item.id === current)) {
                        return current;
                    }
                    return mapped[0].id;
                });
            }
        } catch (_) {
            // keep existing items on failure
        }
    }, []);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadProgramAdminCounts = async () => {
            try {
                const response = await apiFetch('/api/dashboard/application-work-queue', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (payload && Array.isArray(payload.buckets)) {
                    const nextCounts = {};
                    payload.buckets.forEach(bucket => {
                        if (bucket && bucket.id) {
                            const parsed = Number(bucket.count);
                            nextCounts[bucket.id] = Number.isFinite(parsed) ? parsed : 0;
                        }
                    });
                    setProgramAdminCounts(current => ({
                        ...current,
                        ...nextCounts
                    }));
                }
            } catch (_) {
                // keep existing counts on failure
            }
        };
        loadProgramAdminCounts();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole, isNwacAdminRole]);

    useEffect(() => {
        if (!isNwacAdminRole) {
            return;
        }
        let ignore = false;
        const loadAllClientCases = async () => {
            try {
                const response = await apiFetch('/api/dashboard/all-client-cases?limit=200&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.items)) {
                    throw new Error('Unexpected response format while loading all client cases.');
                }
                const mapped = payload.items.map((row, idx) => {
                    const caseId = row.case_id || row.caseId || row.id || null;
                    const clientName =
                        row.client_name ||
                        row.clientName ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.applicant_name ||
                        row.applicantName ||
                        row.tracking_id ||
                        (caseId ? `Case ${caseId}` : `Client ${idx + 1}`);
                    const nextActionDueAt = row.next_action_due_at || row.nextActionDueAt || null;
                    return {
                        id: caseId ? `all-client-case-${caseId}` : `all-client-case-${idx}`,
                        title: clientName,
                        trackingId: row.tracking_id || row.trackingId || row.case_number || row.caseNumber || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: caseId,
                        bucketId: 'all-client-cases',
                        type: 'Case',
                        applicant: clientName,
                        applicant_name: clientName,
                        region:
                            row.region_name ||
                            row.regionName ||
                            row.region_code ||
                            row.regionCode ||
                            row.owner_region_name ||
                            row.ownerRegionName ||
                            row.owner_region_code ||
                            row.ownerRegionCode ||
                            '—',
                        owner: row.owner_email || row.owner_name || row.ownerName || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        status: row.status || 'Initiated',
                        dueDate: nextActionDueAt,
                        submittedAt: row.opened_at || row.openedAt || row.created_at || row.createdAt || null,
                        updatedAt: row.updated_at || row.updatedAt || row.last_activity_at || row.lastActivityAt || null,
                        summary: 'Open client case across the national portfolio.',
                        workspacePath: caseId ? `/cases/${caseId}` : '/case-assignment-dashboard'
                    };
                });
                const totalCount = Number(payload.totalCount);
                setProgramAdminItems(current => {
                    const nonAllCases = current.filter(item => item.bucketId !== 'all-client-cases');
                    return [...mapped, ...nonAllCases];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'all-client-cases': Number.isFinite(totalCount) ? totalCount : mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'all-client-cases');
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadAllClientCases();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isNwacAdminRole]);

    useEffect(() => {
        if (!isRegionalCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadRegionalManagerOpenApplications = async () => {
            try {
                const response = await apiFetch('/api/applications?excludeTerminal=1&limit=200&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading regional applications.');
                }
                const mapped = payload.rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `regional-open-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'regional-open-applications',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'submitted'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'Non-terminal application in your regional portfolio.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                const totalCount = Number(payload.count);
                setProgramAdminItems(current => {
                    const nonRegional = current.filter(item => item.bucketId !== 'regional-open-applications');
                    return [...mapped, ...nonRegional];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'regional-open-applications': Number.isFinite(totalCount) ? totalCount : mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'regional-open-applications');
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadRegionalManagerOpenApplications();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isRegionalCoordinatorRole]);

    useEffect(() => {
        if (!isRegionalCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadRegionalManagerClientCases = async () => {
            try {
                const response = await apiFetch('/api/dashboard/regional-client-cases?limit=200&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.items)) {
                    throw new Error('Unexpected response format while loading regional client cases.');
                }
                const mapped = payload.items.map((row, idx) => {
                    const caseId = row.case_id || row.caseId || row.id || null;
                    const clientName =
                        row.client_name ||
                        row.clientName ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.applicant_name ||
                        row.applicantName ||
                        row.tracking_id ||
                        (caseId ? `Case ${caseId}` : `Client ${idx + 1}`);
                    const nextActionDueAt = row.next_action_due_at || row.nextActionDueAt || null;
                    return {
                        id: caseId ? `regional-client-case-${caseId}` : `regional-client-case-${idx}`,
                        title: clientName,
                        trackingId: row.tracking_id || row.trackingId || row.case_number || row.caseNumber || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: caseId,
                        bucketId: 'regional-client-cases',
                        type: 'Case',
                        applicant: clientName,
                        applicant_name: clientName,
                        region:
                            row.region_name ||
                            row.regionName ||
                            row.region_code ||
                            row.regionCode ||
                            row.owner_region_name ||
                            row.ownerRegionName ||
                            row.owner_region_code ||
                            row.ownerRegionCode ||
                            '—',
                        owner: row.owner_email || row.owner_name || row.ownerName || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        status: row.status || 'Initiated',
                        dueDate: nextActionDueAt,
                        submittedAt: row.opened_at || row.openedAt || row.created_at || row.createdAt || null,
                        updatedAt: row.updated_at || row.updatedAt || row.last_activity_at || row.lastActivityAt || null,
                        summary: 'Open client case in your regional portfolio.',
                        workspacePath: caseId ? `/cases/${caseId}` : '/case-assignment-dashboard'
                    };
                });
                const totalCount = Number(payload.totalCount);
                setProgramAdminItems(current => {
                    const nonRegionalCases = current.filter(item => item.bucketId !== 'regional-client-cases');
                    return [...mapped, ...nonRegionalCases];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'regional-client-cases': Number.isFinite(totalCount) ? totalCount : mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'regional-client-cases');
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadRegionalManagerClientCases();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isRegionalCoordinatorRole]);

    useEffect(() => {
        if (!isRegionalCoordinatorRole) {
            return;
        }
        const currentStaffProfileIdValue = currentStaffProfileId ? String(currentStaffProfileId) : null;
        const currentUserEmailValue = currentUserEmail ? String(currentUserEmail).toLowerCase() : null;
        if (!currentStaffProfileIdValue && !currentUserEmailValue) {
            setProgramAdminItems(current => current.filter(item => item.bucketId !== 'my-new-applications'));
            setProgramAdminCounts(current => ({
                ...current,
                'my-new-applications': 0
            }));
            return;
        }
        let ignore = false;
        const loadRegionalManagerAssignedApplications = async () => {
            try {
                const response = await apiFetch(`/api/applications?${ACTIVE_APPLICATION_QUERY}`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading regional manager assigned applications.');
                }
                const assignedRows = payload.rows.filter(row => {
                    const assignedId = resolveAssignedStaffProfileId(row);
                    const assignedEmail = row.assigned_user_email || row.assignedUserEmail || null;
                    if (currentStaffProfileIdValue && assignedId && String(assignedId) === currentStaffProfileIdValue) {
                        return true;
                    }
                    if (currentUserEmailValue && assignedEmail && assignedEmail.toLowerCase() === currentUserEmailValue) {
                        return true;
                    }
                    return false;
                });
                const mapped = assignedRows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `assigned-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    const isPendingCompletion = isPendingCompletionApplicationRow(row);
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'my-new-applications',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'submitted'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: isPendingCompletion
                            ? buildPendingCompletionApplicationSummary(row)
                            : submitted ? `Submitted ${submitted}` : 'Assigned application',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                setProgramAdminItems(current => {
                    const nonAssigned = current.filter(item => item.bucketId !== 'my-new-applications');
                    return [...mapped, ...nonAssigned];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'my-new-applications': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'my-new-applications');
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadRegionalManagerAssignedApplications();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isRegionalCoordinatorRole, currentStaffProfileId, currentUserEmail]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadAssignedApplications = async () => {
            try {
                const response = await apiFetch(`/api/applications?${ACTIVE_APPLICATION_QUERY}`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading assigned applications.');
                }
                const mapped = payload.rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `assigned-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    const isPendingCompletion = isPendingCompletionApplicationRow(row);
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'my-new-applications',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'submitted'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: isPendingCompletion
                            ? buildPendingCompletionApplicationSummary(row)
                            : submitted ? `Submitted ${submitted}` : 'Assigned application',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                setProgramAdminItems(current => {
                    const nonAssigned = current.filter(item => item.bucketId !== 'my-new-applications');
                    return [...mapped, ...nonAssigned];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'my-new-applications': mapped.length
                }));
                setProgramAdminBucketId(bucket => bucket || 'my-new-applications');
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadAssignedApplications();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadAssignedClientCases = async () => {
            try {
                const response = await apiFetch('/api/dashboard/my-client-cases?limit=200&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.items)) {
                    throw new Error('Unexpected response format while loading assigned client cases.');
                }
                const mapped = payload.items.map((row, idx) => {
                    const caseId = row.case_id || row.caseId || row.id || null;
                    const clientName =
                        row.client_name ||
                        row.clientName ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.applicant_name ||
                        row.applicantName ||
                        row.tracking_id ||
                        (caseId ? `Case ${caseId}` : `Client ${idx + 1}`);
                    const nextActionDueAt = row.next_action_due_at || row.nextActionDueAt || null;
                    return {
                        id: caseId ? `my-client-case-${caseId}` : `my-client-case-${idx}`,
                        title: clientName,
                        trackingId: row.tracking_id || row.trackingId || row.case_number || row.caseNumber || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: caseId,
                        bucketId: 'my-clients',
                        type: 'Case',
                        applicant: clientName,
                        applicant_name: clientName,
                        region:
                            row.region_name ||
                            row.regionName ||
                            row.region_code ||
                            row.regionCode ||
                            row.owner_region_name ||
                            row.ownerRegionName ||
                            row.owner_region_code ||
                            row.ownerRegionCode ||
                            '—',
                        owner: row.owner_email || row.owner_name || row.ownerName || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        status: row.status || 'Initiated',
                        dueDate: nextActionDueAt,
                        submittedAt: row.opened_at || row.openedAt || row.created_at || row.createdAt || null,
                        updatedAt: row.updated_at || row.updatedAt || row.last_activity_at || row.lastActivityAt || null,
                        summary: 'Assigned client case file.',
                        workspacePath: caseId ? `/cases/${caseId}` : '/case-assignment-dashboard'
                    };
                });
                const totalCount = Number(payload.totalCount);
                setProgramAdminItems(current => {
                    const nonClientCases = current.filter(item => item.bucketId !== 'my-clients');
                    return [...mapped, ...nonClientCases];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'my-clients': Number.isFinite(totalCount) ? totalCount : mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadAssignedClientCases();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadMissingDocs = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${coordinatorMissingDocsParam}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading missing docs.');
                }
                const mapped = payload.rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `missing-docs-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'missing-docs',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'docs_requested'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'Awaiting documents or response',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                setProgramAdminItems(current => {
                    const nonMissing = current.filter(item => item.bucketId !== 'missing-docs');
                    return [...mapped, ...nonMissing];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'missing-docs': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadMissingDocs();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole, coordinatorMissingDocsParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadEiEligibility = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${coordinatorEiEligibilityParam}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading EI eligibility items.');
                }
                const rows = payload.rows.filter(row => isEligibilityPending(row.assessment_esdc_eligibility));
                const mapped = rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `ei-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'ei-consent-verification',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'submitted'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'EI consent or verification pending.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                setProgramAdminItems(current => {
                    const nonEi = current.filter(item => item.bucketId !== 'ei-consent-verification');
                    return [...mapped, ...nonEi];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'ei-consent-verification': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadEiEligibility();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole, coordinatorEiEligibilityParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadReadyToAssess = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${coordinatorReadyToAssessParam}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading ready-to-assess items.');
                }
                const rows = payload.rows.filter(row => isEligibilityComplete(row.assessment_esdc_eligibility));
                const mapped = rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `ready-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'file-complete-processing-due',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'submitted'),
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'EI verification complete; ready for assessment.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                setProgramAdminItems(current => {
                    const nonReady = current.filter(item => item.bucketId !== 'file-complete-processing-due');
                    return [...mapped, ...nonReady];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'file-complete-processing-due': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadReadyToAssess();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole, coordinatorReadyToAssessParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadAwaitingApproval = async () => {
            try {
                const [response, interventionResponse] = await Promise.all([
                    apiFetch(`/api/applications?status=${coordinatorApprovalsParam}&limit=200&offset=0`, {
                        headers: buildDevHeaders(role)
                    }),
                    apiFetch('/api/dashboard/intervention-approval-items', {
                        headers: buildDevHeaders(role)
                    })
                ]);
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                if (!interventionResponse.ok) {
                    throw new Error(`Request failed: ${interventionResponse.status}`);
                }
                const payload = await response.json();
                const interventionPayload = await interventionResponse.json();
                const interventionRows = Array.isArray(interventionPayload?.items)
                    ? interventionPayload.items
                    : [];
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading awaiting approval items.');
                }
                const applicationItems = payload.rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `approval-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'approvals-pipeline',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'pending_approval'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'Assessment submitted for review.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                const interventionItems = interventionRows.map((row, idx) => {
                    const tracking =
                        row.trackingId ||
                        row.tracking_id ||
                        row.caseNumber ||
                        row.case_number ||
                        row.caseId ||
                        row.case_id ||
                        `INT-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const interventionLabel =
                        row.intervention_label ||
                        row.interventionLabel ||
                        row.intervention_title ||
                        row.interventionTitle ||
                        null;
                    const interventionId = row.interventionId || row.intervention_id || null;
                    const actionPlanId = row.actionPlanId || row.action_plan_id || null;
                    const caseId = row.caseId || row.case_id || null;
                    const approvalQueuedAt =
                        row.approvalQueuedAt ||
                        row.approval_queued_at ||
                        row.submittedAt ||
                        row.submitted_at ||
                        null;
                    return {
                        id: interventionId ? `INT-${interventionId}` : String(tracking),
                        title: applicantName,
                        trackingId: tracking,
                        titleSecondaryText: '',
                        titleSecondaryContent: buildApprovalInterventionBreakdownContent(row),
                        case_id: caseId,
                        application_id: row.applicationId || row.application_id || null,
                        interventionId,
                        actionPlanId,
                        bucketId: 'approvals-pipeline',
                        type: 'InterventionApproval',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: row.owner || row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        status: row.review_status || row.status || 'Submitted',
                        approvalRequestType: row.approval_request_type || row.approvalRequestType || 'new_intervention',
                        approvalRequestTypeLabel: row.approval_request_type_label || row.approvalRequestTypeLabel || 'Additional intervention proposal',
                        review_status: row.review_status || null,
                        delivery_status: row.delivery_status || null,
                        intervention_effective_status: row.intervention_effective_status || null,
                        intervention_code: row.intervention_code || null,
                        intervention_label: interventionLabel,
                        intervention_cost_total: row.intervention_cost_total || null,
                        interventionGroups: row.interventionGroups || row.intervention_groups || [],
                        interventionSummaries: row.interventionSummaries || row.intervention_summaries || [],
                        intervention_start_date: row.intervention_start_date || null,
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        budgetPotCode: row.budgetPotCode || row.budget_pot_code || null,
                        budget_pot_code: row.budgetPotCode || row.budget_pot_code || null,
                        approvalQueuedAt,
                        dueDate: null,
                        submittedAt: row.submittedAt || row.submitted_at || null,
                        summary: 'Intervention request submitted for review.',
                        workspacePath: caseId
                            ? buildApprovalWorkspacePath({
                                basePath: `/cases/${caseId}`,
                                approvalType: 'intervention',
                                step: 'review',
                                interventionId,
                                planId: actionPlanId
                            })
                            : '/case-assignment-dashboard'
                    };
                });
                const mapped = [...applicationItems, ...interventionItems];
                setProgramAdminItems(current => {
                    const nonApproval = current.filter(item => item.bucketId !== 'approvals-pipeline');
                    return [...mapped, ...nonApproval];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'approvals-pipeline': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadAwaitingApproval();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole, coordinatorApprovalsParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadFundingAgreements = async () => {
            try {
                const response = await apiFetch(`/api/applications?${PENDING_COMPLETION_APPLICATION_QUERY}`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                let interventionCompletionItems = [];
                try {
                    const interventionResponse = await apiFetch('/api/dashboard/intervention-completion-items', {
                        headers: buildDevHeaders(role)
                    });
                    if (interventionResponse.ok) {
                        const interventionPayload = await interventionResponse.json();
                        interventionCompletionItems = Array.isArray(interventionPayload?.items)
                            ? interventionPayload.items
                            : [];
                    }
                } catch (_) {
                    interventionCompletionItems = [];
                }
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading funding agreements.');
                }
                const rows = payload.rows.filter(isPendingCompletionApplicationRow);
                const applicationItems = rows.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `funding-agreement-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.client?.displayName ||
                        row.client?.name ||
                        [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                        row.client?.firstName ||
                        row.client?.lastName ||
                        [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                        row.client?.first_name ||
                        row.client?.last_name ||
                        row.tracking_id ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.tracking_id || row.trackingId || null,
                        application_id: row.application_id || row.applicationId || null,
                        case_id: row.case_id || row.caseId || null,
                        bucketId: 'funding-agreements',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, row.application_status || row.status || 'approved'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: buildPendingCompletionApplicationSummary(row),
                        assessment_intervention_cost_total: row.assessment_intervention_cost_total ?? null,
                        assessment_intervention_pot_id: row.assessment_intervention_pot_id ?? null,
                        funding_agreement_count: row.funding_agreement_count ?? 0,
                        approval_decision_letter_sent: row.approval_decision_letter_sent ?? false,
                        decisionLetterSentApproval: row.decisionLetterSentApproval ?? false,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                const interventionItems = mapPendingCompletionInterventionItems(
                    interventionCompletionItems,
                    'funding-agreements'
                );
                const mapped = [...applicationItems, ...interventionItems];
                setProgramAdminItems(current => {
                    const nonFunding = current.filter(item => item.bucketId !== 'funding-agreements');
                    return [...mapped, ...nonFunding];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'funding-agreements': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadFundingAgreements();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadActiveClientMilestones = async () => {
            try {
                const response = await apiFetch(`/api/dashboard/intervention-milestone-items?windowDays=${coordinatorMilestoneWindowParam}`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const rows = Array.isArray(payload.items) ? payload.items : [];
                const mapped = rows.map((row, idx) => {
                    const id = row.interventionId || row.intervention_id || `milestone-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.applicant ||
                        [row.submission_first_name, row.submission_last_name].filter(Boolean).join(' ') ||
                        row.trackingId ||
                        row.tracking_id ||
                        'Applicant';
                    const milestone = resolveInterventionMilestone(
                        row.intervention_start_date || row.interventionStartDate,
                        row.intervention_end_date || row.interventionEndDate
                    );
                    if (!milestone || !milestone.inWindow) {
                        return null;
                    }
                    return {
                        id,
                        title: applicantName,
                        trackingId: row.trackingId || row.tracking_id || null,
                        application_id: row.applicationId || row.application_id || null,
                        case_id: row.caseId || row.case_id || null,
                        intervention_id: row.interventionId || row.intervention_id || null,
                        bucketId: 'active-clients-checkins',
                        type: 'InterventionMilestone',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        status: row.intervention_effective_status || row.delivery_status || row.intervention_status || row.status || 'Active',
                        review_status: row.review_status || null,
                        delivery_status: row.delivery_status || null,
                        intervention_effective_status: row.intervention_effective_status || null,
                        dueDate: milestone.date.toISOString().slice(0, 10),
                        milestoneLabel: milestone.label,
                        milestoneStatus: milestone.badgeColor,
                        milestoneDate: milestone.date.toISOString(),
                        milestoneDiffDays: milestone.diffDays,
                        submittedAt: row.submittedAt || row.submitted_at || null,
                        updatedAt: row.updatedAt || row.updated_at || null,
                        summary: milestone.label,
                        intervention_code: row.intervention_code || null,
                        intervention_label: row.intervention_label || null,
                        intervention_start_date: row.intervention_start_date || null,
                        intervention_end_date: row.intervention_end_date || null,
                        workspacePath: (row.caseId || row.case_id) ? `/cases/${row.caseId || row.case_id}` : '/case-assignment-dashboard'
                    };
                }).filter(Boolean);
                setProgramAdminItems(current => {
                    const nonMilestones = current.filter(item => item.bucketId !== 'active-clients-checkins');
                    return [...mapped, ...nonMilestones];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'active-clients-checkins': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadActiveClientMilestones();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole, coordinatorMilestoneWindowParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadClosureFollowups = async () => {
            try {
                const windowDays = 180;
                const response = await apiFetch(`/api/dashboard/intervention-milestone-items?windowDays=${windowDays}`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const now = new Date();
                const rows = Array.isArray(payload.items) ? payload.items : [];
                const mapped = rows.map((row, idx) => {
                    const endRaw = row.intervention_end_date || row.interventionEndDate || null;
                    if (!endRaw) return null;
                    const endDate = new Date(endRaw);
                    if (Number.isNaN(endDate.getTime())) return null;
                    if (endDate.getTime() > now.getTime()) return null; // not ended yet

                    const diffDays = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (!Number.isFinite(diffDays) || diffDays < 0 || diffDays > 180) return null;

                    const statusKey = String(
                        row.intervention_effective_status ||
                        row.delivery_status ||
                        row.intervention_status ||
                        row.status ||
                        ''
                    ).trim().toLowerCase();
                    if (['closed', 'complete', 'completed', 'cancelled', 'canceled', 'withdrawn', 'archived'].includes(statusKey)) {
                        return null;
                    }

                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.applicant ||
                        [row.submission_first_name, row.submission_last_name].filter(Boolean).join(' ') ||
                        row.trackingId ||
                        row.tracking_id ||
                        'Applicant';

                    const interventionId = row.interventionId || row.intervention_id || null;
                    const caseId = row.caseId || row.case_id || null;
                    const milestoneLabel = `Ended ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
                    const milestoneStatus =
                        diffDays >= 30 ? 'severity-critical' :
                        diffDays >= 14 ? 'severity-high' :
                        'severity-medium';

                    return {
                        id: interventionId ? `closure-${interventionId}` : `closure-${idx}`,
                        title: applicantName,
                        trackingId: row.trackingId || row.tracking_id || null,
                        application_id: row.applicationId || row.application_id || null,
                        case_id: caseId,
                        intervention_id: interventionId,
                        bucketId: 'followups-closure',
                        type: 'InterventionMilestone',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        ...buildAssignedStaffProfileAliases(row),
                        status: row.intervention_effective_status || row.delivery_status || row.intervention_status || row.status || 'Active',
                        review_status: row.review_status || null,
                        delivery_status: row.delivery_status || null,
                        intervention_effective_status: row.intervention_effective_status || null,
                        dueDate: endDate.toISOString().slice(0, 10),
                        milestoneLabel,
                        milestoneStatus,
                        milestoneDate: endDate.toISOString(),
                        milestoneDiffDays: diffDays,
                        submittedAt: row.submittedAt || row.submitted_at || null,
                        updatedAt: row.updatedAt || row.updated_at || null,
                        summary: milestoneLabel,
                        intervention_code: row.intervention_code || null,
                        intervention_label: row.intervention_label || null,
                        intervention_start_date: row.intervention_start_date || null,
                        intervention_end_date: row.intervention_end_date || null,
                        workspacePath: caseId ? `/cases/${caseId}` : '/iset/cases'
                    };
                }).filter(Boolean);

                setProgramAdminItems(current => {
                    const nonClosure = current.filter(item => item.bucketId !== 'followups-closure');
                    return [...mapped, ...nonClosure];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'followups-closure': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadClosureFollowups();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadPaymentsProofDue = async () => {
            try {
                const response = await apiFetch('/api/dashboard/payment-proof-due-items', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const rows = Array.isArray(payload.items) ? payload.items : [];
                const mapped = rows.map((row, idx) => {
                    const caseId = row.caseId || row.case_id || null;
                    const applicantName =
                        row.applicantName ||
                        row.applicant_name ||
                        row.applicant ||
                        row.trackingId ||
                        row.tracking_id ||
                        'Applicant';
                    const packetId = row.packetId || row.payment_packet_id || null;
                    const lineId = row.lineId || row.payment_packet_line_id || null;
                    const interventionLabel = row.intervention_label || null;
                    const missingEvidence = Array.isArray(row.missingEvidence) ? row.missingEvidence.filter(Boolean) : [];
                    const proofKind = row.kind === 'payment_proof_missing' ? 'Proof missing' : 'Evidence missing';
                    const evidenceSuffix = missingEvidence.length ? `: ${missingEvidence.join(', ')}` : '';
                    const titlePrefix = packetId ? `PAY-${packetId}` : `PAY-${idx + 1}`;
                    const lineSuffix = lineId ? ` · Line ${lineId}` : '';
                    const title = `${titlePrefix}${lineSuffix} · ${applicantName}`;

                    return {
                        id: packetId && lineId ? `pay-${packetId}-${lineId}` : packetId ? `pay-${packetId}` : `pay-${idx}`,
                        title,
                        trackingId: row.trackingId || row.tracking_id || null,
                        application_id: row.applicationId || row.application_id || null,
                        case_id: caseId,
                        bucketId: 'payments-proof-due',
                        type: 'Payment',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: 'You',
                        status: row.lineStatus || row.line_status || row.packetStatus || row.packet_status || 'Action required',
                        dueDate: null,
                        submittedAt: row.updatedAt || row.updated_at || null,
                        updatedAt: row.updatedAt || row.updated_at || null,
                        summary: `${proofKind}${interventionLabel ? ` • ${interventionLabel}` : ''}${evidenceSuffix}`,
                        workspacePath: caseId ? `/cases/${caseId}` : '/iset/cases'
                    };
                });
                setProgramAdminItems(current => {
                    const nonPay = current.filter(item => item.bucketId !== 'payments-proof-due');
                    return [...mapped, ...nonPay];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'payments-proof-due': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadPaymentsProofDue();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadOverdueCombined = async () => {
            try {
                const now = new Date();
                const toDate = (value) => {
                    if (!value) return null;
                    const d = new Date(value);
                    return Number.isNaN(d.getTime()) ? null : d;
                };

                let slaTargets = { ...SLA_DEFAULT_DAYS };
                try {
                    const slaRes = await apiFetch('/api/config/sla-targets', { headers: buildDevHeaders(role) });
                    if (slaRes.ok) {
                        const data = await slaRes.json();
                        const targets = Array.isArray(data?.targets) ? data.targets : [];
                        targets.forEach(item => {
                            const key = item.stage_key || item.stage;
                            const hours = item.target_hours ?? item.targetHours;
                            if (key && hours !== undefined && hours !== null) {
                                const days = Number(hours) / 24;
                                if (!Number.isNaN(days) && days > 0) {
                                    slaTargets[key] = Math.round(days);
                                }
                            }
                        });
                    }
                } catch (_) {}

                const caseRes = await apiFetch('/api/cases?page=1&pageSize=200&sort=updatedAt&direction=desc', {
                    headers: buildDevHeaders(role)
                });
                let casePayload = null;
                try { casePayload = await caseRes.json(); } catch { casePayload = null; }
                const caseRows = Array.isArray(casePayload?.items) ? casePayload.items : [];
                const overdueCases = caseRows.filter(row => {
                    const overdueTasks = Number(row?.overdueTasks ?? 0);
                    if (Number.isFinite(overdueTasks) && overdueTasks > 0) return true;
                    const due = toDate(row?.nextActionDueAt);
                    return Boolean(due && due.getTime() < now.getTime());
                });
                const overdueCaseIdSet = new Set(
                    overdueCases
                        .map(row => Number(row?.id))
                        .filter(id => Number.isFinite(id) && id > 0)
                );
                const mappedCaseItems = overdueCases.map((row, idx) => {
                    const caseId = Number(row?.id);
                    const clientName = [
                        row?.client?.firstName,
                        row?.client?.lastName
                    ].filter(Boolean).join(' ').trim() || row?.trackingId || (Number.isFinite(caseId) ? `Case ${caseId}` : `Case ${idx + 1}`);

                    const overdueTasks = Number(row?.overdueTasks ?? 0);
                    const reminderDue = toDate(row?.nextActionDueAt);
                    const taskDue = toDate(row?.nextOverdueTaskDueAt);
                    const dueCandidates = [reminderDue, taskDue].filter(Boolean);
                    const dueDate = dueCandidates.length
                        ? new Date(Math.min(...dueCandidates.map(d => d.getTime()))).toISOString()
                        : null;

                    const reasons = [];
                    if (Number.isFinite(overdueTasks) && overdueTasks > 0) {
                        reasons.push(`${overdueTasks} task${overdueTasks === 1 ? '' : 's'} overdue`);
                    }
                    if (reminderDue && reminderDue.getTime() < now.getTime()) {
                        reasons.push('reminder overdue');
                    }

                    return {
                        id: Number.isFinite(caseId) ? `case-${caseId}` : `case-${idx}`,
                        title: clientName,
                        trackingId: row?.trackingId || (Number.isFinite(caseId) ? `CASE-${caseId}` : null),
                        case_id: Number.isFinite(caseId) ? caseId : null,
                        application_id: row?.applicationId || null,
                        bucketId: 'overdue',
                        type: 'Case',
                        applicant: clientName,
                        applicant_name: clientName,
                        region: '—',
                        address_province: null,
                        owner: row?.owner?.email || row?.owner?.name || 'You',
                        ...buildAssignedStaffProfileAliases({
                            ...row,
                            assignedStaffProfileId: row?.owner?.staffProfileId || row?.owner?.staff_profile_id || row?.owner?.id,
                        }),
                        status: row?.status || 'open',
                        dueDate,
                        submittedAt: row?.submittedAt || row?.openedAt || null,
                        updatedAt: row?.lastActivityAt || null,
                        summary: reasons.length ? reasons.join(' • ') : 'Overdue',
                        workspacePath: Number.isFinite(caseId) ? `/cases/${caseId}` : '/iset/cases'
                    };
                });

                const appRes = await apiFetch('/api/applications?limit=300&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!appRes.ok) throw new Error(`Request failed: ${appRes.status}`);
                const appPayload = await appRes.json();
                if (ignore) return;
                const rows = Array.isArray(appPayload?.rows) ? appPayload.rows : [];
                const mappedApplications = rows
                    .map((row, idx) => {
                        const status = getApplicationQueueRawStatus(row, 'submitted');
                        const meta = computeSlaMeta(row, slaTargets, status, Boolean(resolveAssignedStaffProfileId(row)));
                        const isOverdue = meta.status === 'critical-overdue' || meta.status === 'high-overdue';
                        if (!isOverdue) return null;

                        const caseIdRaw = row.case_id || row.caseId || null;
                        const caseId = Number(caseIdRaw);
                        if (Number.isFinite(caseId) && overdueCaseIdSet.has(caseId)) {
                            return null;
                        }

                        const id = row.tracking_id || row.case_id || row.application_id || `overdue-${idx}`;
                        const applicantName =
                            row.applicant_name ||
                            row.applicantName ||
                            row.client?.displayName ||
                            row.client?.name ||
                            [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                            row.client?.firstName ||
                            row.client?.lastName ||
                            [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                            row.client?.first_name ||
                            row.client?.last_name ||
                            row.tracking_id ||
                            'Applicant';
                        return {
                            id,
                            title: applicantName,
                            trackingId: row.tracking_id || null,
                            case_id: row.case_id || null,
                            application_id: row.application_id || null,
                            bucketId: 'overdue',
                            type: 'Application',
                            applicant: applicantName,
                            applicant_name: applicantName,
                            region: row.address_province || '—',
                            address_province: row.address_province || null,
                            owner: row.assigned_user_email || 'You',
                            ...buildAssignedStaffProfileAliases(row),
                            ...buildApplicationQueueStatusFields(row, 'submitted'),
                            dueDate: meta.due ? meta.due.toISOString() : null,
                            submittedAt: row.submitted_at || row.created_at || null,
                            updatedAt: row.application_updated_at || row.last_activity_at || row.submitted_at || row.created_at || null,
                            summary: meta.status ? `Application timeline ${meta.status}` : 'Overdue',
                            workspacePath: resolveApplicationWorkspacePath(row)
                        };
                    })
                    .filter(Boolean);

                const mapped = [...mappedCaseItems, ...mappedApplications];
                setProgramAdminItems(current => {
                    const nonOverdue = current.filter(item => item.bucketId !== 'overdue');
                    return [...mapped, ...nonOverdue];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    overdue: mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadOverdueCombined();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isIsetCoordinatorRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadSubmittedApplicationsPipeline = async () => {
            try {
                const response = await apiFetch('/api/applications?status=submitted&limit=200&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading submitted applications.');
                }
                const nextItems = {
                    'new-applications': [],
                    'pending-assessment': []
                };
                const mappedSubmittedItems = payload.rows
                    .map((row, idx) => {
                        const resolvedBucketId = resolveApplicationPipelineBucketId(row);
                        if (resolvedBucketId !== 'new-applications' && resolvedBucketId !== 'pending-assessment') {
                            return null;
                        }
                        const bucketId =
                            isNwacAdminRole && resolvedBucketId === 'pending-assessment'
                                ? 'new-applications'
                                : resolvedBucketId;
                        const id = row.tracking_id || row.case_id || row.application_id || `submitted-${idx}`;
                        const applicantName =
                            row.applicant_name ||
                            row.applicantName ||
                            row.client?.displayName ||
                            row.client?.name ||
                            [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                            row.client?.firstName ||
                            row.client?.lastName ||
                            [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                            row.client?.first_name ||
                            row.client?.last_name ||
                            row.tracking_id ||
                            'Applicant';
                        const title = applicantName;
                        const submitted = row.submitted_at || row.opened_at || null;
                        return {
                            id,
                            title,
                            trackingId: row.tracking_id || row.trackingId || null,
                            application_id: row.applicationId || row.application_id || null,
                            case_id: row.case_id || null,
                            bucketId,
                            type: 'Application',
                            applicant: applicantName,
                            applicant_name: applicantName,
                            region: row.region || row.address_province || row.owner?.regionId || '—',
                            address_province: row.address_province || row['address-province'] || row.region || null,
                            owner: row.assigned_user_email || 'Unassigned',
                            ...buildAssignedStaffProfileAliases(row),
                            ...buildApplicationQueueStatusFields(row, 'submitted'),
                            docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                            docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                            docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                            docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                            dueDate: row.nextActionDueAt || null,
                            submittedAt: submitted,
                            summary:
                                bucketId === 'new-applications'
                                    ? (isAssignedApplicationRow(row)
                                        ? 'Assigned and ready for assessment start.'
                                        : 'Submitted and awaiting assignment.')
                                    : 'Assigned and waiting for EI verification before assessment can begin.',
                            workspacePath: resolveApplicationWorkspacePath(row)
                        };
                    })
                    .filter(Boolean);
                mappedSubmittedItems.forEach(item => {
                    nextItems[item.bucketId].push(item);
                });
                setProgramAdminItems(current => {
                    const nonPipelineStart = current.filter(
                        item => item.bucketId !== 'new-applications' && item.bucketId !== 'pending-assessment'
                    );
                    return [
                        ...nextItems['new-applications'],
                        ...nextItems['pending-assessment'],
                        ...nonPipelineStart
                    ];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'new-applications': nextItems['new-applications'].length,
                    'pending-assessment': isNwacAdminRole ? 0 : nextItems['pending-assessment'].length
                }));
                const firstVisibleItem =
                    nextItems['new-applications'][0] ||
                    nextItems['pending-assessment'][0] ||
                    null;
                if (firstVisibleItem) {
                    setProgramAdminBucketId(bucket => bucket || firstVisibleItem.bucketId);
                    setProgramAdminSelectedItemId(current => {
                        const combined = [
                            ...nextItems['new-applications'],
                            ...nextItems['pending-assessment']
                        ];
                        if (combined.some(item => item.id === current)) {
                            return current;
                        }
                        return firstVisibleItem.id;
                    });
                }
            } catch (_) {
                // keep existing data on failure
            }
        };
        loadSubmittedApplicationsPipeline();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole, isNwacAdminRole]);

    useEffect(() => {
        if (!isWorkQueueRole && !isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadOnHoldApplications = async () => {
            try {
                const statusParam = isIsetCoordinatorRole
                    ? coordinatorOnHoldParam
                    : encodeURIComponent(WORK_QUEUE_ON_HOLD_FILTER);
                const response = await apiFetch(`/api/applications?status=${statusParam}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading on-hold applications.');
                }
                const mapped = payload.rows
                    .filter(row => resolveApplicationPipelineBucketId(row) === 'on-hold')
                    .map((row, idx) => {
                        const tracking = row.trackingId || row.tracking_id || row.caseId || `on-hold-${idx}`;
                        const caseId = row.caseId || row.case_id || null;
                        const applicantName =
                            row.applicant_name ||
                            row.applicantName ||
                            tracking ||
                            'Applicant';
                        const submitted = row.submittedAt || row.submitted_at || null;
                        const awaitingReason = row.application_awaiting_reason || row.applicationAwaitingReason || 'on_hold';
                        const reasonLabel = getApplicationAwaitingReasonLabel(awaitingReason);
                        return {
                            id: tracking,
                            title: applicantName,
                            trackingId: tracking,
                            case_id: caseId,
                            application_id: row.applicationId || row.application_id || null,
                            bucketId: 'on-hold',
                            type: 'Application',
                            applicant: applicantName,
                            applicant_name: applicantName,
                            region: row.address_province || '—',
                            address_province: row.address_province || null,
                            assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                            owner: row.owner || row.assigned_user_email || 'Unassigned',
                            ...buildAssignedStaffProfileAliases(row),
                            ...buildApplicationQueueStatusFields(row, 'on_hold'),
                            docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                            docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                            docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                            docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                            dueDate: null,
                            submittedAt: submitted,
                            updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                            summary: reasonLabel ? `Parked: ${reasonLabel}.` : 'Parked for follow-up.',
                            workspacePath: caseId ? `/application-case/${caseId}` : '/case-assignment-dashboard'
                        };
                    });
                setProgramAdminItems(current => {
                    const nonOnHold = current.filter(item => item.bucketId !== 'on-hold');
                    return [...mapped, ...nonOnHold];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'on-hold': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'on-hold');
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing data on failure
            }
        };
        loadOnHoldApplications();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole, isIsetCoordinatorRole, coordinatorOnHoldParam]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadConflicts = async () => {
            try {
                const response = await apiFetch('/api/dashboard/conflict-declarations', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const declarations = Array.isArray(payload?.declarations) ? payload.declarations : [];
                const mapped = declarations.map((row, idx) => {
                    const tracking = row.referenceNumber || row.trackingId || row.caseId || `conflict-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.applicant_name ||
                        row.applicantName ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const signedAt = row.signedAt || row.signed_at || null;
                    return {
                        id: tracking,
                        title: applicantName,
                        trackingId: tracking,
                        bucketId: 'unresolved-conflicts',
                        type: 'Conflict',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || row.staffRegionId || row.staff_region_id || '—',
                        address_province: row.address_province || row.staffRegionId || row.staff_region_id || null,
                        owner: row.staffEmail || row.staff_email || 'Unassigned',
                        staffEmail: row.staffEmail || row.staff_email || null,
                        staffRole: row.staffRole || row.staff_role || null,
                        status: 'Conflict declared',
                        dueDate: null,
                        submittedAt: signedAt,
                        signedAt,
                        summary: row.details || 'Conflict declaration',
                        workspacePath: row.caseId ? `/application-case/${row.caseId}` : '/case-assignment-dashboard',
                        case_id: row.caseId || null,
                        staffProfileId: row.staffProfileId || row.staff_profile_id || null,
                        details: row.details || ''
                    };
                });
                setProgramAdminItems(current => {
                    const nonConflict = current.filter(item => item.bucketId !== 'unresolved-conflicts');
                    return [...mapped, ...nonConflict];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'unresolved-conflicts': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadConflicts();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadInAssessmentApplications = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${encodeURIComponent(WORK_QUEUE_IN_ASSESSMENT_FILTER)}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading in-assessment applications.');
                }
                const mapped = payload.rows
                    .filter(row => resolveApplicationPipelineBucketId(row) === 'in-assessment')
                    .map((row, idx) => {
                    const tracking = row.trackingId || row.tracking_id || row.caseId || `assessment-${idx}`;
                    const caseId = row.caseId || row.case_id || null;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const submitted = row.submittedAt || row.submitted_at || null;
                    const rawStatus = getApplicationQueueRawStatus(row, 'in_review');
                    return {
                        id: tracking,
                        title: applicantName,
                        trackingId: tracking,
                        case_id: row.caseId || row.case_id || null,
                        application_id: row.applicationId || row.application_id || null,
                        bucketId: 'in-assessment',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, rawStatus),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary:
                            rawStatus === 'awaiting_applicant'
                                ? 'Assessment is paused while PATH waits for applicant documents or a response.'
                                : 'Assessment is in progress.',
                        workspacePath: caseId ? `/application-case/${caseId}` : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonAssessment = current.filter(item => item.bucketId !== 'in-assessment');
                    return [...mapped, ...nonAssessment];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'in-assessment': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'in-assessment');
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadInAssessmentApplications();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadPendingCompletionApplications = async () => {
            try {
                const response = await apiFetch(`/api/applications?${PENDING_COMPLETION_APPLICATION_QUERY}`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                let interventionCompletionItems = [];
                try {
                    const interventionResponse = await apiFetch('/api/dashboard/intervention-completion-items', {
                        headers: buildDevHeaders(role)
                    });
                    if (interventionResponse.ok) {
                        const interventionPayload = await interventionResponse.json();
                        interventionCompletionItems = Array.isArray(interventionPayload?.items)
                            ? interventionPayload.items
                            : [];
                    }
                } catch (_) {
                    interventionCompletionItems = [];
                }
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading pending-completion applications.');
                }
                const rows = payload.rows.filter(isPendingCompletionApplicationRow);
                const applicationItems = rows.map((row, idx) => {
                    const tracking = row.tracking_id || row.case_id || row.application_id || `completion-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const submitted = row.submitted_at || row.created_at || null;
                    return {
                        id: tracking,
                        title: applicantName,
                        trackingId: tracking,
                        case_id: row.case_id || null,
                        application_id: row.application_id || null,
                        bucketId: 'pending-completion',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: row.assigned_user_email || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, row.application_status || row.status || 'approved'),
                        docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                        docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                        docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                        docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: buildPendingCompletionApplicationSummary(row),
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        funding_agreement_count: row.funding_agreement_count ?? 0,
                        workspacePath: resolveApplicationWorkspacePath(row)
                    };
                });
                const interventionItems = mapPendingCompletionInterventionItems(
                    interventionCompletionItems,
                    'pending-completion'
                );
                const mapped = [...applicationItems, ...interventionItems];
                setProgramAdminItems(current => {
                    const nonCompletion = current.filter(item => item.bucketId !== 'pending-completion');
                    return [...mapped, ...nonCompletion];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'pending-completion': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadPendingCompletionApplications();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadAwaitingApproval = async () => {
            try {
                const response = await apiFetch('/api/dashboard/awaiting-approval-items', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const items = Array.isArray(payload?.items) ? payload.items : [];
                const mapped = items.map((row, idx) => {
                    const tracking = row.trackingId || row.tracking_id || row.caseId || `await-${idx}`;
                    const reviewStage = String(row.reviewWorkflowStage || row.review_workflow_stage || '').trim();
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const submitted = row.submittedAt || row.submitted_at || null;
                    const approvalQueuedAt =
                        row.approvalQueuedAt ||
                        row.approval_queued_at ||
                        row.updatedAt ||
                        row.updated_at ||
                        submitted;
                    const interventionBreakdownContent = buildApprovalInterventionBreakdownContent(row);
                    const caseId = row.caseId || row.case_id || null;
                    return {
                        id: tracking,
                        title: applicantName,
                        trackingId: tracking,
                        titleSecondaryText: '',
                        titleSecondaryContent: interventionBreakdownContent,
                        case_id: caseId,
                        application_id: row.applicationId || row.application_id || null,
                        bucketId: isRegionalCoordinatorRole ? 'pending-review' : 'pending-decision',
                        type: 'AwaitingApproval',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        status: isRegionalCoordinatorRole
                            ? (reviewStage === 'returned_to_rm' ? 'Returned to RM' : 'Pending Review')
                            : (row.status || 'Pending decision'),
                        review_workflow_stage: reviewStage || null,
                        reviewWorkflowStage: reviewStage || null,
                        approvalRequestType: row.approval_request_type || row.approvalRequestType || 'new_application',
                        approvalRequestTypeLabel: row.approval_request_type_label || row.approvalRequestTypeLabel || 'New application assessment',
                        recommendation: row.recommendation || null,
                        intervention_code: row.intervention_code || null,
                        intervention_label: row.intervention_label || null,
                        intervention_cost_total: row.intervention_cost_total || null,
                        interventionGroups: row.interventionGroups || row.intervention_groups || [],
                        interventionSummaries: row.interventionSummaries || row.intervention_summaries || [],
                        intervention_start_date: row.intervention_start_date || null,
                        intervention_pot_id: row.intervention_pot_id || null,
                        budgetPotCode: row.budgetPotCode || row.budget_pot_code || null,
                        budget_pot_code: row.budgetPotCode || row.budget_pot_code || null,
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        approvalQueuedAt,
                        dueDate: null,
                        submittedAt: submitted,
                        summary: isRegionalCoordinatorRole
                            ? (
                                reviewStage === 'returned_to_rm'
                                    ? 'The Decision Maker requested changes; review the note and forward it to the Coordinator.'
                                    : 'Submitted assessment is waiting for Regional Manager review.'
                            )
                            : 'Application decision is waiting for final decision.',
                        workspacePath: caseId
                            ? buildApprovalWorkspacePath({
                                basePath: `/application-case/${caseId}`,
                                approvalType: 'application',
                                step: 'decision'
                            })
                            : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonAwaiting = current.filter(item => item.type !== 'AwaitingApproval');
                    return [...mapped, ...nonAwaiting];
                });
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadAwaitingApproval();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole, isRegionalCoordinatorRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadInterventionApprovals = async () => {
            try {
                const response = await apiFetch('/api/dashboard/intervention-approval-items', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const items = Array.isArray(payload?.items) ? payload.items : [];
                const mapped = items.map((row, idx) => {
                    const tracking =
                        row.trackingId ||
                        row.tracking_id ||
                        row.caseNumber ||
                        row.case_number ||
                        row.caseId ||
                        row.case_id ||
                        `INT-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const interventionLabel =
                        row.intervention_label ||
                        row.interventionLabel ||
                        row.intervention_title ||
                        row.interventionTitle ||
                        null;
                    const interventionId = row.interventionId || row.intervention_id || null;
                    const actionPlanId = row.actionPlanId || row.action_plan_id || null;
                    const caseId = row.caseId || row.case_id || null;
                    const approvalQueuedAt =
                        row.approvalQueuedAt ||
                        row.approval_queued_at ||
                        row.submittedAt ||
                        row.submitted_at ||
                        null;
                    const reviewStage = String(row.reviewWorkflowStage || row.review_workflow_stage || '').trim();
                    const interventionBreakdownContent = buildApprovalInterventionBreakdownContent(row, {
                        showRevisionAmendmentSummary: true
                    });
                    return {
                        id: interventionId ? `INT-${interventionId}` : String(tracking),
                        title: applicantName,
                        trackingId: tracking,
                        titleSecondaryText: '',
                        titleSecondaryContent: interventionBreakdownContent,
                        case_id: caseId,
                        application_id: row.applicationId || row.application_id || null,
                        interventionId,
                        actionPlanId,
                        bucketId: isRegionalCoordinatorRole ? 'pending-review' : 'pending-decision',
                        type: 'InterventionApproval',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        status: isRegionalCoordinatorRole
                            ? (reviewStage === 'returned_to_rm' ? 'Returned to RM' : 'Pending Review')
                            : (row.review_status || row.status || 'Submitted'),
                        review_workflow_stage: reviewStage || null,
                        reviewWorkflowStage: reviewStage || null,
                        approvalRequestType: row.approval_request_type || row.approvalRequestType || 'new_intervention',
                        approvalRequestTypeLabel: row.approval_request_type_label || row.approvalRequestTypeLabel || 'Additional intervention proposal',
                        review_status: row.review_status || null,
                        delivery_status: row.delivery_status || null,
                        intervention_effective_status: row.intervention_effective_status || null,
                        intervention_code: row.intervention_code || null,
                        intervention_label: interventionLabel,
                        intervention_cost_total: row.intervention_cost_total || null,
                        revisionSourceInterventionId: row.revisionSourceInterventionId ?? row.revision_source_intervention_id ?? null,
                        revisionBaselineCostTotal: row.revisionBaselineCostTotal ?? row.revision_baseline_cost_total ?? null,
                        revisionRevisedCostTotal: row.revisionRevisedCostTotal ?? row.revision_revised_cost_total ?? null,
                        revisionNetChange: row.revisionNetChange ?? row.revision_net_change ?? null,
                        interventionGroups: row.interventionGroups || row.intervention_groups || [],
                        interventionSummaries: row.interventionSummaries || row.intervention_summaries || [],
                        intervention_start_date: row.intervention_start_date || null,
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        budgetPotCode: row.budgetPotCode || row.budget_pot_code || null,
                        budget_pot_code: row.budgetPotCode || row.budget_pot_code || null,
                        approvalQueuedAt,
                        dueDate: null,
                        submittedAt: row.submittedAt || row.submitted_at || null,
                        summary: isRegionalCoordinatorRole
                            ? (
                                reviewStage === 'returned_to_rm'
                                    ? 'The Decision Maker requested changes; review the note and forward it to the submitter.'
                                    : 'Submitted intervention request is waiting for Regional Manager review.'
                            )
                            : 'Intervention decision is waiting for final decision.',
                        workspacePath: caseId
                            ? buildApprovalWorkspacePath({
                                basePath: `/cases/${caseId}`,
                                approvalType: 'intervention',
                                step: isRegionalCoordinatorRole ? 'review' : 'decision',
                                interventionId,
                                planId: actionPlanId
                            })
                            : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonInterventions = current.filter(item => item.type !== 'InterventionApproval');
                    return [...mapped, ...nonInterventions];
                });
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadInterventionApprovals();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole, isRegionalCoordinatorRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadWatchlistHits = async () => {
            try {
                const response = await apiFetch('/api/dashboard/watchlist-hit-items', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const items = Array.isArray(payload?.items) ? payload.items : [];
                const mapped = items.map((row, idx) => {
                    const tracking =
                        row.trackingId ||
                        row.tracking_id ||
                        row.caseNumber ||
                        row.case_number ||
                        row.applicationId ||
                        row.application_id ||
                        row.caseId ||
                        row.case_id ||
                        `watch-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        row.applicant ||
                        tracking ||
                        'Applicant';
                    const submitted = row.submittedAt || row.submitted_at || null;
                    const caseId = row.caseId || row.case_id || null;
                    const notes = row.watchlist_notes || row.notes || null;
                    const rawSin = row.sin || row.sin_number || row.sin_digits || null;
                    const formattedSin = formatSinDisplay(rawSin) || rawSin || null;
                    return {
                        id: `watch-${tracking}`,
                        title: applicantName,
                        trackingId: tracking,
                        case_id: caseId,
                        application_id: row.applicationId || row.application_id || null,
                        bucketId: 'ilmp-issues',
                        type: 'WatchlistHit',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || row.region || '—',
                        address_province: row.address_province || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        ...buildAssignedStaffProfileAliases(row),
                        ...buildApplicationQueueStatusFields(row, 'submitted'),
                        sin: formattedSin,
                        notes: notes || null,
                        dueDate: null,
                        submittedAt: submitted,
                        summary: notes || 'Watchlist match',
                        workspacePath: caseId ? `/application-case/${caseId}` : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonWatchlist = current.filter(item => item.bucketId !== 'ilmp-issues');
                    return [...mapped, ...nonWatchlist];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'ilmp-issues': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadWatchlistHits();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        const loadEscalations = async () => {
            await fetchEscalations();
        };
        loadEscalations();
    }, [role, programAdminRefresh, fetchEscalations, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadOverdue = async () => {
            try {
                let slaTargets = { ...SLA_DEFAULT_DAYS };
                try {
                    const slaRes = await apiFetch('/api/config/sla-targets', { headers: buildDevHeaders(role) });
                    if (slaRes.ok) {
                        const data = await slaRes.json();
                        const targets = Array.isArray(data?.targets) ? data.targets : [];
                        targets.forEach(item => {
                            const key = item.stage_key || item.stage;
                            const hours = item.target_hours ?? item.targetHours;
                            if (key && hours !== undefined && hours !== null) {
                                const days = Number(hours) / 24;
                                if (!Number.isNaN(days) && days > 0) {
                                    slaTargets[key] = Math.round(days);
                                }
                            }
                        });
                    }
                } catch (_) {}
                const response = await apiFetch('/api/applications?limit=300&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) throw new Error(`Request failed: ${response.status}`);
                const payload = await response.json();
                if (ignore) return;
                const rows = Array.isArray(payload?.rows) ? payload.rows : [];
                const overdueItems = rows
                    .map((row, idx) => {
                        const status = getApplicationQueueRawStatus(row, 'submitted');
                        const meta = computeSlaMeta(row, slaTargets, status, Boolean(resolveAssignedStaffProfileId(row)));
                        const isOverdue = meta.status === 'critical-overdue' || meta.status === 'high-overdue';
                        if (!isOverdue) return null;
                        const id = row.tracking_id || row.case_id || row.application_id || `overdue-${idx}`;
                        const applicantName =
                            row.applicant_name ||
                            row.applicantName ||
                            row.client?.displayName ||
                            row.client?.name ||
                            [row.client?.firstName, row.client?.lastName].filter(Boolean).join(' ') ||
                            row.client?.firstName ||
                            row.client?.lastName ||
                            [row.client?.first_name, row.client?.last_name].filter(Boolean).join(' ') ||
                            row.client?.first_name ||
                            row.client?.last_name ||
                            row.tracking_id ||
                            'Applicant';
                        return {
                            id,
                            title: applicantName,
                            trackingId: row.tracking_id || null,
                            case_id: row.case_id || null,
                            application_id: row.application_id || null,
                            bucketId: 'overdue',
                            type: 'Application',
                            applicant: applicantName,
                            applicant_name: applicantName,
                            region: row.address_province || '—',
                            address_province: row.address_province || null,
                            owner: row.assigned_user_email || 'Unassigned',
                            ...buildAssignedStaffProfileAliases(row),
                            ...buildApplicationQueueStatusFields(row, 'submitted'),
                            docs_requested_active: row.docs_requested_active ?? row.docsRequestedActive ?? false,
                            docs_requested_at: row.docs_requested_at ?? row.docsRequestedAt ?? null,
                            docs_requested_cleared_at: row.docs_requested_cleared_at ?? row.docsRequestedClearedAt ?? null,
                            docs_requested_source: row.docs_requested_source ?? row.docsRequestedSource ?? null,
                            dueDate: meta.due ? meta.due.toISOString() : null,
                            submittedAt: row.submitted_at || row.created_at || null,
                            summary: meta.status ? `Timeline ${meta.status}` : 'Overdue',
                            workspacePath: resolveApplicationWorkspacePath(row)
                        };
                    })
                    .filter(Boolean);
                setProgramAdminItems(current => {
                    const nonOverdue = current.filter(item => item.bucketId !== 'overdue');
                    return [...overdueItems, ...nonOverdue];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    overdue: overdueItems.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadOverdue();
        return () => { ignore = true; };
    }, [role, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole && !isIsetCoordinatorRole) {
            if (programAdminSelectedItemId !== null) {
                setProgramAdminSelectedItemId(null);
            }
            return;
        }
        const firstBucket = bucketDefinitions[0]?.id || null;
        const bucket = programAdminBucketId || firstBucket || null;
        if (!programAdminBucketId && firstBucket) {
            setProgramAdminBucketId(firstBucket);
            return;
        }
        const bucketItems = programAdminItems.filter(item => item.bucketId === bucket);
        if (!bucketItems.length) {
            if (programAdminSelectedItemId !== null) {
                setProgramAdminSelectedItemId(null);
            }
            return;
        }
        if (!bucketItems.some(item => item.id === programAdminSelectedItemId)) {
            setProgramAdminSelectedItemId(bucketItems[0].id);
        }
    }, [isWorkQueueRole, isIsetCoordinatorRole, bucketDefinitions, programAdminBucketId, programAdminItems, programAdminSelectedItemId]);

    const handleItemsChange = useCallback(({ detail }) => {
        if (!detail || !Array.isArray(detail.items)) return;
        const nextLayout = exportLayout(detail.items, allowedWidgets);
        setLayout(current => areLayoutsEqual(current, nextLayout) ? current : nextLayout);
    }, [allowedWidgets]);

    const resetLayout = useCallback(() => {
        setLayout(defaultLayout);
        const defaultPalette = computePaletteItems(defaultLayout, allowedWidgets);
        paletteSignatureRef.current = JSON.stringify(defaultPalette);
        if (typeof setAvailableItems === 'function') {
            try { setAvailableItems(defaultPalette); } catch (_) {}
        }
        try { window.localStorage.removeItem(storageKey); } catch (_) {}
    }, [allowedWidgets, defaultLayout, setAvailableItems, storageKey]);

    const openPalette = useCallback(() => {
        if (typeof setAvailableItems === 'function') {
            try { setAvailableItems(paletteItems); } catch (_) {}
        }
        if (typeof setSplitPanelOpen === 'function') {
            setSplitPanelOpen(true);
        }
    }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

    useEffect(() => {
        const handleAdd = event => {
            const id = event?.detail?.id;
            if (!id || !allowedWidgets[id]) return;
            setLayout(current => current.some(item => item.id === id) ? current : [...current, { id }]);
        };
        window.addEventListener('palette:add', handleAdd);
        return () => window.removeEventListener('palette:add', handleAdd);
    }, [allowedWidgets]);

    useEffect(() => {
        const handleOpen = () => openPalette();
        const handleReset = () => resetLayout();
        window.addEventListener('home:openPalette', handleOpen);
        window.addEventListener('home:resetLayout', handleReset);
        return () => {
            window.removeEventListener('home:openPalette', handleOpen);
            window.removeEventListener('home:resetLayout', handleReset);
        };
    }, [openPalette, resetLayout]);

    const renderBoardItem = (item, actions) => {
        const definition = allowedWidgets[item.id];
        if (!definition || !definition.component) return null;
        const WidgetComponent = definition.component;
        if (item.id === 'program-admin-work-queue') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authRefreshKey}
                    selectedBucketId={programAdminBucketId}
                    onSelectBucket={handleProgramAdminBucketSelect}
                    bucketDefinitions={bucketDefinitions}
                    items={programAdminItems}
                    countsByBucket={programAdminCounts}
                    onRefresh={handleProgramAdminRefresh}
                    toggleHelpPanel={toggleHelpPanel}
                />
            );
        }
        if (item.id === 'iset-coordinator-work-queue') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authRefreshKey}
                    selectedBucketId={programAdminBucketId}
                    onSelectBucket={handleProgramAdminBucketSelect}
                    items={programAdminItems}
                    countsByBucket={programAdminCounts}
                    onRefresh={handleProgramAdminRefresh}
                    toggleHelpPanel={toggleHelpPanel}
                />
            );
        }
        if (item.id === 'work-queue-items-table') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authRefreshKey}
                    mode={metricDrilldown ? 'metric' : 'queue'}
                    metricView={metricDrilldown}
                    onCloseMetricView={clearMetricDrilldown}
                    selectedBucketId={programAdminBucketId}
                    selectedItemId={programAdminSelectedItemId}
                    onSelectItem={handleProgramAdminItemSelect}
                    bucketDefinitions={bucketDefinitions}
                    items={programAdminItems}
                    onRefresh={handleProgramAdminRefresh}
                    toggleHelpPanel={toggleHelpPanel}
                />
            );
        }
        if (item.id === 'metrics') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authRefreshKey}
                    metricDrilldown={metricDrilldown}
                    onOpenMetricDrilldown={handleMetricDrilldownOpen}
                    toggleHelpPanel={toggleHelpPanel}
                />
            );
        }
        return (
            <WidgetComponent
                actions={actions}
                role={role}
                refreshKey={authRefreshKey}
                toggleHelpPanel={toggleHelpPanel}
            />
        );
    };

    const shouldShowAuthPrompt = !isAuthenticated;

    if (shouldShowAuthPrompt) {
        return (
            <SpaceBetween size="m">
                <Box variant="p">You are not signed in. Please authenticate to access administrative functions.</Box>
                <Button variant="primary" onClick={signIn}>Sign in</Button>
            </SpaceBetween>
        );
    }

    return (
        <SpaceBetween size="l">
            <Board
                renderItem={renderBoardItem}
                items={boardItems}
                onItemsChange={handleItemsChange}
                i18nStrings={boardI18nStrings}
                empty={<Box padding="m">No widgets on the dashboard.</Box>}
            />
            <Box fontSize="body-s" color="text-body-secondary" textAlign="right">
                {buildStampLabel}
            </Box>
        </SpaceBetween>
    );
};
const computeSlaMeta = (row, slaTargets, rawStatus, isAssigned) => {
    return computeApplicationSlaMeta({
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
        dueAt: row.sla_due_at,
        slaTargets,
        rawStatus,
        isAssigned,
        assessmentEligibility: row.assessment_esdc_eligibility,
    });
};

export default AdminDashboard;
