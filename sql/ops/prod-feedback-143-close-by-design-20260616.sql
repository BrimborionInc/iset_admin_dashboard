-- PROD feedback #143 closure after Financial Overview design confirmation.
-- Scope: admin_feedback_* only. No client/case/application/document/signing data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'closed'
 WHERE id = 143
   AND status = 'triaging'
   AND summary = 'Fillable Financial Form';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 143, 'triaging', 'closed', NULL, @actor_name, @actor_email, @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 143
          AND status = 'closed'
          AND summary = 'Fillable Financial Form'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 143
          AND previous_status = 'triaging'
          AND new_status = 'closed'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 143, NULL, @actor_name, @actor_email,
       'Codex correction 2026-06-16: Reviewed the Financial Overview design notes and earlier implementation records. The current behavior is by design for the initial build: the case manager/PATH financial data populates the Financial Overview, the applicant cannot edit figures in the signing request, and the applicant signature records only the attestation that the displayed figures are accurate as of signing. Canonical references: docs/requirements/SentToApplicant/README.md and docs/planning/cfa-versioning-spec.md. Closing this report as support/training/by-design rather than a functional bug. Staff guidance needed: complete/update the financial figures in PATH before sending the Financial Overview for signature; if the client sends a separate completed Word/PDF form, upload it as a supporting document as Amanda did for this case.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 143
          AND summary = 'Fillable Financial Form'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 143
          AND note_text LIKE 'Codex correction 2026-06-16: Reviewed the Financial Overview design notes%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 143;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 143
 ORDER BY changed_at DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 143
 ORDER BY id DESC
 LIMIT 3;
