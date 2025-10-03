import React, { useEffect, useState } from 'react';
import '@cloudscape-design/global-styles/index.css';
import {
    Box,
    Button,
    ColumnLayout,
    Container,
    Header,
    Link,
    SpaceBetween,
    StatusIndicator,
    SegmentedControl,
    Cards,
    Modal,
    Badge,
    TokenGroup
} from '@cloudscape-design/components';
import { devTasks as devTasksData } from '../devTasksData';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims, buildLoginUrl } from '../auth/cognito';
import { apiFetch } from '../auth/apiClient';

// --- Mock Data Providers (to be replaced with real data sources later) ---
function getMockMyWork(role) {
    switch (role) {
        case 'Program Administrator':
            return [
                { id: 'new-submissions', label: 'New submissions', count: 18, description: 'Applications received in the last 24 hours awaiting triage.' },
                { id: 'unassigned', label: 'Unassigned backlog', count: 32, description: 'Cases ready to be routed to regional teams or assessors.' },
                { id: 'in-assessment', label: 'In assessment', count: 57, description: 'Applications actively under review across all regions.' },
                { id: 'awaiting-decision', label: 'Awaiting program decision', count: 9, description: 'Assessments that need a Program Administrator approval.' },
                { id: 'on-hold', label: 'On hold / info requested', count: 6, description: 'Applicants have been asked for more information.' },
                { id: 'overdue', label: 'Overdue', count: 4, description: 'Cases past the program turnaround target.' }
            ];
        case 'Regional Coordinator':
            return [
                { id: 'region-queue', label: 'Assigned to my region', count: 21, description: 'Cases owned by you or assessors in your region.' },
                { id: 'needs-reassignment', label: 'Assigned to me', count: 3, description: 'Cases waiting for you to re-route or pick up.' },
                { id: 'awaiting-info', label: 'Awaiting applicant info', count: 5, description: 'Follow-ups sent to applicants from your region.' },
                { id: 'due-this-week', label: 'Due this week', count: 12, description: 'Cases with upcoming SLA deadlines.' },
                { id: 'overdue', label: 'Overdue', count: 1, description: 'Items breaching SLA within your region.' }
            ];
        case 'Application Assessor':
            return [
                { id: 'assigned-to-me', label: 'Assigned to me', count: 7, description: 'Your active assessment queue.' },
                { id: 'due-today', label: 'Due today', count: 2, description: 'Assessments approaching their SLA window.' },
                { id: 'awaiting-applicant', label: 'Awaiting applicant response', count: 1, description: 'Cases paused while the applicant responds.' },
                { id: 'overdue', label: 'Overdue', count: 0, description: 'Cases past SLA that need immediate attention.' }
            ];
        case 'System Administrator':
            return [
                { id: 'workflow-drafts', label: 'Workflow drafts', count: 4, description: 'Draft workflows pending publish.' },
                { id: 'release-prep', label: 'Release prep tasks', count: 3, description: 'Configuration or release items awaiting action.' },
                { id: 'platform-alerts', label: 'Platform alerts', count: 2, description: 'Active platform alerts requiring follow-up.' }
            ];
        default:
            return [
                { id: 'assigned', label: 'Assigned cases', count: 0, description: 'Cases currently assigned to you.' },
                { id: 'awaiting-review', label: 'Awaiting review', count: 0, description: 'Cases needing your review.' },
                { id: 'overdue', label: 'Overdue', count: 0, description: 'Items past their target date.' }
            ];
    }
}

function getMockRecentActivity(role) {
    const now = Date.now();
    return [
        { id: 'a1', title: 'Case 2457 updated', ts: now - 1000 * 60 * 14 },
        { id: 'a2', title: 'New workflow version published', ts: now - 1000 * 60 * 42 },
        ...(role === 'System Administrator' ? [{ id: 'a3', title: 'Config setting changed', ts: now - 1000 * 60 * 90 }] : []),
    ];
}

function mergeWorkQueueBuckets(base, updates) {
    if (!Array.isArray(base)) {
        return [];
    }
    const updateMap = new Map();
    (Array.isArray(updates) ? updates : []).forEach(bucket => {
        if (bucket && bucket.id) {
            updateMap.set(bucket.id, bucket);
        }
    });
    const merged = base.map(item => {
        const update = updateMap.get(item.id);
        if (!update) {
            return item;
        }
        const parsedCount = Number(update.count);
        return {
            ...item,
            count: Number.isFinite(parsedCount) ? parsedCount : item.count,
            label: update.label || item.label,
            description: typeof update.description === 'string' && update.description.trim().length ? update.description : item.description
        };
    });
    updateMap.forEach((bucket, id) => {
        if (!merged.some(entry => entry.id === id)) {
            const parsedCount = Number(bucket.count);
            merged.push({
                id,
                label: bucket.label || id,
                count: Number.isFinite(parsedCount) ? parsedCount : 0,
                description: typeof bucket.description === 'string' ? bucket.description : ''
            });
        }
    });
    return merged;
}

