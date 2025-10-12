import React from 'react';
import { Box, Link, SpaceBetween } from '@cloudscape-design/components';

const ManageIntakeStepsHelpContent = () => {
    return (
        <SpaceBetween size="s">
            <p>
                Use this dashboard to manage reusable Intake Steps (blocks of questions) that you can
                preview, edit, and later assemble into Workflows. Each step consists of one or more
                GOV.UK-styled components with bilingual text support (English/French).
            </p>
            <Box>
                <h3>What you can do here</h3>
                <ul>
                    <li>Browse all steps in the library, filter by name, and select one to preview.</li>
                    <li>Create a new step or modify/delete existing ones.</li>
                    <li>Preview the step as end users will see it, including a language switcher.</li>
                    <li>Inspect the underlying JSON for debugging or support requests.</li>
                </ul>
            </Box>
            <Box>
                <h3>About bilingual content</h3>
                <p>
                    Authoring stores translatable fields as objects: {'{ en: "…", fr: "…" }'}. The preview
                    will flatten these to the selected language, so you never see {'[object Object]'}.
                    The Step Editor also includes a Translations panel to edit or auto-translate missing text
                    in either direction.
                </p>
            </Box>
            <Box>
                <h3>Common tasks</h3>
                <ul>
                    <li>
                        To edit a step, click its name in the library and use “Modify”, or select
                        “Create New Step” to start fresh.
                    </li>
                    <li>
                        Use the language dropdown in the Preview widget to validate both EN and FR content.
                    </li>
                    <li>
                        Copy JSON from the Step JSON widget when reporting issues or filing support tickets.
                    </li>
                </ul>
            </Box>
            <Box>
                <SpaceBetween size="xs">
                    <div>Need more? Contact the platform team or see documentation.</div>
                    <ul>
                        <li><Link href="#" external={true}>Authoring guide</Link></li>
                        <li><Link href="#" external={true}>Publishing workflows</Link></li>
                    </ul>
                </SpaceBetween>
            </Box>
        </SpaceBetween>
    );
};

export default ManageIntakeStepsHelpContent;
