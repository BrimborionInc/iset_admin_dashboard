import React from 'react';
import { Button } from '@cloudscape-design/components';
import { useTutorials } from '../context/TutorialsContext';
import { useAuth } from '../context/AuthContext.js';
import { getHomeIntroTutorialIdForRole } from '../tutorials/tutorialPlatform';

const HomeDashboardHelp = () => {
  const { role } = useAuth();
  const { tutorials } = useTutorials();
  const homeIntroTutorialId = getHomeIntroTutorialIdForRole(role);
  const homeTutorials = (tutorials || []).filter(
    tutorial => tutorial?.tutorialId === homeIntroTutorialId
  );
  const homeTutorial = homeTutorials[0] || null;
  const isCoordinator = role === 'ISET Coordinator';
  const isSystemAdmin = role === 'System Administrator';
  const isRegionalManager = role === 'Regional Manager';
  const isNwacAdmin = role === 'NWAC Administrator';

  const handleStartTutorial = () => {
    if (!homeTutorial?.tutorialId) return;
    window.dispatchEvent(
      new CustomEvent('tutorials:start', {
        detail: { tutorialId: homeTutorial.tutorialId }
      })
    );
  };

  return (
    <div>
      <h2>NWAC ISET homepage</h2>
      <p>
        This is the day-to-day starting point for staff work in PATH. Use it to see what needs
        attention now, open the right workspace quickly, and keep track of follow-up items without
        hunting through multiple menus.
      </p>

      <h3>What you can do here</h3>
      <ul>
        <li>Review the highest-priority work queues for your role and open the related record immediately.</li>
        <li>Track recent updates across applications and active cases.</li>
        <li>Use metrics as a workload snapshot, then drill into the matching record list from any count.</li>
        <li>Keep a personal list of tagged files that need follow-up.</li>
        {(isRegionalManager || isNwacAdmin) ? (
          <li>Use the Pending Decision queue to review submitted application assessments, new intervention proposals, and proposed intervention changes, then complete the decision inside the workspace.</li>
        ) : null}
        {(isRegionalManager || isNwacAdmin || isCoordinator) ? (
          <li>Use Pending Completion to catch decision-recorded files that still need letters, funding-form follow-through, signatures, or other post-decision completion work.</li>
        ) : null}
        {isSystemAdmin ? (
          <li>Use the operations snapshot to triage reporting blockers, applicant-account backlog, and staff access hygiene before opening deeper admin tools.</li>
        ) : null}
        {isSystemAdmin ? (
          <li>Check AWS environment status to confirm whether staff sign-in, applicant sign-in, and PATH notification mail are healthy in the active environment.</li>
        ) : null}
        {isSystemAdmin ? (
          <li>Review users and access alerts to catch staff sign-in risk and applicant activation follow-up before it becomes a support issue.</li>
        ) : null}
        {isCoordinator ? (
          <li>For coordinators, this is the quickest way to spot applications needing EI follow-up, missing documents, approval follow-through, check-ins, or case closure work.</li>
        ) : null}
      </ul>

      <h3>Key widgets</h3>
      <ul>
        <li><strong>{isCoordinator ? 'Work Queue (ISET Coordinator)' : 'Work Queue'}</strong> - the role-based list of things that need action first.</li>
        <li><strong>Work Queue Items</strong> - the detailed table for the selected queue, with direct links into the correct workspace.</li>
        {(isRegionalManager || isNwacAdmin) ? (
          <li><strong>Pending Decision Items</strong> - the decision-focused view of Work Queue Items, showing applicant province, EI status, timeline target, and workspace access for approval decisions.</li>
        ) : null}
        {(isRegionalManager || isNwacAdmin || isCoordinator) ? (
          <li><strong>Pending Completion</strong> - the post-decision application queue for files that are decided but not yet fully completed.</li>
        ) : null}
        {!isSystemAdmin ? (
          <li><strong>Metrics</strong> - activity totals for the selected period; count values open the contributing records below.</li>
        ) : null}
        {isSystemAdmin ? (
          <li><strong>Operations Snapshot</strong> - current System Administrator counts for ILMP submission blockers, applicant activation backlog, and staff access follow-up.</li>
        ) : null}
        {isSystemAdmin ? (
          <li><strong>AWS Environment Status</strong> - live read-only checks for staff/applicant Cognito and SES mail in the active environment.</li>
        ) : null}
        {isSystemAdmin ? (
          <li><strong>Users &amp; Access Alerts</strong> - staff MFA/reset/disabled-account follow-up plus applicant activation queue visibility.</li>
        ) : null}
        <li><strong>{isSystemAdmin ? 'Recent Admin Activity' : 'Recent Activity'}</strong> - {isSystemAdmin ? 'recent workflow publishes, configuration changes, and relevant admin/system events.' : 'newest assignments, status changes, and system events.'}</li>
        <li><strong>My Tagged Applications</strong> - your personal follow-up list.</li>
      </ul>

      {isCoordinator ? (
        <>
          <h3>How coordinators usually use this page</h3>
          <ol>
            <li>Start in the Work Queue and open the queue that matches today&apos;s priority.</li>
            <li>Use Work Queue Items to open the application or case you need to work on.</li>
            <li>Do the actual review, messaging, notes, and assessment in the Application Workspace or Case Workspace.</li>
            <li>Return here to pick the next item or check whether anything has become overdue.</li>
          </ol>
          <p>
            NWAC training expectations still apply even if the dashboard only shows counts: acknowledge
            new applications promptly, document follow-up attempts, keep all files tracked, and use
            notes/messages in the workspace to maintain the audit trail.
          </p>
        </>
      ) : null}

      <h3>Layout and usage tips</h3>
      <ul>
        <li>Use <em>Add widget</em> to bring back removed panels; <em>Reset layout</em> restores the default layout.</li>
        <li>Drag and resize widgets to fit your workflow. The layout saves per browser.</li>
        <li>Use Work queue preferences to choose which queue cards are visible for your role.</li>
        <li>Use the tag icon in Work Queue Items to add or remove tagged items from your list.</li>
        {(isRegionalManager || isNwacAdmin) ? (
          <li>Queue actions vary by role. In the Pending Decision queue, use <strong>Open workspace</strong> and complete the decision inside the workspace rather than from the table.</li>
        ) : null}
      </ul>

      {homeTutorial ? (
        <div
          style={{
            border: '1px solid var(--color-border-container-default, #d5dbdb)',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '20px'
          }}
        >
          <p style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.4rem', fontWeight: 700 }}>{homeTutorial.title}</p>
          <div style={{ marginBottom: '12px' }}>{homeTutorial.description}</div>
          {homeTutorial.completed ? (
            <p style={{ marginTop: 0, marginBottom: '12px', color: 'var(--color-text-status-success, #037f0c)' }}>
              Tutorial completed
            </p>
          ) : null}
          <Button variant="primary" onClick={handleStartTutorial}>
            {homeTutorial.completed ? 'Restart tutorial' : 'Start tutorial'}
          </Button>
        </div>
      ) : (
        <p>No hands-on tutorial is currently available for your role on this page.</p>
      )}
    </div>
  );
};

