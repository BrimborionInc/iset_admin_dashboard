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

      <h3>Typical coordinator flow</h3>
      <ol>
        <li>Start with <strong>Case header</strong> and <strong>Participant details</strong> to confirm you are on the right file and the client information is current.</li>
        <li>Use <strong>Action plans</strong> and <strong>Interventions</strong> to manage the client&apos;s active path toward employment or training goals.</li>
        <li>Record follow-up, conversations, and decisions in <strong>Notes</strong>, and keep evidence in <strong>Supporting documents</strong>.</li>
        <li>Use <strong>Secure messaging</strong> and the <strong>Case calendar</strong> to manage ongoing communication and reminders.</li>
        <li>When an intervention ends, capture outcomes, complete required follow-up, and close the file properly instead of letting it drift.</li>
      </ol>

      <h3>What matters most</h3>
      <ul>
        <li>Keep participant details, plans, interventions, and dates current so reporting and reminders stay accurate.</li>
        <li>Record meaningful client contact, follow-up attempts, and decisions in the file.</li>
        <li>Use documents and notes together so the case can stand on its own during review or audit.</li>
        <li>Follow through after the intervention ends, including outcome tracking and the required post-intervention follow-up, including the 12-week follow-up where it applies, before closing the file.</li>
      </ul>

      <h3>Layout tips</h3>
      <ul>
        <li>Use <em>Add widget</em> if you need optional panels such as Finance or Compliance.</li>
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
- record notes, documents, and client contact;
- use reminders and calendar dates to stay on top of check-ins and milestones;
- capture outcomes, complete the required post-intervention follow-up, including the 12-week follow-up where applicable, and then close the file properly.

Mention Add widget, Reset layout, and board movement only as secondary mechanics. When relevant, remind the user that PATH should support the same training expectations around documentation, audit trail, ongoing follow-up, and post-intervention outcome tracking.`;

export default CaseWorkspaceHelp;
