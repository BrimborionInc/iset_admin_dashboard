# CR-0014 – Configurable Notification Email Pipeline

Date created: 2025-11-05  
Owner: Admin Dashboard & Intake Platform teams  
Status: Draft (scaffolding kickoff)

---

## 1. Problem Statement

Notification toggles, templates, and applicant rows already exist in the admin dashboard (`docs/planning/notification-applicant-integration.md`), but the delivery path still relies on hardwired SES calls that ignore stored configuration. This gap leaves staff unable to control who receives submission confirmations, secure message digests, or decision outcomes, and it blocks parity between staff and applicant notifications. Without scaffolding for a shared resolver, template rendering, and instrumentation, the team cannot safely roll out configurable outbound email without risking duplicate sends or silent failures.

## 2. Goals & Success Criteria

1. **Single source of truth** – Intake services must respect `notification_setting` flags (`enabled`, `email_alert`, `template_id`, `language`) for both staff and applicant roles.
2. **Template authoring uplift** – Deliver a production-ready template editor experience (rich text toolbar, placeholder palette, draft handling) so admins can manage email content without code changes.
3. **Deployable delivery pipeline** – Introduce resolver + renderer modules that fetch configuration, render copy, and send via SES with structured logging/metrics and fallback behaviour when templates are missing.
4. **Operational visibility** – Emit events/logs for send attempts, template/cache misses, and SES outcomes so ops can trace issues end-to-end.

## 3. Scope

### Phase 0 – Platform scaffolding
- Define shared TypeScript types + SDK helpers for `notification_setting`, `notification_template`, and template tokens.
- Establish feature flags / config (`notifications.emailPipeline.enabled`) to guard rollout per environment.
- Document SES sandbox handling and verified recipient requirements in runbooks.

### Phase 1 – Template editor uplift
- Expand the dashboard widget with toolbar, placeholder picker, validation, and autosave cache (per collaboration notes).
- Surface template metadata (audience, language) and enforce token validation before save.
- Hook editor success states into Notification Settings so toggles see fresh templates without reloads.

### Phase 2 – Intake resolver + delivery
- Build resolver that loads relevant settings, filters enabled `email_alert` rows, fetches templates, and renders HTML/text bodies.
- Implement fallback copy + warning logs when `template_id` is null but `email_alert` is on.
- Wire resolver into submission confirmations first, then secure messaging + decision events.
- Add stubs for future channels (portal alerts, SMS) but keep scope on email for now.

### Out of scope (for this CR)
- Applicant portal in-app notifications (`iset_portal_notification`).
- SMS/voice delivery implementations.
- Multi-language template rendering beyond existing `en` support.

## 4. Proposed Architecture

1. **Configuration & caching layer** – Shared `NotificationConfigService` hydrates `notification_setting` rows (keyed by `{event, role}`) plus template payloads, caching with TTL + change notifications from admin saves.
2. **Template authoring UX** – React component upgrades reuse shared rich-text primitives, integrate placeholder validation, and expose preview + diff before publish.
3. **Intake resolver & renderer** – Node module `notificationEmailResolver` handles lookup, template merge (Handlebars-lite or mustache tokens), context building (tracking ID, applicant/staff names, portal URLs), and hands results to `sesMailer`. Supports dry-run/testing hooks.
4. **Observability & safety** – Structured logs (JSON) per send attempt, metric counters for `notifications.email.sent`, `notifications.email.skipped`, plus dead-letter strategy for SES failures. Feature flags + environment config determine fallback-to-stock behaviour.

## 5. Milestones / Checklist

