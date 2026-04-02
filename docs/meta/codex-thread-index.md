# Codex Thread Index

Purpose: searchable index of durable notes, handoff docs, and thread-born findings that future chats may need to recover quickly when prior chat history is unavailable.

Last Updated: 2026-04-02

## How to use

- Start here when the user references "another chat", "previous thread", "there should be a note", or asks for context that is not visible in the current session.
- Search this file using the user's own words first, then open the linked canonical doc instead of relying on the short index summary.
- Keep entries focused on cross-thread recovery value. This is not a changelog and should not duplicate normal release-note logging.
- When a thread produces durable context that a future chat is likely to need, either update an existing canonical doc and add it here, or create a short handoff note and index it here in the same change.
- Prefer canonical docs by type:
  - operational/how-to guidance -> `docs/guides/*`
  - design or decision handoffs -> `docs/planning/*`
  - repo-wide durable context -> `docs/AGENTS.md` or `docs/meta/*`

## Entry format

For each indexed thread/topic, keep:

- `Topic`: short human-readable label
- `Keywords`: terms a future chat is likely to search
- `When to open`: concrete trigger conditions
- `Primary docs`: canonical docs/scripts to open next
- `Status`: whether the note is current, partial, or superseded

## Indexed Topics

### Prod portal hostname cutover

- Topic: production public-portal cutover from `nwac-public.awentech.ca` to `iset.nwac.ca` while retaining the old hostname
- Keywords: `iset.nwac.ca`, `prod portal hostname`, `production environment`, `live production environment`, `nwac-public.awentech.ca`, `prod cutover`, `prod portal domain`, `production domain`
- When to open: the user asks about the prior Codex discussion for making `iset.nwac.ca` the live production portal hostname, or asks how the prod hostname/certificate/CAPTCHA/DNS cutover is meant to work
- Primary docs:
  - `docs/ops/runbooks/prod-portal-hostname-cutover.md`
  - `docs/ops/runbooks/terraform-prod-runbook.md`
  - `docs/ops/environments/prod-env-guide.md`
- Status: current as of 2026-04-02
- Notes: the exact original Codex chat title was not preserved in the repo docs/index. The durable handoff that replaced it is `Prod Portal Hostname Cutover`, which captures the intended `iset.nwac.ca` go-live plan, including WAF CAPTCHA key rotation, prod env updates, ACM certificate request/validation, ALB listener updates, Cognito callback/logout URL changes, and DNS handoff to the `nwac.ca` domain admin. On 2026-04-02 the AWS-side cutover was executed in prod: a fresh ACM cert `arn:aws:acm:ca-central-1:468278742295:certificate/70e5fe66-19b8-4715-bc0f-5dd8fe300b0b` was issued, the prod ALB listener was switched to it, the `iset.nwac.ca` host-header rule was added to the portal target group, prod SSM env values were aligned to `iset.nwac.ca`, and the prod ASG instance refresh completed successfully. Later the same day, `iset.nwac.ca` was intentionally put behind a temporary ALB fixed-response maintenance rule returning `503` with a go-live message for April 3, 2026, while `nwac-public.awentech.ca` remained live.

### Public portal prelaunch review and rich-HTML regression

- Topic: production-aware public-portal launch review, security hardening discussion, and the fix for flattened authored HTML in digital forms such as the Client Funding Agreement
- Keywords: `public portal launch review`, `CFA flattened`, `Client Funding Agreement`, `raw HTML`, `dangerouslySetInnerHTML`, `security fixes`, `LOG_SENSITIVE_INTAKE_PAYLOADS`, `message recipient auth`, `upload ownership`, `EFT_form`, `MinIO scanner`
- When to open: the user references the thread that reviewed public-portal launch blockers, asks about the chat where the CFA render broke after security fixes, asks whether a thread was the `iset.nwac.ca` cutover discussion, or asks what was already fixed in the sibling portal repo before launch
- Primary docs:
  - `docs/planning/public-portal-prelaunch-review-2026-03-28.md`
  - `../ISET-intake/server.js`
  - `../ISET-intake/src/renderer/renderers.js`
- Status: current as of 2026-04-02
- Notes: this is not the production hostname/domain cutover thread. The durable outcomes from this chat were: replacing raw intake-payload logging with metadata-only logging by default, hardening applicant message target/file-delete authorization, confirming the EFT workflow structure in DEV DB, and restoring raw authored HTML rendering in the public portal after the sanitizer path flattened stored digital-form HTML.

