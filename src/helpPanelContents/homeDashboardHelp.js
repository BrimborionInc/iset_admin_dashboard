import React from 'react';
import { Button } from '@cloudscape-design/components';
import { useTutorials } from '../context/TutorialsContext';
import { getIdTokenClaims, getRoleFromClaims, hasValidSession, isIamOn } from '../auth/cognito';
import { getHomeIntroTutorialIdForRole } from '../tutorials/tutorialPlatform';

const HomeDashboardHelp = ({ currentRole }) => {
  const { tutorials } = useTutorials();
  const fallbackRole = currentRole?.value || currentRole?.label || currentRole || null;
  const claimsRole = (isIamOn() && hasValidSession()) ? getRoleFromClaims(getIdTokenClaims()) : null;
  const effectiveRole = claimsRole || fallbackRole;
  const homeIntroTutorialId = getHomeIntroTutorialIdForRole(effectiveRole);
  const homeTutorials = (tutorials || []).filter(
    tutorial => tutorial?.tutorialId === homeIntroTutorialId
  );
  const homeTutorial = homeTutorials[0] || null;

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
        This is the landing dashboard for day-to-day ISET work. It surfaces role-specific work queues,
        a quick metrics snapshot, recent activity, and your tagged applications so you can jump into priority files quickly.
      </p>

      <h3>What you can do here</h3>
      <ul>
        <li>Review the highest-priority queues for your role and open a file in one click.</li>
        <li>Scan a weekly/monthly/quarterly/yearly metrics snapshot for workload and funding pace.</li>
        <li>Track recent updates across applications and cases.</li>
        <li>Keep a personal list of tagged applications that need follow-up.</li>
        <li>Handle queue-specific actions such as conflict reassignment, EI eligibility updates, approvals, and escalations.</li>
      </ul>

      <h3>Key widgets</h3>
      <ul>
        <li><strong>Work Queue</strong> - queue counts that reflect your role. Select a queue card to drive the queue table.</li>
        <li><strong>Work Queue Items</strong> - table view of the selected queue with filters, flags, and direct workspace links.</li>
        <li><strong>Metrics</strong> - activity totals for this week, month, quarter, and year.</li>
        <li><strong>Recent Activity</strong> - newest assignments, status changes, and system events.</li>
        <li><strong>My Tagged Applications</strong> - cases you have tagged for follow-up; remove tags once resolved.</li>
        <li><strong>Development Tracker</strong> - internal development tasks (System Administrators only).</li>
      </ul>

      <h3>Layout tips</h3>
      <ul>
        <li>Use <em>Add widget</em> to bring back removed panels; <em>Reset layout</em> restores the default layout.</li>
        <li>Drag and resize widgets to fit your workflow. The layout saves per browser.</li>
        <li>Use Work queue preferences in the Work Queue widget to choose which queues are visible for your role.</li>
        <li>Use the tag icon in Work Queue Items to add or remove tagged items from your list.</li>
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

HomeDashboardHelp.aiContext = `You are assisting a user on the NWAC ISET homepage (route /). This dashboard is a role-based landing board that shows work queues, queue items, metrics, recent activity, and tagged applications. NWAC Administrators and Regional Managers see the consolidated Work Queue and Work Queue Items widgets plus Metrics. ISET Coordinators see the ISET-specific queue, Work Queue Items, and Metrics. System Administrators see the development tracker widget instead of Metrics.

Guide users to select a work queue to populate the Work Queue Items table, use filters to find a record, and open the linked workspace. Mention queue-specific actions (for example conflict reassignment, EI eligibility updates, decision/escalation actions), Add widget and Reset layout actions, and remind them that layouts are stored per browser.
`;

export default HomeDashboardHelp;
