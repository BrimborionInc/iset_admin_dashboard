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
        <li>Confirm the signed EI consent is on file. An authorized Regional Manager or Decision Maker must record the verified status as <strong>CRF</strong>, <strong>EI Active Claim</strong>, or <strong>EI Reach Back</strong> before the assessment can move forward.</li>
        <li>For living allowance requests, make sure the financial overview and income or expense verification support what you plan to recommend before you submit the assessment.</li>
      </ul>

      <h3>Completing the assessment</h3>
      <ol>
        <li>Select <em>Edit</em> and confirm to acquire the lock.</li>
        <li>Check the EI status and verification evidence. Coordinators can view these fields but cannot set them; ask an authorized Regional Manager or Decision Maker to complete the check when it is outstanding.</li>
        <li>Complete the overview so it explains the client, their background, prior education or work, and why the proposed direction fits.</li>
        <li>Record other funding carefully so the file shows which funders are confirmed, pending, denied, or unknown, and what program funding is covering.</li>
        <li>Capture the intervention details, provider, timing, and cost information clearly enough for review and later follow-through.</li>
        <li>Use the checklist step to confirm the evidence is complete or to identify what still needs follow-up.</li>
        <li>Write the recommendation and justification in plain language. The recommendation should explain why you are recommending support, a different intervention, a referral, or no funding.</li>
        <li>Use <em>Save</em> for a draft, or <em>Submit for review</em> when the file is ready for Regional Manager review.</li>
      </ol>

      <h3>How the two-step review works</h3>
      <ol>
        <li><strong>Submit for review</strong> sends the read-only assessment to the Regional Manager&apos;s <strong>Pending Review</strong> queue.</li>
        <li>The Regional Manager either returns it to the recorded submitter with a required note or selects <strong>Submit for final decision</strong>.</li>
        <li>The Decision Maker approves, denies, or requests changes from <strong>Pending Decision</strong>.</li>
        <li>A Decision Maker request goes back to the Regional Manager first. The Regional Manager adds context and forwards it to the original submitter.</li>
        <li>The submitter corrects and resubmits the assessment through Regional Manager review again. Work moves up and down one review level at a time.</li>
      </ol>
      <p>
        Once a final decision is recorded, PATH unlocks the communication step. For an approval with
        funded cost lines, sending the client approval letter also sends the application-specific
        Client Funding Agreement and EFT/Wire Transfer form. Zero-funding approvals do not create a
        funding package. Required forms and signatures remain separate post-approval work.
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
- Work moves up and down one level at a time: submitter -> Regional Manager -> Decision Maker; Decision Maker-requested changes return to the Regional Manager before the original submitter.
- The assessment body is read-only during Regional Manager review, Decision Maker review, and the returned-to-Regional-Manager stage. Only the recorded submitter edits returned work.

Training-aligned guidance to surface:
- The assessment should explain the client background, prior education/work, employment goal, and why the recommendation makes sense.
- Keep numbers, dates, and facts consistent across the application and documents.
- Other funding should distinguish confirmed funding from pending, denied, or unknown sources; confirmed funders need coverage details, while amount can be left blank when it is not known.
- A signed Client Consent for EI Verification is required before the verification request. The application assessment must have one verified status before submission: CRF maps to CRF funding; EI Active Claim and EI Reach Back map to EI funding.
- Coordinators can view but cannot set the Application Assessment EI status. Regional Managers, Decision Makers, and System Administrators can set it and upload evidence. A Regional Manager can complete this reviewer-only check while the submitted assessment body stays read-only.
- When a returned correction leaves the accepted EI status unchanged, do not tell the user to obtain a new report solely because another field changed. If the EI status itself changes, supporting verification evidence must be present.
- Living allowance recommendations should be supported by financial overview and verification. If those are missing and living allowance is still being considered, tell the user not to submit yet: save a draft, document what is outstanding, and follow up for the missing evidence.
- A coordinator does not have to recommend funding; alternate interventions, referrals, job-search support, or no funding may be the correct outcome.
- After final approval, funded cost lines trigger the exact application-linked Client Funding Agreement and EFT/Wire Transfer form when the approval letter is sent. Zero-funding approvals have no CFA package. CFA signing is post-approval document work and must not be described as another review decision.
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
        <li>Confirm the verified EI result and matching CRF or EI funding stream. Do not change EI merely to fit an available budget pot.</li>
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
      <p>
        A final approval is recorded before any Client Funding Agreement is sent. When funded cost
        lines exist, the later approval-letter send includes the exact application&apos;s CFA and
        EFT/Wire Transfer form. A zero-funding approval sends no CFA package.
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
confirm the EI result and funding-stream alignment, record the funding decision, assurance outcome, and required reasons, and explain what happens when Commit is selected. CRF maps to the CRF stream; EI Active Claim and EI Reach Back map to EI. Never advise changing a verified EI result merely to fit a budget pot.
Approved or Denied records the decision, keeps the reviewer on the decision screen, and unlocks the Communication step as a separate follow-up; approvals with funded
cost lines then send the exact application-linked Client Funding Agreement and EFT/Wire Transfer form with the approval letter and require completing Funding forms and signatures, while zero-funding approvals
send an intervention-focused approval letter without a CFA package. Complete the application only when all required
items are Complete, while denials complete after the letter is sent. Request Changes returns the assessment to the
Regional Manager first; the Regional Manager forwards the requested changes to the recorded submitter with notes, and the correction must pass Regional Manager review again before returning for final decision. Editing is disabled after a final decision unless reopening is permitted. Status and audit logs
update automatically.
`;

export default ApplicationAssessmentHelp;
