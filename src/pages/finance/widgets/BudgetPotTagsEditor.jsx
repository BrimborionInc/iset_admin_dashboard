import React, { useMemo } from "react";
import { Box, Checkbox, ColumnLayout, FormField, Input, Select, SpaceBetween } from "@cloudscape-design/components";
import { defaultPotTags } from "./BudgetsDataContext.jsx";

const fundingSourceOptions = [
  { label: "EI", value: "EI" },
  { label: "CRF", value: "CRF" },
  { label: "Other", value: "OTHER" },
];

const BudgetPotTagsEditor = ({ value, onChange, disabled = false }) => {
  const tags = useMemo(() => ({ ...defaultPotTags, ...(value || {}) }), [value]);
  const selectedFundingSource =
    fundingSourceOptions.find(opt => opt.value === tags.fundingSource) ?? null;

  const handleChange = (field, next) => {
    if (typeof onChange === "function") {
      onChange({ ...tags, [field]: next });
    }
  };

  return (
    <SpaceBetween size="s">
      <Box variant="p" color="text-body-secondary">
        Tags drive transfer and budget-check policies (e.g., EI vs CRF directionality).
      </Box>
      <ColumnLayout columns={2} variant="text-grid">
        <FormField label="Funding source">
          <Select
            disabled={disabled}
            placeholder="Select funding source"
            selectedOption={selectedFundingSource}
            options={fundingSourceOptions}
            onChange={({ detail }) => handleChange("fundingSource", detail.selectedOption?.value || "")}
          />
        </FormField>
        <FormField label="Restricted">
          <Checkbox
            disabled={disabled}
            checked={Boolean(tags.isRestricted)}
            onChange={({ detail }) => handleChange("isRestricted", detail.checked)}
          >
            Restricted
          </Checkbox>
        </FormField>
        <FormField label="Agreement ID">
          <Input
            disabled={disabled}
            value={tags.agreementId}
            placeholder="e.g., CA-2025-1234"
            onChange={({ detail }) => handleChange("agreementId", detail.value)}
          />
        </FormField>
        <FormField label="Fiscal year" description='Accepts values like "2025" or "2025-2026".'>
          <Input
            disabled={disabled}
            value={tags.fiscalYearTag}
            placeholder="2025-2026"
            onChange={({ detail }) => handleChange("fiscalYearTag", detail.value)}
          />
        </FormField>
      </ColumnLayout>
    </SpaceBetween>
  );
};

export default BudgetPotTagsEditor;
