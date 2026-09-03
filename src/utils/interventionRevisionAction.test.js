import { resolveInterventionRevisionAction } from "./interventionRevisionAction.js";

describe("resolveInterventionRevisionAction", () => {
  const approvedApplicationIntervention = {
    id: 109,
    status: "in_progress",
    deliveryStatus: "in_progress",
    proposalId: 233,
    proposalReviewStatus: "approved",
  };

  it("offers a revision for an approved application intervention with no open proposal", () => {
    expect(resolveInterventionRevisionAction({
      intervention: approvedApplicationIntervention,
      canModify: true,
    })).toEqual({
      available: true,
      reason: "revision_available",
      label: "Revise approved intervention",
      draft: null,
    });
  });

  it("resumes the matching revision draft even though a proposal is already open", () => {
    const matchingRevisionDraft = { id: 521, status: "draft" };
    expect(resolveInterventionRevisionAction({
      intervention: approvedApplicationIntervention,
      canModify: true,
      hasOpenProposal: true,
      matchingRevisionDraft,
    })).toEqual({
      available: true,
      reason: "matching_revision_draft",
      label: "Resume revision draft",
      draft: matchingRevisionDraft,
    });
  });

  it("does not offer a second revision while another proposal is open", () => {
    expect(resolveInterventionRevisionAction({
      intervention: approvedApplicationIntervention,
      canModify: true,
      hasOpenProposal: true,
    })).toEqual({
      available: false,
      reason: "another_proposal_open",
    });
  });
});
