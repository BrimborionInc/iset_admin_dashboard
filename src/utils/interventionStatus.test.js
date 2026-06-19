import { resolveInterventionApprovalLetterFollowUp } from "./interventionStatus";

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
