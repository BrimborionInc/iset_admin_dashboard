# Purpose
Document the currency input UX used in finance dashboards so new widgets handle money fields consistently.

# Audience
Admin dashboard engineers adding or updating finance widgets and forms.

# Last Updated
2025-02-22

# Pattern: currency inputs

- Show a formatted currency value when the field is blurred (e.g., `$75,000.00`), but keep the raw, unformatted string while the user edits.
- Do not use `type="number"` on these inputs; use the default text input so the formatted value with `$` and commas renders cleanly on blur.
- Use the helper pattern already present in finance widgets:
  - `formatCurrencyDisplay(value)` converts a numeric-ish value into `$X,XXX.XX` or returns the original string if parsing fails.
  - Track a `focused` boolean in component state for each currency field.
  - Render `value={focused ? rawValue : formatCurrencyDisplay(rawValue)}` and toggle `focused` with `onFocus`/`onBlur`.
  - Store the raw string in state (not the formatted string). Derive numbers with `Number(stateValue)` when computing metrics.

# References

- Budgets: `src/pages/finance/widgets/BudgetStructureManagerWidget.jsx` (approved/adjusted currency inputs).
- Allocations: `src/pages/finance/widgets/AllocationTransferWizardWidget.jsx` (transfer amount input).

# Implementation checklist

- [ ] Add `formatCurrencyDisplay` helper locally or import an existing shared helper if one is added later.
- [ ] Add `const [fieldFocused, setFieldFocused] = useState(false)` for each currency input.
- [ ] Render formatted value when blurred; raw value when focused.
- [ ] Keep state as a string and parse to numbers only for calculations/submission.
- [ ] Avoid mixing formatting and state; never write the formatted string back into state.
