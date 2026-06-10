# Secure Messaging widget

## Workflow

Application Assessment; Case Management

## Source

- src/widgets/SecureMessagingWidget.js
- src/widgets/SecureMessageComposePanel.jsx

## Primary Route Context

- /application-case/:id; /cases/:caseId

## Purpose

Case-linked secure communications with attachments.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
- Inbox, Sent, and Deleted tab tables use Cloudscape resizable columns and local full-tab sorting. Date/Time defaults newest first; From, Subject, Status, Forms, and Urgent are sortable from their column headers.
- In staff-facing Secure Messaging, `Inbox` unread/read remains the current viewer's mailbox state, while `Sent` status is applicant-facing and now reads as `Sent`, `Read by applicant`, or `Applicant replied`.
- The widget derives applicant direction, inbox/sent buckets, display names, and read-state authority from the canonical `sender`, `recipient`, and `thread` objects returned by `/api/cases/:id/messages`, or their typed actor field aliases. Raw `sender_id` / `recipient_id` values are compatibility-only and must not be used as applicant/staff routing authority.
- Secure-message compose opens in a floating non-modal panel owned by the Application Workspace / Case Workspace shell, not by the board widget. It stays open if quick layouts remove Secure Messaging from the board. The draft is only held in component state while the panel is open; there is no persisted draft retrieval. If the staff user changes to another case/applicant record while composing, the floating draft is closed and a warning is shown.
