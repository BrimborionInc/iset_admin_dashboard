-- Resolve PROD feedback #133 after code and deployed-source verification.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();
SET @previous_status_133 := NULL;

START TRANSACTION;

SELECT status
  INTO @previous_status_133
  FROM admin_feedback_report
 WHERE id = 133
   AND submitted_by_email = 'bill@sillery.co.uk'
   AND summary = 'Regional Snapshots - Export to Excel totals don''t add up.'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @resolved_at
 WHERE id = 133
   AND @previous_status_133 IS NOT NULL
   AND @previous_status_133 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 133, @previous_status_133, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE @previous_status_133 IS NOT NULL
   AND @previous_status_133 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 133
        AND previous_status = @previous_status_133
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 133, NULL, @actor_name, @actor_email,
       'Codex resolution 2026-06-14: Code and deployed-source recheck confirms the Regional Snapshot totals/export issue is fixed. Local source and PROD /opt/nwac/admin-dashboard now separate submitted-in-period application activity from approved-funding funded-client metrics: readRegionalSnapshotLiveMetrics() partitions applications into received, approved/funded applications, denied/ineligible/withdrawn/NC, and pending/no decision; buildRegionalSnapshotPayload() keeps liveMetrics.funded aligned to fundedApplications and exposes funded clients only through fundingMetrics; the dashboard and Excel export label Client Activity as Approved/Funded Applications while Funded Clients appears with Funding. Verification passed: node --check isetadminserver.js; node --check src/pages/reporting/regionalSnapshotExport.js; npm test -- --watchAll=false --runTestsByPath src/pages/reporting/__tests__/regionalSnapshotExport.test.js. PROD deployed-source SSM check on instance i-034c7daa416ec6865 found fundedApplications backend markers and the compiled Approved/Funded Applications / Funded Clients export labels. The fix was already deployed in PROD release 20260605-prod-ilmp-casework-batch; marking resolved after this code-level recheck. No client/case/application rows were mutated.',
       @resolved_at
 WHERE @previous_status_133 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 133
        AND note_text LIKE 'Codex resolution 2026-06-14: Code and deployed-source recheck confirms the Regional Snapshot totals/export issue is fixed%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 133;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 133
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 133
 ORDER BY id DESC
 LIMIT 3;
