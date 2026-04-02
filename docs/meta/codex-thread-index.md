# Codex Thread Index

Purpose: searchable index of durable notes, handoff docs, and thread-born findings that future chats may need to recover quickly when prior chat history is unavailable.

Last Updated: 2026-04-01

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

## Future improvements

- Add stable entry IDs if this grows beyond a small manual list.
- Split the index by area (`Casework`, `Reporting`, `Ops`, `Auth`, `Finance`) once the list becomes long enough that a flat file slows search.
- Mark entries `superseded` when a newer canonical doc replaces them, but keep the old search keywords so future chats can still find the redirect.
