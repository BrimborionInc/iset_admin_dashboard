# Internal Messages Email-Action Control

Purpose: Track design, planning, implementation, and validation for making `/messages` behave like standard email for core actions.
Audience: Admin dashboard engineers and product owner.
Last Updated: 2026-02-20

## Scope Decisions (Locked)
- Internal staff messaging only.
- No spam/junk workflows.
- No thread/conversation view work.
- Keep implementation simple and action-focused.

## Phase Status
- Design: complete (for MVP)
- Planning: complete (for MVP)
- Implementation: in progress
- Validation: not started

## Goal
- Make the main user actions behave like standard email: `new`, `reply`, `reply all`, `forward`, `delete`, plus related mailbox actions (`restore`, `permanent delete`, `read/unread`).

## Current Gaps (From Code Review)
- Minor UX/text cleanup still needed to fully remove database-centric wording.
- Manual validation is pending for all action paths after backend changes.

## Target Behavior (MVP)

### 1) New
- User picks one or more recipients.
- Subject may be empty (store/display as `(No subject)`).
- Sent item appears for sender; inbox item appears only for selected recipients.

### 2) Reply
- Default recipient is original sender only.
- Subject prefixed with `Re:` once.
- Send targets only selected recipients (not all thread participants).

### 3) Reply All
- Recipients include original sender + all original recipients except current user.
- Subject prefixed with `Re:` once.
- Send targets only selected recipients.

### 4) Forward
- New compose action from selected message.
- Default recipients empty.
- Subject prefixed with `Fwd:` once.
- Body prefilled with forwarded content block.
- Forward sends as a new thread/message chain (no reply-thread coupling).

### 5) Delete / Restore / Permanent Delete
- `Delete` moves current user’s mailbox item to Deleted.
- `Restore` returns item to prior folder (`inbox` or `sent`).
- `Permanent delete` removes only current user’s deleted mailbox item from their view.
- No action should remove another user’s mailbox visibility.

### 6) Read / Unread
- Open/read marks inbox item as read.
- User can mark read items back to unread.

## Implementation Plan (Simple / Action-First)

1. Introduce explicit compose action modes in UI:
- Add `forward` mode in `src/pages/messages/MessagingContext.js`.
- Add compose initialization rules in `src/pages/messages/PinnedMessagePanel.jsx`.

2. Correct recipient semantics in backend send path:
- Ensure send delivery uses explicit recipient IDs from payload for each message.
- Do not auto-deliver replies to all historical thread participants.
- Keep sender copy in `sent`.
- Files: `isetadminserver.js` (`POST /api/me/staff-messages`, list query shaping).

3. Make message list return per-message recipients:
- Derive recipients for each message item from that message’s mailbox items (or equivalent per-message source), not thread-level participant union.
- This supports accurate `Reply all` prefill and “To” display.

4. Add `Forward` action end-to-end:
- UI button on selected message panel.
- Compose defaults and payload mapping.
- Backend treats forward as new-thread send.

5. Add `Mark as unread` action:
- UI affordance in inbox/deleted where applicable.
- Backend endpoint to clear `read_at` for owner item.

6. Normalize delete/read UX and refresh behavior:
- Update labels/help text to mailbox language (`Move to Deleted`, `Restore`, `Delete permanently`).
- Emit `staff-messages:refresh` after read/delete/restore/purge.
- Keep side navigation unread count consistent.

## Implementation Progress
- 2026-02-20 (Completed) Backend send semantics corrected in `isetadminserver.js`:
- Reply/reply-all delivery now respects explicit `toStaffProfileIds` and no longer auto-delivers to all historical thread participants.
- New messages no longer require non-empty subject (subject can be null/empty and is displayed as `(No subject)`).
- Thread participant table is still maintained, but per-message delivery is explicit-recipient only.
- Existing-thread send now enforces that the sender is already a thread participant (`thread_access_denied` on violation).
- 2026-02-20 (Completed) Backend list shaping corrected in `isetadminserver.js`:
- `recipients` and `participants` are now derived per message from `staff_message_item` ownership, not from thread-wide participant union.
- This enables correct `Reply all` prefill behavior.
- 2026-02-20 (Completed) Backend cleanup for dev/no-legacy direction:
- Removed missing-table fallbacks from staff messaging endpoints (`/api/me/staff-profiles`, `/api/me/staff-messages`, `/api/me/staff-messages/counts`, send/read/delete/restore/purge paths).
- 2026-02-20 (Completed) UI action-mode changes:
- Added `forward` mode to `MessagingContext`.
- Added `Forward` action button in `PinnedMessagePanel`.
- Compose behavior now differentiates `reply`, `reply all`, and `forward`.
- Forward composes with `Fwd:` subject and prefills forwarded body block.
- Reply target selection now respects sent-origin context (reply from a sent/deleted-from-sent item targets recipient instead of self).
- 2026-02-20 (Completed) Read/unread + refresh consistency:
- Added `PATCH /api/me/staff-messages/:itemId/unread` endpoint.
- Added `Mark unread` action in inbox message row actions.
- Read/delete/restore/permanent-delete now emit `staff-messages:refresh` to keep unread counts in sync.
- Simplified row-action refresh flow to a single event-driven reload path (avoids duplicate fetch calls per action).
- Updated messages route helper copy from scaffold wording to production wording (`Internal secure messaging for staff.`).
- Updated Deleted tab label to mailbox wording (`Deleted Items`).

## Remaining Work (Next Small Chunks)
1. Manual verification pass against the full test matrix (new/reply/reply-all/forward/delete/restore/purge/read/unread).
2. Tighten mailbox wording in UI labels/help text (final pass).
3. Optional: add confirmation behavior for empty-subject send (if desired by owner; currently allowed without prompt).

## Acceptance Criteria
- Reply only notifies sender unless user manually adds others.
- Reply all notifies all original participants except current user.
- Forward exists and sends to explicitly chosen recipients only.
- Delete/restore/permanent delete affect only current user mailbox items.
- Mark unread works and updates unread badge/counts.
- No thread-view feature added.
- No spam/junk feature added.

## Test Matrix (Manual)
- New: send with empty subject and with subject; validate inbox/sent placement.
- Reply: on a message with multiple participants, ensure only sender receives.
- Reply all: ensure all original participants except self receive.
- Forward: ensure no recipients preselected; ensure sent as new chain.
- Delete: sender deletes from Sent; recipient copy remains.
- Restore: deleted item returns to prior folder.
- Permanent delete: item disappears only for acting user.
- Read/unread: toggle updates row styling and side-nav unread count.

## Risks / Open Questions
- Empty-subject confirmation prompt decision still open (behavior currently allows silent send).
- Mark-unread is currently implemented for inbox rows only.
- Bulk actions intentionally deferred to keep scope small.
- Local runtime validation pending because Node.js tooling is not available in this WSL sandbox (`node: command not found`).

## Current Issues / Notes
- Attempted direct DB introspection using Windows `mysql.exe` from WSL hung in this sandbox session; code changes were validated by source inspection only (no runtime SQL smoke test yet).

## Change Log
- 2026-02-20: Initial control document created from current `/messages` gap analysis with scope constraints (internal-only, no spam/junk, no thread view).
- 2026-02-20: Phase 1 implementation started; backend recipient semantics corrected, forward mode added, mark-unread endpoint/action added, and staff-messaging legacy fallbacks removed.
