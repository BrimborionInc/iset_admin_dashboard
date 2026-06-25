-- Resolve PROD feedback #146 after release 20260624-rm-draft-edit-hotfix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();

START TRANSACTION;

SET @previous_146 := (SELECT status FROM admin_feedback_report WHERE id = 146 FOR UPDATE);

UPDATE admin_feedback_report
   SET status = 'resolved'
 WHERE id = 146
   AND summary = 'Can''t make edits to assessment'
   AND status <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 146, @previous_146, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE COALESCE(@previous_146, '') <> 'resolved'
   AND EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 146
          AND status = 'resolved'
          AND summary = 'Can''t make edits to assessment'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 146
          AND new_status = 'resolved'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 146, NULL, @actor_name, @actor_email,
       'Codex PROD closeout 2026-06-24: Release 20260624-rm-draft-edit-hotfix deployed to PROD as an admin-only hotfix with no schema, data, portal, shared, Terraform, or runtime-config changes. Sequence used admin 10-minute warning, admin ALB fallback, prebuilt production bundle with --skip-build, PROD ASG refresh f972930b-62c6-4cc7-b82d-7df49894cb78, fallback clear for ELB health evaluation, normal-routing smoke, deployed-source check, and warning clear. Verification: https://nwac-console.awentech.ca/healthz returned 200 after normal routing was restored; deployed-source SSM check 72dc8bd0-541c-4d6c-8e9e-adbec173be25 on replacement instance i-07d89e5d81b3a2077 confirmed releaseId 20260624-rm-draft-edit-hotfix, buildTarget production, public release notes, and canEditDraftAssessmentAsRegionalManager in CoordinatorAssessmentWidget.js. Live data recheck showed report case 129 still has active application 50 with status/lifecycle in_review and no iset_review_workflow row, so the deployed RM draft-edit gate applies while submitted assessments remain read-only. Report resolved.',
       @resolved_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 146
          AND summary = 'Can''t make edits to assessment'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 146
          AND note_text LIKE 'Codex PROD closeout 2026-06-24: Release 20260624-rm-draft-edit-hotfix deployed to PROD%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 146;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 146
 ORDER BY changed_at DESC, id DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 146
 ORDER BY id DESC
 LIMIT 4;
