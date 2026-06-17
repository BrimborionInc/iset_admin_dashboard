-- PROD feedback #143 Financial Overview signing triage for 2026-06-16.
-- Scope: admin_feedback_* only. No client/case/application/document/signing data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'triaging'
 WHERE id = 143
   AND status = 'submitted'
   AND summary = 'Fillable Financial Form';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 143, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 143
          AND status = 'triaging'
          AND summary = 'Fillable Financial Form'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 143
          AND previous_status = 'submitted'
          AND new_status = 'triaging'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 143, NULL, @actor_name, @actor_email,
       'Codex triage 2026-06-16: Valid report for Kaitlyn Kitson, case 44 / application 88. Secure message 790 created Financial Overview signing request 66 from workflow 52; Kaitlyn signed it on 2026-06-15. The saved signed payload contains only client-sig, and the funding_overview_version snapshot has empty income/expense fields because the current Financial Overview secure-message flow renders the existing Case Workspace/Application Details financial figures for review and signature. It does not capture applicant-entered PDF/form-field values inside the signing flow. The resulting signed PDFs 4135/4136 therefore mirror the blank source snapshot. Amanda later manually uploaded Applicant Financial Overview June 2026.docx as document 4138. This should stay open as a workflow/product fix: either collect/update financial overview fields before sending, or change the applicant signing flow to expose real editable fields and persist them before generating the signed PDF. No client/case/document/signing data changed during triage.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 143
          AND summary = 'Fillable Financial Form'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 143
          AND note_text LIKE 'Codex triage 2026-06-16: Valid report for Kaitlyn Kitson%'
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
 ORDER BY id DESC;
