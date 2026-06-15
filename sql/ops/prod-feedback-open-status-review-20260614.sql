-- PROD feedback open-status review for 2026-06-14.
-- Scope: admin_feedback_note only. No client/case/application/document/action-plan data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 96, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains in_progress under the clarified queue definitions. This item is not planned because there is no complete/tested fix waiting for PROD deploy; the blocking work is still the NWAC/Bill business decision on which additional non-school or non-employment supporting document types/rules should be accepted. It is not resolved because that decision and any resulting configuration/code work are still outstanding.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 96
          AND summary = 'New supporting docs for non-school/employment applications'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 96
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains in_progress under the clarified queue definitions%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 97, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains in_progress under the clarified queue definitions. This item is not planned because there is no complete/tested wording or document-type change waiting for PROD deploy; the blocking work is still a NWAC/Bill decision on the intended Letters of Reference wording and how it should relate to Inuit/status-card alternatives. It is not resolved because the business wording decision and any resulting configuration/code work are still outstanding.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 97
          AND summary = 'Change "Letters of Reference"'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 97
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains in_progress under the clarified queue definitions%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 123, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains triaging. The appeals workflow has a recorded design recommendation, but it is not a complete/tested fix and is not awaiting only PROD deploy, so planned would be inaccurate. Outstanding work is policy/spec confirmation for the appeal entity, statuses, permissions, notifications, artifacts, and audit trail before implementation can be treated as underway.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 123
          AND summary = 'Appeals Workflow'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 123
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains triaging%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 130, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains in_progress under the clarified queue definitions because the reported Employment Insurance eligibility issue is still awaiting Deb/reporter confirmation or a reproducible current failure. Prior live-data inspection found the linked record clean and no repairable code/data defect was confirmed. It is not planned because no complete/tested fix is waiting for deploy, and not resolved until the reporter confirms the issue is cleared or we reproduce and close a concrete defect.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 130
          AND summary = 'Employment insurance eligibility'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 130
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains in_progress under the clarified queue definitions%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 134, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains in_progress, not planned. The applicant-name/salutation fix is already deployed in PROD, so planned would be the wrong state; however the workflow is not complete under the client-facing artifact validation rule because a newly generated/sent approval or denial letter still needs to be checked in PROD for the correct participant salutation/name. Move to resolved only after that artifact recheck is clean.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 134
          AND summary = 'Name shown in letter'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 134
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains in_progress, not planned%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 140, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains in_progress, not planned. The closed-action-plan recovery action is already deployed in PROD, so planned would be inaccurate; the item remains incomplete until an authenticated staff workflow recheck confirms the live recovery action end to end, including reason capture, internal note/audit event, ILMP reset, and optional completed-intervention reopen behavior. Move to resolved only after that recheck is clean.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 140
          AND summary = 'Add admin recovery action to reopen closed plan/intervention for amendment'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 140
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains in_progress, not planned%'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 141, NULL, @actor_name, @actor_email,
       'Codex open-status audit 2026-06-14: Status remains in_progress, not planned. The funding-revision CFA recovery path is already deployed in PROD, so planned would be inaccurate; the item remains incomplete until an authenticated live recheck confirms the funding revision letter path creates the missing Client Funding Agreement draft and produces the expected client-facing packet/signing request. Move to resolved only after that recheck is clean.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 141
          AND summary = 'Question'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 141
          AND note_text LIKE 'Codex open-status audit 2026-06-14: Status remains in_progress, not planned%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE status IN ('submitted', 'triaging', 'planned', 'in_progress')
 ORDER BY id;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (96, 97, 123, 130, 134, 140, 141)
 ORDER BY id DESC
 LIMIT 14;

SELECT status, COUNT(*) AS count
  FROM admin_feedback_report
 GROUP BY status
 ORDER BY status;