### Reporting dashboards and applicant-account activation

- Topic: workbook-aligned reporting buildout plus the imported applicant-account activation workflow and related client-anchored admin behavior
- Keywords: `Data and Results`, `Regional Snapshot`, `Budgets and Finance Salaries`, `Applicant Accounts`, `activate account`, `dummy draft applicant list`, `Notification Settings sender email`, `client anchored`, `reporting dashboard thread`
- When to open: the user asks about the long thread that built the reporting dashboards, regional snapshot export/reporting surfaces, salaries tracking, imported applicant activation flow, case-header PATH account actions, or why dummy-draft applicant selection no longer mirrors Cognito directly
- Primary docs:
  - `docs/dashboards/data-and-results-dashboard.md`
  - `docs/data/regional-snapshot-reporting.md`
  - `docs/data/finance-regional-salaries.md`
  - `docs/data/applicant-account-activation.md`
  - `docs/features/user-management.md`
  - `docs/dashboards/manage-notifications-dashboard.md`
- Status: current as of 2026-04-02
- Notes: this is not the `iset.nwac.ca` production-hostname thread. Durable outcomes from this chat included: `Reporting > Data and Results` workbook-aligned sections plus drilldowns and exports; `Reporting > Regional Snapshot` with Excel export and live/manual hybrid data; `Budgets and Finance > Salaries` annual-entry tracking that feeds Regional Snapshot salary values; imported applicant accounts anchored on `client` with manual PATH activation, user-management tab, and case-header quick action; PATH SES sender email moved into `iset_runtime_config`; and the current rule that the AI dummy-draft applicant picker is `client`/`user`-anchored rather than a direct Cognito-user list. A one-off dev repair in this thread also repopulated missing `client`/`user` rows from the DEV applicant Cognito pool after the `client` table was purged; treat that as environment repair, not normal product behavior.

### Applicant notification portal-link resolution

- Topic: why applicant secure-message or reminder emails can lose the clickable portal link even when the template uses `[link url="{portal_dashboard_url}"]...[/link]`
- Keywords: `secure message email link missing`, `portal_dashboard_url`, `APPLICANT_PORTAL_BASE`, `message_received`, `please sign in here`, `TEST email hyperlink`, `public portal link`, `notification template link`
- When to open: the user reports that applicant emails show the sign-in text without a hyperlink, or asks which app/env actually controls applicant email portal links in TEST/prod
- Primary docs:
  - `docs/AGENTS.md`
  - `../ISET-intake/docs/system/runtime/notifications.md`
  - `docs/ops/environments/test-env-config-map.md`
  - `docs/planning/notification-applicant-integration.md`
- Status: current as of 2026-04-02
- Notes: the template syntax is not the root cause. The renderer supports `[link url="..."]...[/link]`, but if `{portal_dashboard_url}` resolves empty or invalid the runtime intentionally degrades to plain text with no anchor. For admin-triggered secure-message emails, the send is initiated by `admin-dashboard` but uses shared notification code from `ISET-intake`, so the effective runtime env is the admin backend process. Current durable rule: prefer `APPLICANT_PORTAL_URL` / `APPLICANT_PORTAL_BASE`; fallback also checks `PUBLIC_PORTAL_BASE_URL`, `REACT_APP_PORTAL_URL`, `REACT_APP_API_BASE_URL`, and `PORTAL_DOMAIN`. For current TEST env-only mitigation before code deploy, set `APPLICANT_PORTAL_BASE=https://nwac-public-test.awentech.ca` in `admin-dashboard/.env.test` and redeploy the admin backend.

### Test-environment form/data pull path

- Topic: TEST DB access and the current Codex path for pulling tester-made environment data
- Keywords: `tester changes`, `download changes`, `test environment`, `intake process`, `digital forms`, `pull from test`, `workflow.schema.intake`, `run-test-sql-via-ssm`
- When to open: the user asks how to download, inspect, or pull changes testers made in TEST, or asks whether Codex is ready to query TEST from WSL/sandbox
- Primary docs:
  - `docs/guides/test-db-access-from-codex.md`
  - `docs/AGENTS.md` -> `Test DB interaction from Codex/WSL`
  - `scripts/run-test-sql-via-ssm.sh`
