# Non-NWAC ISET Holder Onboarding Configuration Inventory

Purpose: give a prospective client a high-level view of the major configuration work needed to onboard a non-NWAC ISET holder into PATH.
Audience: sales, implementation, product, and delivery teams scoping a new holder rollout.
Last Updated: 2026-04-09

## Executive Summary

The current product can already externalize a meaningful amount of operational and program setup through admin configuration, runtime configuration, templates, and reference data. However, it is not yet a clean multi-holder platform with a neutral tenant layer. In practice, onboarding a non-NWAC holder is a mix of:

- environment and access setup
- business-process and intake configuration
- document, notification, finance, and reporting configuration
- review of NWAC-specific wording, branding, approval logic, and data assumptions that are still coded into the product

For scoping purposes, the configuration exercise can be treated as the following major workstreams.

## Canonical High-Level Configuration Scope

| Workstream | What would need to be configured or confirmed |
|---|---|
| 1. Environment and deployment setup | Dedicated environment, domains/URLs, database, object storage, email service, CORS/origin settings, runtime secrets, and deployment parameters. Because current runtime configuration is mostly global by environment, a separate environment per holder is the safest current operating model. |
| 2. Authentication, access, and user administration | Staff Cognito pools/clients, applicant account activation flow, role assignments, route access matrix, admin-user management rules, password/session policy, MFA policy, and role-to-region mappings. |
| 3. Organization structure and regional model | The holder’s operating geography, province/territory coverage, region ownership, staff-region assignments, and any equivalent of the current PTMA/Hub structure, including codes and contact metadata. |
| 4. Branding and organization identity | Holder name, logos, sender identity, support contact details, portal/admin branding, legal organization names in letters/forms, and any public/help-panel/tutorial content that currently assumes NWAC. |
| 5. Intake workflow and applicant questions | The actual client intake journey: steps, questions, labels, translations, validations, branching, conditional logic, storage keys, and which workflow is published as the live intake schema. This is the main area for tailoring the application to another holder’s eligibility, service model, and intake questions. |
| 6. Document collection, checklists, and signatures | Which supporting documents are requested, when they are requested, document types/scopes, compliance checklist gates, consent/signature workflows, generated forms, and how signed artifacts map into the document library. |
| 7. Notifications, templates, and secure messaging | Event catalog enablement, who gets bell alerts vs email alerts, notification templates, sender email, portal links, secure-message flows, and any holder-specific applicant/staff communications. |
| 8. Case workflow, assignment, and operating rules | Auto-assignment rules, SLA targets, reminder jobs, locking behavior, dashboard/queue access, event capture rules, and the holder’s preferred case-operating model across intake, review, action plans, interventions, and closure. |
| 9. Assessment, approval, and decision governance | Assessment fields, recommendation workflow, approval routing, decision notices, escalation thresholds, who can approve what, and how final decision states should work. This is a major fit-gap area because current review logic still carries NWAC-specific concepts. |
| 10. Finance and payment configuration | Budget pots, reporting units, assessment costing defaults, payment-type mapping, recurrence rules, evidence requirements, finance email routing, accounting/integration settings, and holder-specific payment policy rules. |
| 11. Reporting and external compliance outputs | Fiscal-year settings, management reporting targets/comments, ILMP/ESDC mappings, agreement-holder metadata, finance/reporting rollups, and any holder-specific external reporting obligations. |
| 12. Data migration and backload setup | Client import template, matching rules, historical backload approach for cases/action plans/interventions/documents, applicant account linking, and any phased migration from legacy spreadsheets or systems. |
| 13. Forms, policies, and training content | Client-facing forms, funding agreements, consent language, document templates, job aids, tutorial/help content, and any embedded compliance/training assumptions that need to reflect the new holder’s policy framework rather than NWAC’s. |

## Important Current Fit-Gap Notes

These are the biggest areas where the exercise is not just “configuration” today:

- **Holder/tenant model is global, not per-holder.** Most runtime settings are stored as shared environment-level keys rather than holder-scoped records.
- **NWAC branding is still in code.** Examples include top-nav branding, NWAC logos used in generated artifacts, and multiple default organization labels.
- **Approval logic is still NWAC-specific.** The assessment/decision path still uses NWAC review fields and currently includes hard-coded approval thresholds and a named approver email.
- **Role naming is still NWAC-biased.** `NWAC Administrator` remains a canonical admin role label, even though some older `Program Administrator` naming is still tolerated as an alias.
- **Training/help/document content is heavily NWAC/PTMA-oriented.** Even where the workflow engine is configurable, the surrounding instructional and policy content still needs review for a non-NWAC rollout.

## Practical Scoping Recommendation

For a prospective client conversation, the cleanest framing is:

1. **Platform setup**: environment, access, branding, and integrations.
2. **Program setup**: intake workflow, documents, notifications, case/approval flow, finance, and reporting.
3. **Migration/setup services**: user setup, legacy client import, reference-data seeding, template setup, and UAT.
4. **Product gap resolution**: remove or generalize NWAC-specific logic where it is still coded rather than configured.

## Key Repo Evidence

- Intake/workflow authoring: `docs/features/intake-authoring/end-to-end.md`, `docs/guides/workflow-studio.md`
- User/access setup: `docs/features/user-management.md`, `src/config/roleMatrix.json`
- Runtime/system settings: `src/pages/configurationSettings.js`, `isetadminserver.js`
- Checklists/documents/signing: `docs/planning/document-checklist-config-widget.md`, `docs/widgets/admin/supporting-documents-widget.md`, `docs/features/document-signing.md`
- Notifications/templates: `docs/dashboards/manage-notifications-dashboard.md`, `src/widgets/manageTemplates.js`
- Finance settings: `docs/features/payments-module.md`, `src/pages/finance/FinanceSettingsPage.jsx`
- Reporting: `docs/dashboards/data-and-results-dashboard.md`, `docs/workflows/admin/ilmp-reporting.md`
- Migration/backload: `docs/guides/client-file-imports.md`, `docs/dashboards/client-file-import-dashboard.md`
