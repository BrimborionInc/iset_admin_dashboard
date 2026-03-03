# Payment Packet Scheduling Design (Implementation Handoff)

Last updated: 2026-03-02  
Status: Design decisions locked for v1 implementation

## Purpose
Capture the complete agreed behavior for refactoring payment packet creation so queue views in Case Workspace and Budgets & Payments represent a forward-looking transmission schedule to Finance.

This document is written as a standalone handoff so implementation can proceed in a new chat/thread without relying on prior conversation context.

## Core Product Goal
Payment packets must be date-driven aggregates of intervention funding disbursement lines, visible as a chronological schedule showing both future work and transmission history.

## Canonical Functional Rules (Locked)

### 1. Aggregation boundary
- Aggregate packet lines by `intervention_id + scheduled_payment_date`.
- Never merge lines across interventions, even when dates match.

### 2. Packet creation trigger
- Keep existing creation trigger: generate scheduled draft packets when intervention is approved.
- Do not create persisted scheduled packets during proposal draft editing.

### 3. Recurring generation volume
- Generate all scheduled recurring occurrences at approval time (for example, all 12 monthly occurrences).

### 4. Recurring date semantics
- Occurrence 1 date = recurrence `startDate`.
- Subsequent occurrence dates = `startDate` stepped by recurrence period (`weekly`, `bi_weekly`, `monthly`, `quarterly`).
- Treat recurrence dates as period-start dates.

### 5. Submission timing source
- Payment line scheduled date comes from payment-type timing policy.
- Policy is configured in Finance Settings `Payment type mapping` (Payment types tab).

### 6. Manual trigger policy behavior
- For `manual_trigger` payment types:
  - create packet/line in queue immediately;
  - mark as trigger-required state (`awaiting_trigger`);
  - no auto-release to finance submission pipeline.
- Users must explicitly trigger before submission.

### 7. Queue sorting
- Sort by:
  1. `scheduled_payment_date` ascending;
  2. status priority (operational urgency);
  3. packet creation timestamp.
- Null-date trigger-required packets appear after dated packets.

### 8. Due/overdue indicators
- `overdue`: `scheduled_payment_date < today` and status is not terminal (`sent`, `posted`, `reconciled`, `cancelled`).
- `due_today`: `scheduled_payment_date == today`.
- `upcoming`: `scheduled_payment_date > today`.
- `awaiting_trigger`: manual trigger packet not yet released (often null scheduled date, but can still carry suggested date).
- Use strict calendar-day logic (no grace period).

### 9. Intervention edits after approval
- On intervention funding/schedule edits: rebuild unsent packets from current schedule.
- `sent` and `posted` packets are immutable.
- Regeneration scope includes unsent statuses only.
- Record audit event/note on regeneration.

### 10. Defensive backend validation
- Keep limited safeguards in packet generation against malformed non-UI paths:
  - direct DB edits,
  - non-primary API clients,
  - demo/seed scripts,
  - import/backfill operations.
- Do not introduce heavy guard complexity beyond preventing invalid packet schedules.

## Canonical Packet Status Model (Locked)

### Statuses
1. `draft_scheduled`: dated draft packet not yet triggered/released/submitted.
2. `awaiting_trigger`: manual-trigger packet pending explicit user release.
3. `released`: manually triggered and now ready for finance submission.
4. `sent`: submitted to finance.
5. `posted`: finance accepted/posted.
6. `reconciled`: matched/closed in reconciliation workflow.
7. `cancelled`: voided/not payable.

### Transition rules
- `draft_scheduled` -> `released` (manual release action, if trigger-required policy applies)
- `draft_scheduled` -> `sent` (submit directly when release step not required)
- `awaiting_trigger` -> `released` (manual trigger action)
- `released` -> `sent` (finance submission action)
- `sent` -> `posted` (finance accepted/posted response)
- `posted` -> `reconciled` (reconciliation closeout)
- any non-terminal unsent status -> `cancelled` (explicit cancellation action)

### Immutability
- `sent`, `posted`, `reconciled` are immutable for schedule/line recomposition.
- Regeneration only mutates/replaces unsent packets.

## Approved Payment-Type Scheduling Defaults (Locked)
- `LivingAllowance` -> `recurrence_schedule`
- `TuitionFeesDirect` -> `intervention_start`
- `TuitionFeesReimbursement` -> `intervention_end`
- `SpecializedEquipmentAdvance` -> `intervention_start`
- `SpecializedEquipmentReimbursement` -> `intervention_end`
- `WageSubsidyEmployer` -> `recurrence_schedule`
- `Childcare` -> `recurrence_schedule`
- `Transportation` -> `recurrence_schedule`
- `BooksMaterialsDirect` -> `intervention_start`
- `BooksMaterialsReimbursement` -> `intervention_end`
- `JCPProjectCost` -> `manual_trigger`
- `SEBSupport` -> `recurrence_schedule`
- `OtherEligibleCost` -> `manual_trigger`

## Queue UX Expectations (Locked)
- Queue must show future scheduled packets and already-transmitted packets together in timeline context.
- `released` packets remain in normal date-based ordering and due/overdue logic, with additional visual tag such as `ready_to_send`.
- Users opening a case should immediately see what is upcoming, due, overdue, awaiting trigger, and sent history.

## Deferred Items (Explicitly Not in Current Scope)

### A. Intervention cancellation/early close cascading
- Deferred due complexity.
- v1 should avoid deep retroactive lifecycle automation beyond the agreed unsent-regeneration behavior.

### B. Detailed trigger UX payload
- Exact trigger form fields (trigger date vs suggested date, required notes, etc.) can be finalized during implementation.

### C. Regeneration conflict semantics for manually edited drafts
- If users manually edit unsent packet lines, conflict/override policy still needs explicit implementation rule.
- Recommendation for implementation phase: regenerate with deterministic source-of-truth schedule and record audit diff.

## Implementation Invariants
- Runtime payment-type mapping remains source of truth for scheduling policy.
- Scheduled date must be resolved at line level first, then packet aggregation applied.
- Grouping key must include intervention id to preserve cancellation/edit isolation.
- Terminal finance statuses must remain immutable for accounting traceability.
