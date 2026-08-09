import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { apiFetch } from "../../../auth/apiClient.js";
import { CaseWorkspaceProvider, useCaseWorkspace } from "./CaseWorkspaceContext.jsx";

jest.mock("../../../auth/apiClient.js", () => ({ apiFetch: jest.fn() }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const response = payload => ({
  ok: true,
  status: 200,
  json: async () => payload,
});

const workspacePayload = ({ caseId, applicationId, label }) => ({
  id: caseId,
  applicationId,
  caseNumber: label,
  client: { id: caseId, firstName: label, lastName: "Participant" },
  actionPlans: [{ id: caseId * 10, applicationId, title: `${label} plan`, interventions: [] }],
});

let latestWorkspace;

const WorkspaceProbe = () => {
  latestWorkspace = useCaseWorkspace();
  return null;
};

const renderWorkspace = (caseId, applicationId) => render(
  <CaseWorkspaceProvider caseId={caseId} applicationId={applicationId}>
    <WorkspaceProbe />
  </CaseWorkspaceProvider>
);

describe("CaseWorkspaceProvider route ownership", () => {
  afterEach(() => {
    cleanup();
    apiFetch.mockReset();
    latestWorkspace = null;
    jest.useRealTimers();
  });

  test("keeps only the newest A/B/A response and clears actions, selections, and the old lock while changing scope", async () => {
    const oldA = deferred();
    const routeB = deferred();
    const newA = deferred();
    const requests = [oldA, routeB, newA];

    apiFetch.mockImplementation((url, options = {}) => {
      if (options.method === "DELETE") return Promise.resolve(response({}));
      const next = requests.shift();
      if (!next) throw new Error(`Unexpected request: ${url}`);
      return next.promise;
    });

    const view = renderWorkspace(1, 10);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/cases/1/workspace?applicationId=10",
      expect.objectContaining({ method: "GET" })
    ));

    view.rerender(
      <CaseWorkspaceProvider caseId={2} applicationId={20}>
        <WorkspaceProbe />
      </CaseWorkspaceProvider>
    );
    await act(async () => {
      routeB.resolve(response(workspacePayload({ caseId: 2, applicationId: 20, label: "Route B" })));
      await routeB.promise;
    });
    await waitFor(() => expect(latestWorkspace.caseData?.caseNumber).toBe("Route B"));

    act(() => {
      latestWorkspace.setSelectedActionPlanId(20);
      latestWorkspace.setSelectedInterventionId(200);
    });
    expect(latestWorkspace.selectedActionPlanId).toBe(20);
    expect(latestWorkspace.selectedInterventionId).toBe(200);

    view.rerender(
      <CaseWorkspaceProvider caseId={1} applicationId={11}>
        <WorkspaceProbe />
      </CaseWorkspaceProvider>
    );

    expect(latestWorkspace.caseData).toBeNull();
    expect(latestWorkspace.isLoading).toBe(true);
    expect(latestWorkspace.selectedActionPlanId).toBeNull();
    expect(latestWorkspace.selectedInterventionId).toBeNull();
    await expect(latestWorkspace.createActionPlan({ title: "stale" })).rejects.toMatchObject({
      code: "WORKSPACE_SCOPE_NOT_READY",
    });
    expect(apiFetch).not.toHaveBeenCalledWith(
      "/api/cases/1/action-plans",
      expect.objectContaining({ method: "POST" })
    );

    await act(async () => {
      newA.resolve(response(workspacePayload({ caseId: 1, applicationId: 11, label: "New Route A" })));
      await newA.promise;
    });
    await waitFor(() => expect(latestWorkspace.caseData?.caseNumber).toBe("New Route A"));
    expect(latestWorkspace.caseData?.actionPlans?.[0]?.applicationId).toBe(11);

    await act(async () => {
      oldA.resolve(response(workspacePayload({ caseId: 1, applicationId: 10, label: "Old Route A" })));
      await oldA.promise;
    });
    expect(latestWorkspace.caseData?.caseNumber).toBe("New Route A");
    expect(latestWorkspace.selectedActionPlanId).toBe(10);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/locks/application/20",
      { method: "DELETE" }
    );
  });

  test("treats an application change on the same case as a new scope", async () => {
    let workspaceRequestCount = 0;
    apiFetch.mockImplementation((url, options = {}) => {
      if (options.method === "DELETE") return Promise.resolve(response({}));
      workspaceRequestCount += 1;
      if (workspaceRequestCount === 1) {
        return Promise.resolve(response(workspacePayload({ caseId: 3, applicationId: 30, label: "Application 30" })));
      }
      return new Promise(() => {});
    });

    const view = renderWorkspace(3, 30);
    await waitFor(() => expect(latestWorkspace.caseData?.caseNumber).toBe("Application 30"));

    view.rerender(
      <CaseWorkspaceProvider caseId={3} applicationId={31}>
        <WorkspaceProbe />
      </CaseWorkspaceProvider>
    );

    expect(latestWorkspace.caseData).toBeNull();
    expect(latestWorkspace.isLoading).toBe(true);
  });

  test("does not retry a failed request after its route scope is abandoned", async () => {
    jest.useFakeTimers();
    apiFetch.mockImplementation((url, options = {}) => {
      if (options.method === "DELETE") return Promise.resolve(response({}));
      if (url.startsWith("/api/cases/4/")) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      }
      return Promise.resolve(response(workspacePayload({ caseId: 5, applicationId: 50, label: "Current" })));
    });

    const view = renderWorkspace(4, 40);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/cases/4/workspace?applicationId=40",
      expect.objectContaining({ method: "GET" })
    ));

    view.rerender(
      <CaseWorkspaceProvider caseId={5} applicationId={50}>
        <WorkspaceProbe />
      </CaseWorkspaceProvider>
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    const abandonedCalls = apiFetch.mock.calls.filter(([url]) => url.startsWith("/api/cases/4/"));
    expect(abandonedCalls).toHaveLength(1);
    expect(latestWorkspace.caseData?.caseNumber).toBe("Current");
  });

  test("caches an intentionally empty reference response instead of refetching forever", async () => {
    apiFetch.mockImplementation((url, options = {}) => {
      if (options.method === "DELETE") return Promise.resolve(response({}));
      if (url === "/api/reference/intervention-codes") {
        return Promise.resolve(response({ codes: [] }));
      }
      if (url === "/api/reference/noc-versions") {
        return Promise.resolve(response({ versions: [] }));
      }
      return Promise.resolve(response(workspacePayload({
        caseId: 6,
        applicationId: 60,
        label: "Reference cache",
      })));
    });

    renderWorkspace(6, 60);
    await waitFor(() => expect(latestWorkspace.caseData?.applicationId).toBe(60));

    await act(async () => {
      await latestWorkspace.loadInterventionCodes();
      await latestWorkspace.loadNocVersions();
    });
    await waitFor(() => expect(latestWorkspace.interventionCodesLoading).toBe(false));
    await act(async () => {
      await latestWorkspace.loadInterventionCodes();
      await latestWorkspace.loadNocVersions();
    });

    expect(apiFetch.mock.calls.filter(([url]) => url === "/api/reference/intervention-codes")).toHaveLength(1);
    expect(apiFetch.mock.calls.filter(([url]) => url === "/api/reference/noc-versions")).toHaveLength(1);
  });

  test("keeps applied revision evidence separate from operational interventions and counts", async () => {
    const payload = workspacePayload({ caseId: 7, applicationId: 70, label: "Revision evidence" });
    payload.counts = { openInterventions: 1, totalInterventions: 1 };
    payload.actionPlans[0].interventions = [{
      id: 701,
      status: "approved",
      deliveryStatus: "planned",
      title: "Operational intervention",
    }];
    payload.actionPlans[0].appliedRevisionEvidence = [{
      id: 702,
      status: "approved",
      deliveryStatus: "planned",
      title: "Applied revision decision",
      operational: false,
      recordKind: "applied_revision_evidence",
      isAppliedRevisionEvidence: true,
      metadata: { revisionApplication: { status: "applied" } },
    }];
    apiFetch.mockResolvedValue(response(payload));

    renderWorkspace(7, 70);
    await waitFor(() => expect(latestWorkspace.caseData?.applicationId).toBe(70));

    const [plan] = latestWorkspace.caseData.actionPlans;
    expect(plan.interventions.map(item => item.id)).toEqual([701]);
    expect(plan.interventionCount).toBe(1);
    expect(plan.appliedRevisionEvidence).toEqual([
      expect.objectContaining({
        id: 702,
        operational: false,
        recordKind: "applied_revision_evidence",
        isAppliedRevisionEvidence: true,
      }),
    ]);
    expect(latestWorkspace.caseData.appliedRevisionEvidence.map(item => item.id)).toEqual([702]);
    expect(latestWorkspace.caseData.appliedRevisionEvidenceCount).toBe(1);
    expect(latestWorkspace.caseData.counts).toMatchObject({
      openInterventions: 1,
      totalInterventions: 1,
    });
  });
});
