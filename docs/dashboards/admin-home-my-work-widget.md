# Admin Home – “Application Work Queue” Widget Design

## Scope
- Surface the work queue for ISET applications that a signed-in user is responsible for.
- Role-aware counts and descriptions; single shared widget used across personas.

## Roles & Responsibility Filters
- **Program Administrator**: sees every application across the program, including items awaiting assignment.
- **Regional Coordinator**: limited to applications assigned to their region (self or their assessors) plus regional backlog.
- **Application Assessor**: only cases directly assigned to them.
- **System Administrator**: non-application operational tasks (placeholder until workflow tooling work begins).

## Status Buckets (Program Administrator)
1. **New submissions** – Applications received within the last 24 hours that have not completed triage.
2. **Unassigned backlog** – Triage-complete applications with no coordinator/assessor assigned. SLA clock starts here.
3. **In assessment** – Applications currently owned by an assessor or regional coordinator.
4. **Awaiting program decision** – Assessments requiring a program-level approval/denial.
5. **On hold / info requested** – Cases paused because applicants must provide more information.
6. **Overdue** – Any application breaching the program turnaround target (can overlap with other categories; shown here for visibility).

## Status Progression
- Intake places new records into **New submissions** (status `received`, created < 24h).
- Triage marks items ready for assignment. Until an owner is set they appear in **Unassigned backlog**.
- Once assigned to a coordinator or assessor they move to **In assessment**.
- Completed assessments needing PA judgement transition to **Awaiting program decision**.
- Cases with outstanding applicant actions move into **On hold / info requested**.
- SLA evaluation runs across all buckets; any overdue item additionally increments the **Overdue** count.

## Regional Coordinator View (draft)
- **Assigned to my region** – Work owned by the coordinator or their assessors.
- **Needs reassignment** – Cases explicitly waiting for the coordinator to re-route.
- **Awaiting applicant info** – Region-scoped holds awaiting applicant response.
- **Due this week** – Items with SLA deadlines inside the next 7 days.
- **Overdue** – Region workload breaching SLA.

## Application Assessor View (draft)
- **Assigned to me** – Personal queue of active assessments.
- **Due today** – Items with deadlines inside the next 24 hours.
- **Awaiting applicant response** – Paused while waiting on applicant action.
- **In quality review** – Completed assessments pending QA.
- **Overdue** – Personal SLA breaches.

## Outstanding Questions
- Confirm SLA windows (24h for “new submissions”, backlog thresholds, etc.).
- Determine whether “Overdue” should exclude items already in “Awaiting program decision”.
- Clarify data sources: likely `application_case` plus coordination metadata; needs API endpoint design.

## Next Steps
1. Validate role filters against the case lifecycle model.
2. Define backend queries / materialized views that emit these counts.
3. Replace the current mock scaffold with live data fetching per role.
