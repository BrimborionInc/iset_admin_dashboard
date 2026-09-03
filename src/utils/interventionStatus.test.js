import {
  isInterventionDeletableStatus,
  isInterventionFinalDecisionRecorded,
  resolveInterventionApprovalLetterFollowUp,
} from "./interventionStatus";

describe("isInterventionDeletableStatus", () => {
  it("only allows an unsubmitted draft to enter the ordinary delete workflow", () => {
    expect(isInterventionDeletableStatus({ reviewStatus: "draft" })).toBe(true);

    ["submitted", "in_review", "changes_requested", "approved", "rejected"].forEach(
      reviewStatus => {
        expect(isInterventionDeletableStatus({ reviewStatus })).toBe(false);
      }
    );
  });
});

describe("isInterventionFinalDecisionRecorded", () => {
  it("recognizes a final workflow or an approved compatibility proposal", () => {
    expect(isInterventionFinalDecisionRecorded({
      status: "in_progress",
      metadata: { source: "manual_backload" },
    })).toBe(false);
    expect(isInterventionFinalDecisionRecorded({
      status: "in_progress",
      reviewWorkflow: { currentStage: "final_decision_recorded" },
    })).toBe(true);
    expect(isInterventionFinalDecisionRecorded({
      status: "approved",
      review_workflow: { current_stage: "returned_to_rm" },
    })).toBe(false);
    expect(isInterventionFinalDecisionRecorded({
      status: "in_progress",
      proposalId: 233,
      proposalReviewStatus: "approved",
    })).toBe(true);
    expect(isInterventionFinalDecisionRecorded({
      status: "in_progress",
      proposalId: 233,
      proposalReviewStatus: "changes_requested",
    })).toBe(false);
  });
});

describe("resolveInterventionApprovalLetterFollowUp", () => {
  it("does not treat an original approval letter sent marker as a sent revision letter", () => {
    const followUp = resolveInterventionApprovalLetterFollowUp({
      status: "approved",
      metadata: {
        lastAppliedRevision: {
          draftInterventionId: "42",
          sourceTitle: "Employment counselling",
        },
        approvalLetterFollowUp: {
          status: "sent",
          sentAt: "2026-06-18T12:00:00.000Z",
          kind: "new",
        },
      },
    });

    expect(followUp.eligible).toBe(true);
    expect(followUp.isRevision).toBe(true);
    expect(followUp.letterSent).toBe(false);
    expect(followUp.pendingLetter).toBe(true);
  });

  it("counts a sent marker when it belongs to the applied revision", () => {
    const followUp = resolveInterventionApprovalLetterFollowUp({
      status: "approved",
      metadata: {
        lastAppliedRevision: {
          draftInterventionId: "42",
          sourceTitle: "Employment counselling",
        },
        approvalLetterFollowUp: {
          status: "sent",
          sentAt: "2026-06-19T12:00:00.000Z",
          kind: "revision",
          revisionDraftInterventionId: "42",
        },
      },
    });

    expect(followUp.eligible).toBe(true);
    expect(followUp.isRevision).toBe(true);
    expect(followUp.letterSent).toBe(true);
    expect(followUp.pendingLetter).toBe(false);
  });
});