- Status: current as of 2026-04-01
- Notes: the durable note currently covers verified TEST DB access. As of 2026-04-01, large JSON exports through SSM stdout were observed truncating, so intake-step authoring pulls should use per-component base64 export and local reconstruction rather than one large stdout dump. If DEV is meant to become the new editing source of truth, treat `step` plus `step_component` as the import target and keep published runtime JSON as a reference snapshot, not the only artifact.

### Payment packet scheduling handoff

- Topic: locked scheduling, packet-grouping, and regeneration decisions for finance/payment packets
- Keywords: `payment packet`, `scheduling`, `awaiting_trigger`, `recurrence`, `queue timeline`, `regeneration`, `group by intervention date`
- When to open: the user references a prior design thread about packet scheduling, manual trigger flow, or why packets are grouped the way they are
- Primary docs:
  - `docs/planning/thread-handoff-2026-03-02.md`
  - `docs/planning/payment-packet-scheduling-design.md`
- Status: current durable handoff baseline

### Sage Intacct mock dashboard handoff

- Topic: durable handoff for the separate Intacct mock-dashboard and AP-bills design work
- Keywords: `intacct`, `sage`, `mock dashboard`, `AP bills`, `bill splitting`, `reconciliation`
- When to open: the user references the prior Intacct design thread or asks for the saved mock-dashboard direction
- Primary docs:
  - `docs/planning/intacct-mock-dashboard-design.md`
- Status: current durable handoff baseline

### Step 19 checkbox-conditionality follow-up

- Topic: keeping Step 19 `Supports Requested` as a checkbox array while driving later intake conditionality from those selections
- Keywords: `step 19`, `supports requested`, `checkbox array`, `contains`, `containsAny`, `notContainsAny`, `manual intake parity`, `workflow preview parity`
- When to open: the user asks why Step 19 support selections work in the public portal but not in Manual Intake or preview, or asks how the checkbox-array conditionality was implemented without refactoring Step 19 into yes/no fields
- Primary docs:
  - `docs/planning/step19-checkbox-conditionality-followup.md`
  - `docs/AGENTS.md`
- Status: current partial implementation as of 2026-04-01
- Notes: public portal runtime support and DEV workflow-21 authoring were added on 2026-04-01. That runtime support now includes checkbox-array operators plus whole-step skipping when a step has no visible components, and DEV Step 21/22 rely on that behavior instead of placeholder notices. Workflow 21 also now branches after Step `93` so applicants with `dependent-children = 0` are sent to a cloned Step 19 that omits the `Childcare` option. Manual Intake, Workflow Preview, and the intake-step editor still need parity work before this becomes a full-stack authoring feature.

### TEST staff Cognito recovery

- Topic: recovering TEST admin/staff accounts when region display is wrong or Cognito invitation/reset email flows fail
- Keywords: `mcoppola`, `acurtis`, `emarion`, `Administrative Users regions`, `primary region only`, `staff_profiles cognito_sub`, `FORCE_CHANGE_PASSWORD`, `resend invite`, `admin-set-user-password`, `forgot password email not received`
- When to open: the user reports that TEST admin users only show one region in `Administrative Users`, or a staff user cannot receive a Cognito password/invitation email, or a TEST DB refresh may have copied the wrong `staff_profiles` data
- Primary docs:
  - `docs/guides/test-staff-cognito-recovery.md`
  - `docs/AGENTS.md`
  - `src/routes/admin/users.js`
- Status: current as of 2026-04-02
- Notes: the durable findings from this thread are: `Administrative Users` multi-region display depends on matching Cognito `sub` to `staff_profiles.cognito_sub`; stale DB `cognito_sub` values make the UI fall back to the single Cognito `custom:region_id` primary region. The TEST staff pool currently uses `COGNITO_DEFAULT` mail with `verified_email` account recovery only, so legacy users missing `email` / `email_verified` cannot receive recovery mail until those attributes are repaired. For existing `FORCE_CHANGE_PASSWORD` users, prefer `admin-create-user --message-action RESEND`; if email delivery still fails, use `admin-set-user-password --no-permanent` and send the temporary password out-of-band.

## Future improvements

- Add stable entry IDs if this grows beyond a small manual list.
- Split the index by area (`Casework`, `Reporting`, `Ops`, `Auth`, `Finance`) once the list becomes long enough that a flat file slows search.
- Mark entries `superseded` when a newer canonical doc replaces them, but keep the old search keywords so future chats can still find the redirect.
