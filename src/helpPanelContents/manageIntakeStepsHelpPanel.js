import React from 'react';
import { HelpPanel } from '@cloudscape-design/components';

const ManageIntakeStepsHelpPanel = () => {
    return (
        <HelpPanel
            header={<h2>Manage Components Help</h2>}
            footer={<div>For more information, visit our documentation.</div>}
        >
            <p>This panel provides help content for managing components within the dashboard.</p>
        </HelpPanel>
    );
};

export default ManageIntakeStepsHelpPanel;
