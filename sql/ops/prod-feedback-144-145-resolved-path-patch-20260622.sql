-- Resolve PROD feedback #144 and #145 after release 20260622-path-bugfix-patch.
-- Scope: admin_feedback_* only. App/data cleanup was applied separately by
-- sql/ops/prod-path-patch-bugfix-cleanup-20260622-apply.sql.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();

START TRANSACTION;

SET @previous_144 := (SELECT status FROM admin_feedback_report WHERE id = 144 FOR UPDATE);
UPDATE admin_feedback_report
   SET status = 'resolved'
 WHERE id = 144
   AND summary = 'Financial Overview Document'
   AND status <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 144, @previous_144, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE COALESCE(@previous_144, '') <> 'resolved'
   AND EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 144
          AND status = 'resolved'
          AND summary = 'Financial Overview Document'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 144
          AND new_status = 'resolved'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 144, NULL, @actor_name, @actor_email,
       'Codex PROD closeout 2026-06-22: Release 20260622-path-bugfix-patch deployed to PROD after TEST deployment and normal-routing smoke. Live PROD evidence: public health smoke returned 200 for admin and both portal hostnames; deployed-source check on replacement instance i-0362df79d25a76d15 confirmed the admin and portal signing APIs contain the alreadySigned=true idempotency guard; post-deploy cleanup archived 5 duplicate/unreferenced active signed Financial Overview PDFs; rerun preview returned 0 unreferenced active signed Financial Overview PDFs. Report resolved.',
       @resolved_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 144
          AND summary = 'Financial Overview Document'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 144
          AND note_text LIKE 'Codex PROD closeout 2026-06-22: Release 20260622-path-bugfix-patch deployed to PROD%'
     );

SET @previous_145 := (SELECT status FROM admin_feedback_report WHERE id = 145 FOR UPDATE);
UPDATE admin_feedback_report
   SET status = 'resolved'
 WHERE id = 145
   AND summary = 'Overdue Items'
   AND status <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 145, @previous_145, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE COALESCE(@previous_145, '') <> 'resolved'
   AND EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND status = 'resolved'
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 145
          AND new_status = 'resolved'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 145, NULL, @actor_name, @actor_email,
       'Codex PROD closeout 2026-06-22: Release 20260622-path-bugfix-patch deployed to PROD after TEST deployment and normal-routing smoke. Live PROD evidence: public health smoke returned 200 for admin and both portal hostnames; deployed-source check on replacement instance i-0362df79d25a76d15 confirmed the Overdue/status patch code is present; post-deploy cleanup cleared the stale terminal-state work that could keep closed/completed records in active work queues (3 document-request flags and 7 terminal-case reminders) and backfilled 5 completed approved decision outcomes; rerun preview returned 0 for all four cleanup categories. Report resolved.',
       @resolved_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 145
          AND note_text LIKE 'Codex PROD closeout 2026-06-22: Release 20260622-path-bugfix-patch deployed to PROD%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (144, 145)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (144, 145)
 ORDER BY changed_at DESC, id DESC
 LIMIT 10;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (144, 145)
 ORDER BY id DESC
 LIMIT 6;
