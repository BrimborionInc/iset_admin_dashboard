-- Guarded PROD feedback-log release-planning update for feedback #196.
-- Scope: feedback metadata only. No case, application, action-plan, CFA,
-- signing-request, message, document, event, notification, or runtime row is
-- mutated.
--
-- Required immediately before execution:
--   * prove exact PROD identity;
--   * capture current full DDL for admin_feedback_report,
--     admin_feedback_status_history, and admin_feedback_note;
--   * execute prod-feedback-196-triage-preview-20260825.sql and confirm the
--     exact triaging/high row and the 2026-08-25 Codex triage note.

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
       'planned',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'high'
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.summary = 'Decision Letter'
   AND admin_feedback_report.submitted_by_staff_profile_id = 54
   AND admin_feedback_report.submitted_by_email = 'acurtis@nwac.ca'
   AND admin_feedback_report.submitted_by_role = 'Regional Manager'
   AND admin_feedback_report.page_path = '/application-case/76?entry=approval&approvalType=application&step=communication&applicationId=123'
   AND admin_feedback_report.submitted_at = '2026-08-25 14:16:13'
   AND admin_feedback_report.updated_at = '2026-08-25 15:14:15';

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'high'
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.summary = 'Decision Letter'
   AND admin_feedback_report.submitted_by_staff_profile_id = 54
   AND admin_feedback_report.submitted_by_email = 'acurtis@nwac.ca'
   AND admin_feedback_report.submitted_by_role = 'Regional Manager'
   AND admin_feedback_report.page_path = '/application-case/76?entry=approval&approvalType=application&step=communication&applicationId=123'
   AND admin_feedback_report.submitted_at = '2026-08-25 14:16:13'
   AND admin_feedback_report.updated_at = '2026-08-25 15:14:15';

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
       'Release plan 2026-08-26: The systematic signing-lineage repair is complete and passed the exact Regional Manager Decision Letter send in the deployed Test and Training environment under release 20260825-signing-lineage-r2. The PROD release is approved and planned as clean admin 8fcd9ab27f67f5da6f905a8c810419d8b3e253cb, portal 9bd0f3bc75076dc9793eaeb490d645144c090a7f, unchanged shared f81519d74ab0553b19713cff33961386dd0887da, and the two canonical additive migrations only. No case, application, Action Plan, CFA, message, signing request, document, runtime configuration, or workflow data repair is included. Keep planned until normal-routing PROD readiness and exact deployed provenance are verified; do not send the real Decision Letter merely as a deployment smoke.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.status = 'planned'
   AND admin_feedback_report.severity = 'high'
   AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.note_text LIKE 'Release plan 2026-08-26: The systematic signing-lineage repair%'
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
