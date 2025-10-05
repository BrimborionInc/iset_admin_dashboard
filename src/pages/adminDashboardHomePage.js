import React, { useEffect, useMemo, useState } from 'react';
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
import RecentActivityWidget from '../widgets/RecentActivityWidget';
import StatisticsWidget from '../widgets/StatisticsWidget';

const BOARD_STORAGE_PREFIX = 'admin-dashboard.board.items.v1';

const cloneBoardItems = items => items.map(item => ({
    ...item,
    data: item.data ? { ...item.data } : undefined
}));

const buildDefaultBoardItems = role => {
    const defaults = [
        { id: 'application-work-queue', rowSpan: 5, columnSpan: 2, data: { title: 'Application Work Queue' } },
        { id: 'recent-activity', rowSpan: 5, columnSpan: 2, data: { title: 'Recent Activity' } },
        { id: 'statistics', rowSpan: 5, columnSpan: 2, data: { title: 'Statistics' } }
    ];
    if (role === 'System Administrator') {
        defaults.push({ id: 'dev-task-tracker', rowSpan: 6, columnSpan: 4, data: { title: 'Development Tracker' } });
    }
    return defaults;
};

const filterAllowedBoardItems = (items, defaults) => {
    const defaultsById = new Map(defaults.map(item => [item.id, item]));
    const merged = [];
    const seen = new Set();

    (Array.isArray(items) ? items : []).forEach(item => {
        if (!item || !defaultsById.has(item.id) || seen.has(item.id)) {
            return;
        }
        const defaultItem = defaultsById.get(item.id);
        merged.push({
            ...defaultItem,
            ...item,
            data: item.data ? { ...defaultItem.data, ...item.data } : (defaultItem.data ? { ...defaultItem.data } : undefined)
        });
        seen.add(item.id);
    });

    defaults.forEach(defaultItem => {
        if (!seen.has(defaultItem.id)) {
            merged.push({ ...defaultItem, data: defaultItem.data ? { ...defaultItem.data } : undefined });
            seen.add(defaultItem.id);
        }
    });

    return merged;
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

const AdminDashboard = () => {
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
    }, [authVersion]);

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
    }, [authVersion]);

    const defaultItems = useMemo(() => cloneBoardItems(buildDefaultBoardItems(role)), [role]);
    const storageKey = useMemo(() => `${BOARD_STORAGE_PREFIX}.${role || 'guest'}`, [role]);
    const [boardItems, setBoardItems] = useState(defaultItems);

    useEffect(() => {
        let restored = false;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setBoardItems(filterAllowedBoardItems(parsed, defaultItems));
                    restored = true;
                }
            }
        } catch (_) {}
        if (!restored) {
            setBoardItems(cloneBoardItems(defaultItems));
        }
    }, [defaultItems, storageKey]);

    const handleResetLayout = () => {
        const next = cloneBoardItems(defaultItems);
        setBoardItems(next);
        try { window.localStorage.removeItem(storageKey); } catch (_) {}
    };

    const handleItemsChange = ({ detail }) => {
        const next = filterAllowedBoardItems(detail.items, defaultItems);
        setBoardItems(next);
        try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch (_) {}
    };

    const renderBoardItem = (item, actions) => {
        switch (item.id) {
            case 'application-work-queue':
                return <ApplicationWorkQueueWidget actions={actions} role={role} refreshKey={authVersion} />;
            case 'recent-activity':
                return <RecentActivityWidget actions={actions} role={role} refreshKey={authVersion} />;
            case 'statistics':
                return <StatisticsWidget actions={actions} role={role} refreshKey={authVersion} />;
            case 'dev-task-tracker':
                return <DevTaskTracker actions={actions} />;
            default:
                return null;
        }
    };

    const shouldShowAuthPrompt = (iamOn && !signedIn) || (!iamOn && simulateSignedOut);

    if (shouldShowAuthPrompt) {
        return (
            <ContentLayout header={<Header variant="h1">Administration Console</Header>}>
                <SpaceBetween size="m">
                    <Box variant="p">You are not signed in. Please authenticate to access administrative functions.</Box>
                    <Button variant="primary" onClick={() => window.location.assign(buildLoginUrl())}>Sign in</Button>
                </SpaceBetween>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout
            header={
                <Header
                    variant="h1"
                    actions={<Button onClick={handleResetLayout}>Reset layout</Button>}
                >
                    Administration Console
                </Header>
            }
        >
            <SpaceBetween size="l">
                <Board
                    renderItem={renderBoardItem}
                    items={boardItems}
                    onItemsChange={handleItemsChange}
                    i18nStrings={boardI18nStrings}
                />
            </SpaceBetween>
        </ContentLayout>
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

export default AdminDashboard;
