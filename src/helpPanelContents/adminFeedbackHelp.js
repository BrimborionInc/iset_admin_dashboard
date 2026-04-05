import React from 'react';
import { Box, Button, Header, SpaceBetween } from '@cloudscape-design/components';

function openReporter(reportType) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('admin-feedback:open-composer', {
        detail: { reportType },
      })
    );
  } catch (error) {
    console.error('Failed to open admin feedback composer', error);
  }
}

const AdminFeedbackHelp = () => (
  <SpaceBetween size="m">
    <Header variant="h3">Report a bug or request a change</Header>
    <Box>
      Use this panel to capture admin-console issues and improvement requests without leaving PATH. The floating report window
      stays open while you continue working in the main console.
    </Box>
    <Box>
      When you open the report window, PATH captures the current page context so the team can see where the problem or requested
      change came from. Add supporting files when screenshots, spreadsheets, or reference documents help explain the request.
    </Box>
    <Header variant="h4">What to include</Header>
    <Box as="ul" padding={{ left: 'm' }}>
      <li>For bugs: the expected behaviour, what happened instead, and any visible errors or reproduction steps.</li>
      <li>For change requests: the workflow problem, the desired outcome, and who is affected.</li>
      <li>Avoid pasting sensitive applicant information unless it is required to explain the issue.</li>
    </Box>
    <SpaceBetween size="xs" direction="horizontal">
      <Button variant="primary" onClick={() => openReporter('bug')}>
        Report a bug
      </Button>
      <Button onClick={() => openReporter('change_request')}>
        Request a change
      </Button>
    </SpaceBetween>
  </SpaceBetween>
);

AdminFeedbackHelp.aiContext = `
- Help PATH staff submit useful internal bug reports and change requests from inside the admin console.
- Remind them that the report window captures the current page context automatically when opened.
- For bug reports, ask for expected behaviour, actual behaviour, visible errors, and reproduction steps.
- For change requests, ask for the workflow problem, desired outcome, and who is affected.
- Keep the guidance concise and operational.
`;

export default AdminFeedbackHelp;
