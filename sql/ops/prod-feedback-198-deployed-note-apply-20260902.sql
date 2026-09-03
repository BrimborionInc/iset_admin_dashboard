-- Guarded PROD deployment note for feedback #198.
-- Scope: one admin_feedback_note row only. The report remains planned pending
-- reporter-role verification; no status/history, client, case, application,
-- workflow, reporting, document, configuration, or notification data changes.
--
-- Live metadata re-proved immediately before this artifact was prepared:
--   AWS account: 468278742295
--   database: iset_intake
--   server: MySQL 8.0.42 on ip-172-16-0-77:3306
--   user: app_admin@%
--   tables: admin_feedback_report, admin_feedback_note

START TRANSACTION;

SET @path_feedback_198_deployed_note_id = 0;

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.page_title,
       admin_feedback_report.page_path,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 198
 FOR UPDATE;

SET @path_feedback_198_deployed_guard_count = (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE admin_feedback_report.id = 198
     AND admin_feedback_report.report_type = 'bug'
     AND admin_feedback_report.severity = 'medium'
     AND admin_feedback_report.status = 'planned'
     AND admin_feedback_report.summary = 'Unable to Withdraw Application'
     AND admin_feedback_report.submitted_by_staff_profile_id = 60
     AND admin_feedback_report.submitted_by_role = 'ISET Coordinator'
     AND admin_feedback_report.page_title = 'Admin Console'
     AND admin_feedback_report.page_path = '/application-case/292?applicationId=233'
     AND admin_feedback_report.submitted_at = '2026-09-01 14:53:28'
     AND admin_feedback_report.updated_at = '2026-09-02 14:50:05'
);

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
       'Release 20260902-feedback-198-withdrawal-r1 was deployed to PROD on 2026-09-02/03 UTC as an admin-only rollout from clean commit d96c8894813f71174472425995ccb2834dccb23d. Schema, data, portal, shared runtime, workflow configuration, and external providers were outside scope. Immutable artifact SHA-256 ba8f3e6f330ae920f0e544fafb4666f08c0927e6563fd685025be111b8da612c was installed through ASG refresh a42a4483-04c9-47fb-99e5-9fe2e3984715. Normal-routing admin /readyz returned 200, and SSM provenance check cda2d2b8-bb02-463c-b934-c345130cc391 confirmed the exact release, commit, withdraw_application action, required-reason guard, and local readiness. The manifest truthfully records UNQUALIFIED because the general qualification harness is retired. Report #198 remains planned pending Judy Cook rechecking the affected workflow as an ISET Coordinator; do not mark it resolved until that role-specific verification passes.'
  FROM admin_feedback_report
 WHERE @path_feedback_198_deployed_guard_count = 1
   AND admin_feedback_report.id = 198
   AND admin_feedback_report.status = 'planned'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE admin_feedback_note.report_id = admin_feedback_report.id
        AND admin_feedback_note.author_name = 'Codex'
        AND admin_feedback_note.note_text = 'Release 20260902-feedback-198-withdrawal-r1 was deployed to PROD on 2026-09-02/03 UTC as an admin-only rollout from clean commit d96c8894813f71174472425995ccb2834dccb23d. Schema, data, portal, shared runtime, workflow configuration, and external providers were outside scope. Immutable artifact SHA-256 ba8f3e6f330ae920f0e544fafb4666f08c0927e6563fd685025be111b8da612c was installed through ASG refresh a42a4483-04c9-47fb-99e5-9fe2e3984715. Normal-routing admin /readyz returned 200, and SSM provenance check cda2d2b8-bb02-463c-b934-c345130cc391 confirmed the exact release, commit, withdraw_application action, required-reason guard, and local readiness. The manifest truthfully records UNQUALIFIED because the general qualification harness is retired. Report #198 remains planned pending Judy Cook rechecking the affected workflow as an ISET Coordinator; do not mark it resolved until that role-specific verification passes.'
   );
SET @path_feedback_198_deployed_note_count = ROW_COUNT();
SET @path_feedback_198_deployed_note_id = LAST_INSERT_ID();

SELECT @path_feedback_198_deployed_guard_count,
       @path_feedback_198_deployed_note_count,
       @path_feedback_198_deployed_note_id;

COMMIT;