| Milestone | Target | Notes | Status |
|-----------|--------|-------|--------|
| CR approval & scope sign-off | 2025-11-07 | Review with product + ops | Pending |
| Phase 0 scaffolding merged | 2025-11-12 | Types, feature flags, SES config docs | Pending |
| Template editor uplift GA | 2025-11-19 | Rich text, placeholders, autosave, refresh hooks (Template Editor dashboard split, toolbar + link/list formatting, Cloudscape board controls) | In progress |
| Intake resolver MVP (submission) | 2025-11-26 | Handles `application_submitted`, fallback copy, logging | Pending |
| Secure messaging + decisions | 2025-12-03 | Extend resolver coverage | Pending |
| Production readiness review | 2025-12-06 | Runbook updates, alerts, toggle plan | Pending |

## 6. Open Questions & Decisions

1. Which renderer syntax (Mustache, Handlebars, custom token replacement) best balances flexibility and security?
2. What default copy should ship when `template_id` is null yet `email_alert=1`? Need bilingual strategy?
3. Do we require per-environment opt-in (feature flag matrix) or can we tie rollout to the Notification Settings toggles alone?
4. How do we expose template/test previews to non-admin roles without granting edit rights?
5. What auditing is required when admins change templates or toggles (existing audit tables vs. new events)?

## 7. Dependencies & Risks

- Relies on accurate `notification_setting` + `notification_template` data; missing applicant rows must be seeded (Outstanding work noted in planning doc).
- SES sandbox limits could block QA unless verified recipients are curated per environment.
- Template editor uplift shares components with other dashboards; regressions could impact unrelated widgets if not isolated.
- Intake resolver touches submission flow—need rollback plan and comprehensive tests to avoid blocking applicants.
- Feature flag drift between admin + intake repos could desync behaviour; central config management required.

## 8. Next Actions

- [ ] Socialise CR with stakeholders (product, ops, intake, admin UI).
- [ ] Finalise renderer technology choice and placeholder contract.
- [ ] Draft technical design for `NotificationConfigService` caching/invalidation.
- [ ] Complete Template Editor dashboard polish (palette defaults, header links) and document the split in `docs/dashboards/template-editor-dashboard.md`.
- [ ] Define SES verification + sandbox exit criteria in `docs/ops` runbooks.
- [ ] Store the test SES access keys in Parameter Store (`/nwac/test/portal/env`) and document the redeploy procedure so portal `.env` always contains `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
- [x] Implement intake-side template renderer (loads `notification_setting` + `notification_template`, applies token substitutions, provides fallback copy) and replace the hard-coded SES copy path for applicant submission emails.
- [x] Extend renderer integration to secure message + decision notifications (ensure logging/fallbacks remain consistent).
- [x] Add unit/integration tests plus structured logging to cover renderer fallbacks, missing templates, and token substitution failures.

## 9. Progress Log

- 2025-11-05: CR drafted to capture scope across scaffolding, template editor uplift, and intake resolver workstreams; awaiting review.
- 2025-11-08: Template Editor dashboard split into dedicated widgets (Library + Editor), Cloudscape help panels and toolbar scaffolding completed, Notification Settings dashboard cleaned up, access control + documentation updated.
- 2025-11-08: Intake pipeline plan outlined—template renderer + SES integration to replace legacy hard-coded copy; pending implementation.
- 2025-11-09: Added `notifications/templateRenderer.js`, wired submission confirmations to template-driven SES payloads with placeholder support; next up secure message + decision flows.
- 2025-11-09: Secure message + decision notifications now use the shared renderer (event-driven context, placeholder support, fallbacks). Admin dashboard token palette updated with the new placeholders.
- 2025-11-10: Documented the token contract & caching plan, added structured renderer logging + `node:test` coverage (`notifications/__tests__/templateRenderer.test.js`), and exposed `npm run test:renderer` for smoke checks.
- 2025-11-14: Resolved test SES send failures by rotating the IAM access keys (`SES_backend`) and updating `/nwac/test/portal/.env` so AWS credentials deploy with the portal; portal + admin PM2 processes confirmed healthy afterward.

---

_Keep this CR current as we answer open questions, ship milestones, and gather production readiness evidence._
