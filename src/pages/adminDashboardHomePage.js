import React, { useMemo, useEffect, useState } from 'react';
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

// --- Mock Data Providers (to be replaced with real data sources later) ---
function getMockMyWork(role) {
    const base = { assigned: 0, awaitingReview: 0, overdue: 0 };
    switch (role) {
        case 'System Administrator':
            return { ...base, awaitingReview: 4 };
        case 'Program Administrator':
            return { ...base, assigned: 8, awaitingReview: 2 };
        case 'Regional Coordinator':
            return { ...base, assigned: 15, overdue: 1 };
        case 'PTMA Staff':
            return { ...base, assigned: 5 };
        default:
            return base;
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

function pickQuickActions(role) {
    switch (role) {
        case 'System Administrator':
            return [
                { label: 'Manage Users', href: '/user-management-dashboard' },
                { label: 'Workflows', href: '/manage-workflows' },
                { label: 'Upload Config', href: '/admin/upload-config' },
                { label: 'Release Mgmt', href: '/release-management-dashboard' },
            ];
        case 'Program Administrator':
            return [
                { label: 'Case Operations', href: '/case-assignment-dashboard' },
                { label: 'Reporting & Monitoring', href: '/reporting-and-monitoring-dashboard' },
                { label: 'Notifications', href: '/manage-notifications' },
            ];
        case 'Regional Coordinator':
            return [
                { label: 'Case Operations', href: '/case-assignment-dashboard' },
                { label: 'Reporting & Monitoring', href: '/reporting-and-monitoring-dashboard' },
                { label: 'Secure Messaging', href: '/manage-messages' },
            ];
        case 'PTMA Staff':
            return [
                { label: 'My Queue', href: '/case-management' },
                { label: 'Continue Last Case', href: '/case-management' },
                { label: 'Secure Messaging', href: '/manage-messages' },
            ];
        default:
            return [
                { label: 'Case Management', href: '/case-management' },
                { label: 'Help & Docs', href: 'https://example.com', external: true },
            ];
    }
}

function getMockAlerts(role) {
    const base = [];
    if (role === 'System Administrator') {
        return [
            { id: 'al1', type: 'warning', header: 'Pending workflow draft', content: 'A workflow draft has not been published for 5 days.' },
            { id: 'al2', type: 'info', header: 'Release window', content: 'Planned release scheduled for tomorrow 09:00 UTC.' },
        ];
    }
    if (role === 'Program Administrator') {
        return [
            { id: 'al3', type: 'info', header: '3 cases awaiting assignment', content: 'Assign to case managers to maintain SLA.' }
        ];
    }
    return base;
}

function getWelcomeMessage(role) {
    switch (role) {
        case 'System Administrator':
            return 'Oversee platform configuration, monitor system health, and plan upcoming releases. Use the Development Tracker below to coordinate engineering tasks.';
        case 'Program Administrator':
            return 'Manage program-wide policies, oversee workload distribution, and ensure service quality across coordinators and staff.';
        case 'Regional Coordinator':
            return 'Coordinate case distribution, monitor regional performance, and support staff with escalations.';
        case 'PTMA Staff':
            return 'Work your assigned cases efficiently. Review recent updates and prioritize overdue tasks.';
        case 'Guest':
            return 'Explore limited console features. Sign in for full access.';
        default:
            return 'Access your current work, take quick actions, and review recent changes.';
    }
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

        const role = tokenRole || simulatedRole || 'Guest';

    const quickActions = useMemo(() => pickQuickActions(role), [role]);
    const myWork = useMemo(() => getMockMyWork(role), [role]);
    const recentActivity = useMemo(() => getMockRecentActivity(role), [role]);
        const alerts = useMemo(() => getMockAlerts(role), [role]);

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
                <Container header={<Header variant="h1">Welcome{role && role !== 'Guest' ? ` – ${role}` : ''}</Header>}>
                    <Box variant="p">{getWelcomeMessage(role)}</Box>
            </Container>

            <Container header={<Header variant="h2">Quick Actions</Header>}>
                <SpaceBetween size="xs" direction="horizontal">
                    {quickActions.map(a => (
                        <Button key={a.label} href={a.href} target={a.external ? '_blank' : undefined} iconName={a.external ? 'external' : undefined}>
                            {a.label}
                        </Button>
                    ))}
                </SpaceBetween>
            </Container>

                    {!!alerts.length && (
                        <Container header={<Header variant="h2">Alerts</Header>}>
                            <SpaceBetween size="xs">
                                {alerts.map(al => (
                                    <Box key={al.id} variant="p" style={{ borderLeft: '4px solid #f90', paddingLeft: 8 }}>
                                        <strong>{al.header}:</strong> {al.content}
                                    </Box>
                                ))}
                            </SpaceBetween>
                        </Container>
                    )}

            <ColumnLayout columns={3} variant="text-grid">
                <Container header={<Header variant="h2">My Work</Header>}>
                    <SpaceBetween size="xs">
                        <Box>Assigned: <strong>{myWork.assigned}</strong></Box>
                        <Box>Awaiting Review: <strong>{myWork.awaitingReview}</strong></Box>
                        <Box>Overdue: <strong>{myWork.overdue}</strong></Box>
                    </SpaceBetween>
                </Container>
                        <Container header={<Header variant="h2">Recent Activity</Header>}>
                            <SpaceBetween size="xs">
                                {recentActivity.map(item => (
                                    <Box key={item.id} variant="p" title={new Date(item.ts).toLocaleString()}>{item.title} – <span style={{ color: '#61738e' }}>{relativeTime(item.ts)}</span></Box>
                                ))}
                                {!recentActivity.length && <Box variant="p">No recent activity.</Box>}
                            </SpaceBetween>
                        </Container>
                <Container header={<Header variant="h2">Resources</Header>}>
                    <SpaceBetween size="xs">
                        <Link href="https://example.com" external>Documentation</Link>
                        <Link href="/manage-messages">Secure Messaging</Link>
                        <Link href="/help-support-dashboard">Help & Support</Link>
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
