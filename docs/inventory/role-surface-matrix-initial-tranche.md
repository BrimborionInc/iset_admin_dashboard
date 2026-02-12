# Role-to-Surface Matrix (Initial Tranche)

Purpose: Quick access map for the first documentation tranche.

Last updated: 2026-02-11

Legend:
- `Yes`: explicitly in workflow scope for the role.
- `Partial`: role touches some, but not all, workflow surfaces.
- `Matrix`: route is controlled by role matrix (not hardcoded in route guard here).

| Workflow | ISET Coordinator | Regional Manager | Program Administrator | Notes |
|---|---|---|---|---|
| Application Assessment | Yes | Yes | Yes | Main workspace route: `/application-case/:id` (matrix controlled). |
| Case Management (Action Plans, Interventions, Payments) | Yes | Yes | Yes | Case workspace route: `/cases/:caseId` (matrix controlled). |
| ILMP Reporting | Partial | Partial | Yes | `/esdc/reporting` explicitly allows Program Administrator (+ System Administrator). Other ESDC routes are matrix controlled. |
| Payments AP Integrations | Partial | Yes | Yes | Finance Payments route matrix controlled; case payment widgets are in case workspace. |

## Route References

- Application Assessment: `/application-case/:id`
- Case Workspace: `/cases/:caseId`
- ILMP participant submissions: `/esdc/participants`
- ILMP participant workspace: `/esdc/participant/:clientId`
- ILMP reporting packages: `/esdc/reporting`
- Finance Payments: `/finance/payments`
- Program Payments (caseworking context): `/iset/payments`
