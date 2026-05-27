# Regional Snapshot Reporting

Purpose: schema note for the Board-style regional snapshot report planned under `Reporting`.

## Primary table

- `iset_regional_snapshot_report`

One row represents one saved regional snapshot for a single reporting window.

## Grain

- One row per `region_id + period_type + period_start + period_end`
- `period_type` is one of `month`, `quarter`, or `year`

## What is stored here

This table is intended to store the manual and report-specific inputs that are not yet available from PATH as live operational data.

Current saved fields:
- regional manager name
- regional coordinator name
- operating costs amount
- compliance flag
- comments / recommendations
- optional `manual_inputs_json` for future low-risk extensions

## Current live metric basis

- Region filtering uses participant home province / territory, matching Financial Reports rather than case portfolio assignment.
- CRF/EI funding and funded-client count reuse the Financial Reports approved-funding basis: approved CRF/EI intervention rows in the selected period, excluding zero-dollar rows for funded-client totals.
- Application activity remains application-based: applications received use submission date; denied / ineligible / withdrawn / NC uses the recorded application decision/update date; pending decision counts currently pending applications from the received-in-period set.
- Because funded clients follow Financial Reports and the other activity rows follow application workflow dates, the Client Activity section is not an arithmetic status breakdown.

## What is not stored here

This table should not become a duplicate store for operational PATH data that can be calculated live, such as:
- applications received
- funded
- denied / ineligible / withdrawn
- pending decision
- intervention-derived funding totals where live logic exists
- coordinator salary totals derived from `finance_regional_salary_entry`

Those values should be calculated by the reporting layer and merged with the saved snapshot inputs at read time.

## Metadata

- `snapshot_status` supports `draft` and `final`
- `created_by_staff_profile_id` and `updated_by_staff_profile_id` track authoring context
- `created_at` and `updated_at` track row timestamps
