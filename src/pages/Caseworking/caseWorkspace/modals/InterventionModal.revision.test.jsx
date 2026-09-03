import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { apiFetch } from "../../../../auth/apiClient.js";
import InterventionModal from "./InterventionModal.jsx";

jest.mock("@cloudscape-design/components", () => {
  const ReactForMock = require("react");
  const Container = ({ children }) => ReactForMock.createElement("div", null, children);
  const Input = ({ value, readOnly, disabled }) => ReactForMock.createElement("input", {
    value: value || "",
    readOnly,
    disabled,
    onChange: () => {},
  });
  return {
    Alert: Container,
    Autosuggest: Input,
    Badge: Container,
    Box: Container,
    Button: ({ children, onClick, disabled }) => ReactForMock.createElement(
      "button",
      { type: "button", onClick, disabled },
      children
    ),
    ColumnLayout: Container,
    DatePicker: Input,
    FormField: ({ children, label }) => ReactForMock.createElement("label", null, label, children),
    Header: Container,
    Input,
    Modal: ({ visible, children, footer }) => visible
      ? ReactForMock.createElement("div", null, children, footer)
      : null,
    Select: () => null,
    SpaceBetween: Container,
    Table: () => null,
    Textarea: Input,
  };
});

jest.mock("../../../../hooks/useCurrentUser.js", () => () => ({
  role: "ISET Coordinator",
}));

jest.mock("../../../../auth/apiClient.js", () => ({ apiFetch: jest.fn() }));

describe("InterventionModal revision action", () => {
  beforeEach(() => {
    // This test exercises the revision action only. Keep unrelated budget-pot
    // and payment-line requests pending so they cannot update state mid-assertion.
    apiFetch.mockImplementation(() => new Promise(() => {}));
  });

  it("offers the reapproval route while approved facts are read-only", () => {
    const onRevise = jest.fn();
    const intervention = {
      id: 109,
      status: "in_progress",
      deliveryStatus: "in_progress",
      title: "Undergrad",
      institution: "STFX University",
      proposalId: 233,
      proposalReviewStatus: "approved",
    };

    render(
      <InterventionModal
        visible
        mode="edit"
        intervention={intervention}
        plan={{ id: 54, status: "active" }}
        readOnly
        onDismiss={() => {}}
        onSubmit={() => {}}
        onRevise={onRevise}
      />
    );

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    const revisionButton = screen.getByRole("button", {
      name: "Revise approved intervention",
    });
    fireEvent.click(revisionButton);
    expect(onRevise).toHaveBeenCalledWith(intervention);
  });
});
