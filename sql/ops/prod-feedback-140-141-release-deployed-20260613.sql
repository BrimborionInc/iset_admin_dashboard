-- PROD post-deploy notes for reports #140 and #141 after release 20260612-212548.
-- Scope: admin_feedback_* rows plus read-only runtime-config verification.
-- No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();
SET @release_id := '20260612-212548';
SET @manifest_path := 'tmp/path-deploy/prod/20260612-212548--2026-06-13T01-21-28-902Z.json';
SET @refresh_id := '8e559286-0a7d-4207-bfcc-34034519fa32';
SET @bundle_check_command := 'ac1e4b2c-3f29-4216-98e3-d107b40b4d2d';
SET @source_check_command := '954db689-acf6-4ebb-b433-c6173d14e1dc';

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_feedback_post_deploy_status_change AS
SELECT id AS report_id,
       status AS previous_status
  FROM admin_feedback_report
 WHERE id IN (140, 141)
   AND status <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT c.report_id, c.previous_status, 'in_progress', NULL, @actor_name, @actor_email, @note_at
  FROM tmp_feedback_post_deploy_status_change c
 WHERE NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = c.report_id
        AND h.new_status = 'in_progress'
        AND h.changed_by_name = @actor_name
        AND h.changed_at >= DATE_SUB(@note_at, INTERVAL 10 MINUTE)
   );

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id IN (140, 141)
   AND (
     status <> 'in_progress'
     OR updated_at < @note_at
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 140, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD deploy note 2026-06-13: full PROD release ', @release_id,
         ' is live. Manifest: ', @manifest_path,
         '. Restore point path-prod-20260612-212548-20260613012128 is available; canonical schema plan reported pendingCount 0; intake-release promoted workflow 21 runtime config checksum 6126d57f8fd66f712672b83c2c0d5672fb3f410e20d3148488b64a23d4ed08c9. ',
         'Artifacts uploaded to s3://nwac-prod-artifacts/shared/shared-latest.zip, s3://nwac-prod-artifacts/admin/admin-dashboard-latest.zip, and s3://nwac-prod-artifacts/portal/portal-latest.zip; ASG refresh ', @refresh_id,
         ' completed Successful on replacement instance i-07b1b6ede5bb88a6a. Normal-routing smoke returned 200 for https://nwac-console.awentech.ca/healthz, https://iset.nwac.ca/healthz, and https://nwac-public.awentech.ca/healthz; ALB fallback and the in-app maintenance warning were cleared. ',
         'Deployed bundle check ', @bundle_check_command,
         ' found Release 20260612-212548 first in /opt/nwac/admin-dashboard/build/static/js/main.9c617ea1.js and found the System Administrators reopen note. Deployed-source check ', @source_check_command,
         ' found the System Administrator-only reopen guard and closed action plan audit marker in /opt/nwac/admin-dashboard/isetadminserver.js. ',
         'Keep this report in_progress until an authenticated staff workflow recheck confirms the live Case Workspace recovery action end to end, including reason capture, ILMP reset, and optional completed-intervention reopen.'
       ),
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 140)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 140
        AND note_text LIKE CONCAT('Codex PROD deploy note 2026-06-13: full PROD release ', @release_id, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 141, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex PROD deploy note 2026-06-13: full PROD release ', @release_id,
         ' is live. Manifest: ', @manifest_path,
         '. Restore point path-prod-20260612-212548-20260613012128 is available; canonical schema plan reported pendingCount 0; intake-release promoted workflow 21 runtime config checksum 6126d57f8fd66f712672b83c2c0d5672fb3f410e20d3148488b64a23d4ed08c9. ',
         'Artifacts uploaded to s3://nwac-prod-artifacts/shared/shared-latest.zip, s3://nwac-prod-artifacts/admin/admin-dashboard-latest.zip, and s3://nwac-prod-artifacts/portal/portal-latest.zip; ASG refresh ', @refresh_id,
         ' completed Successful on replacement instance i-07b1b6ede5bb88a6a. Normal-routing smoke returned 200 for https://nwac-console.awentech.ca/healthz, https://iset.nwac.ca/healthz, and https://nwac-public.awentech.ca/healthz; ALB fallback and the in-app maintenance warning were cleared. ',
         'Deployed bundle check ', @bundle_check_command,
         ' found the funding-revision release note in the live admin bundle. Deployed-source check ', @source_check_command,
         ' found the plan-first CFA draft fallback markers createCfaVersionForPlan, createCfaVersionFromAssessment, and hasAppliedInterventionRevisionMetadata(sourceMetadata) in /opt/nwac/admin-dashboard/isetadminserver.js. ',
         'Keep this report in_progress until an authenticated staff workflow/artifact recheck confirms the live funding revision letter path creates the missing Client Funding Agreement draft and produces the expected client-facing packet.'
       ),
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 141)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 141
        AND note_text LIKE CONCAT('Codex PROD deploy note 2026-06-13: full PROD release ', @release_id, '%')
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (140, 141)
 ORDER BY id;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (140, 141)
 ORDER BY id DESC
 LIMIT 6;

SELECT COUNT(*) AS active_service_announcement_rows
  FROM iset_runtime_config
 WHERE scope = 'runtime'
   AND k = 'service.announcement';
