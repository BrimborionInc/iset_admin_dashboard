# Admin Dashboard Functional Scope Register (Initial Tranche)

Purpose: Inventory the initial documentation tranche for non-System-Administrator workflows.

Last updated: 2026-02-11

## In-Scope Workflows

| Workflow | Primary routes / surfaces | Core dashboards/pages | Status |
|---|---|---|---|
| Application Assessment | `/application-case/:id` | ISET Application Assessment dashboard | Live |
| Case Management (Action Plans, Interventions, Payments) | `/cases/:caseId`, `/iset/payments` | Case Workspace, Program Payments | Live (Program Payments page scaffolded) |
| ILMP Reporting | `/esdc/participants`, `/esdc/participant/:clientId`, `/esdc/reporting` | ILMP Submissions & Exports, Participant workspace, Reporting packages | Live |
| Payments AP Integrations | `/finance/payments`, `/cases/:caseId` (payment widgets) | Finance Payments dashboard, Case payment widgets | Live |

## Out of Scope For This Tranche

- System Administrator-only operations and configuration-only workflows.
- Authoring tools and template/workflow studio.
- Non-admin portal flows.

## Widget Documentation Coverage

Widget-level docs for this tranche are under:

- `docs/widgets/admin/README.md`

Workflow-level docs for this tranche are under:

- `docs/workflows/admin/application-assessment.md`
- `docs/workflows/admin/case-management.md`
- `docs/workflows/admin/ilmp-reporting.md`
- `docs/workflows/admin/payments-ap-integrations.md`

## Notes

- Route guards in `src/routes/AppRoutes.js` and role matrix rules jointly determine access.
- Where role access is not hardcoded in routes, docs label access as "role-matrix controlled".
- Program Payments page (`/iset/payments`) currently uses an empty widget registry and should be treated as scaffold status until populated.
