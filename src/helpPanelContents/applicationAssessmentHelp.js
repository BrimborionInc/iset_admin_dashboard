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
      Use this form to document the assessment, confirm eligibility, and capture the funding recommendation. Required
      fields must be completed before you can submit for NWAC review. Editing requires an assessment lock and becomes
      read-only once a final decision is recorded.
    </p>

    <h3>Before you start</h3>
    <ul>
      <li>Review the <strong>ISET Application Form</strong> for intake answers, signatures, and background details.</li>
      <li>Check <strong>Supporting Documents</strong> and confirm the checklist reflects the required evidence.</li>
      <li>Complete the conflict of interest declaration if it is still required; the assessment stays locked until it is signed.</li>
      <li>Set EI eligibility if your role permits it; sections remain locked until eligibility is recorded.</li>
    </ul>

    <h3>Completing the form</h3>
    <ol>
      <li>Select <em>Edit</em> and confirm to acquire the lock.</li>
      <li>Record EI eligibility and upload verification if required.</li>
      <li>Complete the assessment overview, employment goals, barriers, priorities, other funding, and previous ISET details.</li>
      <li>In <em>Other funding</em>, record whether other funding exists, add each non-NWAC funder, and capture what NWAC will cover to prevent overlap.</li>
      <li>Capture intervention details (dates, provider, delivery mode, NOC code/version when required, childcare needs).</li>
      <li>Enter costs using the ITP and/or wage subsidy breakdowns and confirm totals.</li>
      <li>When adding or editing cost items, capture payee details in the same modal when available (payee is encouraged here but not required to advance this step).</li>
      <li>Review the checklist step and upload missing documents as needed.</li>
      <li>Set the recommendation and justification on the Review step.</li>
      <li>Click <em>Save</em> to keep a draft, or <em>Submit assessment</em> to move the application to <strong>pending approval</strong>.</li>
    </ol>

    <h3>Outcome notice</h3>
    <p>
      After submission, the NWAC section unlocks for reviewers to record the decision and assurance outcome. Approved
      or Not Approved moves the application to decision ready; Push back returns it to in review. The Communication step
      then appears to draft and send the approval or denial letter. For approvals, the client letter remains editable
      while institution and other-funding-source letters are available as admin-only read-only tabs for preview/download.
      Approved cases continue to Funding forms and signatures to monitor form completion; mark the application complete
      only when all required items show Complete. Denial letters complete the application.
    </p>

    <h3>Need to revise?</h3>
    <p>
      If adjustments are required after submission and policy allows, choose <em>Edit</em> to re-open the form (lock
      required). Save or re-submit to persist changes; edits are blocked once a final decision exists unless reopening
      is permitted.
    </p>

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
You are assisting a coordinator filling out the Application Assessment widget. Key behaviors and constraints:
- Edit requires acquiring an assessment lock; editing is blocked after a final decision or when another user holds the lock.
- Sections include EI eligibility, overview/employment goals, barriers and local priorities, previous ISET, structured other funding (involved yes/no/unknown, repeatable funders, NWAC coverage, notes), intervention details (provider, dates, program name, NOC + version as needed, childcare need), costs (ITP and/or wage breakdowns plus optional early payee capture in cost-item modals), recommendation, justification, and the document checklist.
- Save keeps a draft without changing status; Submit assessment moves the application to pending approval and unlocks NWAC review.
- Use related widgets for context: Application Overview (status/owner), ISET Application Form (applicant data/version history), Supporting Documents (evidence/checklist), Notes and Tasks (audit trail), Secure Messaging (doc requests).
- In approved outcomes, treat Communication as a letter pack: edit/send only the client letter; institution and other funding source letters are admin-only preview/download tabs.
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
        <li>Select <strong>Approved</strong>, <strong>Not Approved</strong>, or <strong>Push back to coordinator</strong>.</li>
        <li>Choose the <strong>Assessment Assurance</strong> outcome when approving or not approving.</li>
        <li>Provide the <strong>Reason for Not Approving</strong> or <strong>Reason for Push Back</strong> when required.</li>
        <li>Click <em>Commit</em> to save the outcome, update status, and unlock the Communication step.</li>
      </ol>

      <h3>Hands-on tutorial</h3>
      <p>Follow the guided walkthrough to record the NWAC decision and communicate the outcome.</p>
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
Explain how to record the funding decision, assurance outcome, and required reasons, and what happens when Commit is
selected. Approved or Not Approved moves the application to decision ready and unlocks the Communication step; approvals
then require completing Funding forms and signatures after the letter is sent; complete the application only when all
required items are Complete, while denials complete after the letter is sent. Push back returns the assessment to the
coordinator for updates. Editing is disabled after a final decision unless
reopening is permitted. Status and audit logs update automatically.
`;

export default ApplicationAssessmentHelp;
