-- Resolve PROD feedback #149 after two-step review data repair and prevention release.
-- Scope: admin_feedback_* only. No client/case/application/intervention/document data is mutated.

START TRANSACTION;

SET @report_id := 149;
SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();
SET @previous_status := (
  SELECT status
    FROM admin_feedback_report
   WHERE id = @report_id
   FOR UPDATE
);

SET @note_text := 'Codex resolved 2026-07-05: Post-repair and post-deploy recheck for Kitson/Wallace two-step review. Kitson is intervention proposal 332 / workflow 12 at nwac_review after Amanda RM sign-off, so it correctly belongs with Decision Maker for final review; its generated v2 assessment/redline PDFs are active and now linked to intervention 219 through iset_document_intervention. Wallace is intervention proposal 339 / workflow 13 at final_decision_recorded/approved; its submitted_at timestamp was repaired to the authoritative workflow submit time and its generated/approved assessment PDFs are active and linked to intervention 220. PROD release 20260705-two-step-review-prevention is live, deployed-source markers are present, admin smoke returned 200, and post-deploy two-step audit command 7405d66e-0bf6-4076-808d-114b562715e7 returned no known workflow/status, missing packet document, or proposal timestamp mismatch rows. Reopen or file a new report only if Madison still sees a current Decision Maker action blocked in the UI.';

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @resolved_at
 WHERE id = @report_id
   AND @previous_status IS NOT NULL
   AND @previous_status <> 'resolved';

INSERT INTO admin_feedback_status_history (
  report_id,
  previous_status,
  new_status,
  changed_by_staff_profile_id,
  changed_by_name,
  changed_by_email,
  changed_at
)
SELECT
  @report_id,
  @previous_status,
  'resolved',
  NULL,
  @actor_name,
  @actor_email,
  @resolved_at
WHERE @previous_status IS NOT NULL
  AND @previous_status <> 'resolved'
  AND NOT EXISTS (
    SELECT 1
      FROM admin_feedback_status_history
     WHERE report_id = @report_id
       AND new_status = 'resolved'
       AND changed_by_name = @actor_name
       AND changed_by_email = @actor_email
       AND changed_at >= '2026-07-05 00:00:00'
  );

INSERT INTO admin_feedback_note (
  report_id,
  author_staff_profile_id,
  author_name,
  author_email,
  note_text,
  created_at
)
SELECT
  @report_id,
  NULL,
  @actor_name,
  @actor_email,
  @note_text,
  @resolved_at
WHERE @previous_status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = @report_id
       AND note_text LIKE 'Codex resolved 2026-07-05: Post-repair and post-deploy recheck for Kitson/Wallace two-step review.%'
  );

SELECT
  id,
  status,
  summary,
  updated_at
FROM admin_feedback_report
WHERE id = @report_id;

SELECT
  report_id,
  previous_status,
  new_status,
  changed_by_name,
  changed_by_email,
  changed_at
FROM admin_feedback_status_history
WHERE report_id = @report_id
ORDER BY changed_at, id;

SELECT
  report_id,
  author_name,
  author_email,
  created_at,
  LEFT(note_text, 500) AS note_preview
FROM admin_feedback_note
WHERE report_id = @report_id
ORDER BY created_at DESC, id DESC
LIMIT 3;

COMMIT;
