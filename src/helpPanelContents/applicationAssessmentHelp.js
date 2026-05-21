import React from 'react';
import TutorialPanel from '@cloudscape-design/components/tutorial-panel';
import { Button, SpaceBetween } from '@cloudscape-design/components';
import { useTutorials } from '../context/TutorialsContext';
import { tutorialPanelI18nStrings } from '../tutorials/tutorialI18n';

const ApplicationAssessmentHelp = () => {
  const { tutorials } = useTutorials();
  const workspaceTutorial = (tutorials || []).find(
    tutorial => tutorial.category === 'application-workspace'
  ) || null;

  const handleStartWorkspaceTutorial = () => {
    const tutorialId = workspaceTutorial?.tutorialId;
    if (!tutorialId) return;
    window.dispatchEvent(
      new CustomEvent('tutorials:start', {
        detail: { tutorialId }
      })
    );
  };

  return (
    <div>
      <h2>Application assessment workflow</h2>
      <p>
        Use this widget to record the coordinator&apos;s assessment and recommendation. This is where you
        explain why the requested intervention should or should not move forward, based on the
        application, documents, research, and conversations with the client.
      </p>

      <h3>Before you start</h3>
      <ul>
        <li>Review the <strong>ISET Application Form</strong> for intake answers, signatures, employment goal, and client background.</li>
        <li>Check <strong>Supporting Documents</strong> so you know which required items are present and which still need follow-up.</li>
        <li>Confirm EI consent and EI verification requirements before moving forward with EI-related decisions.</li>
        <li>For living allowance requests, make sure the financial overview and income or expense verification support what you plan to recommend before you submit the assessment.</li>
      </ul>

      <h3>Completing the assessment</h3>
      <ol>
        <li>Select <em>Edit</em> and confirm to acquire the lock.</li>
        <li>Record EI eligibility and upload verification if required.</li>
        <li>Complete the overview so it explains the client, their background, prior education or work, and why the proposed direction fits.</li>
        <li>Record other funding carefully so the file shows what NWAC is covering and what another funder is covering.</li>
        <li>Capture the intervention details, provider, timing, and cost information clearly enough for review and later follow-through.</li>
        <li>Use the checklist step to confirm the evidence is complete or to identify what still needs follow-up.</li>
        <li>Write the recommendation and justification in plain language. The recommendation should explain why you are recommending support, a different intervention, a referral, or no funding.</li>
        <li>Use <em>Save</em> for a draft, or <em>Submit assessment</em> when the file is ready for NWAC review.</li>
      </ol>

      <h3>After submission</h3>
      <p>
        All coordinator recommendations go to NWAC for decision. Once NWAC records the outcome, PATH
        unlocks the communication step so the approval or denial can be sent properly. Approved files
        may still need Funding Agreement completion and signatures before the file is truly complete.
      </p>

      <h3>Good assessment practice</h3>
      <ul>
        <li>Make the recommendation understandable to someone who did not speak with the client directly.</li>
        <li>Keep numbers, dates, and file details consistent across the form and supporting documents.</li>
        <li>Do not treat &quot;fund&quot; as the default outcome. The assessment can recommend an alternate intervention, referral, or no funding when that better fits the client and program rules.</li>
      </ul>

      {workspaceTutorial ? (
        <div
          style={{
            border: '1px solid var(--color-border-container-default, #d5dbdb)',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '20px'
          }}
        >
          <p style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.4rem', fontWeight: 700 }}>
            {workspaceTutorial.title}
          </p>
          <div style={{ marginBottom: '12px' }}>{workspaceTutorial.description}</div>
          {workspaceTutorial.completed ? (
            <p style={{ marginTop: 0, marginBottom: '12px', color: 'var(--color-text-status-success, #037f0c)' }}>
              Tutorial completed
            </p>
          ) : null}
          <Button variant="primary" onClick={handleStartWorkspaceTutorial}>
            {workspaceTutorial.completed ? 'Restart tutorial' : 'Start tutorial'}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

ApplicationAssessmentHelp.aiContext = `
You are assisting a coordinator filling out the Application Assessment widget. Answer like a case-management coach and file-quality reviewer, not a technical form guide.

Key behaviors and constraints:
- Edit requires acquiring an assessment lock; editing is blocked after a final decision or when another user holds the lock.
- Sections include EI eligibility, assessment overview, barriers/priorities, previous ISET, other funding, intervention details, costs, recommendation, justification, and the document checklist.
- Save keeps a draft without changing status; Submit assessment moves the application to pending approval and unlocks NWAC review.
- Use related widgets for context: Application Overview, ISET Application Form, Supporting Documents, Notes and Tasks, and Secure Messaging.

Training-aligned guidance to surface:
- The assessment should explain the client background, prior education/work, employment goal, and why the recommendation makes sense.
- Keep numbers, dates, and facts consistent across the application and documents.
- EI consent and verification matter before EI-related decisions can proceed.
- Living allowance recommendations should be supported by financial overview and verification. If those are missing and living allowance is still being considered, tell the user not to submit yet: save a draft, document what is outstanding, and follow up for the missing evidence.
- A coordinator does not have to recommend funding; alternate interventions, referrals, job-search support, or no funding may be the correct outcome.
- All coordinator recommendations go to NWAC for approval, and approved files may still require Funding Agreement follow-through before completion.
`;

export const NwacAssessmentHelp = ({ onRestartTutorial, onEndTutorial }) => {
  const { tutorials } = useTutorials();
  const nwacTutorials = (tutorials || []).filter(
    tutorial => tutorial.category === 'nwac-assessment'
  );
  const nwacTutorial = nwacTutorials[0] || null;

  const handleRestart = () => {
    if (typeof onRestartTutorial === 'function') {
      onRestartTutorial();
      return;
    }
    const tutorialId = nwacTutorial?.tutorialId;
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
      <h2>NWAC outcome notice</h2>
      <p>
        This panel appears once the assessment is submitted. Use it to record the NWAC decision and assurance outcome
        before moving to communication.
      </p>
      <SpaceBetween direction="horizontal" size="xs">
        <Button onClick={handleRestart}>Restart tour</Button>
        <Button onClick={handleEnd}>End</Button>
      </SpaceBetween>
      <ol>
        <li>Review the visible <strong>Case manager recommendation</strong> and rationale before recording the outcome.</li>
        <li>Select <strong>Approved</strong>, <strong>Denied</strong>, or <strong>Request Changes</strong>.</li>
        <li>Choose the <strong>Assessment Assurance</strong> outcome when approving or denying.</li>
        <li>Provide the <strong>Reason for denial</strong> or <strong>Request Changes note</strong> when required.</li>
        <li>Click <em>Commit</em> to save the outcome. Approved or denied outcomes stay on the decision screen and unlock the Communication step as a separate follow-up; Request Changes sends the assessment back for updates.</li>
      </ol>
      <p>
        <strong>Request Changes</strong> sends the assessment back to the coordinator or case manager for updates.
        PATH records the Request Changes note in Case Notes / Notes and Reminders for audit visibility; it is not the
        same as denying the application.
      </p>

      <h3>Quick start walkthrough</h3>
      <p>Use the guided walkthrough if you want a focused pass through recording the NWAC decision, checking consistency, and moving the outcome into communication.</p>
      {nwacTutorials.length ? (
        <TutorialPanel
          tutorials={nwacTutorials}
          i18nStrings={tutorialPanelI18nStrings}
        />
      ) : (
        <p>No hands-on tutorials are available for NWAC yet.</p>
      )}

      <p>
        Edits are locked once a final decision exists. Reopen the assessment only when policy permits and capture a
        case note documenting any change.
      </p>
    </div>
  );
};

NwacAssessmentHelp.aiContext = `
You are assisting an NWAC reviewer who is completing the outcome notice at the end of the Application Assessment widget.
Explain that the outcome notice shows the case manager's recommendation and rationale inline, then explain how to
record the funding decision, assurance outcome, and required reasons, and what happens when Commit is selected.
Approved or Denied records the decision, keeps the reviewer on the decision screen, and unlocks the Communication step as a separate follow-up; approvals with funded
cost lines then require completing Funding forms and signatures after the letter is sent, while zero-funding approvals
send an intervention-focused approval letter without a funding package. Complete the application only when all required
items are Complete, while denials complete after the letter is sent. Request Changes returns the assessment to the
coordinator for updates. Editing is disabled after a final decision unless reopening is permitted. Status and audit logs
update automatically.
`;

export default ApplicationAssessmentHelp;
