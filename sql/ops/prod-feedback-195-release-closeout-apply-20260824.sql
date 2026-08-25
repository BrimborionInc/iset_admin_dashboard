-- Guarded PROD release closeout for feedback #195.
-- Scope: feedback metadata only. No case, client, application, assessment,
-- ILMP, reporting, document, notification, or runtime row is mutated.
--
-- Live metadata re-proved immediately before this artifact was prepared:
--   database: iset_intake
--   server: MySQL 8.0.42 on ip-172-16-0-77:3306
--   user: app_admin@%
--   tables: admin_feedback_report, admin_feedback_status_history,
--           admin_feedback_note

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
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
       'resolved',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-24 18:49:15';

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
       'Codex release closeout 2026-08-24: Resolved after PROD release 20260824-path-maintenance-r1. The deployed admin source contains the dedicated case-only PATCH /api/cases/:id/participant-details boundary and exactly matches clean commit a791bc4b12fb606ee7f4655e5832d0656563863f (server SHA-256 7e2df624da8e7d45eeed4ab7a297ece672dd184d2484d8b2daa2b0c399b7849f; participant-details helper SHA-256 a781e4247a98c7287df0a18ff013acbd84092b731cc994e63f68e20ba8e89a0a). Focused route, helper, widget, ownership, repeat/application-less case, no-sibling-mutation, and ILMP-state preservation tests passed inside the full release gates. Aurora restore point path-prod-20260824-path-maintenance-r1-20260825001518 was available before the additive lifecycle migration; ASG refresh 59e0a31b-e88d-4843-9e4b-3493ef5cd5c9 completed successfully on i-0133d8b37828eeee9; both PM2 services are online with zero restarts; admin and both portal /readyz endpoints returned 200 under normal routing. The reported postal-code correction requires no data repair and can now be retried from ISET Clients. Release manifest: tmp/path-deploy/prod/20260824-path-maintenance-r1--2026-08-25T00-15-18-895Z.json. The retired qualification harness was deliberately bypassed, so the manifest records UNQUALIFIED rather than GO.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-24 18:49:15';

UPDATE admin_feedback_report
   SET status = 'resolved'
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-24 18:49:15';

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 195
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
 ORDER BY admin_feedback_note.id;
