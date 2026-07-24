import { resolveInterventionPostingContextForForm } from "./interventionPostingContext";

describe("resolveInterventionPostingContextForForm", () => {
  test("preserves an internal intervention when its parent plan is external", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "edit",
        intervention: { postingContext: "internal" },
        plan: { postingContext: "external" },
      })
    ).toBe("internal");
  });

  test("preserves an external intervention when its parent plan is internal", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "edit",
        intervention: { postingContext: "external" },
        plan: { postingContext: "internal" },
      })
    ).toBe("external");
  });

  test("reads the saved intervention context from metadata", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "edit",
        intervention: { metadata: { postingContext: "internal" } },
        plan: { postingContext: "external" },
      })
    ).toBe("internal");
  });

  test("uses valid metadata when a legacy top-level value is blank or invalid", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "edit",
        intervention: {
          postingContext: "",
          posting_context: "unknown",
          metadata: { postingContext: "internal" },
        },
        plan: { postingContext: "external" },
      })
    ).toBe("internal");
  });

  test("inherits the parent plan context for a new intervention", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "create",
        plan: { postingContext: "internal" },
      })
    ).toBe("internal");
  });

  test("uses the parent plan for legacy interventions without a saved context", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "edit",
        intervention: {},
        plan: { postingContext: "internal" },
      })
    ).toBe("internal");
  });

  test("falls back safely when neither record has a valid context", () => {
    expect(
      resolveInterventionPostingContextForForm({
        mode: "edit",
        intervention: { postingContext: "unknown" },
        plan: { postingContext: "unknown" },
      })
    ).toBe("external");
  });
});
