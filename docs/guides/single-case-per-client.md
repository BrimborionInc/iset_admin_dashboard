# Single Case Per Client
Purpose: capture the working rule that a client should have one case record, even when multiple applications arrive over time.  
Audience: assessors, case managers, and developers wiring application→case flows.  
Last Updated: 2025-11-24

## Policy
- Default model: one case per client; new applications attach to that case instead of creating a parallel case.
- If a client has an existing case in a non-terminal status (active, dormant, ready_to_close), always reuse it.
- If the case is closed/archived, prefer reopening and reusing it; only create a new case when there is a clear, explicit reason.

## Assessor experience
- When opening an application in the workspace, surface a notice if the client already has a case (e.g., banner/bell with a link to the case workspace and last status/date).
- The notice should be acknowledged before approval so the reuse decision is deliberate.
  - Implementation note: existing-client detection in the admin backend matches by SIN hash (preferred), prior submission SIN scan, email, then name + DOB (fallback to name-only). The assessment UI should only flag "existing client" when another case already exists for that matched client and show the current case manager if assigned.

## Approval flow
- On approval, if a case exists: prompt “Reuse existing case (recommended)” vs “Create new case (rare)”. Default to reuse.
- Reuse path: if the case is closed/archived, reopen it; create a new action plan for the approved application; add any indicated interventions in draft/approved.
- New-case path: allowed only with justification (e.g., explicitly documented edge case); create a separate case row and seed the plan/interventions there.

## Data rules (platform)
- Application approval should first resolve the client identity, then look up the client’s case by `client_id`.
- Reuse should update the existing `iset_case` rather than insert a new row; the new application links to that case via action plan/intervention records.
- History must preserve prior applications and plans inside the case; never drop or overwrite earlier content when reusing.

## Open questions
- What exact statuses count as “non-terminal” for reuse? (Current intent: active, dormant, ready_to_close.)
- When is a truly new case justified for the same client and program?
- How should reporting show multiple approved applications within one case (e.g., per-application rollups vs. case-level totals)?
