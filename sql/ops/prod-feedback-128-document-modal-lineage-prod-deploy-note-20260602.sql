-- PROD feedback #128 deployed note for the document modal lineage fix.
-- Scope: admin_feedback_* tables only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 128;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 128, NULL, @actor_name, @actor_email,
       'Codex deploy note 2026-06-02: Admin-only PROD release 20260601-prod-document-lineage-fix is live. The release preserves application-submission lineage for source-required Supporting Documents rows when the Edit document details modal updates application_submission status_card documents, fixing the check-constraint failure Danielle reported after the earlier inline-label fix. PROD deploy evidence: schema/data/portal/shared were skipped; admin artifact uploaded to s3://nwac-prod-artifacts/admin/admin-dashboard-latest.zip; ASG refresh 06019adf-ddc9-4f80-8e2c-ae254a68b2f6 completed successfully on replacement instance i-06dfaf4a1f010fe18; normal-routing smoke returned 200 for https://nwac-console.awentech.ca/healthz, https://iset.nwac.ca/healthz, and https://nwac-public.awentech.ca/healthz; deployed-source SSM check found documentSourceRequiresApplicationLineage, preserveDocumentSourceLineage, and both route call sites in /opt/nwac/admin-dashboard/isetadminserver.js. Keep this report in_progress until Danielle or staff rechecks the live modal path, because Codex did not mutate Danielle''s live applicant document solely for verification.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 128)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 128
        AND note_text LIKE 'Codex deploy note 2026-06-02: Admin-only PROD release 20260601-prod-document-lineage-fix is live%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 128;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 128
 ORDER BY id DESC
 LIMIT 3;
