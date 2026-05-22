# Purpose
Document the currency input UX used in finance dashboards so new widgets handle money fields consistently.

# Audience
Admin dashboard engineers adding or updating finance widgets and forms.

# Last Updated
2025-02-22

# Pattern: currency inputs

- Show a formatted currency value when the field is blurred (e.g., `$75,000.00`), but keep the raw, unformatted string while the user edits.
- Do not use `type="number"` on these inputs; use the default text input so the formatted value with `$` and commas renders cleanly on blur.
- Use the shared helper pattern:
  - `formatCurrencyDisplay(value)` converts a numeric-ish value into `$X,XXX.XX` or returns the original string if parsing fails.
  - `parseCurrencyAmount(value)`, `normalizeCurrencyAmount(value)`, and `hasCurrencyPrecision(value)` support `$`/comma-formatted values and enforce normal dollar precision (no more than two decimal places) before submitting.
  - Track a `focused` boolean in component state for each currency field.
  - Render `value={focused ? rawValue : formatCurrencyDisplay(rawValue)}` and toggle `focused` with `onFocus`/`onBlur`.
  - Store the raw string in state (not the formatted string). Derive numbers with `parseCurrencyAmount(stateValue)` or `normalizeCurrencyAmount(stateValue)` when computing metrics or submitting.
  - For currency fields that allow cents, validate with the shared parse/precision helpers instead of `Number.isInteger`.

# References

- Budgets: `src/pages/finance/widgets/BudgetStructureManagerWidget.jsx` (approved/adjusted currency inputs).
- Allocations: `src/pages/finance/widgets/AllocationTransferWizardWidget.jsx` (transfer amount input).
- Case workspace interventions: `src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx` and `src/pages/Caseworking/caseWorkspace/modals/ExistingInterventionModal.jsx` (planned/approved/actual costs and payment line amounts).

# Implementation checklist

- [ ] Import the shared helpers from `src/utils/currencyFormat.js`.
- [ ] Add `const [fieldFocused, setFieldFocused] = useState(false)` for each currency input.
- [ ] Render formatted value when blurred; raw value when focused.
- [ ] Keep state as a string and parse to numbers only for calculations/submission.
- [ ] Accept valid dollars-and-cents values; reject more than two decimal places.
- [ ] Avoid mixing formatting and state; never write the formatted string back into state.
