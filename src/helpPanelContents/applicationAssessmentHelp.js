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
        <li>Record other funding carefully so the file shows which funders are confirmed, pending, denied, or unknown, and what program funding is covering.</li>
        <li>Capture the intervention details, provider, timing, and cost information clearly enough for review and later follow-through.</li>
        <li>Use the checklist step to confirm the evidence is complete or to identify what still needs follow-up.</li>
        <li>Write the recommendation and justification in plain language. The recommendation should explain why you are recommending support, a different intervention, a referral, or no funding.</li>
        <li>Use <em>Save</em> for a draft, or <em>Submit for review</em> when the file is ready for Regional Manager review.</li>
      </ol>

      <h3>After submission</h3>
      <p>
        Submitted recommendations go to Regional Manager review before the Decision Maker records the
        final outcome. If the Regional Manager or Decision Maker requests changes, PATH returns the
        assessment with notes so the coordinator can update and resubmit it. Once the final outcome is
        recorded, PATH unlocks the communication step so the approval or denial can be sent properly.
        Approved files may still need Funding Agreement completion and signatures before the file is
        truly complete.
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
- Save keeps a draft without changing status; Submit for review sends the assessment into the active review workflow.
- Use related widgets for context: Application Overview, ISET Application Form, Supporting Documents, Notes and Tasks, and Secure Messaging.

Training-aligned guidance to surface:
- The assessment should explain the client background, prior education/work, employment goal, and why the recommendation makes sense.
- Keep numbers, dates, and facts consistent across the application and documents.
- Other funding should distinguish confirmed funding from pending, denied, or unknown sources; confirmed funders need coverage details, while amount can be left blank when it is not known.
- EI consent and verification matter before EI-related decisions can proceed.
- Living allowance recommendations should be supported by financial overview and verification. If those are missing and living allowance is still being considered, tell the user not to submit yet: save a draft, document what is outstanding, and follow up for the missing evidence.
- A coordinator does not have to recommend funding; alternate interventions, referrals, job-search support, or no funding may be the correct outcome.
- Coordinator recommendations go through the Regional Manager review and final-decision workflow, and approved files may still require Funding Agreement follow-through before completion.
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
      <h2>Decision review</h2>
      <p>
        This panel appears once the assessment is ready for final decision. Use it to review the
        coordinator recommendation, Regional Manager sign-off, decision outcome, and assurance outcome
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
        <li>Click <em>Commit</em> to save the outcome. Approved or denied outcomes stay on the decision screen and unlock the Communication step as a separate follow-up; Request Changes sends the assessment back to the Regional Manager first.</li>
      </ol>
      <p>
        <strong>Request Changes</strong> sends the assessment back to the Regional Manager first. The
        Regional Manager reviews the Decision Maker note and forwards changes to the coordinator with
        their own note. PATH records the notes for audit visibility; requesting changes is not the same
        as denying the application.
      </p>

      <h3>Quick start walkthrough</h3>
      <p>Use the guided walkthrough if you want a focused pass through recording the final decision, checking consistency, and moving the outcome into communication.</p>
      {nwacTutorials.length ? (
        <TutorialPanel
          tutorials={nwacTutorials}
          i18nStrings={tutorialPanelI18nStrings}
        />
      ) : (
        <p>No hands-on tutorials are available for decision review yet.</p>
      )}

      <p>
        Edits are locked once a final decision exists. Reopen the assessment only when policy permits and capture a
        case note documenting any change.
      </p>
    </div>
  );
};

NwacAssessmentHelp.aiContext = `
You are assisting a Decision Maker who is completing the decision review at the end of the Application Assessment widget.
Explain that the decision step shows the case manager's recommendation/rationale and the Regional Manager review note inline, then explain how to
record the funding decision, assurance outcome, and required reasons, and what happens when Commit is selected.
Approved or Denied records the decision, keeps the reviewer on the decision screen, and unlocks the Communication step as a separate follow-up; approvals with funded
cost lines then require completing Funding forms and signatures after the letter is sent, while zero-funding approvals
send an intervention-focused approval letter without a funding package. Complete the application only when all required
items are Complete, while denials complete after the letter is sent. Request Changes returns the assessment to the
Regional Manager first; the Regional Manager forwards the requested changes to the coordinator with notes. Editing is disabled after a final decision unless reopening is permitted. Status and audit logs
update automatically.
`;

export default ApplicationAssessmentHelp;