function relativeTime(ts) {
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return diffMin + 'm ago';
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return diffH + 'h ago';
    const diffD = Math.floor(diffH / 24);
    return diffD + 'd ago';
}

function pickFirstText(...candidates) {
    const visited = new Set();

    const extract = (value) => {
        if (value === null || value === undefined) {
            return '';
        }
        const valueType = typeof value;
        if (valueType === 'string') {
            const trimmed = value.trim();
            return trimmed.length ? trimmed : '';
        }
        if (valueType === 'number' || valueType === 'bigint') {
            return String(value);
        }
        if (valueType === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (valueType === 'object') {
            if (visited.has(value)) {
                return '';
            }
            visited.add(value);
            if (Array.isArray(value)) {
                for (const entry of value) {
                    const nested = extract(entry);
                    if (nested) {
                        return nested;
                    }
                }
                return '';
            }
            const fields = ['displayName', 'name', 'label', 'title', 'text', 'summary', 'message', 'email', 'value', 'description'];
            for (const field of fields) {
                if (field in value) {
                    const nested = extract(value[field]);
                    if (nested) {
                        return nested;
                    }
                }
            }
            if ('id' in value) {
                const nested = extract(value.id);
                if (nested) {
                    return nested;
                }
            }
        }
        return '';
    };

    for (const candidate of candidates) {
        const result = extract(candidate);
        if (result) {
            return result;
        }
    }
    return '';
}

// Import baseline tasks
const initialDevTasks = devTasksData;

// statusBadge removed (redundant with segmented control)

const AdminDashboard = () => {
        const iamOn = isIamOn();
        const signedIn = hasValidSession();
        const claims = signedIn ? getIdTokenClaims() : null;
        const tokenRole = claims ? getRoleFromClaims(claims) : null;
        const [tick, setTick] = useState(0);

        // Listen for simulated role changes
        useEffect(() => {
            const handler = () => setTick(t => t + 1);
            window.addEventListener('auth:session-changed', handler);
            return () => window.removeEventListener('auth:session-changed', handler);
        }, []);

        let simulatedRole = null;
        try {
            const raw = sessionStorage.getItem('currentRole');
            if (raw) {
                const parsed = JSON.parse(raw);
                simulatedRole = parsed?.value || parsed?.label || null;
            } else if (sessionStorage.getItem('simulateSignedOut') === 'true') {
                simulatedRole = 'Guest';
            }
        } catch {}

        const role = (() => {
            if (iamOn) {
                return tokenRole || simulatedRole || 'Guest';
            }
            return simulatedRole || tokenRole || 'Guest';
        })();

        const [myWork, setMyWork] = useState(() => getMockMyWork(role));

        useEffect(() => {
            setMyWork(getMockMyWork(role));
        }, [role]);

        useEffect(() => {
            let ignore = false;

async function loadWorkQueue() {
    try {
        const options = {};
        try {
            const headerBag = { Accept: 'application/json' };
            if (role && role !== 'Guest') {
                headerBag['X-Dev-Role'] = role;
            }
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('iamBypass') === 'off') {
                const token = sessionStorage.getItem('devBypassToken') || process.env.REACT_APP_DEV_AUTH_TOKEN || 'local-dev-secret';
                headerBag['X-Dev-Bypass'] = token;
                const simulatedUser = sessionStorage.getItem('devUserId');
                if (simulatedUser) headerBag['X-Dev-UserId'] = simulatedUser;
                const simulatedRegion = sessionStorage.getItem('devRegionId');
                if (simulatedRegion) headerBag['X-Dev-RegionId'] = simulatedRegion;
            }
            options.headers = headerBag;
        } catch {}
        const response = await apiFetch('/api/dashboard/application-work-queue', options);
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        const payload = await response.json();
                    if (ignore) {
                        return;
                    }
                    if (payload && Array.isArray(payload.buckets) && (!payload.role || payload.role === role)) {
                        setMyWork(mergeWorkQueueBuckets(getMockMyWork(role), payload.buckets));
                    }
                } catch (err) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[dashboard] application work queue fetch failed', err);
                    }
                }
            }

            loadWorkQueue();
            return () => { ignore = true; };
        }, [role]);
        const [recentActivity, setRecentActivity] = useState(() => getMockRecentActivity(role));
        const [recentActivityLoading, setRecentActivityLoading] = useState(true);
        const [recentActivityError, setRecentActivityError] = useState(null);

        useEffect(() => {
            setRecentActivity(getMockRecentActivity(role));
        }, [role]);

        useEffect(() => {
            let ignore = false;
            setRecentActivityLoading(true);
            setRecentActivityError(null);

            async function loadRecentActivity() {
                try {
                    const options = {};
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
                    } catch {}
                    options.headers = headers;

                    const response = await apiFetch('/api/events/feed?limit=5', options);
                    if (!response.ok) {
                        throw new Error(`Request failed: ${response.status}`);
                    }
                    const data = await response.json();
                    if (ignore) {
                        return;
                    }
                    if (Array.isArray(data)) {
                        setRecentActivity(data);
                    } else {
                        setRecentActivity([]);
                    }
                } catch (err) {
                    if (ignore) {
                        return;
                    }
                    setRecentActivityError(err);
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[dashboard] recent activity feed fetch failed', err);
                    }
                    setRecentActivity(getMockRecentActivity(role));
                } finally {
                    if (!ignore) {
                        setRecentActivityLoading(false);
                    }
                }
            }

            loadRecentActivity();
            return () => { ignore = true; };
        }, [role, tick]);

    const simulateSignedOut = (() => { try { return sessionStorage.getItem('simulateSignedOut') === 'true'; } catch { return false; } })();
    if ((iamOn && !signedIn) || (!iamOn && simulateSignedOut)) {
        return (
            <Container header={<Header variant="h1">Administration Console</Header>}>
                <SpaceBetween size="m">
                    <Box variant="p">You are not signed in. Please authenticate to access administrative functions.</Box>
                    <Button variant="primary" onClick={() => window.location.assign(buildLoginUrl())}>Sign in</Button>
                </SpaceBetween>
            </Container>
        );
    }

    return (
        <SpaceBetween size="l">
            <ColumnLayout columns={2} variant="text-grid">
                <Container header={<Header variant="h2" description="Applications currently in your remit by status.">Application Work Queue</Header>}>
                    {Array.isArray(myWork) && myWork.length ? (
                        <ColumnLayout columns={3} variant="text-grid">
                            {myWork.map(item => (
                                <Box key={item.id} padding={{ bottom: 's' }}>
                                    <Box fontSize="display-l" fontWeight="bold">{item.count}</Box>
                                    <Box fontWeight="bold" margin={{ top: 'xxs' }}>{item.label}</Box>
                                    {item.description && (
                                        <Box fontSize="body-s" color="text-status-inactive" margin={{ top: 'xxs' }}>
                                            {item.description}
                                        </Box>
                                    )}
                                </Box>
                            ))}
                        </ColumnLayout>
                    ) : (
                        <Box variant="p">No work items to display.</Box>
                    )}
                </Container>
                <Container header={<Header variant="h2">Recent Activity</Header>}>
                    <SpaceBetween size="xs">
                        {recentActivityLoading ? (
                            <StatusIndicator type="loading">Loading activity</StatusIndicator>
                        ) : (
                            <>
                                {recentActivityError && (
                                    <Box color="text-status-inactive">Showing sample activity (live feed unavailable).</Box>
                                )}
                                {recentActivity.map((item, idx) => {
                                                                        const key = pickFirstText(
                                        item.id,
                                        item.event_id,
                                        item.event_entry_id,
                                        item.uuid,
                                        item.eventId,
                                        item.tracking_id
                                    ) || `event-${idx}`;
                                    const eventData = item.event_data && typeof item.event_data === 'object' ? item.event_data : null;
                                    const candidateTimestamp = (() => {
                                        if (typeof item.ts === 'number' && Number.isFinite(item.ts)) {
                                            return item.ts;
                                        }
                                        const rawTs = item.created_at || item.createdAt || item.timestamp || item.occurred_at;
                                        if (!rawTs) {
                                            return null;
                                        }
                                        if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
                                            return rawTs;
                                        }
                                        if (typeof rawTs === 'string') {
                                            const normalized = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
                                            const parsed = Date.parse(normalized);
                                            if (!Number.isNaN(parsed)) {
                                                return parsed;
                                            }
                                            const parsedWithZone = Date.parse(normalized.endsWith('Z') ? normalized : normalized + 'Z');
                                            if (!Number.isNaN(parsedWithZone)) {
                                                return parsedWithZone;
                                            }
                                        }
                                        return null;
                                    })();
                                    const timestamp = Number.isFinite(candidateTimestamp) ? candidateTimestamp : null;
                                    const tooltip = timestamp !== null ? new Date(timestamp).toLocaleString() : undefined;
                                    const timeLabel = timestamp !== null ? relativeTime(timestamp) : '';
                                    const title = pickFirstText(item.title, item.summary, item.label, item.event_type, eventData && eventData.summary, eventData && eventData.message) || 'Activity update';
                                    const actorName = pickFirstText(item.actor_name, item.actor, item.user_name, item.user, eventData && eventData.actor_name, eventData && eventData.actor);
                                    const message = pickFirstText(item.message, eventData && eventData.message, eventData && eventData.summary, eventData && eventData.note_preview, eventData && eventData.description);
                                    const caseIdRaw = item.case_id !== undefined && item.case_id !== null ? item.case_id : (item.subject_type === 'case' ? item.subject_id : (eventData && eventData.case_id));
                                    const caseId = caseIdRaw !== undefined && caseIdRaw !== null ? String(caseIdRaw) : null;
                                    const trackingId = pickFirstText(item.tracking_id, eventData && eventData.tracking_id, eventData && eventData.reference_number);
                                    return (
                                        <Box key={key} title={tooltip} margin={{ bottom: 'xxs' }}>
                                            <Box display="inline" margin={{ right: 'xs' }}>{title}</Box>
                                            {actorName && (
                                                <Box display="inline" margin={{ right: 'xs' }} color="text-status-inactive">by {actorName}</Box>
                                            )}
                                            {caseId && (
                                                <Box display="inline" margin={{ right: 'xs' }}>
                                                    <Link href={`/case/${caseId}`}>{trackingId || `Case ${caseId}`}</Link>
                                                </Box>
                                            )}
                                            {message && (
                                                <Box display="inline" margin={{ right: 'xs' }}>{message}</Box>
                                            )}
                                            {timeLabel && (
                                                <Box display="inline" color="text-status-inactive">{timeLabel}</Box>
                                            )}
                                        </Box>
                                    );
                                })}
                                {!recentActivity.length && <Box variant="p">No recent activity.</Box>}
                            </>
                        )}
                    </SpaceBetween>
                </Container>
            </ColumnLayout>

            {role === 'System Administrator' && (
                <Container header={<Header variant="h2">Development Tracker</Header>}>
                    <DevTaskTracker />
                </Container>
            )}
        </SpaceBetween>
    );
};

