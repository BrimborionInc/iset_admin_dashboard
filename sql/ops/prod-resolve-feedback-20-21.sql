-- PROD one-off feedback-log update prepared on 2026-04-14.
-- Purpose: bring admin_feedback_report #20 and #21 up to date after the
-- Regional Manager direct-assignment case-workspace access fix was deployed
-- to PROD in release 20260414-190101.

START TRANSACTION;

SET @actor_name = 'Codex';
SET @actor_email = 'codex@local';

SET @note20_triage = '2026-04-14 Codex triage: confirmed bug. Amanda Curtis (staff_profile 54) is a Regional Manager whose resolved region scope is NB, NL, NS, ON, PE. Case 90 is assigned directly to her but sits in portfolio region AB, and the case-workspace access check was still rejecting directly assigned out-of-region files because it honored only region scope on the /api/cases/:id/workspace family. Suggested fix: allow direct assignment to override regional scope for Regional Manager access on the workspace/action-plan/intervention routes. Recommended next status: planned.';
SET @note21_triage = '2026-04-14 Codex triage: confirmed bug. Amanda Curtis (staff_profile 54) is a Regional Manager whose resolved region scope is NB, NL, NS, ON, PE. Case 50 is assigned directly to her but sits in portfolio region BC, and the case-workspace access check was still rejecting directly assigned out-of-region files because it honored only region scope on the /api/cases/:id/workspace family. Suggested fix: allow direct assignment to override regional scope for Regional Manager access on the workspace/action-plan/intervention routes. Recommended next status: planned.';
SET @note20_final = '2026-04-14 final review update: PROD release 20260414-190101 deployed the Regional Manager case-workspace access fix. The workspace, action-plan, and intervention guards now allow a Regional Manager to open directly assigned files even when the case region is outside the managers resolved region scope. This resolves the failed-to-load-case error reported on /cases/90. Prod smoke checks returned 200 for the admin and portal health endpoints.';
SET @note21_final = '2026-04-14 final review update: PROD release 20260414-190101 deployed the Regional Manager case-workspace access fix. The workspace, action-plan, and intervention guards now allow a Regional Manager to open directly assigned files even when the case region is outside the managers resolved region scope. This resolves the failed-to-load-case error reported on /cases/50. Prod smoke checks returned 200 for the admin and portal health endpoints.';

SELECT id, status, summary, page_path, submitted_by_email, submitted_at
FROM admin_feedback_report
WHERE id IN (20, 21)
FOR UPDATE;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 20, NULL, @actor_name, @actor_email, @note20_triage, NOW()
FROM DUAL
WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 20)
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_note
    WHERE report_id = 20
      AND note_text = @note20_triage
  );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 21, NULL, @actor_name, @actor_email, @note21_triage, NOW()
FROM DUAL
WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 21)
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_note
    WHERE report_id = 21
      AND note_text = @note21_triage
  );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 20, NULL, @actor_name, @actor_email, @note20_final, NOW()
FROM DUAL
WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 20)
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_note
    WHERE report_id = 20
      AND note_text = @note20_final
  );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 21, NULL, @actor_name, @actor_email, @note21_final, NOW()
FROM DUAL
WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 21)
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_note
    WHERE report_id = 21
      AND note_text = @note21_final
  );

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT
  r.id,
  r.status,
  'resolved',
  NULL,
  @actor_name,
  @actor_email,
  NOW()
FROM admin_feedback_report r
WHERE r.id IN (20, 21)
  AND r.status <> 'resolved'
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_status_history h
    WHERE h.report_id = r.id
      AND h.new_status = 'resolved'
      AND h.changed_by_email = @actor_email
  );

UPDATE admin_feedback_report
SET status = 'resolved',
    updated_at = NOW()
WHERE id IN (20, 21)
  AND status <> 'resolved';

SELECT id, status, summary, page_path, updated_at
FROM admin_feedback_report
WHERE id IN (20, 21)
ORDER BY id;

SELECT report_id, new_status, changed_by_name, changed_by_email, changed_at
FROM admin_feedback_status_history
WHERE report_id IN (20, 21)
ORDER BY report_id, changed_at, id;

SELECT report_id, author_name, author_email, note_text, created_at
FROM admin_feedback_note
WHERE report_id IN (20, 21)
ORDER BY report_id, created_at, id;

COMMIT;
