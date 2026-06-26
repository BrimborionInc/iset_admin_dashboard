-- Resolve PROD feedback #147 after release 20260626-rm-draft-submit-hotfix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();

START TRANSACTION;

SET @previous_147 := (SELECT status FROM admin_feedback_report WHERE id = 147 FOR UPDATE);

UPDATE admin_feedback_report
   SET status = 'resolved'
 WHERE id = 147
   AND summary = '''Review workflow transition forbidden"'
   AND status <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 147, @previous_147, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE COALESCE(@previous_147, '') <> 'resolved'
   AND EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 147
          AND status = 'resolved'
          AND summary = '''Review workflow transition forbidden"'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 147
          AND new_status = 'resolved'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 147, NULL, @actor_name, @actor_email,
       'Codex PROD closeout 2026-06-26: Release 20260626-rm-draft-submit-hotfix deployed to PROD as an admin-only hotfix with no schema, data, portal, shared, Terraform, or runtime-config promotion. Sequence used admin in-app warning, admin ALB fixed-response fallback, PROD ASG refresh 4eafe107-55a1-473a-9cbc-e7fd20962f4f, fallback clear after refresh, normal-routing health smoke, deployed-source check, runtime transition check, targeted live Case 129 recheck, and warning clear. Replacement instance i-0253edba712ce48ca is healthy on nwac-prod-admin-tg:5001; final normal-routing health checks returned 200 for https://nwac-console.awentech.ca/healthz and the path:deploy smoke. Deployed-source SSM command d4ff8cbc-ac80-4236-93ac-402e708ec5e9 confirmed releaseId 20260626-rm-draft-submit-hotfix, buildTarget production, server workflowType propagation, and reviewWorkflow helper markers allowing Regional Manager application-assessment starts. Runtime transition SSM command 212ec468-6022-4b57-b26e-03d736b8bf8b confirmed Regional Manager application_assessment submit_for_rm_review is allowed to rm_review, Regional Manager intervention_proposal start remains denied, and Regional Manager final approval remains denied. Live data recheck showed case 129 / application 50 is still in_review, assigned to Emilie Marion, has assessment row 50, and has no iset_review_workflow row, so the deployed fix applies when Emilie retries. Report resolved.',
       @resolved_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 147
          AND summary = '''Review workflow transition forbidden"'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 147
          AND note_text LIKE 'Codex PROD closeout 2026-06-26: Release 20260626-rm-draft-submit-hotfix deployed to PROD%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 147;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 147
 ORDER BY changed_at DESC, id DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 147
 ORDER BY id DESC
 LIMIT 4;
