-- Guarded PROD feedback-log triage update for feedback #196.
-- Scope: feedback metadata only. No case, application, action-plan, CFA,
-- signing-request, message, document, event, notification, or runtime row is
-- mutated.
--
-- Required preconditions:
--   * exact PROD identity has been proved in the current task;
--   * current full DDL is captured for admin_feedback_report,
--     admin_feedback_status_history, and admin_feedback_note;
--   * the read-only preview still proves the exact submitted report identity
--     guarded below.

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
 FOR UPDATE;

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email)
SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       'triaging',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.summary = 'Decision Letter'
   AND admin_feedback_report.submitted_by_staff_profile_id = 54
   AND admin_feedback_report.submitted_by_email = 'acurtis@nwac.ca'
   AND admin_feedback_report.submitted_by_role = 'Regional Manager'
   AND admin_feedback_report.page_path = '/application-case/76?entry=approval&approvalType=application&step=communication&applicationId=123'
   AND admin_feedback_report.submitted_at = '2026-08-25 14:16:13'
   AND admin_feedback_report.updated_at = '2026-08-25 14:16:13';

UPDATE admin_feedback_report
   SET status = 'triaging',
       severity = 'high'
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.summary = 'Decision Letter'
   AND admin_feedback_report.submitted_by_staff_profile_id = 54
   AND admin_feedback_report.submitted_by_email = 'acurtis@nwac.ca'
   AND admin_feedback_report.submitted_by_role = 'Regional Manager'
   AND admin_feedback_report.page_path = '/application-case/76?entry=approval&approvalType=application&step=communication&applicationId=123'
   AND admin_feedback_report.submitted_at = '2026-08-25 14:16:13'
   AND admin_feedback_report.updated_at = '2026-08-25 14:16:13';

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
SELECT admin_feedback_report.id,
       NULL,
       'Codex',
       NULL,
       'Codex triage 2026-08-25: Confirmed PROD defect and raised severity to high. The report captured Regional Manager communication work on case 76 / application 123. The PROD admin error log records two matching POST /api/cases/:id/messages failures between the adjacent 14:08 and 14:21 UTC log events, both with cfa_version_application_scope_unknown. Live data proves application 123 is final_decision_recorded and approved, review workflow 56 records the final approval, assessment 734 has a funded total of 9128, and application-scoped Action Plan 184 exists. The case also has older application-less Action Plan 3 and CFA version 19, still status sent, whose metadata has case.applicationId null. The current send path fails closed when any draft or sent CFA in the case series lacks application provenance, so it blocks the exact application 123 decision-letter, CFA, and EFT package. No case/CFA/application repair or resend was attempted. Keep triaging pending a code/data design that preserves the older unsigned agreement without letting it block unrelated application-scoped communication, followed by full Regional Manager TEST validation and targeted PROD recheck.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.severity = 'high'
   AND EXISTS (
       SELECT 1
         FROM admin_feedback_status_history
        WHERE admin_feedback_status_history.report_id = 196
          AND admin_feedback_status_history.previous_status = 'submitted'
          AND admin_feedback_status_history.new_status = 'triaging'
          AND admin_feedback_status_history.changed_by_name = 'Codex'
     )
   AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.note_text LIKE 'Codex triage 2026-08-25: Confirmed PROD defect%'
     );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 196
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 196
 ORDER BY admin_feedback_note.id;
