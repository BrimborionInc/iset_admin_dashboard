# Finance Regional Salaries

Purpose: store annual salary totals by province or territory for PATH's finance/admin tracking dashboards.

## Table

- `finance_regional_salary_entry`

## Shape

One row per:
- `region_code`
- `fiscal_year_start`

Key fields:
- `budget_pot_id` - budget pot carrying that region's salary total for the fiscal year
- `annual_salary_amount` - annual salary total for the region
- `created_by_staff_profile_id`
- `updated_by_staff_profile_id`
- `created_at`
- `updated_at`

## Notes

- This table supports `Budgets and Finance > Salaries`.
- It is for annual salary tracking and reporting support, not payroll processing.
- PATH derives monthly values from the annual amount for display and reporting convenience.
- The dev seed currently creates rows for the active fiscal year and preassigns the logical regional salary pot where one exists.
- Pot assignment is intentionally explicit because budget pots are user-configurable; do not hardcode pot names in the ongoing UI logic.
