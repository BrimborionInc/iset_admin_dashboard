-- PROD feedback progress note for report #137.
-- Scope: admin_feedback_* tables only. No client/case/application/action-plan data is mutated.

SET @report_id := 137;
SET @note_text := 'Codex progress update: local code now prevents recurrence by making Add Existing Action Plan load case/application fallback context and require the Appendix A action-plan reporting fields before save. Backend create-action-plan validation now enforces the same core fields for backloaded plans. Read-only Shayleen repair preview sql/ops/prod-preview-shayleen-mcnabb-ilmp-safe-repair-20260605.sql identifies safe repairs for root Participant Details application facts, action-plan education/province/social assistance, and the one-day plan-start correction; it deliberately leaves barrier to employment, EI claimant category, and previous employment NOC/version for Emilie because those are not safely derivable. Focused Jest suites and production build passed locally. No Shayleen data repair or PROD deploy has been applied.';

START TRANSACTION;

SELECT id, status, summary
FROM admin_feedback_report
WHERE id = @report_id
FOR UPDATE;

UPDATE admin_feedback_report
   SET status = CASE
         WHEN status IN ('resolved', 'closed') THEN status
         ELSE 'in_progress'
       END,
       updated_at = NOW()
 WHERE id = @report_id;

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
  1,
  'Bill Sillery',
  'bill@sillery.co.uk',
  @note_text,
  NOW()
FROM DUAL
WHERE EXISTS (
  SELECT 1
  FROM admin_feedback_report
  WHERE id = @report_id
)
AND NOT EXISTS (
  SELECT 1
  FROM admin_feedback_note
  WHERE report_id = @report_id
    AND note_text = @note_text
);

COMMIT;

SELECT r.id, r.status, r.summary, COUNT(n.id) AS note_count
FROM admin_feedback_report r
LEFT JOIN admin_feedback_note n ON n.report_id = r.id
WHERE r.id = @report_id
GROUP BY r.id, r.status, r.summary;
