import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims, buildLoginUrl } from '../../auth/cognito';
import { apiFetch } from '../../auth/apiClient';
import ApplicationWorkQueueWidget from './widgets/ApplicationWorkQueueWidget';
import CaseWorkQueueWidget from './widgets/CaseWorkQueueWidget';
import ProgramAdminWorkQueueWidget, { ProgramAdminWorkItemsWidget, PROGRAM_ADMIN_BUCKETS, PROGRAM_ADMIN_SAMPLE_ITEMS } from './widgets/ProgramAdminWorkQueueWidget';
import IsetCoordinatorWorkQueueWidget, { ISET_COORDINATOR_BUCKETS, ISET_COORDINATOR_SAMPLE_ITEMS } from './widgets/IsetCoordinatorWorkQueueWidget';
import WorkQueueItemsTableWidget from './widgets/WorkQueueItemsTableWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import MyWatchlistWidget from './widgets/MyWatchlistWidget';
import ConflictDeclarationsWidget from './widgets/ConflictDeclarationsWidget';
import DevTaskTrackerWidget from './widgets/DevTaskTrackerWidget';

const WIDGET_REGISTRY = {
    'application-work-queue': {
        id: 'application-work-queue',
        component: ApplicationWorkQueueWidget,
        title: 'Application Work Queue',
        description: 'Applications currently in your remit by status.',
        defaultRowSpan: 2,
        defaultColumnSpan: 4
    },
    'case-work-queue': {
        id: 'case-work-queue',
        component: CaseWorkQueueWidget,
        title: 'Case Work Queue',
        description: 'Case management workload by status.',
        defaultRowSpan: 2,
        defaultColumnSpan: 4
    },
    'program-admin-work-queue': {
        id: 'program-admin-work-queue',
        component: ProgramAdminWorkQueueWidget,
        title: 'Work Queue',
        description: 'Combined application and case queues (role-scoped).',
        defaultRowSpan: 3,
        defaultColumnSpan: 4
    },
    'iset-coordinator-work-queue': {
        id: 'iset-coordinator-work-queue',
        component: IsetCoordinatorWorkQueueWidget,
        title: 'Work Queue (ISET Coordinator)',
        description: 'Scaffolded queue buckets for ISET Coordinators (Application Assessors).',
        defaultRowSpan: 3,
        defaultColumnSpan: 4
    },
    'program-admin-work-items': {
        id: 'program-admin-work-items',
        component: ProgramAdminWorkItemsWidget,
        title: 'Work Queue Items',
        description: 'Items for the selected queue bucket.',
        defaultRowSpan: 6,
        defaultColumnSpan: 4
    },
    'work-queue-items-table': {
        id: 'work-queue-items-table',
        component: WorkQueueItemsTableWidget,
        title: 'Queue Items',
        description: 'Lists items for the selected work queue with adaptive columns.',
        defaultRowSpan: 6,
        defaultColumnSpan: 4
    },
    'recent-activity': {
        id: 'recent-activity',
        component: RecentActivityWidget,
        title: 'Recent Activity',
        description: 'Most recent submissions, assignments, and status changes.',
        defaultRowSpan: 4,
        defaultColumnSpan: 2
    },
    'my-watchlist': {
        id: 'my-watchlist',
        component: MyWatchlistWidget,
        title: 'My Watchlist',
        description: 'Cases and applications you have flagged for follow-up.',
        defaultRowSpan: 4,
        defaultColumnSpan: 2
    },
    'dev-task-tracker': {
        id: 'dev-task-tracker',
        component: DevTaskTrackerWidget,
        title: 'Development Tracker',
        description: 'Track internal development tasks. Visible to System Admins.',
        defaultRowSpan: 6,
        defaultColumnSpan: 4
    },
    'conflict-declarations': {
        id: 'conflict-declarations',
        component: ConflictDeclarationsWidget,
        title: 'Conflict Declarations',
        description: 'Conflicts of interest declared by staff in your remit.',
        defaultRowSpan: 4,
        defaultColumnSpan: 4
    }
};

