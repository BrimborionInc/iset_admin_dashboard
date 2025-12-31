import React, { useEffect, useMemo, useState } from 'react';
import {
    Badge,
    Box,
    Button,
    ButtonDropdown,
    Cards,
    Header,
    Link,
    Modal,
    SegmentedControl,
    SpaceBetween,
    TokenGroup
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { devTasks as devTasksData } from '../../../devTasksData';
import HomeDevTaskTrackerHelp from '../../../helpPanelContents/homeDevTaskTrackerHelp';

const STATUS_OPTIONS = [
    { id: 'planned', text: 'Planned' },
    { id: 'in-progress', text: 'In Progress' },
    { id: 'blocked', text: 'Blocked' },
    { id: 'done', text: 'Done' }
];

const initialDevTasks = devTasksData;

const DevTaskTrackerWidget = ({ actions, toggleHelpPanel }) => {
    const [tasks, setTasks] = useState(() => {
        try {
            const stored = sessionStorage.getItem('devTasks');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const existingIds = new Set(parsed.map(t => t.id));
                    let mutated = false;
                    initialDevTasks.forEach(t => {
                        if (!existingIds.has(t.id)) {
                            parsed.push(t);
                            mutated = true;
                        } else {
                            const existing = parsed.find(p => p.id === t.id);
                            ['notes', 'nextSteps', 'category', 'link', 'label'].forEach(k => {
                                if (t[k] && existing[k] === undefined) {
                                    existing[k] = t[k];
                                    mutated = true;
                                }
                            });
                        }
                    });
                    if (mutated) {
                        try {
                            sessionStorage.setItem('devTasks', JSON.stringify(parsed));
                        } catch (_) {}
                    }
                    return parsed;
                }
            }
        } catch (_) {}
        return initialDevTasks;
    });
    const [activeTask, setActiveTask] = useState(null);

    useEffect(() => {
        try {
            sessionStorage.setItem('devTasks', JSON.stringify(tasks));
        } catch (_) {}
    }, [tasks]);

    const updateStatus = (id, status) => {
        setTasks(current => current.map(task => (task.id === id ? { ...task, status } : task)));
    };

    const grouped = useMemo(
        () =>
            tasks.reduce((acc, task) => {
                acc[task.category] = acc[task.category] || [];
                acc[task.category].push(task);
                return acc;
            }, {}),
        [tasks]
    );

    const infoLink = toggleHelpPanel ? (
        <Link
            variant="info"
            onFollow={event => {
                event.preventDefault();
                toggleHelpPanel(<HomeDevTaskTrackerHelp />, 'Development Tracker', HomeDevTaskTrackerHelp.aiContext || '');
            }}
        >
            Info
        </Link>
    ) : undefined;

    return (
        <BoardItem
            header={<Header variant="h2" info={infoLink}>Development Tracker</Header>}
            settings={
                actions?.removeItem ? (
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
                ) : undefined
            }
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
                                    <Link
                                        onFollow={e => {
                                            e.preventDefault();
                                            setActiveTask(item);
                                        }}
                                        href={item.link}
                                    >
                                        {item.label}
                                    </Link>
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
                        <Box>
                            Category: <Badge>{activeTask.category}</Badge>
                        </Box>
                        <Box>
                            Status:
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
                        {activeTask.notes && (
                            <Box>
                                <strong>Notes:</strong>
                                <br />
                                {activeTask.notes}
                            </Box>
                        )}
                        {Array.isArray(activeTask.nextSteps) && activeTask.nextSteps.length > 0 && (
                            <Box>
                                <strong>Next Steps:</strong>
                                <TokenGroup items={activeTask.nextSteps.map((step, idx) => ({ label: step, value: String(idx) }))} alignment="horizontal" />
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

export default DevTaskTrackerWidget;
