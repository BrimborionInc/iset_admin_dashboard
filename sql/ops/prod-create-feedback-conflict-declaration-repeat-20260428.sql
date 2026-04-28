-- Purpose: create a PROD admin feedback bug report for the anecdotal
-- conflict-of-interest declaration repeat prompt reported by Shelley Stacey.
-- Safe to re-run: reuses the same report if this exact summary/reporter marker
-- was already inserted recently.

START TRANSACTION;

SET @summary := 'Conflict declaration prompt repeated for same file';
SET @reporter_email := 'sstacey@nwac.ca';
SET @reporter_name := 'Shelley Stacey';
SET @actor_name := 'Codex triage on behalf of Bill';
SET @actor_email := NULL;
SET @description := 'Anecdotal PROD report relayed by Bill on 2026-04-27 local time: Shelley Stacey (sstacey@nwac.ca) said she had to click "no conflict" three times for the same file before the application assessment workspace unlocked. Shelley has not submitted an in-app bug report, so evidence is incomplete. Expected behaviour: one successful conflict-of-interest declaration should persist for the signed-in staff member and case, then unlock the assessment screen for that staff profile. Current technical model: the declaration is stored in iset_case_conflict_declaration per case_id + staff_profile_id. Possible causes to investigate once details are available: failed save, row-version or lock conflict, readback under a different or missing staff_profile_id, revoked/reset declaration row, or stale frontend refresh after signing.';
SET @note := 'Created by Codex at Bill''s request from anecdotal PROD report. Needs more information before fixing: exact case/application reference or URL, approximate time(s), whether Shelley saw any error/toast after each click, browser console/network result for PUT /api/cases/:id, whether another user edited or reassigned the file, and whether the same prompt returns after a full browser refresh.';
SET @context := JSON_OBJECT(
  'source', 'codex-prod-triage',
  'reported_by', 'Bill',
  'reported_for_email', @reporter_email,
  'feature', 'Application Workspace conflict-of-interest declaration',
  'needs_more_information', true,
  'created_from_thread', 'privacy ERM cleanup / PROD user issue triage'
);

SET @existing_report_id := NULL;
SELECT @existing_report_id := id
  FROM (
    SELECT id
      FROM admin_feedback_report
     WHERE report_type = 'bug'
       AND summary = @summary
       AND description LIKE CONCAT('%', @reporter_email, '%')
       AND submitted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
     ORDER BY id DESC
     LIMIT 1
  ) existing_report;

INSERT INTO admin_feedback_report
  (report_type, severity, status, summary, description, submitted_by_staff_profile_id, submitted_by_name, submitted_by_email, submitted_by_role, page_title, page_path, page_url, context_json, submitted_at, updated_at)
SELECT
  'bug',
  'medium',
  'triaging',
  @summary,
  @description,
  NULL,
  @reporter_name,
  @reporter_email,
  'NWAC Administrator',
  'Application Workspace',
  '/application-case/:id',
  NULL,
  @context,
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP()
WHERE @existing_report_id IS NULL;

SET @report_id := COALESCE(@existing_report_id, LAST_INSERT_ID());

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT
  @report_id,
  NULL,
  'triaging',
  NULL,
  @actor_name,
  @actor_email,
  UTC_TIMESTAMP()
WHERE @existing_report_id IS NULL;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT
  @report_id,
  NULL,
  @actor_name,
  @actor_email,
  @note,
  UTC_TIMESTAMP()
WHERE NOT EXISTS (
  SELECT 1
    FROM admin_feedback_note
   WHERE report_id = @report_id
     AND note_text = @note
);

COMMIT;

SELECT
  r.id,
  r.report_type,
  r.severity,
  r.status,
  r.summary,
  r.submitted_by_email,
  r.submitted_at,
  (SELECT COUNT(*) FROM admin_feedback_note n WHERE n.report_id = r.id) AS note_count,
  (SELECT COUNT(*) FROM admin_feedback_status_history h WHERE h.report_id = r.id) AS status_history_count
FROM admin_feedback_report r
WHERE r.id = @report_id;
