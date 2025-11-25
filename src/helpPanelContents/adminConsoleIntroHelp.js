import React from 'react';
import { Box, Header, Link, SpaceBetween } from '@cloudscape-design/components';

const AdminConsoleIntroHelp = () => (
  <SpaceBetween size="s">
    <Header variant="h3">Welcome to the ISET Admin Console</Header>
    <Box>
      Use the board layout to review applications, cases, documents, notes, and assessments. Most widgets include their own <i>Info</i> links; click them to open focused help in this panel.
    </Box>
    <Header variant="h4">Using the AI chat</Header>
    <Box>
      Select <b>Ask the AI</b> in this panel to open the assistant. The chat stays focused on the current help topic; ask concise questions about workflow steps, data locations, or troubleshooting. Avoid sharing sensitive data.
    </Box>
    <Header variant="h4">Info links</Header>
    <Box>
      Info links appear beside section titles across the console. When clicked, they load targeted guidance into this panel and set the AI context so the assistant answers with that topic in mind.
    </Box>
    <Header variant="h4">Navigation tips</Header>
    <Box as="ul" padding={{ left: 'm' }}>
      <li>Use the left navigation to switch areas like Cases, Applications, and Configuration.</li>
      <li>Open board items to see widgets; drag to rearrange your workspace.</li>
      <li>Version history is available in many widgets (look for “View versions”).</li>
      <li>Notifications appear at the top of the page; dismiss them when resolved.</li>
    </Box>
    <Box>
      Need more? Open the AI chat or use the <Link href="https://aws.amazon.com/cloudscape/" external>Cloudscape docs</Link> for component behavior basics.
    </Box>
  </SpaceBetween>
);

AdminConsoleIntroHelp.aiContext = `
- Provide concise guidance for first-time admins using the ISET admin console.
- Prioritise how to use the help panel, AI chat, and widget Info links to understand workflows.
- Keep answers short and action-oriented; mention common entry points (Cases, Applications, Configuration) when relevant.
`;

export default AdminConsoleIntroHelp;
