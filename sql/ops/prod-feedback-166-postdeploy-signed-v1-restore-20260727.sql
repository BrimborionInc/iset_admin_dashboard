-- PROD post-deploy recovery for feedback #166 / Case 172.
--
-- The signed Financial Overview v1 was restored at 12:09 UTC, then the
-- pre-release assessment path archived it again at 18:08 UTC. Release
-- 20260727-regional-snapshot-financial-overview now contains the prevention
-- guard. This transaction restores only the already-approved signed v1 row
-- after proving that v2 remains withdrawn and its signing request cancelled.
--
-- Rollback: set iset_document.id 5539 back to status = 'archived' only after
-- rechecking the same case/application/version guards.

START TRANSACTION;

SET @feedback_report_id := 166;
SET @document_id := 5539;
SET @case_id := 172;
SET @application_id := 103;
SET @version_id := 7;
SET @signed_request_id := 91;
SET @withdrawn_version_id := 18;
SET @cancelled_request_id := 136;
SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @now := NOW();

SET @signed_document_guard_count := (
  SELECT COUNT(*)
    FROM iset_document d
    JOIN funding_overview_version_documents vd
      ON vd.document_id = d.id
     AND vd.funding_overview_version_id = @version_id
     AND vd.document_type = 'signed'
    JOIN funding_overview_version v
      ON v.id = vd.funding_overview_version_id
     AND v.version_number = 1
     AND v.status = 'signed'
     AND v.signed_at = '2026-07-06 19:39:02'
    JOIN signing_request sr
      ON sr.id = @signed_request_id
     AND sr.case_id = @case_id
     AND sr.status = 'signed'
     AND sr.signed_at = '2026-07-06 19:39:02'
   WHERE d.id = @document_id
     AND d.case_id = @case_id
     AND d.application_id = @application_id
     AND d.status = 'archived'
     AND d.updated_at = '2026-07-27 18:08:26'
     AND d.source = 'system_generated'
     AND d.document_category = 'financial_overview'
     AND d.file_name = 'financial-overview-v1-ISET-20260616-9C760A-signed.pdf'
     AND d.file_path = 'uploads/2026/07/06/180/aab5bf00-7503-48f6-8b91-931851eb16c2-financial-overview-v1-iset-20260616-9c760a-signed.pdf'
);

SET @withdrawn_v2_guard_count := (
  SELECT COUNT(*)
    FROM funding_overview_version v
    JOIN signing_request sr
      ON sr.id = @cancelled_request_id
     AND sr.case_id = @case_id
     AND sr.status = 'cancelled'
     AND sr.signed_at IS NULL
   WHERE v.id = @withdrawn_version_id
     AND v.series_id = 6
     AND v.version_number = 2
     AND v.status = 'withdrawn'
     AND v.signed_at IS NULL
);

SET @feedback_guard_count := (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE id = @feedback_report_id
     AND submitted_by_email = 'emarion@nwac.ca'
     AND summary = 'Financial Overview'
     AND status = 'in_progress'
);

SET @all_guards_ready := (
  @signed_document_guard_count = 1
  AND @withdrawn_v2_guard_count = 1
  AND @feedback_guard_count = 1
);

CREATE TEMPORARY TABLE tmp_feedback_166_postdeploy_guard (
  guard_name VARCHAR(64) PRIMARY KEY
) ENGINE=Memory;

INSERT INTO tmp_feedback_166_postdeploy_guard (guard_name) VALUES ('ready');

-- Deliberately fail if the exact expected PROD state has drifted.
INSERT INTO tmp_feedback_166_postdeploy_guard (guard_name)
SELECT 'ready'
WHERE @all_guards_ready <> 1;

UPDATE iset_document
   SET status = 'active',
       updated_at = @now
 WHERE id = @document_id
   AND status = 'archived'
   AND @all_guards_ready = 1;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT
  @feedback_report_id,
  NULL,
  @actor_name,
  @actor_email,
  'Post-deploy recheck 2026-07-27: Release 20260727-regional-snapshot-financial-overview is live with the Financial Overview preservation guard. The recheck found that the pre-release assessment path had archived signed v1 document 5539 again at 18:08 UTC. The underlying 225,018-byte PDF object was verified in nwac-prod-uploads-b6bb, then the already-approved signed v1 row was restored to active. Version 18 remains withdrawn and signing request 136 remains cancelled. Feedback remains in_progress pending an authenticated case-file visibility recheck.',
  @now
WHERE @all_guards_ready = 1
  AND NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = @feedback_report_id
       AND note_text LIKE 'Post-deploy recheck 2026-07-27: Release 20260727-regional-snapshot-financial-overview is live%'
  );

COMMIT;

SELECT
  @signed_document_guard_count AS signed_document_guard_count,
  @withdrawn_v2_guard_count AS withdrawn_v2_guard_count,
  @feedback_guard_count AS feedback_guard_count,
  @all_guards_ready AS all_guards_ready;

SELECT id, status, file_name, file_path, case_id, application_id, updated_at
  FROM iset_document
 WHERE id = @document_id;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = @feedback_report_id;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = @feedback_report_id
 ORDER BY id DESC
 LIMIT 3;