const STORAGE_PREFIX = 'admin-home-layout-v5';
const ISET_COORDINATOR_STATUS_FILTER = ['submitted', 'in_review', 'docs_requested', 'closure_notice', 'pending_approval', 'decision_ready'].join(',');
const ISET_COORDINATOR_EI_ELIGIBILITY_FILTER = ISET_COORDINATOR_STATUS_FILTER;
const ISET_COORDINATOR_READY_TO_ASSESS_FILTER = ['submitted', 'in_review'].join(',');
const ISET_COORDINATOR_APPROVALS_FILTER = ['pending_approval'].join(',');
const ISET_COORDINATOR_FUNDING_AGREEMENTS_FILTER = ['decision_ready', 'approved'].join(',');
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
    'information requested',
    'on hold',
    'on_hold'
].join(',');

const buildDevHeaders = (role) => {
    const headers = { Accept: 'application/json' };
    try {
        if (role && role !== 'Guest') {
            headers['X-Dev-Role'] = role;
        }
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('iamBypass') === 'off') {
            const token = sessionStorage.getItem('devBypassToken') || process.env.REACT_APP_DEV_AUTH_TOKEN || 'local-dev-secret';
            headers['X-Dev-Bypass'] = token;
            const simulatedUser = sessionStorage.getItem('devUserId');
            if (simulatedUser) headers['X-Dev-UserId'] = simulatedUser;
            const simulatedRegion = sessionStorage.getItem('devRegionId');
            if (simulatedRegion) headers['X-Dev-RegionId'] = simulatedRegion;
        }
    } catch (_) {}
    return headers;
};

const isEligibilityPending = (value) => {
    if (value === null || value === undefined) return true;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return true;
    return ['pending', 'unknown'].includes(normalized);
};

const isEligibilityComplete = (value) => !isEligibilityPending(value);

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