HomeDashboardHelp.aiContext = `You are assisting a user on the NWAC ISET homepage (route /). Treat this page as the daily workboard for PATH staff, not as a technical dashboard tour.

Role-aware guidance:
- ISET Coordinators use the coordinator work queue, queue items table, metrics, recent activity, and tagged applications.
- Regional Managers and NWAC Administrators use the consolidated work queue plus queue items and metrics.
- System Administrators see an operations snapshot, AWS environment status, and users/access alerts instead of the standard metrics widget.

How to answer:
- Start from the staff task: identify today’s priority, select the right queue, open the matching workspace, then do the real work in the application or case record.
- When helping coordinators, connect queue names to training expectations such as prompt acknowledgement of new applications, documented follow-up attempts for missing information, keeping all files tracked, and following active cases through check-ins and closure.
- Explain that metrics can drill into the same Work Queue Items table, while tagging is a personal follow-up tool.
- For NWAC Administrators and Regional Managers, mention that the Pending Decision queue opens a decision-focused table. Clarify that approval decisions are completed inside the workspace by NWAC Administrators.
- For coordinators, NWAC Administrators, and Regional Managers, explain that Pending Completion is the post-decision stage for letters, funding-form follow-through, signatures, and other completion tasks before the application workflow is fully done.
- Mention Add widget and Reset layout only as secondary page controls, not the main purpose of the page.
- Avoid product-tour language unless the user specifically asks about layout or mechanics.`;

export default HomeDashboardHelp;