const DevTaskTracker = () => {
    const [tasks, setTasks] = useState(() => {
        try {
            const stored = sessionStorage.getItem('devTasks');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Merge: add any new initialDevTasks not already present by id
                    const existingIds = new Set(parsed.map(t => t.id));
                    let mutated = false;
                    initialDevTasks.forEach(t => {
                        if (!existingIds.has(t.id)) { parsed.push(t); mutated = true; }
                        else {
                            // Enrich existing with new fields (notes, nextSteps) if absent
                            const existing = parsed.find(p => p.id === t.id);
                            ['notes','nextSteps','category','link','label'].forEach(k => {
                                if (t[k] && existing[k] === undefined) { existing[k] = t[k]; mutated = true; }
                            });
                        }
                    });
                    if (mutated) {
                        try { sessionStorage.setItem('devTasks', JSON.stringify(parsed)); } catch {}
                    }
                    return parsed;
                }
            }
        } catch {}
        return initialDevTasks;
    });
    const [activeTask, setActiveTask] = useState(null);

    useEffect(() => {
        try { sessionStorage.setItem('devTasks', JSON.stringify(tasks)); } catch {}
    }, [tasks]);

    const updateStatus = (id, status) => {
        setTasks(t => t.map(task => task.id === id ? { ...task, status } : task));
    };

    const grouped = tasks.reduce((acc, t) => {
        acc[t.category] = acc[t.category] || [];
        acc[t.category].push(t);
        return acc;
    }, {});

    const statusOptions = [
        { id: 'planned', text: 'Planned' },
        { id: 'in-progress', text: 'In Progress' },
        { id: 'blocked', text: 'Blocked' },
        { id: 'done', text: 'Done' },
    ];

    return (
        <>
            <SpaceBetween size="l">
                {Object.entries(grouped).map(([cat, list]) => (
                    <Cards
                        key={cat}
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
                                            options={statusOptions}
                                            onChange={({ detail }) => updateStatus(item.id, detail.selectedId)}
                                            ariaLabel={`Set status for ${item.label}`}
                                        />
                                    )
                                }
                            ]
                        }}
                        cardsPerRow={[{ cards: 1 }, { minWidth: 400, cards: 2 }, { minWidth: 900, cards: 3 }]}
                        items={list}
                        header={<Header variant="h3">{cat}</Header>}
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
                                    options={statusOptions}
                                    onChange={({ detail }) => {
                                        updateStatus(activeTask.id, detail.selectedId);
                                        setActiveTask(t => ({ ...t, status: detail.selectedId }));
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
                                    items={activeTask.nextSteps.map((s, idx) => ({ label: s, value: String(idx) }))}
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
        </>
    );
};

export default AdminDashboard;

