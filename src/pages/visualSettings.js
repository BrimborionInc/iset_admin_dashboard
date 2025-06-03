import React, { useState, useEffect } from 'react';
import {
    ContentLayout,
    Header,
    Toggle,
    KeyValuePairs,
    Box,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';
import { useDarkMode } from '../context/DarkModeContext';

const VisualSettings = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
    const { useDarkMode: isDarkMode, setUseDarkMode } = useDarkMode(); // ✅ Correct Destructuring



    const [items, setItems] = useState([
        {
            id: 'colour-settings',
            rowSpan: 3,
            columnSpan: 2,
            data: { title: 'Colour Settings' },
        },
        // Add more widgets here as needed
    ]);

    useEffect(() => {
        updateBreadcrumbs([
            { text: 'Home', href: '/' },
            { text: 'Visual Settings', href: '/visual-settings' },
        ]);
    }, [updateBreadcrumbs]);

    return (
        <ContentLayout
            header={
                <Header variant="h1" info={headerInfo}>
                    {header}
                </Header>
            }
        >
            <Board
                renderItem={(item, actions) => {
                    if (item.id === 'colour-settings') {
                        return (
                            <BoardItem
                                header={
                                    <Box margin={{ bottom: 's' }}>
                                        <Header variant="h2">Colour Settings</Header>
                                    </Box>
                                }
                                i18nStrings={{
                                    dragHandleAriaLabel: "Drag handle",
                                    dragHandleAriaDescription: "Use space bar or enter to activate drag for this item, then use arrow keys to move it.",
                                    resizeHandleAriaLabel: "Resize handle",
                                    resizeHandleAriaDescription: "Use space bar or enter to activate resize for this item, then use arrow keys to resize it."
                                }}
                                actions={actions}
                            >
                                <Toggle
                                    onChange={({ detail }) => setUseDarkMode(detail.checked)}
                                    checked={isDarkMode} // ✅ Correct value for checked prop

                                >
                                    Dark Mode
                                </Toggle>
                            </BoardItem>
                        );
                    }
                    return null;
                }}
                items={items}
                onItemsChange={(event) => setItems(event.detail.items)}
                i18nStrings={{
                    liveAnnouncementDndStarted: (operationType) =>
                        operationType === 'resize' ? 'Resizing' : 'Dragging',
                    liveAnnouncementDndItemReordered: (operation) => {
                        const columns = `column ${operation.placement.x + 1}`;
                        const rows = `row ${operation.placement.y + 1}`;
                        return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
                    },
                    liveAnnouncementDndItemResized: (operation) => {
                        const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
                        const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
                        const sizeAnnouncement = operation.direction === 'horizontal'
                            ? `columns ${operation.placement.width}${columnsConstraint}`
                            : `rows ${operation.placement.height}${rowsConstraint}`;
                        return `Item resized to ${sizeAnnouncement}.`;
                    },
                    liveAnnouncementDndItemInserted: (operation) => {
                        const columns = `column ${operation.placement.x + 1}`;
                        const rows = `row ${operation.placement.y + 1}`;
                        return `Item inserted to ${columns}, ${rows}.`;
                    },
                    liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
                    liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
                    liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
                    navigationAriaLabel: 'Board navigation',
                    navigationAriaDescription: 'Click on non-empty item to move focus over',
                    navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
                }}
            />
        </ContentLayout>
    );
};

export default VisualSettings;
