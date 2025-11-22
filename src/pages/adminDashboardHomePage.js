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
import ApplicationWorkQueueWidget from '../widgets/ApplicationWorkQueueWidget';
import CaseWorkQueueWidget from '../widgets/CaseWorkQueueWidget';
import RecentActivityWidget from '../widgets/RecentActivityWidget';
import MyWatchlistWidget from '../widgets/MyWatchlistWidget';

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
        description: 'Track internal development tasks. Visible to System Administrators.',
        defaultRowSpan: 6,
        defaultColumnSpan: 4
    }
};

const STORAGE_PREFIX = 'admin-home-layout-v1';

const filterWidgetsForRole = (role) => {
    const allowed = { ...WIDGET_REGISTRY };
    if (role !== 'System Administrator') {
        delete allowed['dev-task-tracker'];
    }
    return allowed;
};

const buildDefaultLayout = (role) => {
    const base = [
        { id: 'application-work-queue', rowSpan: 2, columnSpan: 4 },
        { id: 'case-work-queue', rowSpan: 2, columnSpan: 4 },
        { id: 'recent-activity', rowSpan: 4, columnSpan: 2 },
        { id: 'my-watchlist', rowSpan: 4, columnSpan: 2 }
    ];
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

WIDGET_REGISTRY['dev-task-tracker'].component = DevTaskTracker;

export default AdminDashboard;
