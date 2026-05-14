import React from 'react';
import TutorialPanel from '@cloudscape-design/components/tutorial-panel';
import { Button, SpaceBetween } from '@cloudscape-design/components';
import { useTutorials } from '../context/TutorialsContext';
import { tutorialPanelI18nStrings } from '../tutorials/tutorialI18n';

const ApplicationCaseDashboardHelp = ({ onRestartTutorial, onEndTutorial }) => {
  const { tutorials } = useTutorials();
  const workspaceTutorials = (tutorials || []).filter(
    tutorial => tutorial.category === 'application-workspace'
  );
  const workspaceTutorial = workspaceTutorials[0] || null;

  const handleRestart = () => {
    if (typeof onRestartTutorial === 'function') {
      onRestartTutorial();
      return;
    }
    const tutorialId = workspaceTutorial?.tutorialId;
    if (!tutorialId) return;
    window.dispatchEvent(
      new CustomEvent('tutorials:start', {
        detail: { tutorialId }
      })
    );
  };

  const handleEnd = () => {
    if (typeof onEndTutorial === 'function') {
      onEndTutorial();
      return;
    }
    window.dispatchEvent(new CustomEvent('tutorials:end'));
  };

  return (
    <div>
      <h2>ISET application assessment dashboard</h2>
      <p>
        This is the full application file while the applicant is being assessed. Use it to review the
        intake, request or verify documents, complete the assessment, communicate with the applicant,
        and keep the audit trail together in one place.
      </p>
      <p>
        When this workspace is opened from the homepage <strong>Pending Decision</strong> queue, PATH now
        switches to an approval review layout so the approver can move directly from the application
        form and supporting documents into <strong>Application Assessment &gt; Approval and decision</strong>.
      </p>
      <SpaceBetween direction="horizontal" size="xs">
        <Button onClick={handleRestart}>Restart tour</Button>
        <Button onClick={handleEnd}>End</Button>
      </SpaceBetween>

      <h3>What is on this workspace</h3>
      <ul>
        <li><strong>Application Overview</strong> - your quick status check before you start work.</li>
        <li><strong>ISET Application Form</strong> - the original intake details, signatures, and any corrected versions.</li>
        <li><strong>Application Assessment</strong> - where the coordinator records the assessment and recommendation.</li>
        <li><strong>Supporting Documents</strong> - the evidence file and checklist.</li>
        <li><strong>Secure Messaging</strong> - applicant communication kept inside the file.</li>
        <li><strong>Notes and Tasks</strong> - internal notes, call records, and follow-up reminders.</li>
        <li><strong>Case Calendar</strong> - reminders and key dates.</li>
        <li><strong>Events Timeline</strong> - the running history of status and workflow activity.</li>
      </ul>

      <h3>Typical coordinator workflow</h3>
      <ol>
        <li>Start with <em>Application Overview</em> to confirm status, ownership, checklist summary, and urgency.</li>
        <li>Review the <em>ISET Application Form</em> and <em>Supporting Documents</em> together so you understand the applicant&apos;s request, background, and missing evidence.</li>
        <li>Check whether EI consent and EI verification requirements are satisfied before moving the assessment forward.</li>
        <li>If documents or clarification are missing, contact the applicant through <em>Secure Messaging</em> and record the contact in <em>Notes and Tasks</em>.</li>
        <li>Complete the <em>Application Assessment</em> with a clear recommendation and justification, then submit it to NWAC for decision.</li>
        <li>After the decision, use the communication and funding-agreement steps to finish the file properly instead of treating the decision alone as the end of the work.</li>
      </ol>

      <h3>Training-aligned reminders</h3>
      <ul>
        <li>Contact new applicants promptly and document requests for missing information.</li>
        <li>All documents received and all meaningful staff interactions should be captured in the file.</li>
        <li>A file is still pending until documents, coordinator assessment, NWAC approval, and the signed Funding Agreement are complete.</li>
        <li>If a living allowance is being considered, the financial overview and verification need to support the recommendation.</li>
      </ul>

      <h3>Quick start walkthrough</h3>
      <p>Use the guided walkthrough if you want a practical pass through the application file, what each area is for, and what should be recorded as you work it.</p>
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
        <li>Quick actions in Application Overview include assign/reassign, closure notice, withdrawal, escalation, and layout presets.</li>
        <li>Refresh the page after major updates to pull the latest case data and event log entries.</li>
      </ul>
    </div>
  );
};

ApplicationCaseDashboardHelp.aiContext = `You are assisting a coordinator in the ISET Application Assessment dashboard. The board includes Application Overview, ISET Application Form, Application Assessment, Supporting Documents, Secure Messaging, Notes and Tasks, Case Calendar, and Events Timeline.

Guide the user like a trained coordinator working a file, not like a product demo:
- Start from what they need to do next in the assessment process.
- Use Application Overview to orient, Application Form plus Supporting Documents to review evidence, Secure Messaging plus Notes for follow-up, and Application Assessment for the recommendation.
- If the file was opened from the Pending Decision queue, explain that the workspace is intentionally focused on review and the decision belongs in Application Assessment > Approval and decision.
- Remind them that missing information requests and significant staff contact should be documented.

When the coordinator needs to correct applicant data, direct them to the ISET Application Form widget: press Edit, confirm the modal, adjust the fields, then Save. Saving creates a new version visible under View versions. Editing is disabled once a final decision is recorded or another user holds the lock.

Use program guidance: contact new applicants within five days; make up to three attempts for missing information before closure. Required evidence includes Status/Treaty card or two Nation letters plus self-declaration, two IDs, acceptance letter and fee statement, band funding denial where applicable, and income or expense proofs for living allowance. An application remains pending until documents are complete, the coordinator recommendation is recorded, the NWAC decision is set, and the Funding Agreement is signed.`;

export default ApplicationCaseDashboardHelp;
