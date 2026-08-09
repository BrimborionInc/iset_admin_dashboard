import React from "react";
import { Button } from "@cloudscape-design/components";
import { useTutorials } from "../context/TutorialsContext";

const CaseWorkspaceHelp = ({ tutorial, onRestartTutorial, onEndTutorial }) => {
  const { tutorials } = useTutorials();
  const workspaceTutorial =
    tutorial ||
    (tutorials || []).find(item => item?.category === "case-workspace") ||
    null;

  const handleStartTutorial = () => {
    if (typeof onRestartTutorial === "function") {
      onRestartTutorial();
      return;
    }
    const tutorialId = workspaceTutorial?.tutorialId;
    if (!tutorialId) return;
    window.dispatchEvent(
      new CustomEvent("tutorials:start", {
        detail: { tutorialId },
      })
    );
  };

  const handleEndTutorial = () => {
    if (typeof onEndTutorial === "function") {
      onEndTutorial();
      return;
    }
    window.dispatchEvent(new CustomEvent("tutorials:end"));
  };

  return (
    <div>
      <p>
        The case workspace is where ongoing case management happens after the application stage. Use it
        to keep the participant record current, manage action plans and interventions, record notes and
        documents, communicate with the client, and track follow-up through completion and closure.
      </p>
      <p>
        When this workspace is opened from the homepage <strong>Pending Review</strong> or
        <strong> Pending Decision</strong> queue for an intervention proposal or change, PATH opens a
        focused four-widget review layout with
        <strong> Case header</strong>, <strong>Proposed new intervention</strong>,
        <strong> Participant details</strong>, and <strong>Supporting documents</strong>, and loads
        the selected proposal in the active review or final-decision step. Any decision-letter work
        happens separately after the final decision is recorded.
      </p>
      <p>
        Review work moves submitter to Regional Manager to Decision Maker. A Decision Maker request
        comes back to the Regional Manager first, then the RM forwards it to the recorded submitter.
        The packet stays read-only with reviewers. EI status controls CRF/EI funding alignment, while
        the review stage controls queue ownership.
      </p>
      <p>
        This workspace is also where authorized staff record historical casework that already existed outside PATH.
        Use the <strong>Case header</strong> quick actions <strong>Add existing action plan</strong>,{" "}
        <strong>Add existing intervention</strong>, and <strong>Upload existing documents</strong> to record
        historical plans, supports, and evidence without fabricating intake or approval records.
      </p>

      <h3>Typical coordinator flow</h3>
      <ol>
        <li>Start with <strong>Case header</strong> and <strong>Participant details</strong> to confirm you are on the right file and the client information is current.</li>
        <li>Use <strong>Action plans</strong> and <strong>Interventions</strong> to manage the client&apos;s active path toward employment or training goals.</li>
        <li>Record follow-up, conversations, and decisions in <strong>Notes</strong>, and keep evidence in <strong>Supporting documents</strong>.</li>
        <li>Use <strong>Secure messaging</strong> and the <strong>Case calendar</strong> to manage ongoing communication and reminders.</li>
        <li>Use <strong>Events timeline</strong> when you need the running audit trail of what happened on the case and when.</li>
        <li>When an intervention ends, capture outcomes, complete required follow-up, and close the file properly instead of letting it drift.</li>
      </ol>

      <h3>Historical records</h3>
      <ul>
        <li>Use the Case Header add-existing actions only when the plan, intervention, or document already existed outside PATH.</li>
        <li>These actions add historical records only; they do not send messages to applicants or start approval routing.</li>
        <li>Backloaded interventions still have to match the action-plan lifecycle. Archived plans are blocked, closed plans only accept completed or cancelled interventions, and in-progress or suspended interventions require an active plan.</li>
        <li>Add historical supporting documents to the relevant client file, action plan, or case.</li>
      </ul>

      <h3>What matters most</h3>
      <ul>
        <li>Keep participant details, plans, interventions, and dates current so reporting and reminders stay accurate.</li>
        <li>Record meaningful client contact, follow-up attempts, and decisions in the file.</li>
        <li>Use documents and notes together so the case can stand on its own during review or audit.</li>
        <li>Follow through after the intervention ends, including outcome tracking and the required post-intervention follow-up, including the 12-week follow-up where it applies, before closing the file.</li>
        <li>For a funded final approval, send the client letter with the exact Action Plan&apos;s CFA and EFT/Wire Transfer form. Zero-funding approvals, denials, and requested changes do not start CFA signing.</li>
      </ul>

      <h3>Layout tips</h3>
      <ul>
        <li>Use <em>Add widget</em> if you need optional panels such as Finance or Compliance.</li>
        <li>Use the Case Header quick action <em>View audit trail</em> when you want a focused case-header + events view.</li>
        <li>Use <em>Reset layout</em> if you want to return to the default case view.</li>
        <li>The workspace refreshes after edits, and individual widgets also have refresh actions when you need to pull teammate updates.</li>
      </ul>
      {workspaceTutorial ? (
        <div
          style={{
            border: "1px solid var(--color-border-container-default, #d5dbdb)",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "20px",
          }}
        >
          <p style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.4rem", fontWeight: 700 }}>
            {workspaceTutorial.title}
          </p>
          <div style={{ marginBottom: "12px" }}>{workspaceTutorial.description}</div>
          {workspaceTutorial.completed ? (
            <p style={{ marginTop: 0, marginBottom: "12px", color: "var(--color-text-status-success, #037f0c)" }}>
              Tutorial completed
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={handleStartTutorial}>
              {workspaceTutorial.completed ? "Restart tutorial" : "Start tutorial"}
            </Button>
            <Button onClick={handleEndTutorial}>End</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

CaseWorkspaceHelp.aiContext = `You are guiding a case manager through the Case Workspace board. Treat this workspace as the coordinator's main tool for active case management after application approval.

Focus on the staff workflow:
- confirm the right case and current participant details;
- manage action plans and interventions against the client's goals;
- if the file was opened from Pending Review or Pending Decision, explain that the workspace is intentionally focused on the selected proposal and the active review step; any decision-letter follow-up happens separately after the final decision is committed;
- explain the two-step route when relevant: the RM returns ordinary review work to the recorded submitter or submits it for final decision; Decision Maker-requested changes return to the RM first and must be forwarded to the submitter, then pass RM review again;
- explain that EI status controls CRF/EI Action Plan alignment but review stage controls queue ownership; a new proposal can enter RM review before EI is final, but approval cannot be recorded without the EI result;
- explain that funded final approvals send the exact Action Plan/application-linked CFA and EFT form during client-letter follow-up, while zero-funding approvals have no CFA package; CFA signing is not another review stage;
- record notes, documents, and client contact;
- explain that authorized users can use the Case Header quick actions \`Add existing action plan\`, \`Add existing intervention\`, and \`Upload existing documents\` to backload historical casework without inventing intake or approval records;
- when backload questions come up, mention the key guardrails: archived plans cannot receive existing interventions, closed plans only accept completed/cancelled interventions, in-progress or suspended interventions require an active plan, and historic documents stay case-based when there is no linked application;
- use reminders and calendar dates to stay on top of check-ins and milestones;
- use the events timeline when you need the case audit trail or need to confirm what changed and who changed it;
- capture outcomes, complete the required post-intervention follow-up, including the 12-week follow-up where applicable, and then close the file properly.

Mention Add widget, Reset layout, and board movement only as secondary mechanics. When relevant, remind the user that PATH should support the same training expectations around documentation, audit trail, ongoing follow-up, and post-intervention outcome tracking.`;

export default CaseWorkspaceHelp;