const filterWidgetsForRole = (role) => {
    const allowed = { ...WIDGET_REGISTRY };
    const isIsetCoordinator = role === 'Application Assessor';
    if (role !== 'System Administrator') {
        delete allowed['dev-task-tracker'];
    }
    if (role !== 'Program Administrator' && role !== 'Regional Coordinator') {
        delete allowed['conflict-declarations'];
    }
    const isWorkQueueRole = role === 'Program Administrator' || role === 'Regional Coordinator';
    if (isWorkQueueRole) {
        delete allowed['application-work-queue'];
        delete allowed['case-work-queue'];
    } else {
        delete allowed['program-admin-work-queue'];
        delete allowed['program-admin-work-items'];
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
    if (role === 'Program Administrator' || role === 'Regional Coordinator') {
        return [
            { id: 'program-admin-work-queue', rowSpan: 3, columnSpan: 4 },
            { id: 'work-queue-items-table', rowSpan: 6, columnSpan: 4 },
            { id: 'recent-activity', rowSpan: 4, columnSpan: 2 },
            { id: 'my-watchlist', rowSpan: 4, columnSpan: 2 },
            { id: 'conflict-declarations', rowSpan: 4, columnSpan: 4 }
        ];
    }
    if (role === 'Application Assessor') {
        return [
            { id: 'iset-coordinator-work-queue', rowSpan: 3, columnSpan: 4 },
            { id: 'work-queue-items-table', rowSpan: 6, columnSpan: 4 },
            { id: 'application-work-queue', rowSpan: 2, columnSpan: 4 },
            { id: 'case-work-queue', rowSpan: 2, columnSpan: 4 },
            { id: 'recent-activity', rowSpan: 4, columnSpan: 2 },
            { id: 'my-watchlist', rowSpan: 4, columnSpan: 2 }
        ];
    }
    const base = [
        { id: 'application-work-queue', rowSpan: 2, columnSpan: 4 },
        { id: 'case-work-queue', rowSpan: 2, columnSpan: 4 },
        { id: 'recent-activity', rowSpan: 4, columnSpan: 2 },
        { id: 'my-watchlist', rowSpan: 4, columnSpan: 2 }
    ];
    if (role === 'Regional Coordinator') {
        base.push({ id: 'conflict-declarations', rowSpan: 4, columnSpan: 4 });
    }
    if (role === 'System Administrator') {
        base.push({ id: 'dev-task-tracker', rowSpan: 6, columnSpan: 4 });
    }
    return base;
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

const AdminDashboard = ({ setSplitPanelOpen, setAvailableItems }) => {
    const iamOn = isIamOn();
    const signedIn = hasValidSession();
    const claims = signedIn ? getIdTokenClaims() : null;
    const tokenRole = claims ? getRoleFromClaims(claims) : null;
    const [authVersion, setAuthVersion] = useState(0);

    useEffect(() => {
        const handler = () => setAuthVersion(v => v + 1);
        window.addEventListener('auth:session-changed', handler);
        return () => window.removeEventListener('auth:session-changed', handler);
    }, []);

    const simulatedRole = useMemo(() => {
        try {
            const raw = sessionStorage.getItem('currentRole');
            if (raw) {
                const parsed = JSON.parse(raw);
                return parsed?.value || parsed?.label || null;
            }
            if (sessionStorage.getItem('simulateSignedOut') === 'true') {
                return 'Guest';
            }
        } catch (_) {}
        return null;
    }, []);

    const role = useMemo(() => {
        if (iamOn) {
            return tokenRole || simulatedRole || 'Guest';
        }
        return simulatedRole || tokenRole || 'Guest';
    }, [iamOn, tokenRole, simulatedRole]);
    const isWorkQueueRole = role === 'Program Administrator' || role === 'Regional Coordinator';
    const isIsetCoordinatorRole = role === 'Application Assessor';

    const simulateSignedOut = useMemo(() => {
        try {
            return sessionStorage.getItem('simulateSignedOut') === 'true';
        } catch (_) {
            return false;
        }
    }, []);

    const initialItems =
        isIsetCoordinatorRole ? ISET_COORDINATOR_SAMPLE_ITEMS : PROGRAM_ADMIN_SAMPLE_ITEMS;
    const initialBucket = isIsetCoordinatorRole ? ISET_COORDINATOR_BUCKETS[0]?.id : PROGRAM_ADMIN_BUCKETS[0]?.id;
    const [programAdminItems, setProgramAdminItems] = useState(() => initialItems);
    const [programAdminBucketId, setProgramAdminBucketId] = useState(() => initialBucket || null);
    const [programAdminSelectedItemId, setProgramAdminSelectedItemId] = useState(() => {
        const firstItem = initialItems.find(item => item.bucketId === (initialBucket || undefined));
        return firstItem?.id || null;
    });
    const [programAdminCounts, setProgramAdminCounts] = useState(() => ({}));
    const [programAdminRefresh, setProgramAdminRefresh] = useState(0);
    const bucketDefinitions = useMemo(() => {
        if (isWorkQueueRole) return PROGRAM_ADMIN_BUCKETS;
        if (isIsetCoordinatorRole) return ISET_COORDINATOR_BUCKETS;
        return [];
    }, [isWorkQueueRole, isIsetCoordinatorRole]);

    useEffect(() => {
        if (isWorkQueueRole) {
            setProgramAdminItems(PROGRAM_ADMIN_SAMPLE_ITEMS);
            const first = PROGRAM_ADMIN_BUCKETS[0]?.id || null;
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
    }, [isWorkQueueRole, isIsetCoordinatorRole]);

    const allowedWidgets = useMemo(() => filterWidgetsForRole(role), [role]);
    const storageKey = useMemo(() => `${STORAGE_PREFIX}.${role || 'guest'}`, [role]);
    const defaultLayout = useMemo(() => buildDefaultLayout(role), [role]);
    const [layout, setLayout] = useState(() => loadLayoutFromStorage(storageKey, allowedWidgets) ?? defaultLayout);
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
        setProgramAdminBucketId(bucketId);
        const nextItem = programAdminItems.find(item => item.bucketId === bucketId);
        setProgramAdminSelectedItemId(nextItem?.id || null);
    }, [programAdminItems]);

    const handleProgramAdminItemSelect = useCallback((itemId) => {
        setProgramAdminSelectedItemId(itemId || null);
    }, []);

    const handleProgramAdminRefresh = useCallback(() => {
        setProgramAdminRefresh(v => v + 1);
    }, []);

    const coordinatorStatusesParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_STATUS_FILTER),
        []
    );
    const coordinatorMissingDocsParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_MISSING_DOCS_FILTER),
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
    const coordinatorFundingAgreementsParam = useMemo(
        () => encodeURIComponent(ISET_COORDINATOR_FUNDING_AGREEMENTS_FILTER),
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
                    (row.current_owner_role ? row.current_owner_role.toString().replace(/_/g, ' ') : 'Program Admin');
                return {
                    id: `esc-${row.id || idx}`,
                    title: `${tracking} · ${applicantName}`,
                    trackingId: tracking,
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
                    workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
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
                            const mappedId = bucket.id === 'new-submissions'
                                ? 'unassigned-applications'
                                : bucket.id === 'awaiting-decision'
                                ? 'applications-awaiting-approval'
                                : bucket.id;
                            nextCounts[mappedId] = Number.isFinite(parsed) ? parsed : 0;
                        }
                    });
                    setProgramAdminCounts(nextCounts);
                }
            } catch (_) {
                // keep existing counts on failure
            }
        };
        loadProgramAdminCounts();
        return () => { ignore = true; };
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadAssignedApplications = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${coordinatorStatusesParam}&limit=200&offset=0`, {
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
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: row.application_status || row.status || 'Submitted',
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: submitted ? `Submitted ${submitted}` : 'Assigned application',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorStatusesParam]);

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
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: row.application_status || row.status || 'Action required',
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'Awaiting documents or response',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorMissingDocsParam]);

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
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: row.application_status || row.status || 'Submitted',
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'EI consent or verification pending.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorEiEligibilityParam]);

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
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: row.application_status || row.status || 'Submitted',
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'EI verification complete; ready for assessment.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorReadyToAssessParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadAwaitingApproval = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${coordinatorApprovalsParam}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading awaiting approval items.');
                }
                const mapped = payload.rows.map((row, idx) => {
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
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: row.application_status || row.status || 'Pending approval',
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'Assessment submitted for approval.',
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
                    };
                });
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorApprovalsParam]);

    useEffect(() => {
        if (!isIsetCoordinatorRole) {
            return;
        }
        let ignore = false;
        const loadFundingAgreements = async () => {
            try {
                const response = await apiFetch(`/api/applications?status=${coordinatorFundingAgreementsParam}&limit=200&offset=0`, {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading funding agreements.');
                }
                const rows = payload.rows.filter(row => {
                    const costRaw =
                        row.assessment_intervention_cost_total ??
                        row.intervention_cost_total ??
                        null;
                    const costValue = Number(costRaw);
                    const potId =
                        row.assessment_intervention_pot_id ??
                        row.intervention_pot_id ??
                        row.intervention_budget_pot_id ??
                        null;
                    const agreementCount = Number(row.funding_agreement_count ?? row.fundingAgreementCount ?? 0);
                    return Number.isFinite(costValue) && costValue > 0 && potId && agreementCount === 0;
                });
                const mapped = rows.map((row, idx) => {
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
                        type: 'Agreement',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || '—',
                        address_province: row.address_province || row.region || null,
                        owner: row.assigned_user_email || 'You',
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: 'Funding agreement pending',
                        dueDate: null,
                        submittedAt: submitted,
                        updatedAt: row.application_updated_at || row.last_activity_at || submitted || null,
                        summary: 'Funding agreement not yet signed.',
                        assessment_intervention_cost_total: row.assessment_intervention_cost_total ?? null,
                        assessment_intervention_pot_id: row.assessment_intervention_pot_id ?? null,
                        workspacePath: row.case_id ? `/cases/${row.case_id}` : '/case-assignment-dashboard'
                    };
                });
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorFundingAgreementsParam]);

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
                        assigned_user_id: row.assigned_user_id || row.assigned_to_user_id || null,
                        status: row.intervention_status || row.status || 'Active',
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
    }, [role, authVersion, programAdminRefresh, isIsetCoordinatorRole, coordinatorMilestoneWindowParam]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadUnassignedApplications = async () => {
            try {
                const response = await apiFetch('/api/applications?status=submitted,in_review&limit=200&offset=0', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                if (!payload || !Array.isArray(payload.rows)) {
                    throw new Error('Unexpected response format while loading unassigned applications.');
                }
                const unassignedItems = payload.rows.filter(item => {
                    const assignee = item.assigned_user_id || item.assigned_user_email;
                    return !assignee || Number(assignee) === 0 || item.is_unassigned;
                });
                const mapped = unassignedItems.map((row, idx) => {
                    const id = row.tracking_id || row.case_id || row.application_id || `unassigned-${idx}`;
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
                        bucketId: 'unassigned-applications',
                        type: 'Application',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.region || row.address_province || row.owner?.regionId || '—',
                        address_province: row.address_province || row['address-province'] || row.region || null,
                        owner: row.assigned_user_email || 'Unassigned',
                        assigned_user_id: row.assigned_user_id || null,
                        status: row.application_status || row.status || 'Submitted',
                        dueDate: row.nextActionDueAt || null,
                        submittedAt: submitted,
                        summary: submitted ? `Submitted ${submitted}` : 'Unassigned submission',
                        workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonUnassigned = current.filter(item => item.bucketId !== 'unassigned-applications');
                    return [...mapped, ...nonUnassigned];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'unassigned-applications': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'unassigned-applications');
                    setProgramAdminSelectedItemId(current => {
                        if (mapped.some(item => item.id === current)) {
                            return current;
                        }
                        return mapped[0].id;
                    });
                }
            } catch (_) {
                // keep existing sample data on failure
            }
        };
        loadUnassignedApplications();
        return () => { ignore = true; };
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

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
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadEiEligibility = async () => {
            try {
                const response = await apiFetch('/api/dashboard/ei-eligibility-items', {
                    headers: buildDevHeaders(role)
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const payload = await response.json();
                if (ignore) return;
                const items = Array.isArray(payload?.items) ? payload.items : [];
                const mapped = items.map((row, idx) => {
                    const tracking = row.trackingId || row.tracking_id || row.caseId || `elig-${idx}`;
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const submitted = row.submittedAt || row.submitted_at || null;
                    return {
                        id: tracking,
                        title: applicantName,
                        trackingId: tracking,
                        case_id: row.caseId || row.case_id || null,
                        bucketId: 'ei-eligibility-checks',
                        type: 'Eligibility',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        sin: row.sin || row.sin_number || null,
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        applicationId: row.applicationId || row.application_id || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        assigned_user_id: row.assigned_user_id || null,
                        status: row.status || 'Submitted',
                        dueDate: null,
                        submittedAt: submitted,
                        summary: 'Awaiting EI eligibility decision',
                        workspacePath: row.caseId ? `/application-case/${row.caseId}` : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonEligibility = current.filter(item => item.bucketId !== 'ei-eligibility-checks');
                    return [...mapped, ...nonEligibility];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'ei-eligibility-checks': mapped.length
                }));
                if (mapped.length) {
                    setProgramAdminBucketId(bucket => bucket || 'ei-eligibility-checks');
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
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

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
                    const applicantName =
                        row.applicant_name ||
                        row.applicantName ||
                        tracking ||
                        'Applicant';
                    const submitted = row.submittedAt || row.submitted_at || null;
                    return {
                        id: tracking,
                        title: applicantName,
                        trackingId: tracking,
                        case_id: row.caseId || row.case_id || null,
                        application_id: row.applicationId || row.application_id || null,
                        bucketId: 'applications-awaiting-approval',
                        type: 'AwaitingApproval',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        assigned_user_id: row.assigned_user_id || null,
                        status: row.status || 'Pending approval',
                        recommendation: row.recommendation || null,
                        intervention_code: row.intervention_code || null,
                        intervention_label: row.intervention_label || null,
                        intervention_cost_total: row.intervention_cost_total || null,
                        intervention_start_date: row.intervention_start_date || null,
                        intervention_pot_id: row.intervention_pot_id || null,
                        assessment_esdc_eligibility: row.assessment_esdc_eligibility || null,
                        dueDate: null,
                        submittedAt: submitted,
                        summary: 'Awaiting program decision',
                        workspacePath: row.caseId ? `/application-case/${row.caseId}` : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonAwaiting = current.filter(item => item.bucketId !== 'applications-awaiting-approval');
                    return [...mapped, ...nonAwaiting];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'applications-awaiting-approval': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadAwaitingApproval();
        return () => { ignore = true; };
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

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
                    const caseId = row.caseId || row.case_id || null;
                    return {
                        id: interventionId ? `INT-${interventionId}` : String(tracking),
                        title: applicantName,
                        trackingId: tracking,
                        case_id: caseId,
                        application_id: row.applicationId || row.application_id || null,
                        bucketId: 'interventions-awaiting-approval',
                        type: 'InterventionApproval',
                        applicant: applicantName,
                        applicant_name: applicantName,
                        region: row.address_province || '—',
                        address_province: row.address_province || null,
                        owner: row.owner || row.assigned_user_email || 'Unassigned',
                        assigned_user_id: row.assigned_user_id || null,
                        status: row.status || 'Submitted',
                        intervention_code: row.intervention_code || null,
                        intervention_label: interventionLabel,
                        intervention_cost_total: row.intervention_cost_total || null,
                        intervention_start_date: row.intervention_start_date || null,
                        dueDate: null,
                        submittedAt: row.submittedAt || row.submitted_at || null,
                        summary: 'Intervention proposal awaiting approval',
                        workspacePath: caseId ? `/cases/${caseId}` : '/case-assignment-dashboard'
                    };
                });
                setProgramAdminItems(current => {
                    const nonInterventions = current.filter(item => item.bucketId !== 'interventions-awaiting-approval');
                    return [...mapped, ...nonInterventions];
                });
                setProgramAdminCounts(current => ({
                    ...current,
                    'interventions-awaiting-approval': mapped.length
                }));
            } catch (_) {
                // keep existing items on failure
            }
        };
        loadInterventionApprovals();
        return () => { ignore = true; };
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

    useEffect(() => {
        if (!isWorkQueueRole) {
            return;
        }
        let ignore = false;
        const loadEscalations = async () => {
            await fetchEscalations();
        };
        loadEscalations();
        return () => { ignore = true; };
    }, [role, authVersion, programAdminRefresh, fetchEscalations, isWorkQueueRole]);

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
                        const status = row.application_status || row.status || 'submitted';
                        const meta = computeSlaMeta(row, slaTargets, status, Boolean(row.assigned_user_id));
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
                            assigned_user_id: row.assigned_user_id || null,
                            status: row.application_status || row.status || 'Submitted',
                            dueDate: meta.due ? meta.due.toISOString() : null,
                            submittedAt: row.submitted_at || row.created_at || null,
                            summary: meta.status ? `SLA ${meta.status}` : 'Overdue',
                            workspacePath: row.case_id ? `/application-case/${row.case_id}` : '/case-assignment-dashboard'
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
    }, [role, authVersion, programAdminRefresh, isWorkQueueRole]);

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
                    refreshKey={authVersion}
                    selectedBucketId={programAdminBucketId}
                    onSelectBucket={handleProgramAdminBucketSelect}
                    items={programAdminItems}
                    countsByBucket={programAdminCounts}
                    onRefresh={handleProgramAdminRefresh}
                />
            );
        }
        if (item.id === 'program-admin-work-items') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authVersion}
                    selectedBucketId={programAdminBucketId}
                    selectedItemId={programAdminSelectedItemId}
                    onSelectItem={handleProgramAdminItemSelect}
                    items={programAdminItems}
                    countsByBucket={programAdminCounts}
                />
            );
        }
        if (item.id === 'iset-coordinator-work-queue') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authVersion}
                    selectedBucketId={programAdminBucketId}
                    onSelectBucket={handleProgramAdminBucketSelect}
                    items={programAdminItems}
                    countsByBucket={programAdminCounts}
                    onRefresh={handleProgramAdminRefresh}
                />
            );
        }
        if (item.id === 'work-queue-items-table') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authVersion}
                    selectedBucketId={programAdminBucketId}
                    selectedItemId={programAdminSelectedItemId}
                    onSelectItem={handleProgramAdminItemSelect}
                    bucketDefinitions={bucketDefinitions}
                    items={programAdminItems}
                    onRefresh={handleProgramAdminRefresh}
                />
            );
        }
        return (
            <WidgetComponent
                actions={actions}
                role={role}
                refreshKey={authVersion}
            />
        );
    };

    const shouldShowAuthPrompt = (iamOn && !signedIn) || (!iamOn && simulateSignedOut);

    if (shouldShowAuthPrompt) {
        return (
            <SpaceBetween size="m">
                <Box variant="p">You are not signed in. Please authenticate to access administrative functions.</Box>
                <Button variant="primary" onClick={() => window.location.assign(buildLoginUrl())}>Sign in</Button>
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
        </SpaceBetween>
    );
};
const SLA_DEFAULT_DAYS = {
    assignment: 3,
    assessment: 10,
    program_decision: 2
};

const normalizeClosedStatus = status => {
    const key = (status || '').toString().trim().toLowerCase();
    return key === 'withdrawn' ? 'closed' : key;
};

const computeSlaMeta = (row, slaTargets, rawStatus, isAssigned) => {
    const submitted = row.submitted_at ? new Date(row.submitted_at) : row.created_at ? new Date(row.created_at) : null;
    if (!submitted || Number.isNaN(submitted.getTime())) {
        return { status: 'unknown', due: null };
    }
    const due = row.sla_due_at ? new Date(row.sla_due_at) : null;
    const statusKey = normalizeClosedStatus(rawStatus || '');
    if (['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived'].includes(statusKey)) {
        return {
            status: 'ok',
            due: due || submitted,
            deltaDays: null,
            label: 'Complete',
            stage: null
        };
    }
    let targetKey = 'assignment';
    const DECISION_STATUSES = new Set(['pending_approval', 'decision_ready']);
    const ASSESSMENT_STATUSES = new Set([
        'in_review', 'in review',
        'docs_requested', 'docs requested',
        'action_required', 'action required', 'action required (docs requested)',
        'closure_notice', 'closure notice',
        'pending info', 'pending information', 'info requested', 'information requested',
        'on hold', 'on_hold'
    ]);
    if (DECISION_STATUSES.has(statusKey)) {
        targetKey = 'program_decision';
    } else if (ASSESSMENT_STATUSES.has(statusKey) || (statusKey === 'submitted' && isAssigned)) {
        targetKey = 'assessment';
    }
    const targetDays = Number(slaTargets[targetKey]) || SLA_DEFAULT_DAYS[targetKey] || 0;
    const nowMs = Date.now();
    const ageDays = Math.floor((nowMs - submitted.getTime()) / 86400000);
    const effectiveDue = due || new Date(submitted.getTime() + targetDays * 86400000);
    const diffDays = Math.floor((effectiveDue.getTime() - nowMs) / 86400000);
    let status = 'ok';
    if (diffDays < -4) status = 'critical-overdue';
    else if (diffDays < 0) status = 'high-overdue';
    else if (diffDays === 0) status = 'due-today';
    else if (diffDays <= 3) status = 'due-soon';
    return { status, due: effectiveDue, deltaDays: diffDays, ageDays, label: '', stage: targetKey };
};

export default AdminDashboard;
