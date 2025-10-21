import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  FormField,
  Select,
  Input,
  Textarea,
  ColumnLayout,
  Box,
  StatusIndicator,
  Button,
  Alert,
  Toggle,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { FINANCE_POT_METRICS, FINANCE_PRIMARY_POT_OPTIONS } from "./financeDemoData.js";

const POT_OPTIONS = FINANCE_PRIMARY_POT_OPTIONS;

const DEFAULT_STATE = {
  sourcePot: null,
  destinationPot: null,
  amount: "",
  effectiveDate: "",
  justification: "",
  includeEvidence: false,
  tags: "",
};

const formatCurrency = value =>
  Number.isFinite(value) ? `$${value.toLocaleString("en-CA")}` : "-";

const AllocationTransferWizardWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  prefillRequest,
  onPrefillConsumed,
}) => {
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [lastSubmission, setLastSubmission] = useState(null);

  useEffect(() => {
    if (!prefillRequest || !prefillRequest.potId) {
      return;
    }
    const optionMatch = POT_OPTIONS.find(option => option.value === prefillRequest.potId);
    if (!optionMatch) {
      return;
    }
    setFormState(current => ({
      ...current,
      sourcePot: optionMatch,
      destinationPot:
        current.destinationPot && current.destinationPot.value === optionMatch.value
          ? null
          : current.destinationPot,
      justification: current.justification
        ? current.justification
        : "Aligning spend with updated forecasts from Budgets dashboard.",
    }));
    if (typeof onPrefillConsumed === "function") {
      onPrefillConsumed();
    }
  }, [prefillRequest, onPrefillConsumed]);

  const derived = useMemo(() => {
    const amount = Number(formState.amount);
    const sourceMeta = FINANCE_POT_METRICS[formState.sourcePot?.value] ?? null;
    const destMeta = FINANCE_POT_METRICS[formState.destinationPot?.value] ?? null;
    const availableAfter = sourceMeta ? sourceMeta.available - (Number.isFinite(amount) ? amount : 0) : null;
    const adminAfter = destMeta ? destMeta.adminPct + (Number.isFinite(amount) ? amount / 100000 : 0.5) : null;

    const issues = [];
    if (sourceMeta && Number.isFinite(amount) && amount > sourceMeta.available) {
      issues.push({
        type: "error",
        text: "Transfer exceeds available balance in source pot.",
      });
    }
    if (destMeta && Number.isFinite(adminAfter) && adminAfter > 15) {
      issues.push({
        type: "warning",
        text: "Destination admin attribution would exceed 15% cap. Capture ESDC approval reference.",
      });
    }
    if (sourceMeta && Number.isFinite(amount) && amount > 0 && sourceMeta.forecastVariance < -5) {
      issues.push({
        type: "info",
        text: "Source pot forecast already behind plan. Confirm program manager sign-off.",
      });
    }

    return {
      amount: Number.isFinite(amount) ? amount : null,
      availableAfter,
      adminAfter,
      issues,
    };
  }, [formState.amount, formState.destinationPot, formState.sourcePot]);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Transfer wizard",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const updateField = (key, value) => {
    setFormState(current => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = () => {
    setLastSubmission({
      ...formState,
      submittedAt: new Date().toISOString(),
      policyIssues: derived.issues,
    });
    // TODO: connect to transfer API once available
  };

  const disableSubmit =
    !formState.sourcePot ||
    !formState.destinationPot ||
    formState.sourcePot?.value === formState.destinationPot?.value ||
    !formState.amount ||
    Number(formState.amount) <= 0 ||
    !formState.effectiveDate ||
    formState.justification.length < 10;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Stage reallocations with built-in policy guidance before routing for approval."
        >
          Transfer wizard
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Transfer wizard settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Source pot" stretch>
              <Select
                placeholder="Select source"
                options={POT_OPTIONS.filter(option => option.value !== formState.destinationPot?.value)}
                selectedOption={formState.sourcePot}
                onChange={({ detail }) => updateField("sourcePot", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Destination pot" stretch>
              <Select
                placeholder="Select destination"
                options={POT_OPTIONS.filter(option => option.value !== formState.sourcePot?.value)}
                selectedOption={formState.destinationPot}
                onChange={({ detail }) => updateField("destinationPot", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Transfer amount" stretch>
              <Input
                placeholder="e.g., 75000"
                type="number"
                value={formState.amount}
                onChange={({ detail }) => updateField("amount", detail.value)}
              />
            </FormField>
            <FormField label="Effective date" stretch>
              <Input
                type="date"
                value={formState.effectiveDate}
                onChange={({ detail }) => updateField("effectiveDate", detail.value)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Justification">
              <Textarea
                placeholder="Explain the rationale, reference approvals, and highlight forecast impact."
                value={formState.justification}
                onChange={({ detail }) => updateField("justification", detail.value)}
                rows={6}
              />
            </FormField>
            <FormField
              label="Tags &amp; references"
              description="Board minute IDs, approval references, or internal tracking codes."
            >
              <Input
                placeholder="NWAC-BRD-24-07; ESDC-UAF-2024"
                value={formState.tags}
                onChange={({ detail }) => updateField("tags", detail.value)}
              />
            </FormField>
            <Toggle
              checked={formState.includeEvidence}
              onChange={({ detail }) => updateField("includeEvidence", detail.checked)}
            >
              Evidence attachments ready
            </Toggle>
          </SpaceBetween>
        </ColumnLayout>

        <SpaceBetween size="m">
          {derived.issues.map(issue => (
            <Alert key={issue.text} type={issue.type} statusIconAriaLabel={`${issue.type} message`}>
              {issue.text}
            </Alert>
          ))}
          <ColumnLayout columns={3} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Source available after transfer</Box>
              <StatusIndicator type={derived.availableAfter >= 0 ? "success" : "error"}>
                {formatCurrency(derived.availableAfter)}
              </StatusIndicator>
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Destination admin allocation</Box>
              <StatusIndicator type={derived.adminAfter && derived.adminAfter > 15 ? "warning" : "info"}>
                {derived.adminAfter ? `${derived.adminAfter.toFixed(1)}%` : "-"}
              </StatusIndicator>
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Evidence attachments</Box>
              <StatusIndicator type={formState.includeEvidence ? "success" : "pending"}>
                {formState.includeEvidence ? "Ready" : "Pending"}
              </StatusIndicator>
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="xs" direction="horizontal">
          <Button
            variant="primary"
            disabled={disableSubmit}
            onClick={handleSubmit}
          >
            Submit transfer for approval
          </Button>
          <Button
            variant="link"
            onClick={() => setFormState(DEFAULT_STATE)}
          >
            Clear form
          </Button>
        </SpaceBetween>

        {lastSubmission ? (
          <Box variant="awsui-key-label">
            Last submitted {new Date(lastSubmission.submittedAt).toLocaleString()} — awaiting workflow routing.
          </Box>
        ) : null}
      </SpaceBetween>
    </BoardItem>
  );
};

export default AllocationTransferWizardWidget;
