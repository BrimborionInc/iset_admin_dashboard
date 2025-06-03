import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Link, StatusIndicator } from '@cloudscape-design/components';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';

const PtmaIsetStatistics = () => {
    return (
        <BoardItem
            i18nStrings={{
                dragHandleAriaLabel: 'Drag handle',
                dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
                resizeHandleAriaLabel: 'Resize handle',
                resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.'
            }}
            header={
                <Header
                    description=""
                >
                    PTMA ISET Statistics (demo data)
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: 'Open Applications', value: '42' },
                    { label: 'Awaiting Response', value: '17' },
                    { label: 'Active Clients', value: '19' },
                    { label: '# Approved', value: '33' },
                    { label: '# Denied', value: '5' },
                    { label: 'Approval Rate', value: '78%' },
                    { label: 'Avg. Processing Time', value: '12 days' },
                    { label: 'Total Funding', value: '$150,000' },
                    { label: 'Avg. Funding per Case', value: '$6,500' },
                                        {
                        label: 'Status', value: (
                            <StatusIndicator type="warning">Inactive Applications</StatusIndicator>
                        )
                    },
                    {
                        label: 'More Info', value: (
                            <Link variant="info" href="#">Details</Link>
                        )
                    }

                ]}
                empty="No statistics available."
            />
        </BoardItem>
    );
};

export default PtmaIsetStatistics;
