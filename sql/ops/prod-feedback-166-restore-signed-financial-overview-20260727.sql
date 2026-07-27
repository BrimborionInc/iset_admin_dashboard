-- PROD recovery for feedback #166 / Case 172.
-- Restores the signed July 6 Financial Overview document to the active
-- Supporting Documents set without changing the pending v2 signing request.
--
-- Rollback: set iset_document.id 5539 back to status = 'archived' after
-- rechecking the same case/application/version guards.

START TRANSACTION;

SET @feedback_report_id := 166;
SET @document_id := 5539;
SET @case_id := 172;
SET @application_id := 103;
SET @funding_overview_version_id := 7;
SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @now := NOW();

SET @document_guard_count := (
  SELECT COUNT(*)
    FROM iset_document d
    JOIN funding_overview_version_documents vd
      ON vd.document_id = d.id
     AND vd.funding_overview_version_id = @funding_overview_version_id
     AND vd.document_type = 'signed'
    JOIN funding_overview_version v
      ON v.id = vd.funding_overview_version_id
     AND v.version_number = 1
     AND v.status = 'signed'
   WHERE d.id = @document_id
     AND d.case_id = @case_id
     AND d.application_id = @application_id
     AND d.status = 'archived'
     AND d.source = 'system_generated'
     AND d.document_category = 'financial_overview'
     AND d.file_name = 'financial-overview-v1-ISET-20260616-9C760A-signed.pdf'
     AND d.file_path = 'uploads/2026/07/06/180/aab5bf00-7503-48f6-8b91-931851eb16c2-financial-overview-v1-iset-20260616-9c760a-signed.pdf'
     AND v.signed_at = '2026-07-06 19:39:02'
);

SET @feedback_guard_count := (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE id = @feedback_report_id
     AND submitted_by_email = 'emarion@nwac.ca'
     AND summary = 'Financial Overview'
     AND status = 'submitted'
);

SET @all_guards_ready := (
  @document_guard_count = 1
  AND @feedback_guard_count = 1
);

CREATE TEMPORARY TABLE tmp_feedback_166_guard (
  guard_name VARCHAR(64) PRIMARY KEY
) ENGINE=Memory;

INSERT INTO tmp_feedback_166_guard (guard_name) VALUES ('ready');

-- Deliberately fail if the exact expected PROD state has drifted.
INSERT INTO tmp_feedback_166_guard (guard_name)
SELECT 'ready'
WHERE @all_guards_ready <> 1;

UPDATE iset_document
   SET status = 'active',
       updated_at = @now
 WHERE id = @document_id
   AND status = 'archived'
   AND @all_guards_ready = 1;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @now
 WHERE id = @feedback_report_id
   AND status = 'submitted'
   AND @all_guards_ready = 1;

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT
  @feedback_report_id,
  'submitted',
  'in_progress',
  NULL,
  @actor_name,
  @actor_email,
  @now
WHERE @all_guards_ready = 1;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT
  @feedback_report_id,
  NULL,
  @actor_name,
  @actor_email,
  'Codex recovery 2026-07-27, approved by Bill: Restored the signed July 6 Financial Overview document (iset_document 5539, funding overview v1) from archived to active for Case 172 / Application 103. The underlying PDF object was independently verified on the PROD app host before recovery. The later v2 request remains pending and was not changed; if v2 contains further corrections, it should supersede v1 only after the participant signs it. Report remains in_progress pending live UI confirmation and a preventive product fix.',
  @now
WHERE @all_guards_ready = 1;

COMMIT;

SELECT
  @document_guard_count AS document_guard_count,
  @feedback_guard_count AS feedback_guard_count,
  @all_guards_ready AS all_guards_ready;

SELECT id, status, file_name, file_path, case_id, application_id, updated_at
  FROM iset_document
 WHERE id = @document_id;

SELECT id, status, summary, submitted_by_email, updated_at
  FROM admin_feedback_report
 WHERE id = @feedback_report_id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = @feedback_report_id
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = @feedback_report_id
 ORDER BY id DESC
 LIMIT 3;
