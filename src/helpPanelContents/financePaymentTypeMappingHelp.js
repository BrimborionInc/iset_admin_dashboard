import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinancePaymentTypeMappingHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Configure how interventions map to payment types and which validation rules apply before finance submission.
      </p>
    </Box>
    <Box>
      <strong>Intervention map tab</strong>
      <ul>
        <li>`Allowed payment types` limits which payment types can be used for an intervention.</li>
        <li>`Default lines` pre-seeds payment line types for that intervention.</li>
        <li>`Auto-add?` controls whether an intervention is included by default in Application Assessment step 2.</li>
      </ul>
    </Box>
    <Box>
      <strong>Payment types tab</strong>
      <ul>
        <li>Define canonical payment type `code`, `label`, and optional notes.</li>
        <li>Set recurrence policy per type (`not allowed`, `optional`, `required`).</li>
        <li>Set submission timing (`start`, `end`, `recurrence`, or `manual trigger`).</li>
        <li>Set required evidence types used in payment packet validation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes and metadata tab</strong>
      <ul>
        <li>Track mapping version notes for audit/review context.</li>
        <li>Use `Generated on` and update timestamps to confirm freshness after saves.</li>
      </ul>
    </Box>
    <Box>
      <strong>Operational impact</strong>
      <p>
        These rules feed application/case costing behavior and finance packet validation. Required evidence and
        recurrence policy are enforced downstream in payment detail and submission flows.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentTypeMappingHelp.aiContext =
  "Explain Finance Settings Payment type mapping: intervention-to-payment-type mapping, default line seeding, Auto-add behavior for assessment step 2, payment-type recurrence policy, submission timing, required evidence rules, and downstream impact on payment validation/submission.";

export default FinancePaymentTypeMappingHelp;
