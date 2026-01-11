import React from 'react';
import TutorialPanel from '@cloudscape-design/components/tutorial-panel';
import { useTutorials } from '../context/TutorialsContext';
import { tutorialPanelI18nStrings } from '../tutorials/tutorialI18n';

const ApplicationCaseDashboardHelp = () => {
  const { tutorials } = useTutorials();
  const workspaceTutorials = (tutorials || []).filter(
    tutorial => tutorial.category === 'application-workspace'
  );

  return (
    <div>
      <h2>ISET application assessment dashboard</h2>
      <p>
        This board is the main workspace for a single application. It brings together intake data, the assessment
        workflow, documents, messaging, reminders, and the audit trail. Layout changes are saved per browser.
      </p>

      <h3>Current widgets</h3>
      <ul>
        <li><strong>Application Overview</strong> - status, SLA, assignment, escalation, checklist summary, and quick actions.</li>
        <li><strong>ISET Application Form</strong> - full intake submission with signatures, edit mode, and version history.</li>
        <li><strong>Application Assessment</strong> - conflict declaration, EI eligibility check, assessment steps, recommendation, and NWAC decision.</li>
        <li><strong>Supporting Documents</strong> - document list and checklist with upload, labeling, and duplicate tools.</li>
        <li><strong>Secure Messaging</strong> - inbox/sent/deleted threads with compose, urgent flags, and attachments.</li>
        <li><strong>Notes and Tasks</strong> - case notes with pinning and follow-up dates that create reminders.</li>
        <li><strong>Case Calendar</strong> - calendar and list views for reminders and key dates.</li>
        <li><strong>Events Timeline</strong> - status changes, assignments, reminders, and CSV export.</li>
      </ul>

      <h3>Typical workflow</h3>
      <ol>
        <li>Start with <em>Application Overview</em> to confirm status, SLA, assignment, and any escalations or alerts.</li>
        <li>Review the <em>ISET Application Form</em> for intake details and signatures; edit only if permitted.</li>
        <li>Complete the <em>Application Assessment</em> steps, saving progress as needed, then submit for NWAC review.</li>
        <li>Use <em>Supporting Documents</em> and the checklist to confirm required evidence; request missing items via <em>Secure Messaging</em>.</li>
        <li>After a decision is recorded, use the Communication step to draft/send the letter; approved cases continue to Complete funding documentation to finish the checklist.</li>
        <li>Capture context in <em>Notes and Tasks</em> and monitor updates in the <em>Events Timeline</em>.</li>
      </ol>

      <h3>Hands-on tutorial</h3>
      <p>Follow the guided walkthrough to see where each widget lives and what it does.</p>
      {workspaceTutorials.length ? (
        <TutorialPanel
          tutorials={workspaceTutorials}
          i18nStrings={tutorialPanelI18nStrings}
        />
      ) : (
        <p>No hands-on tutorials are available for this workspace yet.</p>
      )}

      <h3>Tips</h3>
      <ul>
        <li>Drag, resize, remove, or re-add widgets from the palette; reset restores the default layout.</li>
        <li>Read-only fields remain visible. Use <em>Edit</em> only when the status and lock allow changes.</li>
        <li>Checklist counts depend on document type and attachment; fix mismatches in Supporting Documents.</li>
        <li>Quick actions in Application Overview include assign/reassign, closure notice, escalation, and layout presets.</li>
        <li>Refresh the page after major updates to pull the latest case data and event log entries.</li>
      </ul>
    </div>
  );
};

ApplicationCaseDashboardHelp.aiContext = `You are assisting a coordinator in the ISET Application Assessment dashboard. The board includes Application Overview, ISET Application Form, Application Assessment, Supporting Documents, Secure Messaging, Notes and Tasks, Case Calendar, and Events Timeline.

When the coordinator needs to correct applicant data, direct them to open the ISET Application Form widget, press Edit, confirm the modal, adjust the fields, then choose Save. Saving creates a new version that can be reviewed under View versions; the original submission stays available. Editing is disabled once a final decision is recorded or another user holds the lock.

Remind them to document coordinator-made edits in Notes and Tasks and, when the applicant must be notified, send a Secure Message from the same workspace. After updates, refresh Application Overview or Events Timeline to confirm the change propagated.

Use program guidance: contact new applicants within five days; make up to three attempts for missing information before closure. Required evidence includes Status/Treaty card or two Nation letters plus self-declaration, two IDs, acceptance letter and fee statement, band funding denial where applicable, and income or expense proofs for living allowance. An application remains pending until documents are complete, the coordinator recommendation is recorded, the NWAC decision is set, and the Funding Agreement is signed.`;

export default ApplicationCaseDashboardHelp;
