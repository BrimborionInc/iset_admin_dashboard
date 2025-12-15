import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Badge,
    Box,
    Button,
    ButtonDropdown,
    Cards,
    ContentLayout,
    Header,
    Link,
    Modal,
    SegmentedControl,
    SpaceBetween,
    TokenGroup
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { BoardItem } from '@cloudscape-design/board-components';
import { devTasks as devTasksData } from '../devTasksData';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims, buildLoginUrl } from '../auth/cognito';
import { apiFetch } from '../auth/apiClient';
import ApplicationWorkQueueWidget from '../widgets/ApplicationWorkQueueWidget';
import CaseWorkQueueWidget from '../widgets/CaseWorkQueueWidget';
import ProgramAdminWorkQueueWidget, { ProgramAdminWorkItemsWidget, PROGRAM_ADMIN_BUCKETS, PROGRAM_ADMIN_SAMPLE_ITEMS } from '../widgets/ProgramAdminWorkQueueWidget';
import WorkQueueItemsTableWidget from '../widgets/WorkQueueItemsTableWidget';
import RecentActivityWidget from '../widgets/RecentActivityWidget';
import MyWatchlistWidget from '../widgets/MyWatchlistWidget';
import ConflictDeclarationsWidget from '../widgets/ConflictDeclarationsWidget';

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
        title: 'Program Admin Work Queue',
        description: 'Combined application and case queues for Program Administrators.',
        defaultRowSpan: 3,
        defaultColumnSpan: 4
    },
    'program-admin-work-items': {
        id: 'program-admin-work-items',
        component: ProgramAdminWorkItemsWidget,
        title: 'Work Queue Items',
        description: 'Items for the selected Program Admin queue bucket.',
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
        component: null, // bound after DevTaskTracker definition
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

const STORAGE_PREFIX = 'admin-home-layout-v3';

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

const filterWidgetsForRole = (role) => {
    const allowed = { ...WIDGET_REGISTRY };
    if (role !== 'System Administrator') {
        delete allowed['dev-task-tracker'];
    }
    if (role !== 'Program Administrator' && role !== 'Regional Coordinator') {
        delete allowed['conflict-declarations'];
    }
    if (role === 'Program Administrator') {
        delete allowed['application-work-queue'];
        delete allowed['case-work-queue'];
    } else {
        delete allowed['program-admin-work-queue'];
        delete allowed['program-admin-work-items'];
        delete allowed['work-queue-items-table'];
    }
    return allowed;
};

const buildDefaultLayout = (role) => {
    if (role === 'Program Administrator') {
        return [
            { id: 'program-admin-work-queue', rowSpan: 3, columnSpan: 4 },
            { id: 'work-queue-items-table', rowSpan: 6, columnSpan: 4 },
            { id: 'recent-activity', rowSpan: 4, columnSpan: 2 },
            { id: 'my-watchlist', rowSpan: 4, columnSpan: 2 },
            { id: 'conflict-declarations', rowSpan: 4, columnSpan: 4 }
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

const STATUS_OPTIONS = [
    { id: 'planned', text: 'Planned' },
    { id: 'in-progress', text: 'In Progress' },
    { id: 'blocked', text: 'Blocked' },
    { id: 'done', text: 'Done' }
];

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

    const simulateSignedOut = useMemo(() => {
        try {
            return sessionStorage.getItem('simulateSignedOut') === 'true';
        } catch (_) {
            return false;
        }
    }, []);

    const [programAdminItems, setProgramAdminItems] = useState(() => PROGRAM_ADMIN_SAMPLE_ITEMS);
    const [programAdminBucketId, setProgramAdminBucketId] = useState(() => PROGRAM_ADMIN_BUCKETS[0]?.id || null);
    const [programAdminSelectedItemId, setProgramAdminSelectedItemId] = useState(() => {
        const initialBucket = PROGRAM_ADMIN_BUCKETS[0]?.id || null;
        const firstItem = PROGRAM_ADMIN_SAMPLE_ITEMS.find(item => item.bucketId === initialBucket);
        return firstItem?.id || null;
    });
    const [programAdminCounts, setProgramAdminCounts] = useState(() => ({}));
    const [programAdminRefresh, setProgramAdminRefresh] = useState(0);

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

    useEffect(() => {
        if (role !== 'Program Administrator') {
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
    }, [role, authVersion, programAdminRefresh]);

    useEffect(() => {
        if (role !== 'Program Administrator') {
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
    }, [role, authVersion, programAdminRefresh]);

    useEffect(() => {
        if (role !== 'Program Administrator') {
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
    }, [role, authVersion, programAdminRefresh]);

    useEffect(() => {
        if (role !== 'Program Administrator') {
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
    }, [role, authVersion, programAdminRefresh]);

    useEffect(() => {
        if (role !== 'Program Administrator') {
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
    }, [role, authVersion, programAdminRefresh]);

    useEffect(() => {
        if (role !== 'Program Administrator') {
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
    }, [role, authVersion, programAdminRefresh]);

    useEffect(() => {
        if (role !== 'Program Administrator') {
            if (programAdminSelectedItemId !== null) {
                setProgramAdminSelectedItemId(null);
            }
            return;
        }
        const bucket = programAdminBucketId || PROGRAM_ADMIN_BUCKETS[0]?.id || null;
        if (!programAdminBucketId && bucket) {
            setProgramAdminBucketId(bucket);
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
    }, [role, programAdminBucketId, programAdminItems, programAdminSelectedItemId]);

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
        if (item.id === 'work-queue-items-table') {
            return (
                <WidgetComponent
                    actions={actions}
                    role={role}
                    refreshKey={authVersion}
                    selectedBucketId={programAdminBucketId}
                    selectedItemId={programAdminSelectedItemId}
                    onSelectItem={handleProgramAdminItemSelect}
                    bucketDefinitions={PROGRAM_ADMIN_BUCKETS}
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

const initialDevTasks = devTasksData;

const DevTaskTracker = ({ actions }) => {
    const [tasks, setTasks] = useState(() => {
        try {
            const stored = sessionStorage.getItem('devTasks');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const existingIds = new Set(parsed.map(t => t.id));
                    let mutated = false;
                    initialDevTasks.forEach(t => {
                        if (!existingIds.has(t.id)) { parsed.push(t); mutated = true; }
                        else {
                            const existing = parsed.find(p => p.id === t.id);
                            ['notes', 'nextSteps', 'category', 'link', 'label'].forEach(k => {
                                if (t[k] && existing[k] === undefined) { existing[k] = t[k]; mutated = true; }
                            });
                        }
                    });
                    if (mutated) {
                        try { sessionStorage.setItem('devTasks', JSON.stringify(parsed)); } catch (_) {}
                    }
                    return parsed;
                }
            }
        } catch (_) {}
        return initialDevTasks;
    });
    const [activeTask, setActiveTask] = useState(null);

    useEffect(() => {
        try { sessionStorage.setItem('devTasks', JSON.stringify(tasks)); } catch (_) {}
    }, [tasks]);

    const updateStatus = (id, status) => {
        setTasks(current => current.map(task => task.id === id ? { ...task, status } : task));
    };

    const grouped = useMemo(() => tasks.reduce((acc, task) => {
        acc[task.category] = acc[task.category] || [];
        acc[task.category].push(task);
        return acc;
    }, {}), [tasks]);

    return (
        <BoardItem
            header={<Header variant="h2">Development Tracker</Header>}
            settings={actions?.removeItem ? (
                <ButtonDropdown
                    ariaLabel="Board item settings"
                    variant="icon"
                    items={[{ id: 'remove', text: 'Remove' }]}
                    onItemClick={({ detail }) => {
                        if (detail.id === 'remove') {
                            actions.removeItem();
                        }
                    }}
                />
            ) : undefined}
            i18nStrings={{
                dragHandleAriaLabel: 'Drag handle',
                dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
                resizeHandleAriaLabel: 'Resize handle',
                resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
            }}
        >
            <SpaceBetween size="l">
                {Object.entries(grouped).map(([category, list]) => (
                    <Cards
                        key={category}
                        cardDefinition={{
                            header: item => (
                                <Box fontWeight="bold">
                                    <Link onFollow={e => { e.preventDefault(); setActiveTask(item); }} href={item.link}>{item.label}</Link>
                                </Box>
                            ),
                            sections: [
                                {
                                    id: 'status',
                                    content: item => (
                                        <SegmentedControl
                                            selectedId={item.status}
                                            options={STATUS_OPTIONS}
                                            onChange={({ detail }) => updateStatus(item.id, detail.selectedId)}
                                            ariaLabel={`Set status for ${item.label}`}
                                        />
                                    )
                                }
                            ]
                        }}
                        cardsPerRow={[{ cards: 1 }, { minWidth: 400, cards: 2 }, { minWidth: 900, cards: 3 }]}
                        items={list}
                        header={<Header variant="h3">{category}</Header>}
                        stickyHeader={false}
                        variant="full-page"
                    />
                ))}
            </SpaceBetween>
            {activeTask && (
                <Modal
                    visible={true}
                    onDismiss={() => setActiveTask(null)}
                    header={activeTask.label}
                    closeAriaLabel="Close task details"
                    footer={
                        <SpaceBetween size="s" direction="horizontal">
                            <Button onClick={() => setActiveTask(null)}>Close</Button>
                        </SpaceBetween>
                    }
                >
                    <SpaceBetween size="m">
                        <Box>Category: <Badge>{activeTask.category}</Badge></Box>
                        <Box>Status:
                            <Box margin={{ left: 'xs' }} display="inline-block">
                                <SegmentedControl
                                    selectedId={activeTask.status}
                                    options={STATUS_OPTIONS}
                                    onChange={({ detail }) => {
                                        updateStatus(activeTask.id, detail.selectedId);
                                        setActiveTask(task => ({ ...task, status: detail.selectedId }));
                                    }}
                                    ariaLabel={`Set status for ${activeTask.label}`}
                                />
                            </Box>
                        </Box>
                        {activeTask.notes && <Box><strong>Notes:</strong><br />{activeTask.notes}</Box>}
                        {Array.isArray(activeTask.nextSteps) && activeTask.nextSteps.length > 0 && (
                            <Box>
                                <strong>Next Steps:</strong>
                                <TokenGroup
                                    items={activeTask.nextSteps.map((step, idx) => ({ label: step, value: String(idx) }))}
                                    alignment="horizontal"
                                />
                            </Box>
                        )}
                        <Box>
                            <Link href={activeTask.link}>Open documentation</Link>
                        </Box>
                    </SpaceBetween>
                </Modal>
            )}
        </BoardItem>
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
    const DECISION_STATUSES = new Set(['pending_approval']);
    const ASSESSMENT_STATUSES = new Set([
        'in_review', 'in review',
        'docs_requested', 'docs requested',
        'action_required', 'action required', 'action required (docs requested)',
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

WIDGET_REGISTRY['dev-task-tracker'].component = DevTaskTracker;

export default AdminDashboard;
