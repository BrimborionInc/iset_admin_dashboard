# Database Retention And Unchecked Growth Review

Purpose: Capture the May 10, 2026 review of shared MySQL tables that can accumulate system tracking, transient, security, or queue data outside ordinary case/application operations records.

Status: investigation complete; retirement implementation added after review.

DEV validation: migration `20260510_0001_retire_event_outbox.sql` was applied locally on 2026-05-10; follow-up migration plan reported `0` pending and `information_schema.tables` reported `iset_event_outbox` absent.

## Scope

This review covered the admin dashboard, public portal, and shared event/notification code paths that write to the shared `iset_intake` MySQL database. The goal was to identify tables liable to unchecked growth, then test the theory against DEV and PROD row counts.

Primary evidence:

- Code scan in `isetadminserver.js`, `../ISET-intake/server.js`, `../ISET-intake/auth/cognitoAuth.js`, and `../shared/events/*`.
- DEV schema/count checks through repo `.env`.
- PROD read-only exact table counts through `bash scripts/run-prod-sql-via-ssm.sh --profile nwac-prod`.

## Findings

### Highest Risk: Event Outbox

`iset_event_outbox` was the clearest unchecked-growth table and has now been selected for retirement.

- At review time, code wrote one outbox row for each event in `../shared/events/emitter.js`.
- No processor or cleanup path was found for `UPDATE iset_event_outbox ...`, `DELETE FROM iset_event_outbox ...`, or delivered/failed retention.
- PROD count on 2026-05-10: `2,672` rows, all `pending`, oldest `2026-03-27 22:46:42.122`, newest `2026-05-10 12:53:46.568`.
- PROD exact all-table counter placed it second by row count, just behind `iset_event_entry` (`2,680`).

Recommendation:

- Decision on 2026-05-10: retire the current outbox scaffold instead of completing it.
- Implementation:
  - `../shared/events/emitter.js` no longer writes `iset_event_outbox`.
  - Migration `20260510_0001_retire_event_outbox.sql` drops the table.
  - Reset/postload helpers no longer reference the table.
- If PATH later needs durable async event delivery, design it deliberately as a notification delivery queue with worker ownership, idempotency, retries, monitoring, and retention.

### High Risk: Event And Notification Tracking

`iset_event_entry`, `iset_internal_notification`, and `iset_internal_notification_dismissal` are intentional audit/UX tracking stores, but they have no retention boundary in code.

PROD counts on 2026-05-10:

- `iset_event_entry`: `2,680` rows.
- `iset_internal_notification`: `693` rows.
- `iset_internal_notification_dismissal`: `631` rows.

The event stream is operationally useful, so this is not a simple purge target. The risk is indefinite retention of high-volume activity such as `document_uploaded` (`1,475` PROD events).

Recommendation:

- Define retention by use:
  - keep case/application event history for the required operational/audit window, likely at least the program reporting period plus one year;
  - set `expires_at` on event-generated bell notifications, for example 90-180 days after creation;
  - delete expired notifications and rely on cascade to remove dismissals;
  - keep admin-authored global notifications until their configured `expires_at` or manual retirement.
- Add a monthly read-only counter/age report for `iset_event_entry`, `iset_internal_notification`, and dismissal rows.

### Medium Risk: Security Audit Tables

`applicant_password_reset_request_audit` is written for every forgot-password / activation reset request and has no cleanup path.

PROD count on 2026-05-10: `47` rows, oldest `2026-04-16 02:50:39.789`, newest `2026-05-10 03:13:23.864`.

This is small today, but it stores raw email, source IP, and user-agent data.

Recommendation:

- Keep enough history for abuse investigation, for example 180 days raw.
- Consider hashing or truncating source IP/user-agent after the short investigation window.
- Delete or anonymize after a fixed upper bound, for example 13 months, unless a legal/security hold exists.

`client_applicant_account_event` is account lifecycle audit data, not a transient queue. PROD count was `242`, mostly `activated`, `account_created`, and `invitation_sent`. Keep it longer than password-reset request rows, but document a retention target.

### Medium Risk: Session Audit Is Not Currently Writing

`user_session_audit` is intended to track token sessions and has a manual System Administrator prune endpoint, but no automatic retention job.

DEV and PROD counts on 2026-05-10 were both `0`.

Important implementation finding: the public portal session-audit insert currently expects columns `cognito_sub`, `exp`, and `ua_hash`, while both DEV and PROD tables have `user_agent_hash` and no `cognito_sub` / `exp`. A rollback-safe DEV probe of the current insert shape failed with `ER_BAD_FIELD_ERROR: Unknown column 'cognito_sub' in 'field list'`. The portal catches this error, so session audit writes are silently skipped.

Recommendation:

- Treat this as two separate tasks:
  - first align the session audit writer and table schema, then verify rows appear;
  - then replace the manual-only prune button with an automatic retention job, probably 60-90 days for ordinary session telemetry.
- Keep IP/user-agent hashed as currently intended for session rows.

### Low Risk / Bounded But Needs Sweeping

`input_json_state` and `pending_uploads` are correctly TTL-shaped.

DEV and PROD counts on 2026-05-10 were `0` for both, with `expires_at` indexes and background cleanup code present in the public portal.

`application_lock` is bounded by `application_id` because it has one row per application. Expired locks are ignored by read joins and deleted opportunistically during acquire, but stale rows are not proactively swept.

PROD count on 2026-05-10: `15`, all expired. DEV count: `1`, expired.

Recommendation:

- Add a harmless scheduled sweep: `DELETE FROM application_lock WHERE expires_at <= NOW()`.
- This is not urgent for database size, but it keeps admin/debug views honest.

## PROD Counter Summary

The 2026-05-10 exact PROD counter found no table that is large in absolute terms. The top system/tracking tables were:

| Table | Rows | Notes |
| --- | ---: | --- |
| `iset_event_entry` | 2,680 | Intentional event/audit stream; needs retention policy. |
| `iset_event_outbox` | 2,672 | Retired after this review; all rows were pending and no processor/cleanup existed. |
| `iset_internal_notification` | 693 | Bell-alert rows; no expiry default for event-generated rows. |
| `iset_internal_notification_dismissal` | 631 | Viewer dismissal/read state; cascades if notifications are deleted. |
| `client_applicant_account_event` | 242 | Account lifecycle audit. |
| `applicant_password_reset_request_audit` | 47 | Security request audit with raw IP/user-agent. |
| `application_lock` | 15 | All expired; bounded, but should be swept. |
| `input_json_state` | 0 | TTL cleanup working. |
| `pending_uploads` | 0 | TTL cleanup working. |
| `user_session_audit` | 0 | Not writing because schema and writer disagree. |

## Proposed Implementation Order

1. Retire `iset_event_outbox`. Implemented by code removal plus migration `20260510_0001_retire_event_outbox.sql`.
2. Add retention jobs for notifications, with dry-run/report mode first.
3. Align `user_session_audit` schema/writer and add automatic session-audit retention.
4. Add lightweight cleanup for expired `application_lock`.
5. Define documented retention windows for password-reset audit and applicant-account event audit.
6. Add a monthly/admin-only table-growth report for the table set above.
