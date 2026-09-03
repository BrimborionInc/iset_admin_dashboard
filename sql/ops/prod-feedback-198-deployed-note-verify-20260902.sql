-- Independent read-only verification for the feedback #198 deployment note.

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 198;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 198
   AND admin_feedback_note.author_name = 'Codex'
   AND admin_feedback_note.note_text = 'Release 20260902-feedback-198-withdrawal-r1 was deployed to PROD on 2026-09-02/03 UTC as an admin-only rollout from clean commit d96c8894813f71174472425995ccb2834dccb23d. Schema, data, portal, shared runtime, workflow configuration, and external providers were outside scope. Immutable artifact SHA-256 ba8f3e6f330ae920f0e544fafb4666f08c0927e6563fd685025be111b8da612c was installed through ASG refresh a42a4483-04c9-47fb-99e5-9fe2e3984715. Normal-routing admin /readyz returned 200, and SSM provenance check cda2d2b8-bb02-463c-b934-c345130cc391 confirmed the exact release, commit, withdraw_application action, required-reason guard, and local readiness. The manifest truthfully records UNQUALIFIED because the general qualification harness is retired. Report #198 remains planned pending Judy Cook rechecking the affected workflow as an ISET Coordinator; do not mark it resolved until that role-specific verification passes.'
 ORDER BY admin_feedback_note.id;
